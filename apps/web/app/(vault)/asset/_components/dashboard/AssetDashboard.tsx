"use client"
// 자산 대시보드 본문 조립. 복호화된 월 데이터를 집계해 hero·예산/지출·카테고리별·달력·선택일 상세를 배치한다.
// 상단 세그먼트(지출/고정 지출/저축·투자)로 예산 본문·RecurringTab·SavingsTab 을 전환한다.
import {
    byCategory,
    remaining,
    spentPct,
    totalSpent,
    type ComputedExpense,
    type ComputedIncome,
    type ComputedRecurring,
    type InvestmentView,
    type SavingsAccountView,
} from "../../_lib/asset-compute"
import type { AssetCategory } from "@/lib/vault-client"
import { SkeletonCard } from "@/components/Skeleton"
import { RemainingHero } from "./RemainingHero"
import { BudgetExpenseCards } from "./BudgetExpenseCards"
import { CategoryBreakdown } from "./CategoryBreakdown"
import { ExpenseCalendar } from "./ExpenseCalendar"
import { DayDetail } from "./DayDetail"
import { RecurringTab } from "./RecurringTab"
import {
    SavingsTab,
    type Contribution,
    type SavingsBoxSummary,
} from "./SavingsTab"

export type { Contribution } from "./SavingsTab"

export interface Loaded {
    budgetAmount: number
    budgetRows: ComputedIncome[] // 서버 Income 행. 예산 시트가 단건 수렴에 사용한다.
    expenses: ComputedExpense[]
    // 활성 고정 지출 템플릿(복호화). 고정 지출 탭이 보고 있는 달 기준으로 걸러 쓴다.
    recurrings: ComputedRecurring[]
    categories: AssetCategory[]
    // 블롭을 읽지 못해 집계에서 빠진 행 수. 0 보다 크면 합계가 실제보다 적다는 뜻이라 화면에 알린다.
    unreadable: number
}

export type AssetTab = "budget" | "recurring" | "savings"

// 저축·투자 탭 로드 상태. page.tsx 의 지연 로드 결과를 그대로 전달한다(기존 State 패턴과 동일한 모양).
export type SavingsView =
    | { status: "idle" | "loading" }
    | { status: "error"; message: string }
    | {
          status: "ready"
          // 저축·투자 순자산(hero) = 저축(쌈짓돈 이체분 차감) + 투자 평가금액 + 쌈짓돈 잔액.
          netWorth: number
          savedTotal: number
          savedContributed: number
          investContributed: number
          contributions: Contribution[]
          accounts: SavingsAccountView[]
          onAddAccount: () => void
          onEditAccountGoal: (name: string) => void
          investment: InvestmentView
          onEditReturn: () => void
          box: SavingsBoxSummary
          onBoxIn: () => void
          onBoxOut: () => void
          onBoxDetail: () => void
      }

interface Props {
    month: string
    data: Loaded
    dayTotals: Map<string, number>
    selectedDay: string | null
    onSelectDay: (d: string) => void
    onOpenBudget: () => void
    assetTab: AssetTab
    savings: SavingsView
}

export function AssetDashboard({
    month,
    data,
    dayTotals,
    selectedDay,
    onSelectDay,
    onOpenBudget,
    assetTab,
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
                // 디자인 본문 컨테이너: 좌우 16px(.container 의 18px 를 -2 로 상쇄), 상단 16px.
                paddingTop: 16,
                marginLeft: -2,
                marginRight: -2,
            }}
        >
            {/* 읽지 못한 행이 있으면 합계가 실제보다 적다. 틀린 금액을 조용히 보여주지 않는다. */}
            {data.unreadable > 0 && (
                <div role="alert" className="error-box">
                    {`${data.unreadable}건을 읽지 못해 합계에서 빠졌습니다. 표시된 금액이 실제보다 적을 수 있습니다.`}
                </div>
            )}

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
                    <CategoryBreakdown cats={cats} />
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

            {assetTab === "recurring" && (
                <RecurringTab
                    month={month}
                    recurrings={data.recurrings}
                    categories={data.categories}
                />
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
                            netWorth={savings.netWorth}
                            savedTotal={savings.savedTotal}
                            savedContributed={savings.savedContributed}
                            investContributed={savings.investContributed}
                            contributions={savings.contributions}
                            accounts={savings.accounts}
                            onAddAccount={savings.onAddAccount}
                            onEditAccountGoal={savings.onEditAccountGoal}
                            investment={savings.investment}
                            onEditReturn={savings.onEditReturn}
                            box={savings.box}
                            onBoxIn={savings.onBoxIn}
                            onBoxOut={savings.onBoxOut}
                            onBoxDetail={savings.onBoxDetail}
                        />
                    )}
                </>
            )}
        </div>
    )
}
