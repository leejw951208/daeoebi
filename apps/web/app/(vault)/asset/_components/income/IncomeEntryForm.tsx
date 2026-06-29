"use client"
// 수입 추가·편집 인라인 폼. 금액·항목명·카테고리 칩. 저장/암호화는 상위(IncomeSheet)가 처리한다.
import { useState } from "react"
import { INCOME_CATEGORIES, formatAmount } from "../../_lib/asset-categories"

export interface IncomeDraft {
    item: string
    amount: number
    category: string
}

interface Props {
    initial?: IncomeDraft
    saving: boolean
    onSubmit: (draft: IncomeDraft) => void
    onCancel: () => void
    onActivity: () => void // resetIdle
}

export function IncomeEntryForm({
    initial,
    saving,
    onSubmit,
    onCancel,
    onActivity,
}: Props) {
    const [amount, setAmount] = useState(initial ? String(initial.amount) : "")
    const [item, setItem] = useState(initial?.item ?? "")
    const [category, setCategory] = useState(
        initial?.category ?? INCOME_CATEGORIES[0].key,
    )

    function submit() {
        onActivity()
        onSubmit({
            item: item.trim(),
            amount: Number(amount.replace(/[^\d]/g, "") || "0"),
            category,
        })
    }

    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                gap: 14,
                marginTop: 4,
            }}
        >
            <div className="income-input">
                <span aria-hidden="true">₩</span>
                <input
                    inputMode="numeric"
                    value={
                        amount
                            ? formatAmount(
                                  Number(amount.replace(/[^\d]/g, "") || "0"),
                              )
                            : ""
                    }
                    onChange={(e) => {
                        onActivity()
                        setAmount(
                            e.target.value.replace(/[^\d]/g, "").slice(0, 12),
                        )
                    }}
                    placeholder="0"
                    aria-label="수입 금액"
                />
            </div>
            <input
                className="field-control"
                placeholder="항목명 (예: 6월 월급)"
                value={item}
                onChange={(e) => {
                    onActivity()
                    setItem(e.target.value)
                }}
                maxLength={128}
                autoComplete="off"
            />
            <div
                className="scr"
                style={{
                    display: "flex",
                    gap: 6,
                    overflowX: "auto",
                    paddingBottom: 4,
                }}
            >
                {INCOME_CATEGORIES.map((c) => (
                    <button
                        key={c.key}
                        type="button"
                        className="chip"
                        aria-pressed={category === c.key}
                        style={
                            category === c.key
                                ? {
                                      borderColor: c.color,
                                      color: c.color,
                                      fontWeight: 700,
                                  }
                                : undefined
                        }
                        onClick={() => {
                            onActivity()
                            setCategory(c.key)
                        }}
                    >
                        {c.key}
                    </button>
                ))}
            </div>
            <div style={{ display: "flex", gap: 9 }}>
                <button
                    type="button"
                    className="btn secondary"
                    style={{ flex: 1 }}
                    onClick={onCancel}
                    disabled={saving}
                >
                    취소
                </button>
                <button
                    type="button"
                    className="btn"
                    style={{ flex: 2 }}
                    onClick={submit}
                    disabled={saving}
                >
                    {saving ? "저장 중…" : "저장"}
                </button>
            </div>
        </div>
    )
}
