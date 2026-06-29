"use client"
// 자산 대시보드 본문 조립. 복호화된 월 데이터를 집계해 hero·수입/지출·카테고리별·달력·선택일 상세를 배치한다.
import {
    byCategory,
    remaining,
    spentPct,
    totalSpent,
    type ComputedExpense,
} from "../../_lib/asset-compute"
import { RemainingHero } from "./RemainingHero"
import { IncomeExpenseCards } from "./IncomeExpenseCards"
import { CategoryBreakdown } from "./CategoryBreakdown"
import { ExpenseCalendar } from "./ExpenseCalendar"
import { DayDetail } from "./DayDetail"

export interface Loaded {
    incomeAmount: number
    expenses: ComputedExpense[]
}

interface Props {
    month: string
    data: Loaded
    dayTotals: Map<string, number>
    selectedDay: string | null
    onSelectDay: (d: string) => void
    onOpenIncome: () => void
}

export function AssetDashboard({
    month,
    data,
    dayTotals,
    selectedDay,
    onSelectDay,
    onOpenIncome,
}: Props) {
    const spent = totalSpent(data.expenses)
    const left = remaining(data.incomeAmount, spent)
    const pct = spentPct(data.incomeAmount, spent)
    const cats = byCategory(data.expenses)
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
            <RemainingHero left={left} pct={pct} income={data.incomeAmount} />
            <IncomeExpenseCards
                income={data.incomeAmount}
                spent={spent}
                count={data.expenses.length}
                onOpenIncome={onOpenIncome}
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
                />
            )}
        </div>
    )
}
