'use client';
// vault entries 목록 전용 화면. URL 기반 카테고리·검색 필터 + 카드 클릭 시 /vault/[id] 로 이동한다.
// 신규는 /vault/new, 카테고리 관리는 /vault/categories, 백업·복원은 /vault/backup 라우트에서 처리한다.
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { listEntries, type VaultCategory, type VaultEntry } from '@/lib/vault-client';
import { CATEGORY_LABELS } from './category-schema';
import { SkeletonCard } from '@/components/Skeleton';
import { useVault } from './vault-context';
import { parseCategoryFilter } from './vault-filter';

type ListState = 'idle' | 'loading' | 'loaded' | 'error';

const CATEGORY_VALUES = Object.keys(CATEGORY_LABELS) as VaultCategory[];

export function EntriesScreen() {
  const router = useRouter();
  const search = useSearchParams();
  const { idleSecondsRemaining, onLock, onStatusRefresh } = useVault();

  const category = parseCategoryFilter(search.get('cat'));
  const query = search.get('q') ?? '';

  const [entries, setEntries] = useState<VaultEntry[]>([]);
  const [state, setState] = useState<ListState>('idle');
  const [error, setError] = useState<string | null>(null);

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

  function updateFilter(next: { cat?: VaultCategory | 'ALL'; q?: string }) {
    const params = new URLSearchParams(search.toString());
    if (next.cat !== undefined) {
      if (next.cat === 'ALL') params.delete('cat');
      else params.set('cat', next.cat);
    }
    if (next.q !== undefined) {
      if (!next.q) params.delete('q');
      else params.set('q', next.q);
    }
    const qs = params.toString();
    router.replace(qs ? `/vault?${qs}` : '/vault', { scroll: false });
  }

  const idleWarning = useMemo(() => {
    if (typeof idleSecondsRemaining !== 'number') return null;
    if (idleSecondsRemaining > 60) return null;
    return `${idleSecondsRemaining}초 후 자동 잠금됩니다.`;
  }, [idleSecondsRemaining]);

  return (
    <section>
      <header className="page-header">
        <h1>비밀번호 보관함</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {typeof idleSecondsRemaining === 'number' && (
            <span className="muted" aria-live="polite">
              잠금까지 {Math.max(0, idleSecondsRemaining)}초
            </span>
          )}
          <button type="button" className="btn secondary" onClick={onLock}>
            잠그기
          </button>
        </div>
      </header>

      {idleWarning && (
        <div role="alert" className="error-box">
          {idleWarning}
        </div>
      )}

      <nav aria-label="보관함 관리" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
        <Link className="btn secondary" href="/vault/categories">카테고리</Link>
        <Link className="btn secondary" href="/vault/backup">백업·복원</Link>
        <Link className="btn" href="/vault/new" style={{ marginLeft: 'auto' }}>+ 항목 추가</Link>
      </nav>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
        <select
          className="field-control"
          value={category}
          onChange={(e) => updateFilter({ cat: e.target.value as VaultCategory | 'ALL' })}
          aria-label="카테고리 필터"
          style={{ width: 'auto' }}
        >
          <option value="ALL">전체</option>
          {CATEGORY_VALUES.map((cat) => (
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
          onChange={(e) => updateFilter({ q: e.target.value })}
          style={{ flex: 1, minWidth: 200 }}
          aria-label="라벨 검색"
        />
      </div>

      {error && (
        <div role="alert" className="error-box" style={{ marginTop: 12 }}>
          {error}
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
            {entries.map((entry) => (
              <li key={entry.id}>
                <Link
                  href={`/vault/${entry.id}`}
                  className="card"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    color: 'inherit',
                    textDecoration: 'none'
                  }}
                >
                  <span>
                    <strong>{entry.label}</strong>
                    <span className="muted" style={{ marginLeft: 8 }}>
                      {CATEGORY_LABELS[entry.category]}
                    </span>
                  </span>
                  <span className="muted" aria-hidden="true">›</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
