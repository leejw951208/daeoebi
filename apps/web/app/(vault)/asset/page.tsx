"use client"
// 자산 대시보드(디자인 화면 11). 예산(서버 Income 재사용)·월 지출·고정 템플릿을 불러와
// 머티리얼라이즈한 뒤 VK 로 복호화·집계해 대시보드를 그린다. 상태·로드만 담당하고 본문은 AssetDashboard 가 그린다.
import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
    listIncomes,
    listExpenses,
    listRecurring,
    listAssetCategories,
    listContributions,
    getSavingsGoal,
    type ExpenseView,
    type IncomeView,
    type SavingsGoalView,
} from "@/lib/vault-client"
import { isApiError } from "@/lib/api-error"
import { SkeletonCard } from "@/components/Skeleton"
import { useVault } from "../_lib/vault-context"
import { openExpense, openIncome, openGoal } from "./_lib/asset-payload"
import { migrateExpenseCategories } from "./_lib/asset-migrate-categories"
import {
    byDay,
    totalIncome,
    savingsSummary,
    filterByMonth,
    type ComputedExpense,
    type ComputedIncome,
} from "./_lib/asset-compute"
import { resolveCategory } from "./_lib/asset-categories"
import { materializeRecurring } from "./_lib/asset-recurring"
import {
    addMonth,
    currentMonth,
    monthLabel,
    todayISO,
} from "./_lib/asset-dates"
import {
    AssetDashboard,
    type Loaded,
    type AssetTab,
    type SavingsView,
    type Contribution,
} from "./_components/dashboard/AssetDashboard"
import { BudgetSheet } from "./_components/budget/BudgetSheet"
import { CategoryManager } from "./_components/CategoryManager"
import { SavingsGoalSheet } from "./_components/SavingsGoalSheet"
import { LockTimer } from "../_components/LockTimer"

// 저축 목표(이름 + 복호화된 금액).
interface Goal {
    name: string
    amount: number
}

// 저축·투자 탭 지연 로드 상태. 메인 State 와 동일한 패턴(idle 은 최초 진입 전).
type SavingsState =
    | { status: "idle" }
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "ready"; contribAll: ComputedExpense[]; goal: Goal | null }

// 저축 목표 블롭 복호화. 블롭이 없으면 null, 복호화 실패 시(손상된 블롭) 목표 없음으로 취급한다.
async function resolveGoal(
    vaultKey: CryptoKey,
    view: SavingsGoalView | null,
): Promise<Goal | null> {
    if (!view) return null
    try {
        const { amount } = await openGoal(vaultKey, view)
        return { name: view.name, amount }
    } catch {
        return null
    }
}

type State =
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "ready"; data: Loaded }

// localStorage 래퍼: SSR/서버 환경에서 안전하게 동작한다.
function getMigrationGuard(month: string): boolean {
    if (typeof window === "undefined") return false
    return (
        window.localStorage.getItem(`daeoebi:asset-cat-migrated:${month}`) !==
        null
    )
}

function setMigrationGuard(month: string): void {
    if (typeof window === "undefined") return
    window.localStorage.setItem(`daeoebi:asset-cat-migrated:${month}`, "1")
}

export default function AssetPage() {
    const { vaultKey, resetIdle } = useVault()
    const [month, setMonth] = useState(currentMonth())
    const [state, setState] = useState<State>({ status: "loading" })
    const [selectedDay, setSelectedDay] = useState<string | null>(null)
    const [sheetOpen, setSheetOpen] = useState(false)
    const [categorySheetOpen, setCategorySheetOpen] = useState(false)
    const [assetTab, setAssetTab] = useState<AssetTab>("budget")
    const [savingsState, setSavingsState] = useState<SavingsState>({
        status: "idle",
    })
    const [goalSheetOpen, setGoalSheetOpen] = useState(false)

    const load = useCallback(async () => {
        setState({ status: "loading" })
        try {
            // 지출은 지출일(date) 기준으로 그 달 것만 집계한다. 해당 월 한 달치를 가져온다.
            const [budgetViews, expM, templates, categories] =
                await Promise.all([
                    listIncomes(month),
                    listExpenses(month),
                    listRecurring(),
                    listAssetCategories(),
                ])
            // 기존 지출 카테고리 마이그레이션(이름→categoryId, 월별 1회). 멱등.
            // localStorage 가드로 이미 처리한 달은 건너뛰고, 새로운 달만 실행한다.
            // categoryId 없는 지출이 있고 가드가 없을 때만 실행하며,
            // 처리 건수>0 이면 재조회한다. 루프 방지: 이 load() 호출당 최대 1회만 재조회.
            const hasLegacy = expM.some((e) => e.categoryId === null)
            let freshExpM = expM
            if (hasLegacy && !getMigrationGuard(month)) {
                const { migrated, pendingLegacy } =
                    await migrateExpenseCategories(vaultKey, categories, expM)
                if (migrated > 0) {
                    freshExpM = await listExpenses(month)
                }
                // 매칭 못 한 legacy 이름이 남아 있으면(카테고리 추가 후 재시도 필요)
                // 가드하지 않는다. 진짜 미분류만 남았을 때만 영구 가드한다.
                if (pendingLegacy === 0) {
                    setMigrationGuard(month)
                }
            }

            // 고정 지출 머티리얼라이즈(멱등). 해당 월 분만 생성한다.
            const createdM = await materializeRecurring(
                vaultKey,
                month,
                templates,
                freshExpM,
            )
            const allViews: ExpenseView[] = [...freshExpM, ...createdM]

            // 예산 행 복호화(실패분 스킵) → 합계가 그 달 예산
            const budgetSettled = await Promise.allSettled(
                budgetViews.map(
                    async (v: IncomeView): Promise<ComputedIncome> => {
                        const p = await openIncome(vaultKey, v)
                        return {
                            id: v.id,
                            month: v.month,
                            item: p.item,
                            amount: p.amount,
                            category: p.category,
                        }
                    },
                ),
            )
            const budgetRows = budgetSettled
                .filter(
                    (r): r is PromiseFulfilledResult<ComputedIncome> =>
                        r.status === "fulfilled",
                )
                .map((r) => r.value)
            const budgetAmount = totalIncome(budgetRows)

            // 지출 복호화(실패분 스킵).
            const settled = await Promise.allSettled(
                allViews.map(async (v): Promise<ComputedExpense> => {
                    const p = await openExpense(vaultKey, v)
                    return {
                        id: v.id,
                        date: v.date,
                        recurringId: v.recurringId,
                        item: p.item,
                        amount: p.amount,
                        categoryId: v.categoryId,
                    }
                }),
            )
            const expenses = settled
                .filter(
                    (r): r is PromiseFulfilledResult<ComputedExpense> =>
                        r.status === "fulfilled",
                )
                .map((r) => r.value)

            setState({
                status: "ready",
                data: { budgetAmount, budgetRows, expenses, categories },
            })
        } catch (e) {
            setState({
                status: "error",
                message: isApiError(e) ? e.message : "불러오지 못했습니다.",
            })
        }
    }, [month, vaultKey])

    useEffect(() => {
        void load()
    }, [load])

    // 월이 바뀌면 선택일 초기화(이번 달이면 오늘, 아니면 미선택).
    useEffect(() => {
        const today = todayISO()
        setSelectedDay(today.startsWith(month) ? today : null)
    }, [month])

    const dayTotals = useMemo(
        () =>
            state.status === "ready" ? byDay(state.data.expenses) : new Map(),
        [state],
    )

    // 저축/투자 카테고리 id(이름 기준). 카테고리 목록이 로드된 뒤에만 계산된다.
    const savingsCategoryIds = useMemo(
        () =>
            state.status === "ready"
                ? state.data.categories
                      .filter((c) => c.name === "저축" || c.name === "투자")
                      .map((c) => c.id)
                : [],
        [state],
    )

    // 저축·투자 탭 지연 로드: 전기간 적립(categoryIds 필터) + 저축 목표를 복호화한다.
    const loadSavings = useCallback(
        async (categoryIds: string[]) => {
            setSavingsState({ status: "loading" })
            try {
                const [contribViews, goalView] = await Promise.all([
                    listContributions(categoryIds),
                    getSavingsGoal(),
                ])
                const settled = await Promise.allSettled(
                    contribViews.map(async (v): Promise<ComputedExpense> => {
                        const p = await openExpense(vaultKey, v)
                        return {
                            id: v.id,
                            date: v.date,
                            recurringId: v.recurringId,
                            item: p.item,
                            amount: p.amount,
                            categoryId: v.categoryId,
                        }
                    }),
                )
                const contribAll = settled
                    .filter(
                        (r): r is PromiseFulfilledResult<ComputedExpense> =>
                            r.status === "fulfilled",
                    )
                    .map((r) => r.value)
                const goal = await resolveGoal(vaultKey, goalView)

                setSavingsState({ status: "ready", contribAll, goal })
            } catch (e) {
                setSavingsState({
                    status: "error",
                    message: isApiError(e) ? e.message : "불러오지 못했습니다.",
                })
            }
        },
        [vaultKey],
    )

    // 세그먼트 전환. savings 로 처음 전환할 때만 지연 로드한다.
    const handleAssetTab = useCallback(
        (tab: AssetTab) => {
            resetIdle()
            setAssetTab(tab)
            if (tab === "savings" && savingsState.status === "idle") {
                void loadSavings(savingsCategoryIds)
            }
        },
        [resetIdle, savingsState.status, loadSavings, savingsCategoryIds],
    )

    // 목표 시트 저장 후: 적립 내역은 그대로 두고 목표만 재조회한다(저장은 이미 성공했으므로
    // 재조회 실패는 조용히 무시하고 다음 진입 때 다시 시도한다).
    const reloadGoal = useCallback(async () => {
        try {
            const goalView = await getSavingsGoal()
            const goal = await resolveGoal(vaultKey, goalView)
            setSavingsState((prev) =>
                prev.status === "ready" ? { ...prev, goal } : prev,
            )
        } catch {
            // no-op: 다음 로드에서 재시도됨
        }
    }, [vaultKey])

    // SavingsTab 에 넘길 뷰 모델. 누적 요약은 savingsSummary 전체 기간, 이번 달 적립은 month 로 필터.
    const savingsView: SavingsView = useMemo((): SavingsView => {
        if (savingsState.status !== "ready" || state.status !== "ready") {
            return savingsState.status === "error"
                ? { status: "error", message: savingsState.message }
                : { status: "loading" }
        }
        const { categories } = state.data
        const { contribAll, goal } = savingsState
        const summary = savingsSummary(contribAll, categories)
        const monthContribs = filterByMonth(contribAll, month)
        const monthSummary = savingsSummary(monthContribs, categories)
        const contributions: Contribution[] = monthContribs.map((c) => {
            const { name } = resolveCategory(c.categoryId, categories)
            return {
                id: c.id,
                item: c.item,
                amount: c.amount,
                categoryName: name,
                date: c.date,
            }
        })
        return {
            status: "ready",
            summary,
            savedMonth: monthSummary.savedTotal,
            investMonth: monthSummary.investTotal,
            goalName: goal?.name ?? null,
            goalAmount: goal?.amount ?? 0,
            contributions,
            onEditGoal: () => {
                resetIdle()
                setGoalSheetOpen(true)
            },
        }
    }, [savingsState, state, month, resetIdle])

    const currentGoal =
        savingsState.status === "ready" ? savingsState.goal : null

    return (
        <section style={{ minHeight: "100%" }}>
            <div className="sticky-header">
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                    }}
                >
                    <div>
                        <div
                            style={{
                                fontSize: 21,
                                fontWeight: 800,
                                letterSpacing: "-0.03em",
                            }}
                        >
                            자산
                        </div>
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                fontSize: 12,
                                color: "var(--color-text-muted)",
                                fontWeight: 600,
                            }}
                        >
                            <button
                                type="button"
                                className="btn-text"
                                aria-label="이전 달"
                                onClick={() => setMonth((m) => addMonth(m, -1))}
                            >
                                ‹
                            </button>
                            <span style={{ minWidth: 72, textAlign: "center" }}>
                                {monthLabel(month)}
                            </span>
                            <button
                                type="button"
                                className="btn-text"
                                aria-label="다음 달"
                                onClick={() => setMonth((m) => addMonth(m, 1))}
                            >
                                ›
                            </button>
                        </div>
                    </div>
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                        }}
                    >
                        <button
                            type="button"
                            className="btn-text"
                            style={{ fontSize: 12 }}
                            onClick={() => {
                                resetIdle()
                                setCategorySheetOpen(true)
                            }}
                        >
                            카테고리 관리
                        </button>
                        <LockTimer />
                    </div>
                </div>
            </div>

            {state.status === "loading" && <SkeletonCard lines={4} />}
            {state.status === "error" && (
                <div role="alert" className="error-box">
                    {state.message}
                </div>
            )}

            {state.status === "ready" && (
                <AssetDashboard
                    month={month}
                    data={state.data}
                    dayTotals={dayTotals}
                    selectedDay={selectedDay}
                    onSelectDay={(d) => {
                        resetIdle()
                        setSelectedDay(d)
                    }}
                    onOpenBudget={() => {
                        resetIdle()
                        setSheetOpen(true)
                    }}
                    assetTab={assetTab}
                    onTab={handleAssetTab}
                    savings={savingsView}
                />
            )}

            <Link className="fab" href="/asset/new" aria-label="새 지출 추가">
                <span aria-hidden="true">+</span>
            </Link>

            {sheetOpen && state.status === "ready" && (
                <BudgetSheet
                    month={month}
                    monthLabel={monthLabel(month)}
                    budgetRows={state.data.budgetRows}
                    onChanged={load}
                    onClose={() => setSheetOpen(false)}
                />
            )}

            {categorySheetOpen && (
                <CategoryManager
                    onChanged={load}
                    onClose={() => setCategorySheetOpen(false)}
                />
            )}

            {goalSheetOpen && (
                <SavingsGoalSheet
                    initialName={currentGoal?.name ?? ""}
                    initialAmount={currentGoal?.amount ?? 0}
                    onSaved={reloadGoal}
                    onClose={() => setGoalSheetOpen(false)}
                />
            )}
        </section>
    )
}
