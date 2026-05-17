'use client';
// 결제 인스턴스 처리 패널. 완료/스킵/되돌리기를 한곳에서 다룬다.
import { useState } from 'react';
import { updateOccurrence } from '@/lib/api-client';
import { formatCurrency, formatDate } from '@/lib/format';
import type { ExpenseOccurrence } from '@/lib/types';

interface Props {
  occurrence: ExpenseOccurrence;
  onClose: () => void;
  onUpdated: (occurrence: ExpenseOccurrence) => void;
}

export function OccurrencePanel({ occurrence, onClose, onUpdated }: Props) {
  const [actualInput, setActualInput] = useState<string>(
    occurrence.actualAmount !== null ? occurrence.actualAmount.toLocaleString('ko-KR') : ''
  );
  const [memo, setMemo] = useState<string>(occurrence.memo ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parseAmount = (input: string): number | undefined => {
    const digits = input.replace(/[^0-9]/g, '');
    return digits ? Number(digits) : undefined;
  };

  const apply = async (status: 'PAID' | 'SKIPPED' | 'SCHEDULED') => {
    setBusy(true);
    setError(null);
    try {
      const payload: Parameters<typeof updateOccurrence>[1] = { status };
      if (status === 'PAID') {
        payload.actualAmount = parseAmount(actualInput) ?? occurrence.expectedAmount;
      }
      // 빈 메모는 명시적 null로 보내 백엔드에 비우기 의도를 전달한다.
      // 입력값이 기존 메모와 동일하면 굳이 전송하지 않아 다른 필드 갱신 시 기존 값을 보존한다.
      const trimmed = memo.trim();
      const original = (occurrence.memo ?? '').trim();
      if (trimmed !== original) {
        payload.memo = trimmed === '' ? null : trimmed;
      }
      const updated = await updateOccurrence(occurrence.id, payload);
      onUpdated(updated);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const expected = occurrence.expectedAmount;
  const actual = occurrence.actualAmount;
  const diff = actual !== null ? actual - expected : 0;

  return (
    <div className="card inline-bottom-sheet" style={{ marginTop: 16 }}>
      <div className="toolbar" style={{ justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0 }}>{occurrence.expense.name}</h3>
        <button type="button" className="btn secondary" onClick={onClose}>닫기</button>
      </div>
      <div className="muted">{formatDate(occurrence.dueDate)} · {occurrence.expense.category}</div>
      <div style={{ marginTop: 8 }}>
        예상 <span className="amount">{formatCurrency(expected, occurrence.expense.currency)}</span>
        {actual !== null && (
          <>
            {' · 실제 '}
            <span className="amount">{formatCurrency(actual, occurrence.expense.currency)}</span>
            {diff !== 0 && (
              <span className={`diff ${diff > 0 ? 'over' : 'under'}`} style={{ marginLeft: 6 }}>
                ({diff > 0 ? '+' : ''}{diff.toLocaleString('ko-KR')})
              </span>
            )}
          </>
        )}
      </div>

      <div className="form-row" style={{ marginTop: 12 }}>
        <label htmlFor="occurrence-actual">실제 금액</label>
        <input
          id="occurrence-actual"
          type="text"
          inputMode="numeric"
          value={actualInput}
          onChange={(e) => {
            const digits = e.target.value.replace(/[^0-9]/g, '');
            setActualInput(digits ? Number(digits).toLocaleString('ko-KR') : '');
          }}
          placeholder={expected.toLocaleString('ko-KR')}
        />
      </div>
      <div className="form-row">
        <label htmlFor="occurrence-memo">메모</label>
        <input
          id="occurrence-memo"
          type="text"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
        />
      </div>

      {error && <div className="error-box">{error}</div>}

      <div className="toolbar">
        <button type="button" className="btn" disabled={busy} onClick={() => apply('PAID')}>완료</button>
        <button type="button" className="btn secondary" disabled={busy} onClick={() => apply('SKIPPED')}>
          스킵
        </button>
        <button type="button" className="btn secondary" disabled={busy} onClick={() => apply('SCHEDULED')}>
          예정으로 되돌리기
        </button>
        <span className={`status-badge status-${occurrence.status}`} style={{ marginLeft: 'auto' }}>
          현재 상태. {occurrence.status}
        </span>
      </div>
    </div>
  );
}
