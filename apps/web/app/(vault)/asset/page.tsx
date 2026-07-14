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
    listMonthSlots,
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
import { toast } from "@/components/toast"
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
import { materializeRecurring, projectRecurring } from "./_lib/asset-recurring"
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
          // "corrupt" = 블롭이 손상돼 원금을 읽지 못했다. 0 으로 덮어쓰지 않도록 수정을 막는다.
          investment: Investment | null | "corrupt"
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

// 투자 포지션 블롭 복호화. 포지션이 없으면 null.
//
// 복호화 실패(손상된 블롭)를 "미설정"과 같게 다루면 안 된다. 원금이 0 으로 보이고, 그 상태에서
// 수익률만 바꿔 저장하면 0 이 재봉인돼 서버의 원금이 영구히 날아간다. "corrupt" 로 구분해
// 수정 자체를 막는다.
async function resolveInvestment(
    vaultKey: CryptoKey,
    view: InvestmentApiView | null,
): Promise<Investment | null | "corrupt"> {
    if (!view) return null
    try {
        const { base } = await openInvestment(vaultKey, view)
        return { base, returnRate: view.returnRate }
    } catch {
        return "corrupt"
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

// 저장은 됐는데 재조회가 실패하면 화면만 옛날 값으로 남는다. 조용히 삼키면 사용자는
// "저장이 안 됐구나" 하고 같은 금액을 또 입력한다(이중 기록). 반드시 알린다.
const STALE_MESSAGE = "저장됐지만 화면 갱신에 실패했습니다. 새로고침하세요."

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
            // slots 는 소프트 삭제분까지 포함한 점유 슬롯이라 머티리얼라이즈가 헛방을 안 친다.
            const [budgetViews, expM, templates, categories, slots] =
                await Promise.all([
                    listIncomes(month),
                    listExpenses(month),
                    listRecurring(),
                    listAssetCategories(),
                    listMonthSlots(month),
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
                slots,
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

            // 미래 달은 인스턴스를 만들지 않는 대신, 템플릿에서 "예정"으로 합성해 보여준다.
            // DB 에 없는 행이라 수정·삭제할 수 없고, 서버가 집계하는 누적(저축·투자)에도 안 들어간다.
            const projected = projectRecurring(
                recurrings,
                month,
                currentMonth(),
            )

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
                    expenses: [...expenses, ...projected],
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

    // 세그먼트 전환. 실패했던 저축·투자 탭에 다시 들어오면 idle 로 되돌려 재시도한다
    // (재시도 수단이 없으면 새로고침 말고는 방법이 없다).
    const handleAssetTab = useCallback(
        (tab: AssetTab) => {
            resetIdle()
            setAssetTab(tab)
            if (tab === "savings") {
                setSavingsState((prev) =>
                    prev.status === "error" ? { status: "idle" } : prev,
                )
            }
        },
        [resetIdle],
    )

    // 저축·투자 지연 로드는 카테고리 목록이 도착한 뒤에만 시작한다.
    // 로딩 중에 탭을 누르면 빈 categoryIds 로 조회돼 "적립 0원"이 ready 로 굳고,
    // idle 이 아니라서 다시는 로드되지 않는다(새로고침 전까지 복구 불가).
    useEffect(() => {
        if (assetTab !== "savings") return
        if (state.status !== "ready") return
        if (savingsState.status !== "idle") return
        void loadSavings(savingsCategoryIds)
    }, [
        assetTab,
        state.status,
        savingsState.status,
        savingsCategoryIds,
        loadSavings,
    ])

    // 계좌 추가/목표 시트 저장·삭제 후: 계좌 목록만 재조회한다(적립 내역·투자는 그대로 둔다).
    const reloadAccounts = useCallback(async () => {
        try {
            const accountViews = await listSavingsAccounts()
            const accounts = await resolveAccounts(vaultKey, accountViews)
            setSavingsState((prev) =>
                prev.status === "ready" ? { ...prev, accounts } : prev,
            )
        } catch {
            toast(STALE_MESSAGE)
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
            toast(STALE_MESSAGE)
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
            toast(STALE_MESSAGE)
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
        // 블롭이 손상됐으면 base 를 모른다. 0 으로 가정하고 보여주되, 수정은 막는다(아래 onEditReturn).
        const investCorrupt = investmentState === "corrupt"
        const investPosition = investCorrupt ? null : investmentState
        const investment = investmentView(
            investPosition?.base ?? 0,
            investPosition?.returnRate ?? "",
            allSummary.investTotal,
        )
        // 저축에서 쌈짓돈으로 옮긴 금액은 저축에서 빼고 쌈짓돈 잔액으로 잡는다(중복 집계 방지).
        // 0 으로 클램프하면 이체가 저축 잔액을 넘었을 때 초과분이 사라져 순자산이 부풀려진다.
        // 초과 이체는 시트에서 막으므로(SavingsBoxSheet), 여기선 공식을 그대로 지킨다.
        const displayedSaved = savedTotal - boxBalance.fromSavings
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
                // 원금을 못 읽은 상태로 저장하면 0 이 재봉인돼 원금이 영구히 날아간다.
                if (investCorrupt) {
                    toast(
                        "투자 정보를 읽지 못했습니다. 원금이 지워질 수 있어 수정할 수 없습니다.",
                    )
                    return
                }
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
    // 손상된 블롭("corrupt")은 시트에 넘기지 않는다 — 시트를 열 수 없게 막아뒀다(onEditReturn).
    const currentInvestment =
        savingsState.status === "ready" && savingsState.investment !== "corrupt"
            ? savingsState.investment
            : null
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
                                onClick={() => {
                                    // 화살표로 달을 훑는 것도 사용 중이다. idle 타이머를 되돌리지
                                    // 않으면 클릭하는 중에 금고가 잠긴다.
                                    resetIdle()
                                    setMonth((m) => addMonth(m, -1))
                                }}
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
                                onClick={() => {
                                    resetIdle()
                                    setMonth((m) => addMonth(m, 1))
                                }}
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
