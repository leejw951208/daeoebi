"use client"
// 자산 대시보드(디자인 화면 11). 예산(서버 Income 재사용)·월 지출·고정 템플릿을 불러와
// 머티리얼라이즈한 뒤 VK 로 복호화·집계해 대시보드를 그린다. 상태·로드만 담당하고 본문은 AssetDashboard 가 그린다.
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type CSSProperties,
    type PointerEvent,
} from "react"
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
    type RecurringView,
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
    savingsAccountsView,
    savingsByItem,
    investmentView,
    savingsBoxBalance,
    sortContributionsByDateDesc,
    type ComputedExpense,
    type ComputedIncome,
    type ComputedRecurring,
} from "./_lib/asset-compute"
import {
    resolveCategory,
    SAVINGS_CODE,
    INVESTMENT_CODE,
} from "./_lib/asset-categories"
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

// 고정 지출 템플릿 블롭 복호화(실패분 스킵). dayOfMonth·termMonths·categoryId 는 서버 평문 메타다.
async function resolveRecurrings(
    vaultKey: CryptoKey,
    views: RecurringView[],
): Promise<ComputedRecurring[]> {
    const settled = await Promise.allSettled(
        views.map(async (v): Promise<ComputedRecurring> => {
            const p = await openExpense(vaultKey, v)
            return {
                id: v.id,
                item: p.item,
                amount: p.amount,
                dayOfMonth: v.dayOfMonth,
                startMonth: v.startMonth,
                termMonths: v.termMonths,
                categoryId: v.categoryId,
            }
        }),
    )
    return settled
        .filter(
            (r): r is PromiseFulfilledResult<ComputedRecurring> =>
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

// 쌈짓돈 거래 블롭 복호화(실패분 스킵). type/source/date 는 서버 평문 메타 그대로 쓴다.
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

// 상단 세그먼트 탭. 순서가 곧 화면 순서다.
const ASSET_TABS: { key: AssetTab; label: string }[] = [
    { key: "budget", label: "지출" },
    { key: "recurring", label: "고정 지출" },
    { key: "savings", label: "저축·투자" },
]

// 세그먼트 버튼 스타일. 선택된 것만 흰 배경 + 그림자로 띄운다.
function segmentStyle(selected: boolean): CSSProperties {
    return {
        flex: 1,
        height: 34,
        border: "none",
        borderRadius: 9,
        font: "inherit",
        fontSize: 13,
        fontWeight: 700,
        cursor: "pointer",
        transition: "transform .12s",
        ...(selected
            ? {
                  background: "#fff",
                  color: "#171717",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.09)",
              }
            : { background: "transparent", color: "#9a9a9a" }),
    }
}

// 누름(active) 시 축소 스케일. 디자인 style-active 를 인라인 포인터 이벤트로 재현한다.
function pressScale(scale: number) {
    const reset = (e: PointerEvent<HTMLElement>) => {
        e.currentTarget.style.transform = ""
    }
    return {
        onPointerDown: (e: PointerEvent<HTMLElement>) => {
            e.currentTarget.style.transform = `scale(${scale})`
        },
        onPointerUp: reset,
        onPointerLeave: reset,
        onPointerCancel: reset,
    }
}

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
    // 월을 빠르게 넘기면 이전 달 응답이 늦게 도착해 최신 화면을 덮어쓴다.
    // 로드마다 번호를 매겨, 가장 마지막에 시작한 로드의 결과만 반영한다.
    const loadSeq = useRef(0)

    const load = useCallback(async () => {
        const seq = loadSeq.current + 1
        loadSeq.current = seq
        const isStale = () => loadSeq.current !== seq
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

            // 월을 넘기는 중이면 여기서 멈춘다. 스쳐 지나간 달에 인스턴스를 쓰지 않는다.
            if (isStale()) return

            // 고정 지출 머티리얼라이즈(멱등). 해당 월 분만, 현재 달까지만 생성한다.
            const createdM = await materializeRecurring(
                vaultKey,
                month,
                templates,
                freshExpM,
                currentMonth(),
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

            // 고정 지출 탭용 템플릿 복호화(실패분 스킵). 위에서 이미 받아둔 templates 를 재사용한다.
            const recurrings = await resolveRecurrings(vaultKey, templates)

            // 읽지 못한 행은 합계에서 조용히 빠진다. 틀린 금액을 아무 표시 없이 보여주지 않도록 건수를 넘긴다.
            const unreadable =
                budgetSettled.length -
                budgetRows.length +
                (settled.length - expenses.length) +
                (templates.length - recurrings.length)

            if (isStale()) return
            setState({
                status: "ready",
                data: {
                    budgetAmount,
                    budgetRows,
                    expenses,
                    recurrings,
                    categories,
                    unreadable,
                },
            })
        } catch (e) {
            if (isStale()) return
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

    // 저축/투자 카테고리 id(고정 code 기준). 카테고리 목록이 로드된 뒤에만 계산된다.
    const savingsCategoryIds = useMemo(
        () =>
            state.status === "ready"
                ? state.data.categories
                      .filter(
                          (c) =>
                              c.code === SAVINGS_CODE ||
                              c.code === INVESTMENT_CODE,
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

    // 쌈짓돈 입출금/삭제 후: 쌈짓돈 거래만 재조회한다(적립 내역·목표·계좌·투자는 그대로 둔다).
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

    // SavingsTab 에 넘길 뷰 모델. 값은 전부 전체 기간 누적이라 보고 있는 달과 무관하다
    // (저축 총액·투자 원금·적립 내역 모두 contribAll 에서 파생한다).
    //
    // 순자산 = 저축(쌈짓돈으로 이체한 만큼 차감) + 투자 평가금액 + 쌈짓돈 잔액.
    // 저축→쌈짓돈 이체는 순자산을 바꾸지 않고, 현금 입금은 늘리고, 출금은 줄인다.
    const savingsView: SavingsView = useMemo((): SavingsView => {
        if (savingsState.status !== "ready" || state.status !== "ready") {
            return savingsState.status === "error"
                ? { status: "error", message: savingsState.message }
                : { status: "loading" }
        }
        const { categories } = state.data
        const {
            contribAll,
            accounts,
            investment: investmentState,
            boxTxns,
        } = savingsState
        const boxBalance = savingsBoxBalance(boxTxns)
        const allSummary = savingsSummary(contribAll, categories)
        // 최근 적립 내역: 전체 기간을 최근 순으로. 몇 건까지 보여줄지는 SavingsTab 이 정한다.
        const contributions: Contribution[] = sortContributionsByDateDesc(
            contribAll,
        ).map((c) => {
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
        const { rows, savedTotal, savedContributed } = savingsAccountsView(
            accounts,
            savingsByItem(contribAll, categories),
        )
        // 투자 원금 = 초기 원금(base) + 전체 기간 투자 적립.
        const investment = investmentView(
            investmentState?.base ?? 0,
            investmentState?.returnRate ?? "",
            allSummary.investTotal,
        )
        // 저축에서 쌈짓돈으로 옮긴 금액은 저축에서 빼고 쌈짓돈 잔액으로 잡는다(중복 집계 방지).
        const displayedSaved = Math.max(0, savedTotal - boxBalance.fromSavings)
        return {
            status: "ready",
            netWorth: displayedSaved + investment.value + boxBalance.balance,
            savedTotal,
            savedContributed,
            investContributed: allSummary.investTotal,
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
                    contributed: row?.contributed ?? 0,
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
    }, [savingsState, state, resetIdle])

    const savingsAccounts =
        savingsState.status === "ready" ? savingsState.accounts : []
    const currentInvestment =
        savingsState.status === "ready" ? savingsState.investment : null
    const boxTxns = savingsState.status === "ready" ? savingsState.boxTxns : []
    // 쌈짓돈 시트에 넘길 "저축 가용 잔액"(쌈짓돈으로 이체된 만큼 이미 뺀 값). savingsView 가
    // ready 일 때만 정확하므로, 그 전엔 0(시트를 열 수 있는 상태 자체가 아니라 문제 없음).
    const displayedSavedTotal =
        savingsView.status === "ready"
            ? Math.max(0, savingsView.savedTotal - savingsView.box.fromSavings)
            : 0

    return (
        <section style={{ minHeight: "100%" }}>
            <div
                className="sticky-header translucent"
                style={{ padding: "30px 18px 12px" }}
            >
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                    }}
                >
                    <div
                        style={{
                            fontSize: 21,
                            fontWeight: 800,
                            letterSpacing: "-0.03em",
                        }}
                    >
                        자산
                    </div>
                    <LockTimer style={{ padding: "0 13px" }} />
                </div>
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
                    {ASSET_TABS.map(({ key, label }) => (
                        <button
                            key={key}
                            type="button"
                            aria-pressed={assetTab === key}
                            style={segmentStyle(assetTab === key)}
                            onClick={() => handleAssetTab(key)}
                            {...pressScale(0.98)}
                        >
                            {label}
                        </button>
                    ))}
                </div>
                {assetTab === "budget" && (
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            marginTop: 12,
                        }}
                    >
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                            }}
                        >
                            <button
                                type="button"
                                aria-label="이전 달"
                                onClick={() => setMonth((m) => addMonth(m, -1))}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.color = "#171717"
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.color = "#c2c2c2"
                                }}
                                {...pressScale(0.82)}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    width: 26,
                                    height: 26,
                                    border: "none",
                                    background: "none",
                                    color: "#c2c2c2",
                                    cursor: "pointer",
                                    padding: 0,
                                    transition: "transform .12s",
                                }}
                            >
                                <svg
                                    width="15"
                                    height="15"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.6"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <path d="M15 6l-6 6 6 6" />
                                </svg>
                            </button>
                            <div
                                style={{
                                    fontSize: 13,
                                    color: "#555",
                                    fontWeight: 700,
                                    minWidth: 78,
                                    textAlign: "center",
                                }}
                            >
                                {monthLabel(month)}
                            </div>
                            <button
                                type="button"
                                aria-label="다음 달"
                                onClick={() => setMonth((m) => addMonth(m, 1))}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.color = "#171717"
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.color = "#c2c2c2"
                                }}
                                {...pressScale(0.82)}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    width: 26,
                                    height: 26,
                                    border: "none",
                                    background: "none",
                                    color: "#c2c2c2",
                                    cursor: "pointer",
                                    padding: 0,
                                    transition: "transform .12s",
                                }}
                            >
                                <svg
                                    width="15"
                                    height="15"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.6"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <path d="M9 6l6 6-6 6" />
                                </svg>
                            </button>
                        </div>
                        <button
                            type="button"
                            aria-label="카테고리 관리"
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                height: 34,
                                padding: "0 13px",
                                border: "1px solid #ececec",
                                borderRadius: 999,
                                background: "#fff",
                                font: "inherit",
                                fontSize: 12.5,
                                fontWeight: 700,
                                color: "#444",
                                cursor: "pointer",
                                whiteSpace: "nowrap",
                                flex: "none",
                                transition: "transform .12s",
                            }}
                            onClick={() => {
                                resetIdle()
                                setCategorySheetOpen(true)
                            }}
                            {...pressScale(0.95)}
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
