"use client"
// 자산 대시보드 본문 조립. 복호화된 월 데이터를 집계해 hero·예산/지출·카테고리별·달력·선택일 상세를 배치한다.
import {
    byCategory,
    remaining,
    spentPct,
    totalSpent,
    type ComputedExpense,
    type ComputedIncome,
} from "../../_lib/asset-compute"
import type { AssetCategory } from "@/lib/vault-client"
import { RemainingHero } from "./RemainingHero"
import { BudgetExpenseCards } from "./BudgetExpenseCards"
import { CategoryBreakdown } from "./CategoryBreakdown"
import { ExpenseCalendar } from "./ExpenseCalendar"
import { DayDetail } from "./DayDetail"

export interface Loaded {
    budgetAmount: number
    budgetRows: ComputedIncome[] // 서버 Income 행. 예산 시트가 단건 수렴에 사용한다.
    expenses: ComputedExpense[]
    categories: AssetCategory[]
}

interface Props {
    month: string
    data: Loaded
    dayTotals: Map<string, number>
    selectedDay: string | null
    onSelectDay: (d: string) => void
    onOpenBudget: () => void
}

export function AssetDashboard({
    month,
    data,
    dayTotals,
    selectedDay,
    onSelectDay,
    onOpenBudget,
}: Props) {
    const spent = totalSpent(data.expenses)
    const left = remaining(data.budgetAmount, spent)
    const pct = spentPct(data.budgetAmount, spent)
    const cats = byCategory(data.expenses, data.categories)
    const dayExpenses = selectedDay
        ? data.expenses
              .filter((e) => e.date === selectedDay)
              .sort((a, b) => b.amount - a.amount)
        : []

    return (
        <div
            className="stagger"
            style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
                paddingTop: 4,
            }}
        >
            <RemainingHero left={left} pct={pct} budget={data.budgetAmount} />
            <BudgetExpenseCards
                budget={data.budgetAmount}
                spent={spent}
                count={data.expenses.length}
                onOpenBudget={onOpenBudget}
            />
            {cats.length > 0 && <CategoryBreakdown cats={cats} />}
            <ExpenseCalendar
                month={month}
                dayTotals={dayTotals}
                selectedDay={selectedDay}
                onSelectDay={onSelectDay}
                count={data.expenses.length}
            />
            {selectedDay && (
                <DayDetail
                    selectedDay={selectedDay}
                    dayExpenses={dayExpenses}
                    categories={data.categories}
                />
            )}
        </div>
    )
}
