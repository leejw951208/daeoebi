// 자산 대시보드 집계(순수 함수). 복호화된 지출 목록에서 월 합계·카테고리별·일별·남은 돈을 계산한다.
// E2E 라 서버 집계가 불가하므로 클라가 메모리에서 계산한다(월 수십~수백 건 규모).
import type { AssetCategory } from "@/lib/vault-client"
import {
    resolveCategory,
    SAVINGS_CODE,
    INVESTMENT_CODE,
} from "./asset-categories"

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

// 저축/투자 카테고리 지출을 고정 code 기준으로 분리 합산한다. netWorth = 저축+투자.
// 저축·투자는 고정 카테고리라 code(SAVINGS/INVESTMENT)가 불변 앵커다.
export function savingsSummary(
    contribs: readonly { categoryId: string | null; amount: number }[],
    categories: readonly { id: string; code: string | null }[],
): SavingsSummary {
    const codeById = new Map(categories.map((c) => [c.id, c.code]))
    let savedTotal = 0
    let investTotal = 0
    for (const c of contribs) {
        const code = c.categoryId ? codeById.get(c.categoryId) : undefined
        if (code === SAVINGS_CODE) savedTotal += c.amount
        else if (code === INVESTMENT_CODE) investTotal += c.amount
    }
    return { savedTotal, investTotal, netWorth: savedTotal + investTotal }
}

// 저축(SAVINGS) 카테고리 지출을 item(적금 계좌명)별로 합산한다. 고정 카테고리 code 로만 판별한다.
// 넘긴 목록의 기간이 곧 집계 기간이다 — 전체 기간을 넘기면 누적 합계, 한 달치를 넘기면 그 달 합계.
export function savingsByItem(
    expenses: readonly {
        categoryId: string | null
        item: string
        amount: number
    }[],
    categories: readonly { id: string; code: string | null }[],
): Map<string, number> {
    const codeById = new Map(categories.map((c) => [c.id, c.code]))
    const map = new Map<string, number>()
    for (const e of expenses) {
        const code = e.categoryId ? codeById.get(e.categoryId) : undefined
        if (code !== SAVINGS_CODE) continue
        map.set(e.item, (map.get(e.item) ?? 0) + e.amount)
    }
    return map
}

export interface SavingsAccountView {
    name: string
    color: string
    base: number
    goal: number
    month: number
    total: number
    goalPct: number
    remain: number
}

// 적금 계좌별 진행률·합계. goalPct 는 0~100 클램프, remain 은 음수 방지.
// rows 는 total 내림차순 정렬.
//
// total = base + 전체 기간 적립(totalByItem)이다. 보고 있는 달과 무관하게 지난 달 적립분이
// 계속 쌓인다(base 는 앱을 쓰기 전부터 있던 초기 잔액). month 는 이번 달 적립분으로,
// 계좌 카드의 "+₩X" 배지에만 쓴다.
export function savingsAccountsView(
    accounts: readonly {
        name: string
        color: string
        base: number
        goal: number
    }[],
    totalByItem: ReadonlyMap<string, number>,
    monthByItem: ReadonlyMap<string, number>,
): { rows: SavingsAccountView[]; savedTotal: number; savedMonth: number } {
    const rows = accounts
        .map((a) => {
            const month = monthByItem.get(a.name) ?? 0
            const total = a.base + (totalByItem.get(a.name) ?? 0)
            const goalPct =
                a.goal > 0
                    ? Math.min(
                          100,
                          Math.max(0, Math.round((total / a.goal) * 100)),
                      )
                    : 0
            const remain = Math.max(a.goal - total, 0)
            return {
                name: a.name,
                color: a.color,
                base: a.base,
                goal: a.goal,
                month,
                total,
                goalPct,
                remain,
            }
        })
        .sort((a, b) => b.total - a.total)
    const savedTotal = rows.reduce((sum, r) => sum + r.total, 0)
    const savedMonth = rows.reduce((sum, r) => sum + r.month, 0)
    return { rows, savedTotal, savedMonth }
}

export interface InvestmentView {
    principal: number
    rate: number | null
    value: number
    pnl: number
}

// 투자 계좌 평가액·손익. rate 는 유효한 소수 문자열일 때만 채워지고, 그 외(빈 값·공백·숫자 아님)엔 null
// 이어서 평가액은 원금과 같다(수익률 미입력 상태).
// 원금 = base(초기 원금) + contribTotal(전체 기간 투자 적립)이라 지난 달 적립분이 계속 쌓인다.
export function investmentView(
    base: number,
    returnRate: string,
    contribTotal: number,
): InvestmentView {
    const principal = base + contribTotal
    const parsed = parseFloat(returnRate)
    const rate = returnRate.trim() !== "" && !isNaN(parsed) ? parsed : null
    const value =
        rate !== null ? Math.round(principal * (1 + rate / 100)) : principal
    const pnl = value - principal
    return { principal, rate, value, pnl }
}

export interface SavingsBoxBalance {
    balance: number
    inTotal: number
    outTotal: number
    fromSavings: number
}

// 세이빙 박스 잔액. balance = inTotal - outTotal.
// fromSavings 는 저축 계좌에서 박스로 넣은(type="in" && source="savings") 금액만 합산한다.
export function savingsBoxBalance(
    txns: readonly {
        type: "in" | "out"
        source: "cash" | "savings"
        amount: number
    }[],
): SavingsBoxBalance {
    let inTotal = 0
    let outTotal = 0
    let fromSavings = 0
    for (const t of txns) {
        if (t.type === "in") {
            inTotal += t.amount
            if (t.source === "savings") fromSavings += t.amount
        } else {
            outTotal += t.amount
        }
    }
    return { balance: inTotal - outTotal, inTotal, outTotal, fromSavings }
}

// "YYYY-MM" 월에 속하는 항목만 남긴다(평문 date "YYYY-MM-DD" 접두 매칭).
export function filterByMonth<T extends { date: string }>(
    items: readonly T[],
    month: string,
): T[] {
    return items.filter((it) => it.date.startsWith(month))
}
