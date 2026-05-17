'use client';
// unlock 상태에서 노출되는 목록·검색·CRUD·잠금 메인 화면.
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  deleteEntry,
  listEntries,
  type VaultCategory,
  type VaultEntry
} from '@/lib/vault-client';
import { CATEGORY_FIELDS, CATEGORY_LABELS } from './category-schema';
import { CategoryForm } from './CategoryForm';
import { CopyField } from './CopyField';
import { BackupPanel } from './BackupPanel';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { SkeletonCard } from '@/components/Skeleton';

type ListState = 'idle' | 'loading' | 'loaded' | 'error';

interface Props {
  onLock: () => void | Promise<void>;
  onStatusRefresh: () => Promise<void> | void;
  idleSecondsRemaining?: number;
}

export function EntriesScreen({ onLock, onStatusRefresh, idleSecondsRemaining }: Props) {
  const [entries, setEntries] = useState<VaultEntry[]>([]);
  const [state, setState] = useState<ListState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<VaultCategory | 'ALL'>('ALL');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<VaultEntry | null | 'new'>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setState('loading');
    try {
      const params: { category?: VaultCategory; q?: string } = {};
      if (category !== 'ALL') params.category = category;
      if (query.trim()) params.q = query.trim();
      const next = await listEntries(params);
      setEntries(next);
      setState('loaded');
      setError(null);
    } catch (e) {
      const err = e as Error & { code?: string };
      if (err.code === 'VAULT_LOCKED') {
        await onStatusRefresh();
        return;
      }
      setState('error');
      setError(err.message);
    }
  }, [category, query, onStatusRefresh]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function confirmDelete() {
    if (!pendingDeleteId) return;
    const id = pendingDeleteId;
    setPendingDeleteId(null);
    try {
      await deleteEntry(id);
      await reload();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const idleWarning = useMemo(() => {
    if (typeof idleSecondsRemaining !== 'number') return null;
    if (idleSecondsRemaining > 60) return null;
    return `${idleSecondsRemaining}초 후 자동 잠금됩니다.`;
  }, [idleSecondsRemaining]);

  return (
    <section>
      <header style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <h1>비밀번호 보관함</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {typeof idleSecondsRemaining === 'number' && (
            <span className="muted" aria-live="polite">
              잠금까지 {Math.max(0, idleSecondsRemaining)}초
            </span>
          )}
          <button type="button" className="btn" onClick={onLock}>
            잠그기
          </button>
        </div>
      </header>

      {idleWarning && (
        <div role="alert" className="error-box">
          {idleWarning}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
        <select
          className="field-control"
          value={category}
          onChange={(e) => setCategory(e.target.value as VaultCategory | 'ALL')}
          aria-label="카테고리 필터"
          style={{ width: 'auto' }}
        >
          <option value="ALL">전체</option>
          {(Object.keys(CATEGORY_LABELS) as VaultCategory[]).map((cat) => (
            <option key={cat} value={cat}>
              {CATEGORY_LABELS[cat]}
            </option>
          ))}
        </select>
        <input
          className="field-control"
          type="search"
          placeholder="라벨 검색"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ flex: 1, minWidth: 200 }}
          aria-label="라벨 검색"
        />
        <button type="button" className="btn" onClick={() => setEditing('new')}>
          + 항목 추가
        </button>
      </div>

      {error && (
        <div role="alert" className="error-box" style={{ marginTop: 12 }}>
          {error}
        </div>
      )}

      {editing && (
        <div style={{ marginTop: 16 }}>
          <CategoryForm
            entry={editing === 'new' ? null : editing}
            onSuccess={async () => {
              setEditing(null);
              await reload();
            }}
            onCancel={() => setEditing(null)}
          />
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        {state === 'loading' && <SkeletonCard lines={3} />}
        {state === 'loaded' && entries.length === 0 && (
          <div className="empty">
            {query.trim() ? '검색 결과가 없습니다.' : '등록된 항목이 없습니다.'}
          </div>
        )}
        {state === 'loaded' && entries.length > 0 && (
          <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 8 }}>
            {entries.map((entry) => {
              const isOpen = expandedId === entry.id;
              return (
                <li key={entry.id} className="card">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                    <div>
                      <strong>{entry.label}</strong>
                      <span className="muted" style={{ marginLeft: 8 }}>
                        {CATEGORY_LABELS[entry.category]}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        className="btn"
                        aria-expanded={isOpen}
                        onClick={() => setExpandedId(isOpen ? null : entry.id)}
                      >
                        {isOpen ? '닫기' : '상세'}
                      </button>
                      <button type="button" className="btn" onClick={() => setEditing(entry)}>
                        수정
                      </button>
                      <button type="button" className="btn danger" onClick={() => setPendingDeleteId(entry.id)}>
                        삭제
                      </button>
                    </div>
                  </div>
                  {isOpen && (
                    <div style={{ marginTop: 12, display: 'grid', gap: 6 }}>
                      {(CATEGORY_FIELDS[entry.category] ?? []).map((spec) => {
                        const v = (entry.payload?.[spec.name] as string | undefined) ?? '';
                        if (!v) return null;
                        return <CopyField key={spec.name} label={spec.label} value={v} sensitive={spec.sensitive} />;
                      })}
                      {entry.category === 'OTHER' &&
                        Array.isArray(entry.payload?.customFields) &&
                        (entry.payload?.customFields as Array<{ key: string; value: string }>).map((kv, idx) => (
                          <CopyField key={`${kv.key}-${idx}`} label={kv.key} value={kv.value} sensitive />
                        ))}
                      {typeof entry.payload?.memo === 'string' && entry.payload.memo && (
                        <div style={{ marginTop: 8 }}>
                          <div className="muted">메모</div>
                          <div style={{ whiteSpace: 'pre-wrap' }}>{entry.payload.memo}</div>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <BackupPanel onImported={reload} />

      <ConfirmDialog
        open={pendingDeleteId !== null}
        title="항목 삭제"
        message="정말 삭제하시겠습니까?"
        confirmLabel="삭제"
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setPendingDeleteId(null)}
      />
    </section>
  );
}
