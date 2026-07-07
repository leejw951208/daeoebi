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
    listSavingsAccounts,
    getInvestment,
    listSavingsBox,
    type ExpenseView,
    type IncomeView,
    type SavingsAccountView as SavingsAccountApiView,
    type InvestmentView as InvestmentApiView,
    type SavingsBoxTxnView,
} from "@/lib/vault-client"
import { isApiError } from "@/lib/api-error"
import { SkeletonCard } from "@/components/Skeleton"
import { useVault } from "../_lib/vault-context"
import {
    openExpense,
    openIncome,
    openAccount,
    openInvestment,
    openBoxTxn,
} from "./_lib/asset-payload"
import { migrateExpenseCategories } from "./_lib/asset-migrate-categories"
import {
    byDay,
    totalIncome,
    savingsSummary,
    filterByMonth,
    savingsAccountsView,
    monthSavingsByItem,
    investmentView,
    savingsBoxBalance,
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
import { SavingsAccountAddSheet } from "./_components/SavingsAccountAddSheet"
import {
    SavingsAccountGoalSheet,
    type EditingAccount,
} from "./_components/SavingsAccountGoalSheet"
import { InvestmentReturnSheet } from "./_components/InvestmentReturnSheet"
import { SavingsBoxSheet } from "./_components/SavingsBoxSheet"
import {
    SavingsBoxDetailSheet,
    type BoxTxnRow,
} from "./_components/SavingsBoxDetailSheet"
import { LockTimer } from "../_components/LockTimer"

// 적금 계좌(복호화된 base/goal). name 은 계좌 식별 앵커(생성 시 중복 방지).
interface Account {
    id: string
    name: string
    color: string
    base: number
    goal: number
}

// 투자 포지션(복호화된 base + 평문 returnRate). 없으면 null(투자 원금·수익률 미설정).
interface Investment {
    base: number
    returnRate: string
}

// 저축·투자 탭 지연 로드 상태. 메인 State 와 동일한 패턴(idle 은 최초 진입 전).
type SavingsState =
    | { status: "idle" }
    | { status: "loading" }
    | { status: "error"; message: string }
    | {
          status: "ready"
          contribAll: ComputedExpense[]
          accounts: Account[]
          investment: Investment | null
          boxTxns: BoxTxnRow[]
      }

// 적금 계좌 블롭 복호화(실패분 스킵).
async function resolveAccounts(
    vaultKey: CryptoKey,
    views: SavingsAccountApiView[],
): Promise<Account[]> {
    const settled = await Promise.allSettled(
        views.map(async (v): Promise<Account> => {
            const p = await openAccount(vaultKey, v)
            return {
                id: v.id,
                name: v.name,
                color: v.color,
                base: p.base,
                goal: p.goal,
            }
        }),
    )
    return settled
        .filter(
            (r): r is PromiseFulfilledResult<Account> =>
                r.status === "fulfilled",
        )
        .map((r) => r.value)
}

// 투자 포지션 블롭 복호화. 없으면 null, 복호화 실패 시(손상된 블롭) 미설정으로 취급한다.
async function resolveInvestment(
    vaultKey: CryptoKey,
    view: InvestmentApiView | null,
): Promise<Investment | null> {
    if (!view) return null
    try {
        const { base } = await openInvestment(vaultKey, view)
        return { base, returnRate: view.returnRate }
    } catch {
        return null
    }
}

// 세이빙 박스 거래 블롭 복호화(실패분 스킵). type/source/date 는 서버 평문 메타 그대로 쓴다.
async function resolveBoxTxns(
    vaultKey: CryptoKey,
    views: SavingsBoxTxnView[],
): Promise<BoxTxnRow[]> {
    const settled = await Promise.allSettled(
        views.map(async (v): Promise<BoxTxnRow> => {
            const p = await openBoxTxn(vaultKey, v)
            return {
                id: v.id,
                type: v.type,
                source: v.source,
                date: v.date,
                amount: p.amount,
                memo: p.memo,
            }
        }),
    )
    return settled
        .filter(
            (r): r is PromiseFulfilledResult<BoxTxnRow> =>
                r.status === "fulfilled",
        )
        .map((r) => r.value)
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
    const [returnSheetOpen, setReturnSheetOpen] = useState(false)
    const [boxSheetMode, setBoxSheetMode] = useState<"in" | "out" | null>(null)
    const [boxDetailOpen, setBoxDetailOpen] = useState(false)
    const [addAccountSheetOpen, setAddAccountSheetOpen] = useState(false)
    const [editingAccount, setEditingAccount] = useState<EditingAccount | null>(
        null,
    )

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

    // 저축/투자 카테고리 id(kind 기준). 카테고리 목록이 로드된 뒤에만 계산된다.
    const savingsCategoryIds = useMemo(
        () =>
            state.status === "ready"
                ? state.data.categories
                      .filter(
                          (c) =>
                              c.kind === "SAVINGS" || c.kind === "INVESTMENT",
                      )
                      .map((c) => c.id)
                : [],
        [state],
    )

    // 저축·투자 탭 지연 로드: 전기간 적립(categoryIds 필터) + 저축 목표를 복호화한다.
    const loadSavings = useCallback(
        async (categoryIds: string[]) => {
            setSavingsState({ status: "loading" })
            try {
                const [
                    contribViews,
                    accountViews,
                    investmentApiView,
                    boxViews,
                ] = await Promise.all([
                    listContributions(categoryIds),
                    listSavingsAccounts(),
                    getInvestment(),
                    listSavingsBox(),
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
                const accounts = await resolveAccounts(vaultKey, accountViews)
                const investment = await resolveInvestment(
                    vaultKey,
                    investmentApiView,
                )
                const boxTxns = await resolveBoxTxns(vaultKey, boxViews)

                setSavingsState({
                    status: "ready",
                    contribAll,
                    accounts,
                    investment,
                    boxTxns,
                })
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

    // 계좌 추가/목표 시트 저장·삭제 후: 계좌 목록만 재조회한다(적립 내역·투자는 그대로 둔다).
    const reloadAccounts = useCallback(async () => {
        try {
            const accountViews = await listSavingsAccounts()
            const accounts = await resolveAccounts(vaultKey, accountViews)
            setSavingsState((prev) =>
                prev.status === "ready" ? { ...prev, accounts } : prev,
            )
        } catch {
            // no-op: 다음 로드에서 재시도됨
        }
    }, [vaultKey])

    // 수익률 시트 저장 후: 투자 포지션만 재조회한다(적립 내역·목표·계좌는 그대로 둔다).
    const reloadInvestment = useCallback(async () => {
        try {
            const investmentApiView = await getInvestment()
            const investment = await resolveInvestment(
                vaultKey,
                investmentApiView,
            )
            setSavingsState((prev) =>
                prev.status === "ready" ? { ...prev, investment } : prev,
            )
        } catch {
            // no-op: 다음 로드에서 재시도됨
        }
    }, [vaultKey])

    // 세이빙 박스 입출금/삭제 후: 박스 거래만 재조회한다(적립 내역·목표·계좌·투자는 그대로 둔다).
    const reloadBox = useCallback(async () => {
        try {
            const boxViews = await listSavingsBox()
            const boxTxns = await resolveBoxTxns(vaultKey, boxViews)
            setSavingsState((prev) =>
                prev.status === "ready" ? { ...prev, boxTxns } : prev,
            )
        } catch {
            // no-op: 다음 로드에서 재시도됨
        }
    }, [vaultKey])

    // SavingsTab 에 넘길 뷰 모델. 저축 합계는 계좌 모델(savingsAccountsView) 기준이고,
    // 순자산(netWorth) = 그 저축 합계 + 투자 평가금액이다(지출 파생 누적 합계는 쓰지 않는다).
    // 이번 달 투자 지출(investMonth)만은 여전히 카테고리 지출(kind=INVESTMENT)에서 파생한다.
    const savingsView: SavingsView = useMemo((): SavingsView => {
        if (savingsState.status !== "ready" || state.status !== "ready") {
            return savingsState.status === "error"
                ? { status: "error", message: savingsState.message }
                : { status: "loading" }
        }
        const { categories, expenses } = state.data
        const {
            contribAll,
            accounts,
            investment: investmentState,
            boxTxns,
        } = savingsState
        const boxBalance = savingsBoxBalance(boxTxns)
        const monthContribs = filterByMonth(contribAll, month)
        const monthSummary = savingsSummary(monthContribs, categories)
        const contributions: Contribution[] = monthContribs.map((c) => {
            const { name, color } = resolveCategory(c.categoryId, categories)
            return {
                id: c.id,
                item: c.item,
                amount: c.amount,
                categoryName: name,
                date: c.date,
                color,
                recurring: c.recurringId !== null,
            }
        })
        // expenses 는 이미 이 달(month)로 필터된 지출이라 그대로 넘긴다.
        const monthByItem = monthSavingsByItem(expenses, categories)
        const { rows, savedTotal, savedMonth } = savingsAccountsView(
            accounts,
            monthByItem,
        )
        // investMonth(이번 달 투자 지출)는 투자 원금에 더해진다(저축 계좌의 monthByItem 과 대응되는 값).
        const investment = investmentView(
            investmentState?.base ?? 0,
            investmentState?.returnRate ?? "",
            monthSummary.investTotal,
        )
        return {
            status: "ready",
            netWorth: savedTotal + investment.value,
            savedTotal,
            savedMonth,
            investMonth: monthSummary.investTotal,
            contributions,
            accounts: rows,
            onAddAccount: () => {
                resetIdle()
                setAddAccountSheetOpen(true)
            },
            onEditAccountGoal: (name: string) => {
                resetIdle()
                const raw = accounts.find((a) => a.name === name)
                const row = rows.find((r) => r.name === name)
                if (!raw) return
                setEditingAccount({
                    id: raw.id,
                    name: raw.name,
                    color: raw.color,
                    base: raw.base,
                    goal: raw.goal,
                    month: row?.month ?? 0,
                })
            },
            investment,
            onEditReturn: () => {
                resetIdle()
                setReturnSheetOpen(true)
            },
            box: {
                balance: boxBalance.balance,
                fromSavings: boxBalance.fromSavings,
                count: boxTxns.length,
            },
            onBoxIn: () => {
                resetIdle()
                setBoxSheetMode("in")
            },
            onBoxOut: () => {
                resetIdle()
                setBoxSheetMode("out")
            },
            onBoxDetail: () => {
                resetIdle()
                setBoxDetailOpen(true)
            },
        }
    }, [savingsState, state, month, resetIdle])

    const savingsAccounts =
        savingsState.status === "ready" ? savingsState.accounts : []
    const currentInvestment =
        savingsState.status === "ready" ? savingsState.investment : null
    const boxTxns = savingsState.status === "ready" ? savingsState.boxTxns : []
    // 세이빙 박스 시트에 넘길 "저축 가용 잔액"(박스로 이체된 만큼 이미 뺀 값). savingsView 가
    // ready 일 때만 정확하므로, 그 전엔 0(시트를 열 수 있는 상태 자체가 아니라 문제 없음).
    const displayedSavedTotal =
        savingsView.status === "ready"
            ? Math.max(0, savingsView.savedTotal - savingsView.box.fromSavings)
            : 0

    return (
        <section style={{ minHeight: "100%" }}>
            <div
                className="sticky-header"
                style={{ padding: "30px 18px 12px" }}
            >
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
                            지출
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
                            gap: 8,
                        }}
                    >
                        <button
                            type="button"
                            aria-label="카테고리"
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                height: 38,
                                padding: "0 13px",
                                border: "1px solid #ececec",
                                borderRadius: 999,
                                background: "#fff",
                                font: "inherit",
                                fontSize: 12.5,
                                fontWeight: 700,
                                color: "#444",
                                cursor: "pointer",
                            }}
                            onClick={() => {
                                resetIdle()
                                setCategorySheetOpen(true)
                            }}
                        >
                            <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                            >
                                <path d="M7 7h.01M7 3h5a2 2 0 0 1 1.4.6l7 7a2 2 0 0 1 0 2.8l-5.6 5.6a2 2 0 0 1-2.8 0l-7-7A2 2 0 0 1 3 12V7a4 4 0 0 1 4-4Z" />
                            </svg>
                            카테고리
                        </button>
                        <LockTimer />
                    </div>
                </div>
                {state.status === "ready" && (
                    <div
                        style={{
                            display: "flex",
                            gap: 4,
                            marginTop: 14,
                            padding: 4,
                            background: "var(--soft)",
                            borderRadius: 12,
                        }}
                    >
                        <button
                            type="button"
                            aria-pressed={assetTab === "budget"}
                            style={{
                                flex: 1,
                                height: 34,
                                border: "none",
                                borderRadius: 9,
                                font: "inherit",
                                fontSize: 13,
                                fontWeight: 700,
                                cursor: "pointer",
                                ...(assetTab === "budget"
                                    ? {
                                          background: "#fff",
                                          color: "#171717",
                                          boxShadow:
                                              "0 1px 3px rgba(0,0,0,0.09)",
                                      }
                                    : {
                                          background: "transparent",
                                          color: "#888",
                                      }),
                            }}
                            onClick={() => handleAssetTab("budget")}
                        >
                            이번 달
                        </button>
                        <button
                            type="button"
                            aria-pressed={assetTab === "savings"}
                            style={{
                                flex: 1,
                                height: 34,
                                border: "none",
                                borderRadius: 9,
                                font: "inherit",
                                fontSize: 13,
                                fontWeight: 700,
                                cursor: "pointer",
                                ...(assetTab === "savings"
                                    ? {
                                          background: "#fff",
                                          color: "#171717",
                                          boxShadow:
                                              "0 1px 3px rgba(0,0,0,0.09)",
                                      }
                                    : {
                                          background: "transparent",
                                          color: "#888",
                                      }),
                            }}
                            onClick={() => handleAssetTab("savings")}
                        >
                            저축·투자
                        </button>
                    </div>
                )}
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

            {returnSheetOpen && (
                <InvestmentReturnSheet
                    base={currentInvestment?.base ?? 0}
                    returnRate={currentInvestment?.returnRate ?? ""}
                    onChanged={reloadInvestment}
                    onClose={() => setReturnSheetOpen(false)}
                />
            )}

            {boxSheetMode && (
                <SavingsBoxSheet
                    mode={boxSheetMode}
                    savedAvailable={displayedSavedTotal}
                    date={todayISO()}
                    onSaved={reloadBox}
                    onClose={() => setBoxSheetMode(null)}
                />
            )}

            {boxDetailOpen && (
                <SavingsBoxDetailSheet
                    balance={savingsBoxBalance(boxTxns).balance}
                    txns={boxTxns}
                    onChanged={reloadBox}
                    onClose={() => setBoxDetailOpen(false)}
                />
            )}

            {addAccountSheetOpen && (
                <SavingsAccountAddSheet
                    accountCount={savingsAccounts.length}
                    existingNames={savingsAccounts.map((a) => a.name)}
                    onSaved={reloadAccounts}
                    onClose={() => setAddAccountSheetOpen(false)}
                />
            )}

            {editingAccount && (
                <SavingsAccountGoalSheet
                    account={editingAccount}
                    onChanged={reloadAccounts}
                    onClose={() => setEditingAccount(null)}
                />
            )}
        </section>
    )
}
