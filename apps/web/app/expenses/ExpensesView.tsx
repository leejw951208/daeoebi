'use client';
// 정기 지출 마스터 목록과 신규/수정 폼을 한 화면에서 다룬다.
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  createExpense,
  deleteExpense,
  updateExpense
} from '@/lib/api-client';
import { formatCurrency, formatDate } from '@/lib/format';
import type { CreateExpenseInput, RecurringExpense } from '@/lib/types';
import { ResponsiveTable, type ResponsiveColumn } from '@/components/ResponsiveTable';
import { ConfirmDialog } from '@/components/ConfirmDialog';

const RECURRENCE_LABELS: Record<string, string> = {
  MONTHLY: '매월',
  WEEKLY: '매주',
  YEARLY: '매년'
};

const DOW_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

interface FormState {
  id?: string;
  name: string;
  category: string;
  amountInput: string;
  recurrence: 'MONTHLY' | 'WEEKLY' | 'YEARLY';
  dayOfMonth: string;
  dayOfWeek: string;
  monthOfYear: string;
  startDate: string;
  endDate: string;
  paymentMethod: string;
  memo: string;
}

const EMPTY_FORM: FormState = {
  name: '',
  category: '',
  amountInput: '',
  recurrence: 'MONTHLY',
  dayOfMonth: '1',
  dayOfWeek: '1',
  monthOfYear: '1',
  startDate: '',
  endDate: '',
  paymentMethod: '',
  memo: ''
};

function parseAmount(input: string): number {
  const digits = input.replace(/[^0-9]/g, '');
  return digits ? Number(digits) : 0;
}

function formatAmountInput(input: string): string {
  const digits = input.replace(/[^0-9]/g, '');
  if (!digits) return '';
  return Number(digits).toLocaleString('ko-KR');
}

function toForm(expense: RecurringExpense): FormState {
  return {
    id: expense.id,
    name: expense.name,
    category: expense.category,
    amountInput: expense.amount.toLocaleString('ko-KR'),
    recurrence: expense.recurrence,
    dayOfMonth: String(expense.dayOfMonth ?? 1),
    dayOfWeek: String(expense.dayOfWeek ?? 1),
    monthOfYear: String(expense.monthOfYear ?? 1),
    startDate: formatDate(expense.startDate),
    endDate: expense.endDate ? formatDate(expense.endDate) : '',
    paymentMethod: expense.paymentMethod ?? '',
    memo: expense.memo ?? ''
  };
}

function toPayload(form: FormState): CreateExpenseInput {
  const payload: CreateExpenseInput = {
    name: form.name.trim(),
    category: form.category.trim(),
    amount: parseAmount(form.amountInput),
    recurrence: form.recurrence,
    startDate: form.startDate
  };
  if (form.recurrence === 'MONTHLY' || form.recurrence === 'YEARLY') {
    payload.dayOfMonth = Number(form.dayOfMonth);
  }
  if (form.recurrence === 'WEEKLY') {
    payload.dayOfWeek = Number(form.dayOfWeek);
  }
  if (form.recurrence === 'YEARLY') {
    payload.monthOfYear = Number(form.monthOfYear);
  }
  if (form.endDate) payload.endDate = form.endDate;
  if (form.paymentMethod.trim()) payload.paymentMethod = form.paymentMethod.trim();
  if (form.memo.trim()) payload.memo = form.memo.trim();
  return payload;
}

export function ExpensesView({ initial }: { initial: RecurringExpense[] }) {
  const router = useRouter();
  const [items, setItems] = useState<RecurringExpense[]>(initial);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const isEditing = Boolean(form.id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const payload = toPayload(form);
      if (!payload.name || !payload.category || !payload.startDate) {
        setError('이름, 카테고리, 시작일은 필수입니다.');
        return;
      }
      if (form.id) {
        const updated = await updateExpense(form.id, payload);
        setItems((prev) => prev.map((it) => (it.id === updated.id ? updated : it)));
      } else {
        const created = await createExpense(payload);
        setItems((prev) => [created, ...prev]);
      }
      setForm(EMPTY_FORM);
      startTransition(() => router.refresh());
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDeleteId) return;
    setError(null);
    const id = pendingDeleteId;
    setPendingDeleteId(null);
    try {
      await deleteExpense(id);
      setItems((prev) => prev.filter((it) => it.id !== id));
      startTransition(() => router.refresh());
    } catch (err) {
      setError((err as Error).message);
    }
  };

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
        <span style={{ display: 'inline-flex', gap: 6 }}>
          <button type="button" className="btn secondary" onClick={() => setForm(toForm(it))}>
            수정
          </button>
          <button type="button" className="btn danger" onClick={() => setPendingDeleteId(it.id)}>
            삭제
          </button>
        </span>
      )
    }
  ];

  return (
    <section>
      <h1>정기 지출</h1>

      {error && <div className="error-box">{error}</div>}

      <div className="card" style={{ marginBottom: 24 }}>
        <h2 style={{ marginTop: 0 }}>{isEditing ? '정기 지출 수정' : '새 정기 지출'}</h2>
        <form onSubmit={handleSubmit}>
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
            <button className="btn" disabled={pending} type="submit">
              {isEditing ? '수정' : '추가'}
            </button>
            {isEditing && (
              <button
                className="btn secondary"
                type="button"
                onClick={() => setForm(EMPTY_FORM)}
              >
                취소
              </button>
            )}
          </div>
        </form>
      </div>

      <h2 className="section-title">등록된 정기 지출</h2>
      {items.length === 0 ? (
        <div className="empty">아직 등록된 정기 지출이 없습니다.</div>
      ) : (
        <ResponsiveTable rows={items} columns={columns} rowKey={(it) => it.id} />
      )}

      <ConfirmDialog
        open={pendingDeleteId !== null}
        title="정기 지출 삭제"
        message="이 정기 지출을 삭제할까요? 미래 SCHEDULED 인스턴스가 제거됩니다."
        confirmLabel="삭제"
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setPendingDeleteId(null)}
      />
    </section>
  );
}
