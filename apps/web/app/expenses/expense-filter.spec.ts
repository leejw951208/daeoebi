// expense-filter helper 단위 테스트. URL state 파싱·필터링·카테고리 추출 회귀 방지.
import {
  filterExpenses,
  parseStatusFilter,
  uniqueCategories
} from './expense-filter';
import type { RecurringExpense } from '@/lib/types';

function makeExpense(overrides: Partial<RecurringExpense>): RecurringExpense {
  return {
    id: 'id',
    name: 'name',
    category: '구독',
    amount: 1000,
    currency: 'KRW',
    recurrence: 'MONTHLY',
    dayOfMonth: 1,
    dayOfWeek: null,
    monthOfYear: null,
    startDate: '2026-01-01',
    endDate: null,
    paymentMethod: null,
    memo: null,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides
  };
}

describe('parseStatusFilter', () => {
  it('active/inactive 값은 그대로 통과시킨다', () => {
    expect(parseStatusFilter('active')).toBe('active');
    expect(parseStatusFilter('inactive')).toBe('inactive');
  });

  it('null 이거나 알 수 없는 값은 all 로 fallback 한다', () => {
    expect(parseStatusFilter(null)).toBe('all');
    expect(parseStatusFilter('')).toBe('all');
    expect(parseStatusFilter('SCHEDULED')).toBe('all');
    expect(parseStatusFilter('garbage')).toBe('all');
  });
});

describe('filterExpenses', () => {
  const items = [
    makeExpense({ id: 'a', category: '구독', isActive: true }),
    makeExpense({ id: 'b', category: '구독', isActive: false }),
    makeExpense({ id: 'c', category: '관리비', isActive: true })
  ];

  it('all + 빈 카테고리는 전체 목록을 반환한다', () => {
    expect(filterExpenses(items, { status: 'all', category: '' }).map((i) => i.id))
      .toEqual(['a', 'b', 'c']);
  });

  it('active 는 isActive 가 true 인 항목만 남긴다', () => {
    expect(filterExpenses(items, { status: 'active', category: '' }).map((i) => i.id))
      .toEqual(['a', 'c']);
  });

  it('inactive 는 isActive 가 false 인 항목만 남긴다', () => {
    expect(filterExpenses(items, { status: 'inactive', category: '' }).map((i) => i.id))
      .toEqual(['b']);
  });

  it('category 가 지정되면 정확히 일치하는 항목만 남긴다', () => {
    expect(filterExpenses(items, { status: 'all', category: '관리비' }).map((i) => i.id))
      .toEqual(['c']);
  });

  it('status 와 category 가 모두 적용되면 교집합을 반환한다', () => {
    expect(filterExpenses(items, { status: 'active', category: '구독' }).map((i) => i.id))
      .toEqual(['a']);
  });
});

describe('uniqueCategories', () => {
  it('중복 제거 후 한국어 로케일로 정렬한다', () => {
    const items = [
      makeExpense({ id: 'a', category: '구독' }),
      makeExpense({ id: 'b', category: '관리비' }),
      makeExpense({ id: 'c', category: '구독' })
    ];
    expect(uniqueCategories(items)).toEqual(['관리비', '구독']);
  });

  it('빈 카테고리는 제외한다', () => {
    const items = [
      makeExpense({ id: 'a', category: '' }),
      makeExpense({ id: 'b', category: '구독' })
    ];
    expect(uniqueCategories(items)).toEqual(['구독']);
  });
});
