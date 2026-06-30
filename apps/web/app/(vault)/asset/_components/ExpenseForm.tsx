"use client"
// 지출 추가/수정 폼(디자인 화면 12). 금액·항목·카테고리·결제방법을 VK 로 봉인해 저장한다.
// 신규에서 고정 ON 이면 템플릿(RecurringExpense)을 만들고 당월 인스턴스를 함께 생성한다(이후 달 자동 생성).
import { useState, useEffect } from "react"
import { useVault } from "../../_lib/vault-context"
import { isApiError } from "@/lib/api-error"
import {
    createExpense,
    createRecurring,
    deleteExpense,
    deleteRecurring,
    updateExpense,
    updateRecurring,
    type AssetCategory,
} from "@/lib/vault-client"
import { formatAmount } from "../_lib/asset-categories"
import { sealExpense, type ExpensePayload } from "../_lib/asset-payload"
import { monthOf, todayISO } from "../_lib/asset-dates"

export interface ExpenseFormInitial {
    id: string
    date: string
    recurringId: string | null
    payload: ExpensePayload
    categoryId: string | null
}

interface Props {
    categories: AssetCategory[]
    initial: ExpenseFormInitial | null
    onSaved: () => void
    onCancel: () => void
    onDeleted: () => void
}

export function ExpenseForm({
    categories,
    initial,
    onSaved,
    onCancel,
    onDeleted,
}: Props) {
    const { vaultKey, resetIdle } = useVault()
    const isEdit = initial !== null

    const [amount, setAmount] = useState(
        initial ? String(initial.payload.amount) : "",
    )
    const [item, setItem] = useState(initial?.payload.item ?? "")
    const [categoryId, setCategoryId] = useState<string | null>(
        initial?.categoryId ?? categories[0]?.id ?? null,
    )
    const [date, setDate] = useState(initial?.date ?? todayISO())
    const [recurring, setRecurring] = useState(false)
    const [termMonths, setTermMonths] = useState("")
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [deleteMenu, setDeleteMenu] = useState(false)

    // 신규 폼에서 카테고리 목록이 비동기로 도착했을 때 첫 항목을 자동 선택한다.
    // categoryId 가 이미 설정된 경우(수정 모드 또는 사용자가 직접 선택)에는 동작하지 않는다.
    useEffect(() => {
        if (initial === null && categoryId === null && categories.length > 0) {
            setCategoryId(categories[0].id)
        }
    }, [categories, categoryId, initial])

    const amountNum = Number(amount || "0")

    function onAmountInput(v: string) {
        resetIdle()
        setAmount(v.replace(/[^\d]/g, "").slice(0, 12))
    }

    async function handleSave() {
        if (amountNum <= 0) {
            setError("금액을 입력하세요.")
            return
        }
        setBusy(true)
        setError(null)
        try {
            const payload: ExpensePayload = {
                item: item.trim(),
                amount: amountNum,
            }
            if (isEdit) {
                const blob = await sealExpense(vaultKey, payload)
                await updateExpense(initial.id, {
                    date,
                    categoryId: categoryId ?? undefined,
                    ...blob,
                })
            } else if (recurring) {
                const tmplBlob = await sealExpense(vaultKey, payload)
                const term = Number(termMonths)
                const tmpl = await createRecurring({
                    dayOfMonth: Number(date.slice(8, 10)),
                    startMonth: monthOf(date),
                    categoryId: categoryId ?? undefined,
                    // 1 이상 정수면 기간 제한, 비었거나 0 이면 무기한(미전송).
                    ...(Number.isInteger(term) && term >= 1
                        ? { termMonths: term }
                        : {}),
                    ...tmplBlob,
                })
                const instBlob = await sealExpense(vaultKey, payload)
                await createExpense({
                    date,
                    recurringId: tmpl.id,
                    period: monthOf(date),
                    categoryId: categoryId ?? undefined,
                    ...instBlob,
                })
            } else {
                const blob = await sealExpense(vaultKey, payload)
                await createExpense({
                    date,
                    categoryId: categoryId ?? undefined,
                    ...blob,
                })
            }
            onSaved()
        } catch (e) {
            setBusy(false)
            setError(
                isApiError(e)
                    ? e.message
                    : "저장에 실패했습니다. 다시 시도하세요.",
            )
        }
    }

    async function handleDeactivate() {
        if (!initial?.recurringId) return
        setBusy(true)
        try {
            await updateRecurring(initial.recurringId, { active: false })
            onDeleted()
        } catch (e) {
            setBusy(false)
            setError(isApiError(e) ? e.message : "해제에 실패했습니다.")
        }
    }

    async function handleDeleteAll() {
        if (!initial?.recurringId) return
        setBusy(true)
        try {
            await deleteRecurring(initial.recurringId) // FK Cascade 로 인스턴스까지 삭제
            onDeleted()
        } catch (e) {
            setBusy(false)
            setError(isApiError(e) ? e.message : "삭제에 실패했습니다.")
        }
    }

    async function handleDeleteThisMonth() {
        if (!initial) return
        setBusy(true)
        try {
            if (initial.recurringId) {
                await updateExpense(initial.id, { removed: true }) // 소프트 삭제(재생성 차단)
            } else {
                await deleteExpense(initial.id) // 일반 지출은 하드 삭제
            }
            onDeleted()
        } catch (e) {
            setBusy(false)
            setError(isApiError(e) ? e.message : "삭제에 실패했습니다.")
        }
    }

    return (
        <section style={{ minHeight: "100%", background: "#fff" }}>
            <div
                className="sticky-header"
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                }}
            >
                <button
                    type="button"
                    className="btn-text"
                    onClick={onCancel}
                    style={{ color: "var(--color-text-muted)" }}
                >
                    취소
                </button>
                <div style={{ fontSize: 15, fontWeight: 700 }}>
                    {isEdit ? "지출 수정" : "지출 추가"}
                </div>
                <button
                    type="button"
                    className="btn-text"
                    onClick={handleSave}
                    disabled={busy}
                    style={{ color: "var(--ac)", fontWeight: 700 }}
                >
                    저장
                </button>
            </div>

            <div
                style={{
                    padding: "14px 4px 50px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 24,
                }}
            >
                {error && (
                    <div role="alert" className="error-box">
                        {error}
                    </div>
                )}

                {/* 금액 */}
                <div style={{ textAlign: "center", padding: "14px 0 4px" }}>
                    <div className="field-label" style={{ marginBottom: 10 }}>
                        금액
                    </div>
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 5,
                        }}
                    >
                        <span
                            style={{
                                fontSize: 30,
                                fontWeight: 800,
                                color: "#cfcfcf",
                            }}
                            aria-hidden="true"
                        >
                            ₩
                        </span>
                        <input
                            inputMode="numeric"
                            value={amount ? formatAmount(amountNum) : ""}
                            onChange={(e) => onAmountInput(e.target.value)}
                            placeholder="0"
                            aria-label="금액"
                            style={{
                                width: "auto",
                                minWidth: 60,
                                maxWidth: 230,
                                border: "none",
                                background: "none",
                                fontSize: 40,
                                fontWeight: 800,
                                letterSpacing: "-0.03em",
                                textAlign: "center",
                                outline: "none",
                                color: "#171717",
                            }}
                        />
                    </div>
                </div>

                {/* 항목 */}
                <div>
                    <div className="field-label">항목</div>
                    <input
                        value={item}
                        onChange={(e) => {
                            resetIdle()
                            setItem(e.target.value)
                        }}
                        placeholder="예: 점심 김밥천국"
                        aria-label="항목"
                        className="field-control"
                    />
                </div>

                {/* 카테고리 */}
                <div>
                    <div className="field-label" style={{ marginBottom: 10 }}>
                        카테고리
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {categories.map((c) => {
                            const active = c.id === categoryId
                            return (
                                <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => {
                                        resetIdle()
                                        setCategoryId(c.id)
                                    }}
                                    aria-pressed={active}
                                    className="chip"
                                    style={
                                        active
                                            ? {
                                                  borderColor: "var(--ac)",
                                                  background: "var(--soft)",
                                                  color: "#222",
                                              }
                                            : undefined
                                    }
                                >
                                    <span
                                        aria-hidden="true"
                                        style={{
                                            width: 9,
                                            height: 9,
                                            borderRadius: "50%",
                                            background: c.color,
                                            display: "inline-block",
                                        }}
                                    />
                                    {c.name}
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* 날짜 */}
                <div>
                    <div className="field-label">날짜</div>
                    <input
                        type="date"
                        value={date}
                        onChange={(e) => {
                            resetIdle()
                            setDate(e.target.value)
                        }}
                        aria-label="날짜"
                        className="field-control"
                    />
                </div>

                {/* 고정 지출 토글(신규만) */}
                {!isEdit && (
                    <label className="asset-toggle-row">
                        <span>
                            <span
                                style={{
                                    fontSize: 14.5,
                                    fontWeight: 700,
                                    color: "#222",
                                }}
                            >
                                고정 지출
                            </span>
                            <span
                                style={{
                                    display: "block",
                                    fontSize: 12,
                                    color: "var(--color-text-muted)",
                                    marginTop: 2,
                                }}
                            >
                                매월 자동으로 추가됩니다.
                            </span>
                        </span>
                        <input
                            type="checkbox"
                            checked={recurring}
                            onChange={(e) => {
                                resetIdle()
                                setRecurring(e.target.checked)
                            }}
                            aria-label="고정 지출"
                        />
                    </label>
                )}

                {/* 개월 수(고정 ON 일 때만, 선택) */}
                {!isEdit && recurring && (
                    <div className="form-row" style={{ margin: 0 }}>
                        <label htmlFor="term-months">
                            개월 수{" "}
                            <span
                                style={{
                                    color: "var(--color-text-muted)",
                                    fontWeight: 600,
                                }}
                            >
                                · 선택
                            </span>
                        </label>
                        <input
                            id="term-months"
                            inputMode="numeric"
                            className="field-control"
                            placeholder="비우면 무기한"
                            value={termMonths}
                            onChange={(e) => {
                                resetIdle()
                                setTermMonths(
                                    e.target.value
                                        .replace(/[^\d]/g, "")
                                        .slice(0, 3),
                                )
                            }}
                            aria-label="개월 수"
                        />
                    </div>
                )}

                {/* 액션(수정만) */}
                {isEdit && (
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 8,
                        }}
                    >
                        {initial?.recurringId ? (
                            <>
                                <button
                                    type="button"
                                    className="btn secondary"
                                    onClick={handleDeactivate}
                                    disabled={busy}
                                >
                                    고정 해제(이후 자동 생성 중단)
                                </button>
                                <button
                                    type="button"
                                    className="btn danger"
                                    onClick={() => setDeleteMenu(true)}
                                    disabled={busy}
                                >
                                    삭제
                                </button>
                            </>
                        ) : (
                            <button
                                type="button"
                                className="btn danger"
                                onClick={handleDeleteThisMonth}
                                disabled={busy}
                            >
                                이 지출 삭제
                            </button>
                        )}
                    </div>
                )}
            </div>

            {deleteMenu && (
                <div
                    className="dialog-backdrop"
                    role="dialog"
                    aria-modal="true"
                    aria-label="고정 지출 삭제"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setDeleteMenu(false)
                    }}
                >
                    <div className="sheet">
                        <div className="sheet-grip" aria-hidden="true" />
                        <div
                            style={{
                                fontSize: 17,
                                fontWeight: 800,
                                marginBottom: 4,
                            }}
                        >
                            고정 지출 삭제
                        </div>
                        <p
                            className="muted"
                            style={{
                                fontSize: 13,
                                lineHeight: 1.5,
                                marginBottom: 16,
                            }}
                        >
                            무엇을 삭제할지 선택하세요.
                        </p>
                        <button
                            type="button"
                            className="btn danger"
                            style={{ width: "100%", marginBottom: 8 }}
                            onClick={() => {
                                setDeleteMenu(false)
                                void handleDeleteAll()
                            }}
                            disabled={busy}
                        >
                            이 고정 전체 삭제(모든 달 기록 제거)
                        </button>
                        <button
                            type="button"
                            className="btn danger"
                            style={{ width: "100%", marginBottom: 8 }}
                            onClick={() => {
                                setDeleteMenu(false)
                                void handleDeleteThisMonth()
                            }}
                            disabled={busy}
                        >
                            이번 달만 삭제
                        </button>
                        <button
                            type="button"
                            className="btn secondary"
                            style={{ width: "100%" }}
                            onClick={() => setDeleteMenu(false)}
                            disabled={busy}
                        >
                            취소
                        </button>
                    </div>
                </div>
            )}
        </section>
    )
}
