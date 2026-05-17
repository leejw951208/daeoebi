'use client';
// vault entry 상세 라우트. 라벨·메타 / 민감 필드 / 액션 3섹션. view ↔ edit 같은 라우트 안 토글.
import { useCallback, useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  deleteEntry,
  getEntry,
  type VaultEntry
} from '@/lib/vault-client';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { SkeletonCard } from '@/components/Skeleton';
import { CATEGORY_FIELDS, CATEGORY_LABELS } from '../category-schema';
import { CopyField } from '../CopyField';
import { CategoryForm } from '../CategoryForm';
import { useVault } from '../vault-context';

type LoadState = 'idle' | 'loading' | 'loaded' | 'missing' | 'error';

export default function VaultEntryDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();
  const { onStatusRefresh } = useVault();
  const [entry, setEntry] = useState<VaultEntry | null>(null);
  const [state, setState] = useState<LoadState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [, startTransition] = useTransition();

  const reload = useCallback(async () => {
    if (!id) return;
    setState('loading');
    try {
      const found = await getEntry(id);
      setEntry(found);
      setState('loaded');
      setError(null);
    } catch (e) {
      const err = e as Error & { code?: string; status?: number };
      if (err.code === 'VAULT_LOCKED') {
        await onStatusRefresh();
        return;
      }
      if (err.status === 404) {
        setState('missing');
        return;
      }
      setState('error');
      setError(err.message);
    }
  }, [id, onStatusRefresh]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function handleDelete() {
    if (!entry) return;
    setConfirmDelete(false);
    setError(null);
    try {
      await deleteEntry(entry.id);
      router.push('/vault');
      startTransition(() => router.refresh());
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (state === 'loading' || state === 'idle') {
    return (
      <section>
        <h1>항목 상세</h1>
        <SkeletonCard lines={3} />
      </section>
    );
  }

  if (state === 'missing') {
    return (
      <section>
        <header className="page-header">
          <h1>항목을 찾을 수 없습니다</h1>
          <Link className="btn secondary" href="/vault">← 목록</Link>
        </header>
        <div className="empty">요청한 항목이 존재하지 않거나 삭제되었습니다.</div>
      </section>
    );
  }

  if (state === 'error' || !entry) {
    return (
      <section>
        <header className="page-header">
          <h1>오류</h1>
          <Link className="btn secondary" href="/vault">← 목록</Link>
        </header>
        <div role="alert" className="error-box">{error}</div>
      </section>
    );
  }

  return (
    <section>
      <header className="page-header">
        <h1>{entry.label}</h1>
        <Link className="btn secondary" href="/vault">← 목록</Link>
      </header>

      {error && <div role="alert" className="error-box">{error}</div>}

      {mode === 'view' ? (
        <>
          <section className="card" style={{ marginTop: 16 }}>
            <h2 className="section-title" style={{ marginTop: 0 }}>라벨·메타</h2>
            <dl style={{ display: 'grid', gap: 8, margin: 0 }}>
              <DetailRow label="라벨" value={entry.label} />
              <DetailRow label="카테고리" value={CATEGORY_LABELS[entry.category]} />
              <DetailRow label="생성" value={new Date(entry.createdAt).toLocaleString('ko-KR')} />
              <DetailRow label="수정" value={new Date(entry.updatedAt).toLocaleString('ko-KR')} />
            </dl>
          </section>

          <section className="card" style={{ marginTop: 16 }}>
            <h2 className="section-title" style={{ marginTop: 0 }}>민감 필드</h2>
            <div style={{ display: 'grid', gap: 8 }}>
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
          </section>

          <section className="card" style={{ marginTop: 16 }}>
            <h2 className="section-title" style={{ marginTop: 0 }}>액션</h2>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="btn" onClick={() => setMode('edit')}>
                수정
              </button>
              <button type="button" className="btn danger" onClick={() => setConfirmDelete(true)}>
                삭제
              </button>
            </div>
          </section>
        </>
      ) : (
        <div style={{ marginTop: 16 }}>
          <CategoryForm
            entry={entry}
            onSuccess={async () => {
              setMode('view');
              await reload();
            }}
            onCancel={() => setMode('view')}
          />
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="항목 삭제"
        message="정말 삭제하시겠습니까?"
        confirmLabel="삭제"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </section>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
      <dt className="muted" style={{ minWidth: 96 }}>{label}</dt>
      <dd style={{ margin: 0, fontWeight: 500, wordBreak: 'break-word' }}>{value}</dd>
    </div>
  );
}
