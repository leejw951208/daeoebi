"use client"
// 자산 대시보드(디자인 화면 11). 수입·월 지출·고정 템플릿을 불러와 머티리얼라이즈한 뒤
// VK 로 복호화·집계해 대시보드를 그린다. 상태·로드·수입 저장만 담당하고 본문은 AssetDashboard 가 그린다.
import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
    getIncome,
    listExpenses,
    listRecurring,
    putIncome,
    type ExpenseView,
} from "@/lib/vault-client"
import { isApiError } from "@/lib/api-error"
import { SkeletonCard } from "@/components/Skeleton"
import { useVault } from "../_lib/vault-context"
import { openExpense, openIncome, sealIncome } from "./_lib/asset-payload"
import { byDay, type ComputedExpense } from "./_lib/asset-compute"
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
import { IncomeSheet } from "./_components/IncomeSheet"
import { LockTimer } from "../_components/LockTimer"

type State =
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "ready"; data: Loaded }

export default function AssetPage() {
    const { vaultKey, resetIdle } = useVault()
    const [month, setMonth] = useState(currentMonth())
    const [state, setState] = useState<State>({ status: "loading" })
    const [selectedDay, setSelectedDay] = useState<string | null>(null)
    const [sheetOpen, setSheetOpen] = useState(false)
    const [incomeDraft, setIncomeDraft] = useState("")
    const [savingIncome, setSavingIncome] = useState(false)

    const load = useCallback(async () => {
        setState({ status: "loading" })
        try {
            const [incomeView, expensesView, templates] = await Promise.all([
                getIncome(),
                listExpenses(month),
                listRecurring(),
            ])
            // 고정 지출 자동 생성(미생성분만). 생성됐으면 목록에 합친다.
            const created = await materializeRecurring(
                vaultKey,
                month,
                templates,
                expensesView,
            )
            const allViews: ExpenseView[] = [...expensesView, ...created]

            const incomeAmount = incomeView
                ? await openIncome(vaultKey, incomeView).then(
                      (p) => p.amount,
                      () => 0,
                  )
                : 0

            // 복호화 실패 건(예: 다른 VK 로 만든 잔여 데이터)은 건너뛴다.
            const settled = await Promise.allSettled(
                allViews.map(async (v): Promise<ComputedExpense> => {
                    const p = await openExpense(vaultKey, v)
                    return {
                        id: v.id,
                        date: v.date,
                        recurringId: v.recurringId,
                        item: p.item,
                        amount: p.amount,
                        category: p.category,
                        method: p.method,
                    }
                }),
            )
            const expenses = settled
                .filter(
                    (r): r is PromiseFulfilledResult<ComputedExpense> =>
                        r.status === "fulfilled",
                )
                .map((r) => r.value)

            setState({ status: "ready", data: { incomeAmount, expenses } })
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

    async function saveIncome() {
        const amount = Number(incomeDraft.replace(/[^\d]/g, "") || "0")
        setSavingIncome(true)
        try {
            const blob = await sealIncome(vaultKey, { amount })
            await putIncome(blob)
            setSheetOpen(false)
            await load()
        } catch {
            // 저장 실패해도 시트는 유지한다.
        } finally {
            setSavingIncome(false)
        }
    }

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
                    <LockTimer />
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
                    onOpenIncome={() => {
                        resetIdle()
                        setIncomeDraft(
                            state.data.incomeAmount
                                ? String(state.data.incomeAmount)
                                : "",
                        )
                        setSheetOpen(true)
                    }}
                />
            )}

            <Link className="fab" href="/asset/new" aria-label="새 지출 추가">
                <span aria-hidden="true">+</span>
            </Link>

            {sheetOpen && (
                <IncomeSheet
                    draft={incomeDraft}
                    saving={savingIncome}
                    onChange={setIncomeDraft}
                    onSave={saveIncome}
                    onClose={() => setSheetOpen(false)}
                />
            )}
        </section>
    )
}
