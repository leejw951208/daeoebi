// expense-form-state helper 단위 테스트. 폼 ↔ payload 양방향 변환 회귀 방지.
import {
  EMPTY_EXPENSE_FORM,
  expenseFormToPayload,
  expenseToForm,
  formatAmountInput,
  parseAmount
} from './expense-form-state';
import type { RecurringExpense } from '@/lib/types';

function makeExpense(overrides: Partial<RecurringExpense>): RecurringExpense {
  return {
    id: 'id',
    name: '넷플릭스',
    category: '구독',
    amount: 17000,
    currency: 'KRW',
    recurrence: 'MONTHLY',
    dayOfMonth: 5,
    dayOfWeek: null,
    monthOfYear: null,
    startDate: '2026-01-05',
    endDate: null,
    paymentMethod: '신한카드',
    memo: null,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides
  };
}

describe('parseAmount', () => {
  it('숫자 외 문자를 제거하고 number 로 변환한다', () => {
    expect(parseAmount('17,000')).toBe(17000);
    expect(parseAmount('₩ 1,234원')).toBe(1234);
    expect(parseAmount('')).toBe(0);
    expect(parseAmount('abc')).toBe(0);
  });
});

describe('formatAmountInput', () => {
  it('숫자만 추출해 ko-KR 천 단위 구분으로 포매팅한다', () => {
    expect(formatAmountInput('17000')).toBe('17,000');
    expect(formatAmountInput('1,2,3,4')).toBe('1,234');
    expect(formatAmountInput('')).toBe('');
    expect(formatAmountInput('abc')).toBe('');
  });
});

describe('expenseToForm', () => {
  it('MONTHLY 정기 지출을 폼 상태로 변환한다', () => {
    const form = expenseToForm(makeExpense({}));
    expect(form).toMatchObject({
      id: 'id',
      name: '넷플릭스',
      category: '구독',
      amountInput: '17,000',
      recurrence: 'MONTHLY',
      dayOfMonth: '5',
      startDate: '2026-01-05',
      paymentMethod: '신한카드'
    });
  });

  it('endDate 가 null 이면 빈 문자열을 반환한다', () => {
    const form = expenseToForm(makeExpense({ endDate: null }));
    expect(form.endDate).toBe('');
  });
});

describe('expenseFormToPayload', () => {
  it('MONTHLY 폼을 payload 로 변환한다', () => {
    const payload = expenseFormToPayload({
      ...EMPTY_EXPENSE_FORM,
      name: '넷플릭스',
      category: '구독',
      amountInput: '17,000',
      recurrence: 'MONTHLY',
      dayOfMonth: '5',
      startDate: '2026-01-05'
    });
    expect(payload).toEqual({
      name: '넷플릭스',
      category: '구독',
      amount: 17000,
      recurrence: 'MONTHLY',
      dayOfMonth: 5,
      startDate: '2026-01-05'
    });
  });

  it('WEEKLY 는 dayOfMonth 가 아닌 dayOfWeek 를 포함한다', () => {
    const payload = expenseFormToPayload({
      ...EMPTY_EXPENSE_FORM,
      name: 'a',
      category: 'b',
      amountInput: '100',
      recurrence: 'WEEKLY',
      dayOfWeek: '3',
      startDate: '2026-01-01'
    });
    expect(payload.dayOfWeek).toBe(3);
    expect(payload.dayOfMonth).toBeUndefined();
  });

  it('YEARLY 는 monthOfYear 와 dayOfMonth 를 모두 포함한다', () => {
    const payload = expenseFormToPayload({
      ...EMPTY_EXPENSE_FORM,
      name: 'a',
      category: 'b',
      amountInput: '100',
      recurrence: 'YEARLY',
      dayOfMonth: '15',
      monthOfYear: '3',
      startDate: '2026-03-15'
    });
    expect(payload.dayOfMonth).toBe(15);
    expect(payload.monthOfYear).toBe(3);
  });

  it('paymentMethod·memo·endDate 공백은 payload 에서 누락한다', () => {
    const payload = expenseFormToPayload({
      ...EMPTY_EXPENSE_FORM,
      name: 'a',
      category: 'b',
      amountInput: '100',
      startDate: '2026-01-01',
      paymentMethod: '   ',
      memo: '',
      endDate: ''
    });
    expect(payload.paymentMethod).toBeUndefined();
    expect(payload.memo).toBeUndefined();
    expect(payload.endDate).toBeUndefined();
  });

  it('이름·카테고리는 trim 결과를 사용한다', () => {
    const payload = expenseFormToPayload({
      ...EMPTY_EXPENSE_FORM,
      name: '  넷플릭스  ',
      category: ' 구독 ',
      amountInput: '100',
      startDate: '2026-01-01'
    });
    expect(payload.name).toBe('넷플릭스');
    expect(payload.category).toBe('구독');
  });
});
