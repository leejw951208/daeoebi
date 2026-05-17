// 통화·날짜 포맷 헬퍼.
const SEOUL_DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

export function formatCurrency(amount: number, currency: string = 'KRW'): string {
  if (currency === 'KRW') {
    return `₩${amount.toLocaleString('ko-KR')}`;
  }
  return `${amount.toLocaleString('ko-KR')} ${currency}`;
}

export function formatDate(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  const parts = SEOUL_DATE_FORMATTER.formatToParts(date);
  const y = parts.find((part) => part.type === 'year')?.value ?? '0000';
  const m = parts.find((part) => part.type === 'month')?.value ?? '01';
  const d = parts.find((part) => part.type === 'day')?.value ?? '01';
  return `${y}-${m}-${d}`;
}

export function formatDateShort(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  const parts = SEOUL_DATE_FORMATTER.formatToParts(date);
  const m = Number(parts.find((part) => part.type === 'month')?.value ?? 1);
  const d = Number(parts.find((part) => part.type === 'day')?.value ?? 1);
  return `${m}월 ${d}일`;
}

export function todayIso(): string {
  return formatDate(new Date());
}

export function addDaysIso(base: string, days: number): string {
  const [y, m, d] = base.split('-').map(Number);
  const next = new Date(Date.UTC(y!, m! - 1, d! + days));
  return formatDate(next);
}
