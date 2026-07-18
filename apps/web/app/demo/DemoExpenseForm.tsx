"use client"
// 데모용 지출 추가 폼(로컬 상태). 실제 ExpenseForm 의 축약본.
import { useState } from "react"
import type { AssetCategory } from "@/lib/vault-client"
import type { ComputedExpense } from "../(vault)/asset/_lib/asset-compute"
import { Button } from "@/components/Button"
import { formatAmount } from "../(vault)/asset/_lib/asset-categories"
import { DEMO_MONTH } from "./demo-asset-data"

interface DemoExpenseFormProps {
    categories: AssetCategory[]
    onSave: (expense: ComputedExpense) => void
    onCancel: () => void
}

let demoExpSeq = 0

export function DemoExpenseForm({
    categories,
    onSave,
    onCancel,
}: DemoExpenseFormProps) {
    const [amount, setAmount] = useState("")
    const [item, setItem] = useState("")
    const [categoryId, setCategoryId] = useState<string | null>(
        categories[0]?.id ?? null,
    )
    const [date, setDate] = useState(`${DEMO_MONTH}-15`)

    const amountNum = Number(amount || "0")
    // 실제 ExpenseForm 과 동일: 콤마 포함 표시 길이에 맞춰 입력 폭·글자 크기를 정한다.
    const amountShown = amount ? formatAmount(amountNum) : ""
    const amountLen = amountShown.length
    const amountFontSize = amountLen <= 7 ? 40 : amountLen <= 11 ? 32 : 24

    function save() {
        if (amountNum <= 0) return
        demoExpSeq += 1
        onSave({
            id: `demo-exp-${demoExpSeq}`,
            date,
            recurringId: null,
            item: item.trim(),
            amount: amountNum,
            categoryId,
        })
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
                <div style={{ fontSize: 15, fontWeight: 700 }}>지출 추가</div>
                <button
                    type="button"
                    className="btn-text"
                    onClick={save}
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
                {/* 금액 */}
                <div style={{ textAlign: "center", padding: "14px 0 4px" }}>
                    <div
                        className="field-label"
                        style={{ marginBottom: 10, color: "#a0a0a0" }}
                    >
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
                            size={Math.max(1, amountLen)}
                            aria-label="금액"
                            value={amountShown}
                            onChange={(e) =>
                                setAmount(
                                    e.target.value
                                        .replace(/[^\d]/g, "")
                                        .slice(0, 12),
                                )
                            }
                            placeholder="0"
                            style={{
                                width: "auto",
                                minWidth: 60,
                                maxWidth: "100%",
                                border: "none",
                                background: "none",
                                fontSize: amountFontSize,
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
                        onChange={(e) => setItem(e.target.value)}
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
                                    className="chip"
                                    aria-pressed={active}
                                    onClick={() => setCategoryId(c.id)}
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
                                            marginRight: 6,
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
                        onChange={(e) => setDate(e.target.value)}
                        aria-label="날짜"
                        className="field-control"
                    />
                </div>

                <Button
                    type="button"
                    variant="primary"
                    onClick={save}
                    disabled={amountNum <= 0}
                    style={{ width: "100%" }}
                >
                    저장
                </Button>
            </div>
        </section>
    )
}
