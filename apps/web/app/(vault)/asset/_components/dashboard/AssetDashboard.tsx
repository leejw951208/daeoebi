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
    type SavingsAccountView,
    type InvestmentView,
} from "../../_lib/asset-compute"
import type { AssetCategory } from "@/lib/vault-client"
import { SkeletonCard } from "@/components/Skeleton"
import { RemainingHero } from "./RemainingHero"
import { BudgetExpenseCards } from "./BudgetExpenseCards"
import { CategoryBreakdown } from "./CategoryBreakdown"
import { ExpenseCalendar } from "./ExpenseCalendar"
import { DayDetail } from "./DayDetail"
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
    categories: AssetCategory[]
}

export type AssetTab = "budget" | "savings"

// 저축·투자 탭 로드 상태. page.tsx 의 지연 로드 결과를 그대로 전달한다(기존 State 패턴과 동일한 모양).
export type SavingsView =
    | { status: "idle" | "loading" }
    | { status: "error"; message: string }
    | {
          status: "ready"
          // 저축·투자 순자산(hero) = 계좌 기반 저축 합계 + 투자 평가금액.
          netWorth: number
          savedTotal: number
          savedMonth: number
          investMonth: number
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
    onTab: (tab: AssetTab) => void
    savings: SavingsView
}

// 세그먼트 트랙 개별 세그먼트 기본 스타일. 활성/비활성만 background·color·box-shadow 로 구분한다.
const SEGMENT_BASE_STYLE = {
    flex: 1,
    textAlign: "center",
    padding: "8px 0",
    border: "none",
    borderRadius: 9,
    font: "inherit",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
} as const

const SEGMENT_ACTIVE_STYLE = {
    background: "#fff",
    color: "#171717",
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
} as const

const SEGMENT_INACTIVE_STYLE = {
    background: "transparent",
    color: "#888",
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
            <div
                style={{
                    display: "flex",
                    gap: 4,
                    padding: 4,
                    background: "var(--soft)",
                    borderRadius: 12,
                }}
            >
                <button
                    type="button"
                    aria-pressed={assetTab === "budget"}
                    style={{
                        ...SEGMENT_BASE_STYLE,
                        ...(assetTab === "budget"
                            ? SEGMENT_ACTIVE_STYLE
                            : SEGMENT_INACTIVE_STYLE),
                    }}
                    onClick={() => onTab("budget")}
                >
                    이번 달
                </button>
                <button
                    type="button"
                    aria-pressed={assetTab === "savings"}
                    style={{
                        ...SEGMENT_BASE_STYLE,
                        ...(assetTab === "savings"
                            ? SEGMENT_ACTIVE_STYLE
                            : SEGMENT_INACTIVE_STYLE),
                    }}
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
                            netWorth={savings.netWorth}
                            savedTotal={savings.savedTotal}
                            savedMonth={savings.savedMonth}
                            investMonth={savings.investMonth}
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
