'use client';
// 월 단위 캘린더 그리드와 인스턴스 처리 패널.
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ExpenseOccurrence } from '@/lib/types';
import { formatCurrency, formatDate } from '@/lib/format';
import { OccurrencePanel } from '@/components/OccurrencePanel';

const DOW_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

function shiftMonth(monthKey: string, delta: number): string {
  const [yStr, mStr] = monthKey.split('-');
  const date = new Date(Date.UTC(Number(yStr), Number(mStr) - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function buildGrid(monthKey: string): Date[] {
  const [yStr, mStr] = monthKey.split('-');
  const year = Number(yStr);
  const monthIndex = Number(mStr) - 1;
  const firstDay = new Date(Date.UTC(year, monthIndex, 1));
  const startOffset = firstDay.getUTCDay();
  const gridStart = new Date(firstDay.getTime() - startOffset * 24 * 60 * 60 * 1000);
  return Array.from({ length: 42 }, (_, i) =>
    new Date(gridStart.getTime() + i * 24 * 60 * 60 * 1000)
  );
}

export function CalendarView({
  monthKey,
  occurrences
}: {
  monthKey: string;
  occurrences: ExpenseOccurrence[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<ExpenseOccurrence | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<string, ExpenseOccurrence[]>();
    for (const o of occurrences) {
      const key = formatDate(o.dueDate);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(o);
    }
    return map;
  }, [occurrences]);

  const grid = useMemo(() => buildGrid(monthKey), [monthKey]);
  const currentMonth = Number(monthKey.split('-')[1]);

  const refreshAfterUpdate = (updated: ExpenseOccurrence) => {
    setSelected(updated);
    router.refresh();
  };

  return (
    <>
      <div className="toolbar">
        <Link className="btn secondary" href={`/calendar?month=${shiftMonth(monthKey, -1)}`}>
          ← 이전 달
        </Link>
        <strong>{monthKey}</strong>
        <Link className="btn secondary" href={`/calendar?month=${shiftMonth(monthKey, 1)}`}>
          다음 달 →
        </Link>
      </div>

      <div className="calendar">
        {DOW_LABELS.map((d) => (
          <div key={d} className="dow">{d}</div>
        ))}
        {grid.map((date, i) => {
          const dateKey = formatDate(date);
          const isCurrent = date.getUTCMonth() + 1 === currentMonth;
          const items = grouped.get(dateKey) ?? [];
          return (
            <div key={i} className={`cell${isCurrent ? '' : ' muted'}`}>
              <div>{date.getUTCDate()}</div>
              {items.map((occ) => (
                <button
                  key={occ.id}
                  type="button"
                  className={`chip ${
                    occ.status === 'PAID' ? 'paid' : occ.status === 'SKIPPED' ? 'skipped' : ''
                  }`}
                  title={`${occ.expense.name} ${formatCurrency(occ.actualAmount ?? occ.expectedAmount, occ.expense.currency)}`}
                  onClick={() => setSelected(occ)}
                >
                  {occ.expense.name}{' '}
                  {formatCurrency(occ.actualAmount ?? occ.expectedAmount, occ.expense.currency)}
                </button>
              ))}
            </div>
          );
        })}
      </div>

      {selected && (
        <OccurrencePanel
          occurrence={selected}
          onClose={() => setSelected(null)}
          onUpdated={refreshAfterUpdate}
        />
      )}
    </>
  );
}
