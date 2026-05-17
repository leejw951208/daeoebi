// 정기 지출 폼 상태와 변환 helper. 신규/수정 라우트가 공유한다.
import { formatDate } from '@/lib/format';
import type { CreateExpenseInput, RecurringExpense } from '@/lib/types';

export const RECURRENCE_LABELS: Record<string, string> = {
  MONTHLY: '매월',
  WEEKLY: '매주',
  YEARLY: '매년'
};

export const DOW_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

export interface ExpenseFormState {
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

export const EMPTY_EXPENSE_FORM: ExpenseFormState = {
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

export function parseAmount(input: string): number {
  const digits = input.replace(/[^0-9]/g, '');
  return digits ? Number(digits) : 0;
}

export function formatAmountInput(input: string): string {
  const digits = input.replace(/[^0-9]/g, '');
  if (!digits) return '';
  return Number(digits).toLocaleString('ko-KR');
}

export function expenseToForm(expense: RecurringExpense): ExpenseFormState {
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

export function expenseFormToPayload(form: ExpenseFormState): CreateExpenseInput {
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
