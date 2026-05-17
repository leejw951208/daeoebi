'use client';
// 모바일 캘린더 대체. 날짜 그룹 헤더 + 세로 리스트로 occurrences 를 표시한다.
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ExpenseOccurrence } from '@/lib/types';
import { formatCurrency, formatDate } from '@/lib/format';
import { OccurrencePanel } from '@/components/OccurrencePanel';

interface Props {
  occurrences: ExpenseOccurrence[];
}

export function AgendaView({ occurrences }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<ExpenseOccurrence | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<string, ExpenseOccurrence[]>();
    for (const o of occurrences) {
      const key = formatDate(o.dueDate);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(o);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [occurrences]);

  if (grouped.length === 0) {
    return <div className="agenda-empty">이번 달 예정된 항목이 없습니다.</div>;
  }

  return (
    <>
      <div className="agenda">
        {grouped.map(([dateKey, items]) => (
          <div key={dateKey} className="agenda-day">
            <div className="agenda-day-header">{dateKey}</div>
            {items.map((occ) => (
              <button
                key={occ.id}
                type="button"
                className="agenda-item"
                onClick={() => setSelected(occ)}
              >
                <span>
                  <strong>{occ.expense.name}</strong>
                  <span className={`status-badge status-${occ.status}`} style={{ marginLeft: 8 }}>
                    {occ.status}
                  </span>
                </span>
                <span className="amount">
                  {formatCurrency(occ.actualAmount ?? occ.expectedAmount, occ.expense.currency)}
                </span>
              </button>
            ))}
          </div>
        ))}
      </div>

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
