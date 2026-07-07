"use client"
// 자산 대시보드 본문 조립. 복호화된 월 데이터를 집계해 hero·예산/지출·카테고리별·달력·선택일 상세를 배치한다.
// 상단 세그먼트(이번 달/저축·투자)로 기존 예산 본문과 SavingsTab 을 전환한다.
import {
    byCategory,
    remaining,
    spentPct,
    totalSpent,
    type ComputedExpense,
    type ComputedIncome,
    type SavingsSummary,
    type SavingsAccountView,
} from "../../_lib/asset-compute"
import type { AssetCategory } from "@/lib/vault-client"
import { SkeletonCard } from "@/components/Skeleton"
import { RemainingHero } from "./RemainingHero"
import { BudgetExpenseCards } from "./BudgetExpenseCards"
import { CategoryBreakdown } from "./CategoryBreakdown"
import { ExpenseCalendar } from "./ExpenseCalendar"
import { DayDetail } from "./DayDetail"
import { SavingsTab, type Contribution } from "./SavingsTab"

export type { Contribution } from "./SavingsTab"

export interface Loaded {
    budgetAmount: number
    budgetRows: ComputedIncome[] // 서버 Income 행. 예산 시트가 단건 수렴에 사용한다.
    expenses: ComputedExpense[]
    categories: AssetCategory[]
}

export type AssetTab = "budget" | "savings"

// 저축·투자 탭 로드 상태. page.tsx 의 지연 로드 결과를 그대로 전달한다(기존 State 패턴과 동일한 모양).
export type SavingsView =
    | { status: "idle" | "loading" }
    | { status: "error"; message: string }
    | {
          status: "ready"
          summary: SavingsSummary
          savedMonth: number
          investMonth: number
          goalName: string | null
          goalAmount: number
          contributions: Contribution[]
          onEditGoal: () => void
          accounts: SavingsAccountView[]
          onAddAccount: () => void
          onEditAccountGoal: (name: string) => void
      }

interface Props {
    month: string
    data: Loaded
    dayTotals: Map<string, number>
    selectedDay: string | null
    onSelectDay: (d: string) => void
    onOpenBudget: () => void
    assetTab: AssetTab
    onTab: (tab: AssetTab) => void
    savings: SavingsView
}

// 상단 세그먼트 토글의 활성 chip 스타일(카테고리 칩 선택 스타일과 동일하게 재사용).
const ACTIVE_CHIP_STYLE = {
    borderColor: "var(--ac)",
    background: "var(--soft)",
    color: "#222",
} as const

export function AssetDashboard({
    month,
    data,
    dayTotals,
    selectedDay,
    onSelectDay,
    onOpenBudget,
    assetTab,
    onTab,
    savings,
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
            <div style={{ display: "flex", gap: 8 }}>
                <button
                    type="button"
                    aria-pressed={assetTab === "budget"}
                    className="chip"
                    style={
                        assetTab === "budget" ? ACTIVE_CHIP_STYLE : undefined
                    }
                    onClick={() => onTab("budget")}
                >
                    이번 달
                </button>
                <button
                    type="button"
                    aria-pressed={assetTab === "savings"}
                    className="chip"
                    style={
                        assetTab === "savings" ? ACTIVE_CHIP_STYLE : undefined
                    }
                    onClick={() => onTab("savings")}
                >
                    저축·투자
                </button>
            </div>

            {assetTab === "budget" && (
                <>
                    <RemainingHero
                        left={left}
                        pct={pct}
                        budget={data.budgetAmount}
                    />
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
                </>
            )}

            {assetTab === "savings" && (
                <>
                    {(savings.status === "idle" ||
                        savings.status === "loading") && (
                        <SkeletonCard lines={4} />
                    )}
                    {savings.status === "error" && (
                        <div role="alert" className="error-box">
                            {savings.message}
                        </div>
                    )}
                    {savings.status === "ready" && (
                        <SavingsTab
                            summary={savings.summary}
                            savedMonth={savings.savedMonth}
                            investMonth={savings.investMonth}
                            goalName={savings.goalName}
                            goalAmount={savings.goalAmount}
                            contributions={savings.contributions}
                            onEditGoal={savings.onEditGoal}
                            accounts={savings.accounts}
                            onAddAccount={savings.onAddAccount}
                            onEditAccountGoal={savings.onEditAccountGoal}
                        />
                    )}
                </>
            )}
        </div>
    )
}
