// 자산 대시보드 집계(순수 함수). 복호화된 지출 목록에서 월 합계·카테고리별·일별·남은 돈을 계산한다.
// E2E 라 서버 집계가 불가하므로 클라가 메모리에서 계산한다(월 수십~수백 건 규모).
import type { AssetCategory } from "@/lib/vault-client"
import { resolveCategory } from "./asset-categories"

// 복호화된 지출 1건(메타 + 본문).
export interface ComputedExpense {
    id: string
    date: string // 지출일 "YYYY-MM-DD"
    recurringId: string | null
    item: string
    amount: number
    categoryId: string | null
}

export function totalSpent(items: ComputedExpense[]): number {
    return items.reduce((sum, e) => sum + e.amount, 0)
}

export interface CategoryBreakdown {
    key: string
    name: string
    color: string
    amount: number
    pct: number // 0–100, 전체 지출 대비 반올림
}

const UNCATEGORIZED_KEY = "uncategorized"

// 카테고리별 합계를 금액 내림차순으로. 지출이 있는 카테고리만 포함한다.
export function byCategory(
    items: ComputedExpense[],
    categories: AssetCategory[],
): CategoryBreakdown[] {
    const total = totalSpent(items)
    const sums = new Map<string, number>()
    for (const e of items) {
        const key = e.categoryId ?? UNCATEGORIZED_KEY
        sums.set(key, (sums.get(key) ?? 0) + e.amount)
    }
    return [...sums.entries()]
        .filter(([, amount]) => amount > 0)
        .map(([key, amount]) => {
            const { name, color } = resolveCategory(
                key === UNCATEGORIZED_KEY ? null : key,
                categories,
            )
            return {
                key,
                name,
                color,
                amount,
                pct: total > 0 ? Math.round((amount / total) * 100) : 0,
            }
        })
        .sort((a, b) => b.amount - a.amount)
}

// 일자 → 그 날 지출 합계.
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

// 복호화된 수입 1건(메타 + 본문).
export interface ComputedIncome {
    id: string
    month: string // "YYYY-MM"
    item: string
    amount: number
    category: string
}

export function totalIncome(items: ComputedIncome[]): number {
    return items.reduce((sum, e) => sum + e.amount, 0)
}
