'use client';
// 정기 지출 신규/수정 공용 폼. 라우트 별로 onSubmit, submitLabel, onCancel 만 다르다.
import { useState, type FormEvent } from 'react';
import type { CreateExpenseInput } from '@/lib/types';
import {
  DOW_LABELS,
  EMPTY_EXPENSE_FORM,
  ExpenseFormState,
  expenseFormToPayload,
  formatAmountInput
} from './expense-form-state';

interface Props {
  initial?: ExpenseFormState;
  submitLabel: string;
  onSubmit: (payload: CreateExpenseInput) => Promise<void>;
  onCancel?: () => void;
}

export function ExpenseForm({ initial = EMPTY_EXPENSE_FORM, submitLabel, onSubmit, onCancel }: Props) {
  const [form, setForm] = useState<ExpenseFormState>(initial);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    const payload = expenseFormToPayload(form);
    if (!payload.name || !payload.category || !payload.startDate) {
      setError('이름, 카테고리, 시작일은 필수입니다.');
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(payload);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card">
      {error && <div role="alert" className="error-box">{error}</div>}

      <div className="form-row">
        <label htmlFor="expense-name">이름</label>
        <input
          id="expense-name"
          type="text"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="예. 넷플릭스"
          required
        />
      </div>

      <div className="form-row">
        <label htmlFor="expense-category">카테고리</label>
        <input
          id="expense-category"
          type="text"
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
          placeholder="예. 구독, 관리비, 카드"
          required
        />
      </div>

      <div className="form-row">
        <label htmlFor="expense-amount">예상 금액 (KRW)</label>
        <input
          id="expense-amount"
          type="text"
          inputMode="numeric"
          value={form.amountInput}
          onChange={(e) => setForm({ ...form, amountInput: formatAmountInput(e.target.value) })}
          placeholder="0"
          required
        />
      </div>

      <div className="form-row">
        <label htmlFor="expense-recurrence">반복 주기</label>
        <select
          id="expense-recurrence"
          value={form.recurrence}
          onChange={(e) =>
            setForm({
              ...form,
              recurrence: e.target.value as 'MONTHLY' | 'WEEKLY' | 'YEARLY'
            })
          }
        >
          <option value="MONTHLY">매월</option>
          <option value="WEEKLY">매주</option>
          <option value="YEARLY">매년</option>
        </select>
      </div>

      {(form.recurrence === 'MONTHLY' || form.recurrence === 'YEARLY') && (
        <div className="form-row">
          <label htmlFor="expense-day-of-month">결제일 (일)</label>
          <input
            id="expense-day-of-month"
            type="number"
            min={1}
            max={31}
            value={form.dayOfMonth}
            onChange={(e) => setForm({ ...form, dayOfMonth: e.target.value })}
            required
          />
        </div>
      )}

      {form.recurrence === 'WEEKLY' && (
        <div className="form-row">
          <label htmlFor="expense-day-of-week">요일</label>
          <select
            id="expense-day-of-week"
            value={form.dayOfWeek}
            onChange={(e) => setForm({ ...form, dayOfWeek: e.target.value })}
          >
            {DOW_LABELS.map((d, i) => (
              <option key={i} value={i}>{d}</option>
            ))}
          </select>
        </div>
      )}

      {form.recurrence === 'YEARLY' && (
        <div className="form-row">
          <label htmlFor="expense-month-of-year">월</label>
          <input
            id="expense-month-of-year"
            type="number"
            min={1}
            max={12}
            value={form.monthOfYear}
            onChange={(e) => setForm({ ...form, monthOfYear: e.target.value })}
            required
          />
        </div>
      )}

      <div className="form-row">
        <label htmlFor="expense-start-date">시작일</label>
        <input
          id="expense-start-date"
          type="date"
          value={form.startDate}
          onChange={(e) => setForm({ ...form, startDate: e.target.value })}
          required
        />
      </div>

      <div className="form-row">
        <label htmlFor="expense-end-date">종료일 (선택)</label>
        <input
          id="expense-end-date"
          type="date"
          value={form.endDate}
          onChange={(e) => setForm({ ...form, endDate: e.target.value })}
        />
      </div>

      <div className="form-row">
        <label htmlFor="expense-payment-method">결제 수단</label>
        <input
          id="expense-payment-method"
          type="text"
          value={form.paymentMethod}
          onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
          placeholder="예. 신한카드"
        />
      </div>

      <div className="form-row">
        <label htmlFor="expense-memo">메모</label>
        <input
          id="expense-memo"
          type="text"
          value={form.memo}
          onChange={(e) => setForm({ ...form, memo: e.target.value })}
        />
      </div>

      <div className="toolbar">
        <button type="submit" className="btn" disabled={submitting}>
          {submitting ? '저장 중.' : submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="btn secondary" onClick={onCancel} disabled={submitting}>
            취소
          </button>
        )}
      </div>
    </form>
  );
}
