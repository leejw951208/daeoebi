// 자산 대시보드 날짜·달력 헬퍼(순수). 월 키는 "YYYY-MM", 일자는 "YYYY-MM-DD".
export const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const

function pad2(n: number): string {
    return String(n).padStart(2, "0")
}

// 로컬 기준 "YYYY-MM-DD".
export function toISODate(d: Date): string {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

export function todayISO(): string {
    return toISODate(new Date())
}

export function monthOf(isoDate: string): string {
    return isoDate.slice(0, 7)
}

export function currentMonth(): string {
    return monthOf(todayISO())
}

// "YYYY-MM" + delta(개월) → "YYYY-MM".
export function addMonth(month: string, delta: number): string {
    const [y, m] = month.split("-").map(Number)
    const base = new Date(y, m - 1 + delta, 1)
    return `${base.getFullYear()}-${pad2(base.getMonth() + 1)}`
}

// "2026년 6월".
export function monthLabel(month: string): string {
    const [y, m] = month.split("-").map(Number)
    return `${y}년 ${m}월`
}

export function daysInMonth(month: string): number {
    const [y, m] = month.split("-").map(Number)
    return new Date(y, m, 0).getDate()
}

// dayOfMonth 를 해당 월 말일로 클램프한 "YYYY-MM-DD"(고정 지출 인스턴스 날짜).
export function clampedDate(month: string, dayOfMonth: number): string {
    const day = Math.min(Math.max(1, dayOfMonth), daysInMonth(month))
    return `${month}-${pad2(day)}`
}

// 결제일. deferred(카드)면 구매일의 다음 달 같은 일(말일 클램프), 그 외 구매일 그대로.
export function billingDate(dateISO: string, deferred: boolean): string {
    if (!deferred) return dateISO
    const day = Number(dateISO.slice(8, 10))
    return clampedDate(addMonth(monthOf(dateISO), 1), day)
}

export interface CalendarCell {
    day: number | null // null = 앞 빈칸
    date: string | null // "YYYY-MM-DD"
}

// 일요일 시작 그리드. 첫 주 앞 빈칸 + 날짜 셀.
export function buildCalendar(month: string): CalendarCell[] {
    const [y, m] = month.split("-").map(Number)
    const firstWeekday = new Date(y, m - 1, 1).getDay() // 0=일
    const total = daysInMonth(month)
    const cells: CalendarCell[] = []
    for (let i = 0; i < firstWeekday; i += 1)
        cells.push({ day: null, date: null })
    for (let d = 1; d <= total; d += 1) {
        cells.push({ day: d, date: `${month}-${pad2(d)}` })
    }
    return cells
}
