'use client';
// 결제 인스턴스 리스트 클라이언트 뷰. 기간·카테고리·결제수단·상태 필터를 URL에 반영한다.
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatCurrency, formatDate } from '@/lib/format';
import type { ExpenseOccurrence, OccurrenceStatus } from '@/lib/types';
import type { ListOccurrencesParams } from '@/lib/api-client';
import { ResponsiveTable, type ResponsiveColumn } from '@/components/ResponsiveTable';
import { OccurrencePanel } from '@/components/OccurrencePanel';

const STATUS_OPTIONS: Array<{ value: '' | OccurrenceStatus; label: string }> = [
  { value: '', label: '전체 상태' },
  { value: 'SCHEDULED', label: '예정' },
  { value: 'PAID', label: '완료' },
  { value: 'SKIPPED', label: '스킵' }
];

interface Props {
  occurrences: ExpenseOccurrence[];
  optionOccurrences: ExpenseOccurrence[];
  filters: Required<Pick<ListOccurrencesParams, 'from' | 'to'>> & ListOccurrencesParams;
}

function unique(values: Array<string | null>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value)))).sort((a, b) =>
    a.localeCompare(b, 'ko-KR')
  );
}

export function OccurrencesView({ occurrences, optionOccurrences, filters }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<ExpenseOccurrence | null>(null);

  const categories = useMemo(
    () => unique(optionOccurrences.map((item) => item.expense.category)),
    [optionOccurrences]
  );
  const paymentMethods = useMemo(
    () => unique(optionOccurrences.map((item) => item.expense.paymentMethod)),
    [optionOccurrences]
  );

  function updateFilter(next: Partial<ListOccurrencesParams>) {
    const merged: ListOccurrencesParams = { ...filters, ...next };
    const params = new URLSearchParams();
    if (merged.from) params.set('from', merged.from);
    if (merged.to) params.set('to', merged.to);
    if (merged.status) params.set('status', merged.status);
    if (merged.category) params.set('category', merged.category);
    if (merged.paymentMethod) params.set('paymentMethod', merged.paymentMethod);
    router.replace(`/occurrences?${params.toString()}`, { scroll: false });
  }

  const columns: ResponsiveColumn<ExpenseOccurrence>[] = [
    {
      key: 'name',
      header: '이름',
      primary: true,
      render: (item) => (
        <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {item.expense.name}
          {!item.expense.isActive && <span className="inactive-badge">보존 이력</span>}
        </span>
      )
    },
    { key: 'dueDate', header: '예정일', render: (item) => formatDate(item.dueDate) },
    { key: 'category', header: '카테고리', render: (item) => item.expense.category },
    { key: 'paymentMethod', header: '결제수단', render: (item) => item.expense.paymentMethod ?? '-' },
    {
      key: 'status',
      header: '상태',
      render: (item) => (
        <span className={`status-badge status-${item.status}`}>
          {item.status}
        </span>
      )
    },
    {
      key: 'amount',
      header: '금액',
      align: 'right',
      render: (item) => {
        const diff = item.actualAmount !== null ? item.actualAmount - item.expectedAmount : 0;
        return (
          <span>
            <span className="amount">
              {formatCurrency(item.actualAmount ?? item.expectedAmount, item.expense.currency)}
            </span>
            {diff !== 0 && (
              <span className={`diff ${diff > 0 ? 'over' : 'under'}`} style={{ marginLeft: 6 }}>
                {diff > 0 ? '+' : ''}{diff.toLocaleString('ko-KR')}
              </span>
            )}
          </span>
        );
      }
    },
    {
      key: 'actions',
      header: '액션',
      render: (item) => (
        <button type="button" className="btn secondary" onClick={() => setSelected(item)}>
          처리
        </button>
      )
    }
  ];

  return (
    <>
      <div className="card">
        <div className="toolbar">
          <label htmlFor="occ-from">
            From{' '}
            <input
              id="occ-from"
              type="date"
              className="field-control"
              value={filters.from}
              onChange={(e) => updateFilter({ from: e.target.value })}
            />
          </label>
          <label htmlFor="occ-to">
            To{' '}
            <input
              id="occ-to"
              type="date"
              className="field-control"
              value={filters.to}
              onChange={(e) => updateFilter({ to: e.target.value })}
            />
          </label>
          <select
            className="field-control compact"
            value={filters.status ?? ''}
            onChange={(e) => updateFilter({ status: e.target.value as OccurrenceStatus | undefined })}
            aria-label="상태 필터"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value || 'all'} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            className="field-control compact"
            value={filters.category ?? ''}
            onChange={(e) => updateFilter({ category: e.target.value || undefined })}
            aria-label="카테고리 필터"
          >
            <option value="">전체 카테고리</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <select
            className="field-control compact"
            value={filters.paymentMethod ?? ''}
            onChange={(e) => updateFilter({ paymentMethod: e.target.value || undefined })}
            aria-label="결제수단 필터"
          >
            <option value="">전체 결제수단</option>
            {paymentMethods.map((paymentMethod) => (
              <option key={paymentMethod} value={paymentMethod}>
                {paymentMethod}
              </option>
            ))}
          </select>
        </div>
      </div>

      <h2 className="section-title">조회 결과 ({occurrences.length}건)</h2>
      {occurrences.length === 0 ? (
        <div className="empty">필터에 해당하는 결제 인스턴스가 없습니다.</div>
      ) : (
        <ResponsiveTable rows={occurrences} columns={columns} rowKey={(item) => item.id} />
      )}

      {selected && (
        <OccurrencePanel
          occurrence={selected}
          onClose={() => setSelected(null)}
          onUpdated={(updated) => {
            setSelected(updated);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
