// 정기 지출 목록의 URL 기반 필터 파싱·변환 helper. UI 와 분리해 단위 테스트에서 직접 호출한다.
import type { RecurringExpense } from '@/lib/types';

export const STATUS_OPTIONS = [
  { value: 'all', label: '전체' },
  { value: 'active', label: '활성' },
  { value: 'inactive', label: '비활성' }
] as const;

export type StatusFilter = (typeof STATUS_OPTIONS)[number]['value'];

export function parseStatusFilter(raw: string | null): StatusFilter {
  if (raw === 'active' || raw === 'inactive') return raw;
  return 'all';
}

export function filterExpenses(
  items: RecurringExpense[],
  options: { status: StatusFilter; category: string }
): RecurringExpense[] {
  return items.filter((it) => {
    if (options.status === 'active' && !it.isActive) return false;
    if (options.status === 'inactive' && it.isActive) return false;
    if (options.category && it.category !== options.category) return false;
    return true;
  });
}

export function uniqueCategories(items: RecurringExpense[]): string[] {
  const unique = new Set<string>();
  for (const it of items) {
    if (it.category) unique.add(it.category);
  }
  return Array.from(unique).sort((a, b) => a.localeCompare(b, 'ko-KR'));
}
