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
    type ExpenseView,
    type IncomeView,
} from "@/lib/vault-client"
import { isApiError } from "@/lib/api-error"
import { SkeletonCard } from "@/components/Skeleton"
import { useVault } from "../_lib/vault-context"
import { openExpense, openIncome } from "./_lib/asset-payload"
import { migrateExpenseCategories } from "./_lib/asset-migrate-categories"
import {
    byDay,
    totalIncome,
    type ComputedExpense,
    type ComputedIncome,
} from "./_lib/asset-compute"
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
} from "./_components/dashboard/AssetDashboard"
import { BudgetSheet } from "./_components/budget/BudgetSheet"
import { CategoryManager } from "./_components/CategoryManager"
import { LockTimer } from "../_components/LockTimer"

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
        </section>
    )
}
