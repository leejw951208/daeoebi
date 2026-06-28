// 자산 대시보드 집계(순수 함수). 복호화된 지출 목록에서 월 합계·카테고리별·일별·남은 돈을 계산한다.
// E2E 라 서버 집계가 불가하므로 클라가 메모리에서 계산한다(월 수십~수백 건 규모).
import { CATEGORIES, categoryColor } from "./asset-categories"

// 복호화된 지출 1건(메타 + 본문).
export interface ComputedExpense {
    id: string
    date: string // "YYYY-MM-DD"
    recurringId: string | null
    item: string
    amount: number
    category: string
    method: string
}

export function totalSpent(items: ComputedExpense[]): number {
    return items.reduce((sum, e) => sum + e.amount, 0)
}

export interface CategoryBreakdown {
    key: string
    color: string
    amount: number
    pct: number // 0–100, 전체 지출 대비 반올림
}

// 카테고리별 합계를 금액 내림차순으로. 지출이 있는 카테고리만 포함한다.
export function byCategory(items: ComputedExpense[]): CategoryBreakdown[] {
    const total = totalSpent(items)
    const sums = new Map<string, number>()
    for (const e of items) {
        sums.set(e.category, (sums.get(e.category) ?? 0) + e.amount)
    }
    // 알려진 카테고리 순서를 기준으로 모으되, 미지의 키도 포함한다.
    const keys = new Set<string>([...CATEGORIES.map((c) => c.key), ...sums.keys()])
    return [...keys]
        .filter((key) => (sums.get(key) ?? 0) > 0)
        .map((key) => {
            const amount = sums.get(key) ?? 0
            return {
                key,
                color: categoryColor(key),
                amount,
                pct: total > 0 ? Math.round((amount / total) * 100) : 0,
            }
        })
        .sort((a, b) => b.amount - a.amount)
}

// 일자("YYYY-MM-DD") → 그 날 지출 합계.
export function byDay(items: ComputedExpense[]): Map<string, number> {
    const map = new Map<string, number>()
    for (const e of items) {
        map.set(e.date, (map.get(e.date) ?? 0) + e.amount)
    }
    return map
}

// 남은 돈 = 수입 − 지출(음수 가능).
export function remaining(income: number, spent: number): number {
    return income - spent
}

// 지출 비율(0–100, 클램프). 진행 바 표시용.
export function spentPct(income: number, spent: number): number {
    if (income <= 0) return spent > 0 ? 100 : 0
    return Math.min(100, Math.round((spent / income) * 100))
}
