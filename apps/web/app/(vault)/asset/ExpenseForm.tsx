"use client"
// 지출 추가/수정 폼(디자인 화면 12). 금액·항목·카테고리·결제방법을 VK 로 봉인해 저장한다.
// 신규에서 고정 ON 이면 템플릿(RecurringExpense)을 만들고 당월 인스턴스를 함께 생성한다(이후 달 자동 생성).
import { useState } from "react"
import { useVault } from "../vault-context"
import { ConfirmDialog } from "@/components/ConfirmDialog"
import { isApiError } from "@/lib/api-error"
import {
    createExpense,
    createRecurring,
    deleteExpense,
    deleteRecurring,
    updateExpense,
} from "@/lib/vault-client"
import {
    CATEGORIES,
    METHODS,
    categoryColor,
    formatAmount,
} from "./asset-categories"
import { sealExpense, type ExpensePayload } from "./asset-payload"
import { monthOf, todayISO } from "./asset-dates"

export interface ExpenseFormInitial {
    id: string
    date: string
    recurringId: string | null
    payload: ExpensePayload
}

interface Props {
    initial: ExpenseFormInitial | null
    onSaved: () => void
    onCancel: () => void
    onDeleted: () => void
}

export function ExpenseForm({ initial, onSaved, onCancel, onDeleted }: Props) {
    const { vaultKey, resetIdle } = useVault()
    const isEdit = initial !== null

    const [amount, setAmount] = useState(
        initial ? String(initial.payload.amount) : "",
    )
    const [item, setItem] = useState(initial?.payload.item ?? "")
    const [category, setCategory] = useState(
        initial?.payload.category ?? CATEGORIES[0].key,
    )
    const [method, setMethod] = useState(initial?.payload.method ?? METHODS[0])
    const [date, setDate] = useState(initial?.date ?? todayISO())
    const [recurring, setRecurring] = useState(false)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [pendingDelete, setPendingDelete] = useState<null | "one" | "series">(
        null,
    )

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
                category,
                method,
            }
            if (isEdit) {
                const blob = await sealExpense(vaultKey, payload)
                await updateExpense(initial.id, { date, ...blob })
            } else if (recurring) {
                const tmplBlob = await sealExpense(vaultKey, payload)
                const tmpl = await createRecurring({
                    dayOfMonth: Number(date.slice(8, 10)),
                    ...tmplBlob,
                })
                const instBlob = await sealExpense(vaultKey, payload)
                await createExpense({
                    date,
                    recurringId: tmpl.id,
                    period: monthOf(date),
                    ...instBlob,
                })
            } else {
                const blob = await sealExpense(vaultKey, payload)
                await createExpense({ date, ...blob })
            }
            onSaved()
        } catch (e) {
            setBusy(false)
            setError(
                isApiError(e) ? e.message : "저장에 실패했습니다. 다시 시도하세요.",
            )
        }
    }

    async function handleDelete() {
        if (!initial) return
        const mode = pendingDelete
        setPendingDelete(null)
        setBusy(true)
        try {
            if (mode === "series" && initial.recurringId) {
                await deleteRecurring(initial.recurringId)
            }
            await deleteExpense(initial.id)
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
                            style={{ fontSize: 30, fontWeight: 800, color: "#cfcfcf" }}
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
                        {CATEGORIES.map((c) => {
                            const active = c.key === category
                            return (
                                <button
                                    key={c.key}
                                    type="button"
                                    onClick={() => {
                                        resetIdle()
                                        setCategory(c.key)
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
                                            background: categoryColor(c.key),
                                            display: "inline-block",
                                        }}
                                    />
                                    {c.key}
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* 결제방법 */}
                <div>
                    <div className="field-label" style={{ marginBottom: 10 }}>
                        결제방법
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {METHODS.map((m) => {
                            const active = m === method
                            return (
                                <button
                                    key={m}
                                    type="button"
                                    onClick={() => {
                                        resetIdle()
                                        setMethod(m)
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
                                    {m}
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
                            <span style={{ fontSize: 14.5, fontWeight: 700, color: "#222" }}>
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

                {/* 삭제(수정만) */}
                {isEdit && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <button
                            type="button"
                            className="btn danger"
                            onClick={() => setPendingDelete("one")}
                            disabled={busy}
                        >
                            이 지출 삭제
                        </button>
                        {initial.recurringId && (
                            <button
                                type="button"
                                className="btn danger"
                                onClick={() => setPendingDelete("series")}
                                disabled={busy}
                            >
                                고정 지출 해지(이후 자동 생성 중단)
                            </button>
                        )}
                    </div>
                )}
            </div>

            <ConfirmDialog
                open={pendingDelete !== null}
                title="삭제"
                message={
                    pendingDelete === "series"
                        ? "이 지출을 삭제하고 고정 지출을 해지합니다. 다음 달부터 자동 생성되지 않습니다."
                        : "이 지출을 삭제할까요?"
                }
                confirmLabel="삭제"
                destructive
                onConfirm={handleDelete}
                onCancel={() => setPendingDelete(null)}
            />
        </section>
    )
}
