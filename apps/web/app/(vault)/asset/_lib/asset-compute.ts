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
    // 목록에 없는(삭제됐거나 stale) categoryId 는 미분류로 합쳐 "미분류" 행이 쪼개지지 않게 한다.
    const validIds = new Set(categories.map((c) => c.id))
    const sums = new Map<string, number>()
    for (const e of items) {
        const key =
            e.categoryId && validIds.has(e.categoryId)
                ? e.categoryId
                : UNCATEGORIZED_KEY
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

// 남은 예산 = 예산 − 지출(음수 가능).
export function remaining(budget: number, spent: number): number {
    return budget - spent
}

// 지출 비율(0–100, 클램프). 진행 바 표시용.
export function spentPct(budget: number, spent: number): number {
    if (budget <= 0) return spent > 0 ? 100 : 0
    return Math.min(100, Math.round((spent / budget) * 100))
}

// 복호화된 수입(Income) 1건(메타 + 본문). 예산은 이 모델을 재사용한다(월 1건이 그 달 예산).
export interface ComputedIncome {
    id: string
    month: string // "YYYY-MM"
    item: string
    amount: number
    category: string
}

// 그 달 예산 = Income 행 합계. 옛 다건 데이터(월급·상여)도 합산되어 깨지지 않는다.
export function totalIncome(items: ComputedIncome[]): number {
    return items.reduce((sum, e) => sum + e.amount, 0)
}

// 예산 저장 계획. 행이 없으면 생성, 있으면 첫 행 수정 + 나머지 삭제로 단건에 수렴시킨다.
export type BudgetSavePlan =
    | { kind: "create" }
    | { kind: "replace"; updateId: string; deleteIds: string[] }

export function planBudgetSave(rows: { id: string }[]): BudgetSavePlan {
    if (rows.length === 0) return { kind: "create" }
    return {
        kind: "replace",
        updateId: rows[0].id,
        deleteIds: rows.slice(1).map((r) => r.id),
    }
}

export interface SavingsSummary {
    savedTotal: number
    investTotal: number
    netWorth: number
}

// 저축/투자 카테고리 지출을 이름 기준으로 분리 합산한다. netWorth = 저축+투자.
export function savingsSummary(
    contribs: readonly { categoryId: string | null; amount: number }[],
    categories: readonly { id: string; name: string }[],
): SavingsSummary {
    const nameById = new Map(categories.map((c) => [c.id, c.name]))
    let savedTotal = 0
    let investTotal = 0
    for (const c of contribs) {
        const name = c.categoryId ? nameById.get(c.categoryId) : undefined
        if (name === "저축") savedTotal += c.amount
        else if (name === "투자") investTotal += c.amount
    }
    return { savedTotal, investTotal, netWorth: savedTotal + investTotal }
}

// 저축 목표 진행률(%). 목표 0 이하면 0. 정수·0~100 클램프.
export function goalProgress(savedTotal: number, goalAmount: number): number {
    if (goalAmount <= 0) return 0
    return Math.min(100, Math.round((savedTotal / goalAmount) * 100))
}
