'use client';
// 정기 지출 목록 전용 화면. 상단 toolbar 에 URL 기반 필터(상태/카테고리)와 "추가" 버튼.
// 신규/수정/삭제는 /expenses/new, /expenses/[id] 라우트에서 처리한다.
import { useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { formatCurrency, formatDate } from '@/lib/format';
import type { RecurringExpense } from '@/lib/types';
import { ResponsiveTable, type ResponsiveColumn } from '@/components/ResponsiveTable';
import { DOW_LABELS, RECURRENCE_LABELS } from './expense-form-state';
import {
  STATUS_OPTIONS,
  type StatusFilter,
  filterExpenses,
  parseStatusFilter,
  uniqueCategories
} from './expense-filter';

export function ExpensesView({ initial }: { initial: RecurringExpense[] }) {
  const router = useRouter();
  const search = useSearchParams();
  const status = parseStatusFilter(search.get('status'));
  const category = search.get('category') ?? '';

  const categoryOptions = useMemo(() => uniqueCategories(initial), [initial]);

  const visible = useMemo(
    () => filterExpenses(initial, { status, category }),
    [initial, status, category]
  );

  function updateFilter(next: { status?: StatusFilter; category?: string }) {
    const params = new URLSearchParams(search.toString());
    if (next.status !== undefined) {
      if (next.status === 'all') params.delete('status');
      else params.set('status', next.status);
    }
    if (next.category !== undefined) {
      if (!next.category) params.delete('category');
      else params.set('category', next.category);
    }
    const qs = params.toString();
    router.replace(qs ? `/expenses?${qs}` : '/expenses', { scroll: false });
  }

  const columns: ResponsiveColumn<RecurringExpense>[] = [
    { key: 'name', header: '이름', render: (it) => it.name, primary: true },
    { key: 'category', header: '카테고리', render: (it) => it.category },
    {
      key: 'amount',
      header: '예상',
      align: 'right',
      render: (it) => formatCurrency(it.amount, it.currency)
    },
    { key: 'recurrence', header: '주기', render: (it) => RECURRENCE_LABELS[it.recurrence] ?? '' },
    {
      key: 'day',
      header: '결제일',
      render: (it) =>
        it.recurrence === 'WEEKLY'
          ? DOW_LABELS[it.dayOfWeek ?? 0]
          : it.recurrence === 'YEARLY'
            ? `${it.monthOfYear}월 ${it.dayOfMonth}일`
            : `${it.dayOfMonth}일`
    },
    { key: 'startDate', header: '시작일', render: (it) => formatDate(it.startDate) },
    { key: 'paymentMethod', header: '결제수단', render: (it) => it.paymentMethod ?? '-' },
    {
      key: 'actions',
      header: '액션',
      render: (it) => (
        <Link className="btn secondary" href={`/expenses/${it.id}`} aria-label={`${it.name} 상세`}>
          상세
        </Link>
      )
    }
  ];

  return (
    <section>
      <header className="page-header">
        <h1>정기 지출</h1>
        <Link className="btn" href="/expenses/new">
          + 추가
        </Link>
      </header>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
        <select
          className="field-control"
          value={status}
          onChange={(e) => updateFilter({ status: e.target.value as StatusFilter })}
          aria-label="상태 필터"
          style={{ width: 'auto' }}
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <select
          className="field-control"
          value={category}
          onChange={(e) => updateFilter({ category: e.target.value })}
          aria-label="카테고리 필터"
          style={{ width: 'auto' }}
        >
          <option value="">전체 카테고리</option>
          {categoryOptions.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      <h2 className="section-title">등록된 정기 지출 ({visible.length}건)</h2>
      {visible.length === 0 ? (
        <div className="empty">
          {initial.length === 0 ? '아직 등록된 정기 지출이 없습니다.' : '필터에 해당하는 항목이 없습니다.'}
        </div>
      ) : (
        <ResponsiveTable rows={visible} columns={columns} rowKey={(it) => it.id} />
      )}
    </section>
  );
}
