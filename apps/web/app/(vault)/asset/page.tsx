"use client"
// 자산 대시보드(디자인 화면 11). 수입·월 지출·고정 템플릿을 불러와 머티리얼라이즈한 뒤
// VK 로 복호화·집계해 남은 돈·카테고리별·지출 달력·선택일 상세를 보여준다. FAB → 새 지출.
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
import { useVault } from "../vault-context"
import {
    formatAmount,
    formatWon,
    categoryColor,
} from "./asset-categories"
import {
    openExpense,
    openIncome,
    sealIncome,
} from "./asset-payload"
import {
    byCategory,
    byDay,
    remaining,
    spentPct,
    totalSpent,
    type ComputedExpense,
} from "./asset-compute"
import { materializeRecurring } from "./asset-recurring"
import {
    WEEKDAYS,
    addMonth,
    buildCalendar,
    currentMonth,
    monthLabel,
    todayISO,
} from "./asset-dates"

interface Loaded {
    incomeAmount: number
    expenses: ComputedExpense[]
}
type State =
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "ready"; data: Loaded }

// 달력 셀 금액 축약(8500→"8.5천", 142000→"14만").
function abbrev(n: number): string {
    if (n >= 10000) return `${Math.round(n / 10000)}만`
    if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}천`
    return String(n)
}

function formatMmSs(total: number): string {
    const m = Math.floor(total / 60)
    const s = total % 60
    return `${m}:${String(s).padStart(2, "0")}`
}

export default function AssetPage() {
    const { vaultKey, idleSecondsRemaining, onLock, resetIdle } = useVault()
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
        () => (state.status === "ready" ? byDay(state.data.expenses) : new Map()),
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
                    <button
                        type="button"
                        className={`lock-timer${idleSecondsRemaining <= 60 ? " urgent" : ""}`}
                        onClick={onLock}
                        aria-label={`자동 잠금까지 ${Math.max(0, idleSecondsRemaining)}초. 지금 잠그기`}
                    >
                        <span className="dot" aria-hidden="true" />
                        {formatMmSs(Math.max(0, idleSecondsRemaining))} 잠그기
                    </button>
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
                <div
                    className="dialog-backdrop"
                    role="dialog"
                    aria-modal="true"
                    aria-label="월 수입 설정"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setSheetOpen(false)
                    }}
                >
                    <div className="sheet">
                        <div className="sheet-grip" aria-hidden="true" />
                        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>
                            월 수입 설정
                        </div>
                        <p
                            className="muted"
                            style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 18 }}
                        >
                            매달 들어오는 월급을 입력하면 남는 돈이 자동으로 계산됩니다.
                        </p>
                        <div className="income-input">
                            <span aria-hidden="true">₩</span>
                            <input
                                inputMode="numeric"
                                value={
                                    incomeDraft
                                        ? formatAmount(
                                              Number(
                                                  incomeDraft.replace(/[^\d]/g, "") ||
                                                      "0",
                                              ),
                                          )
                                        : ""
                                }
                                onChange={(e) =>
                                    setIncomeDraft(
                                        e.target.value.replace(/[^\d]/g, "").slice(0, 12),
                                    )
                                }
                                placeholder="0"
                                aria-label="월 수입"
                            />
                        </div>
                        <button
                            type="button"
                            className="btn"
                            style={{ width: "100%", marginTop: 18 }}
                            onClick={saveIncome}
                            disabled={savingIncome}
                        >
                            저장
                        </button>
                    </div>
                </div>
            )}
        </section>
    )
}

function AssetDashboard({
    month,
    data,
    dayTotals,
    selectedDay,
    onSelectDay,
    onOpenIncome,
}: {
    month: string
    data: Loaded
    dayTotals: Map<string, number>
    selectedDay: string | null
    onSelectDay: (d: string) => void
    onOpenIncome: () => void
}) {
    const spent = totalSpent(data.expenses)
    const left = remaining(data.incomeAmount, spent)
    const pct = spentPct(data.incomeAmount, spent)
    const cats = byCategory(data.expenses)
    const cells = buildCalendar(month)
    const dayExpenses = selectedDay
        ? data.expenses
              .filter((e) => e.date === selectedDay)
              .sort((a, b) => b.amount - a.amount)
        : []

    return (
        <div
            className="stagger"
            style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 4 }}
        >
            {/* 남은 돈 hero */}
            <div className="asset-card" style={{ borderRadius: 20 }}>
                <div
                    style={{
                        fontSize: 12.5,
                        fontWeight: 700,
                        color: "var(--color-text-muted)",
                        marginBottom: 7,
                    }}
                >
                    이번 달 남은 돈
                </div>
                <div
                    style={{
                        fontSize: 34,
                        fontWeight: 800,
                        letterSpacing: "-0.03em",
                        color: left < 0 ? "var(--color-danger-fg)" : "#171717",
                    }}
                >
                    {formatWon(left)}
                </div>
                <div className="asset-bar" style={{ margin: "16px 0 10px" }}>
                    <div
                        className="asset-bar-fill"
                        style={{
                            width: `${pct}%`,
                            background:
                                pct >= 100 ? "var(--color-danger-fg)" : "var(--ac)",
                        }}
                    />
                </div>
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 12,
                        fontWeight: 600,
                        color: "var(--color-text-muted)",
                    }}
                >
                    <span>지출 {pct}%</span>
                    <span>예산 {formatWon(data.incomeAmount)}</span>
                </div>
            </div>

            {/* 수입 / 지출 */}
            <div style={{ display: "flex", gap: 12 }}>
                <button
                    type="button"
                    className="asset-card"
                    style={{ flex: 1, textAlign: "left", cursor: "pointer" }}
                    onClick={onOpenIncome}
                >
                    <div className="asset-card-label">수입 · 월급</div>
                    <div className="asset-card-value">
                        {data.incomeAmount ? formatWon(data.incomeAmount) : "설정하기"}
                    </div>
                    <div
                        style={{
                            fontSize: 11,
                            color: "var(--ac)",
                            fontWeight: 700,
                            marginTop: 5,
                        }}
                    >
                        수정 ›
                    </div>
                </button>
                <div className="asset-card" style={{ flex: 1 }}>
                    <div className="asset-card-label">지출</div>
                    <div
                        className="asset-card-value"
                        style={{ color: "var(--color-danger-fg)" }}
                    >
                        {formatWon(spent)}
                    </div>
                    <div
                        style={{
                            fontSize: 11,
                            color: "var(--color-text-muted)",
                            fontWeight: 600,
                            marginTop: 5,
                        }}
                    >
                        {data.expenses.length}건
                    </div>
                </div>
            </div>

            {/* 카테고리별 지출 */}
            {cats.length > 0 && (
                <div className="asset-card">
                    <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 15 }}>
                        카테고리별 지출
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                        {cats.map((c) => (
                            <div key={c.key}>
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        marginBottom: 7,
                                    }}
                                >
                                    <div
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 8,
                                        }}
                                    >
                                        <span
                                            aria-hidden="true"
                                            style={{
                                                width: 9,
                                                height: 9,
                                                borderRadius: "50%",
                                                background: c.color,
                                            }}
                                        />
                                        <span
                                            style={{
                                                fontSize: 13.5,
                                                fontWeight: 700,
                                                color: "#333",
                                            }}
                                        >
                                            {c.key}
                                        </span>
                                        <span
                                            style={{
                                                fontSize: 11.5,
                                                color: "var(--color-text-muted)",
                                                fontWeight: 600,
                                            }}
                                        >
                                            {c.pct}%
                                        </span>
                                    </div>
                                    <span
                                        style={{
                                            fontSize: 13,
                                            fontWeight: 700,
                                            color: "#444",
                                        }}
                                    >
                                        {formatWon(c.amount)}
                                    </span>
                                </div>
                                <div className="asset-bar">
                                    <div
                                        className="asset-bar-fill"
                                        style={{
                                            width: `${c.pct}%`,
                                            background: c.color,
                                        }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 지출 달력 */}
            <div className="asset-card">
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: 14,
                    }}
                >
                    <span style={{ fontSize: 13, fontWeight: 800 }}>지출 달력</span>
                    <span
                        style={{
                            fontSize: 12,
                            color: "var(--color-text-muted)",
                            fontWeight: 600,
                        }}
                    >
                        {data.expenses.length}건
                    </span>
                </div>
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(7, 1fr)",
                        marginBottom: 6,
                    }}
                >
                    {WEEKDAYS.map((w) => (
                        <div
                            key={w}
                            style={{
                                textAlign: "center",
                                fontSize: 11,
                                fontWeight: 700,
                                color: "var(--color-text-muted)",
                            }}
                        >
                            {w}
                        </div>
                    ))}
                </div>
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(7, 1fr)",
                        gap: 4,
                    }}
                >
                    {cells.map((cell, i) => {
                        if (cell.day === null)
                            return <div key={`b${i}`} aria-hidden="true" />
                        const amount = dayTotals.get(cell.date!) ?? 0
                        const active = cell.date === selectedDay
                        return (
                            <button
                                key={cell.date}
                                type="button"
                                onClick={() => onSelectDay(cell.date!)}
                                aria-pressed={active}
                                className={`cal-cell${active ? " active" : ""}`}
                            >
                                <span className="cal-day">{cell.day}</span>
                                {amount > 0 && (
                                    <span className="cal-amt">{abbrev(amount)}</span>
                                )}
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* 선택일 상세 */}
            {selectedDay && (
                <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            margin: "6px 2px 0",
                        }}
                    >
                        <span style={{ fontSize: 13, fontWeight: 800 }}>
                            {Number(selectedDay.slice(8, 10))}일
                        </span>
                        <span
                            style={{
                                fontSize: 13,
                                fontWeight: 800,
                                color: "var(--color-danger-fg)",
                            }}
                        >
                            {formatWon(totalSpent(dayExpenses))}
                        </span>
                    </div>
                    {dayExpenses.length === 0 ? (
                        <div
                            style={{
                                textAlign: "center",
                                padding: "22px 0",
                                fontSize: 13,
                                color: "var(--color-text-muted)",
                                fontWeight: 600,
                            }}
                        >
                            이 날은 지출이 없어요
                        </div>
                    ) : (
                        dayExpenses.map((e) => (
                            <Link
                                key={e.id}
                                href={`/asset/${e.id}`}
                                className="entry-card"
                                style={{ display: "flex", alignItems: "center", gap: 13 }}
                            >
                                <span
                                    className="avatar"
                                    aria-hidden="true"
                                    style={{ background: categoryColor(e.category) }}
                                >
                                    {e.category.slice(0, 1)}
                                </span>
                                <span className="entry-main" style={{ minWidth: 0 }}>
                                    <span
                                        className="entry-label"
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 6,
                                        }}
                                    >
                                        {e.item || e.category}
                                        {e.recurringId && (
                                            <span className="recur-badge">고정</span>
                                        )}
                                    </span>
                                    <span
                                        style={{
                                            fontSize: 12,
                                            color: "var(--color-text-muted)",
                                            fontWeight: 500,
                                        }}
                                    >
                                        {e.category} · {e.method}
                                    </span>
                                </span>
                                <span
                                    style={{
                                        fontSize: 15,
                                        fontWeight: 800,
                                        letterSpacing: "-0.02em",
                                    }}
                                >
                                    {formatWon(e.amount)}
                                </span>
                            </Link>
                        ))
                    )}
                </div>
            )}
        </div>
    )
}
