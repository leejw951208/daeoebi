"use client"
// 투자 현황 입력 바텀시트. 투자 원금(base)과 수익률(returnRate)을 함께 수정한다.
// 저장 시 base 를 sealInvestment 로 암호화해 returnRate(평문)와 함께 보낸다.
import { useState } from "react"
import { Button } from "@/components/Button"
import { useVault } from "../../_lib/vault-context"
import { saveInvestment } from "@/lib/vault-client"
import { sealInvestment } from "../_lib/asset-payload"
import { RETURN_RATE_PRESETS, formatAmount } from "../_lib/asset-categories"

const MAX_AMOUNT_DIGITS = 12
const ACCENT = "#7b61ff"

interface Props {
    base: number // 현재 투자 원금 베이스(수정 가능).
    returnRate: string // 현재 저장된 수익률(빈 문자열=미설정).
    onChanged: () => void | Promise<void>
    onClose: () => void
}

export function InvestmentReturnSheet({
    base,
    returnRate,
    onChanged,
    onClose,
}: Props) {
    const { vaultKey, resetIdle } = useVault()
    const [returnDraft, setReturnDraft] = useState(returnRate)
    const [baseDraft, setBaseDraft] = useState(base > 0 ? String(base) : "")
    const [saving, setSaving] = useState(false)
    const [saveFailed, setSaveFailed] = useState(false)
    const [focusedField, setFocusedField] = useState<string | null>(null)

    const baseValue = Number(baseDraft || "0")

    async function save() {
        if (saving) return
        setSaving(true)
        setSaveFailed(false)
        try {
            const blob = await sealInvestment(vaultKey, { base: baseValue })
            await saveInvestment(returnDraft.trim(), blob)
            await onChanged()
            onClose()
        } catch {
            setSaveFailed(true)
        } finally {
            setSaving(false)
        }
    }

    return (
        <div
            className="dialog-backdrop"
            role="dialog"
            aria-modal="true"
            aria-label="투자 수익률"
            onClick={(e) => {
                if (e.target === e.currentTarget && !saving) onClose()
            }}
        >
            <div className="sheet">
                <div className="sheet-grip" aria-hidden="true" />
                <div
                    style={{
                        fontSize: 18,
                        fontWeight: 800,
                        marginBottom: 4,
                        letterSpacing: "-0.02em",
                    }}
                >
                    투자 수익률
                </div>
                <p className="muted" style={{ fontSize: 13, marginBottom: 18 }}>
                    투자 원금과 수익률을 입력하면 평가금액과 손익이 자동으로
                    계산돼요.
                </p>

                <div
                    className="field-label"
                    style={{ marginBottom: 7, fontSize: 11.5 }}
                >
                    투자 원금
                </div>
                <div
                    className="income-input"
                    style={{
                        marginBottom: 16,
                        ...(focusedField === "base"
                            ? { borderColor: ACCENT }
                            : {}),
                    }}
                    onFocus={() => setFocusedField("base")}
                    onBlur={() => setFocusedField(null)}
                >
                    <span aria-hidden="true">₩</span>
                    <input
                        inputMode="numeric"
                        value={baseDraft ? formatAmount(baseValue) : ""}
                        placeholder="0"
                        aria-label="투자 원금"
                        onChange={(e) => {
                            resetIdle()
                            setBaseDraft(
                                e.target.value
                                    .replace(/[^\d]/g, "")
                                    .slice(0, MAX_AMOUNT_DIGITS),
                            )
                        }}
                    />
                </div>

                <div
                    className="field-label"
                    style={{ marginBottom: 7, fontSize: 11.5 }}
                >
                    수익률
                </div>
                <div
                    className="income-input"
                    style={{
                        height: 64,
                        padding: "0 18px",
                        marginBottom: 12,
                        borderColor:
                            focusedField === "rate" ? ACCENT : "#ececec",
                    }}
                    onFocus={() => setFocusedField("rate")}
                    onBlur={() => setFocusedField(null)}
                >
                    <input
                        inputMode="decimal"
                        value={returnDraft}
                        placeholder="0"
                        aria-label="투자 수익률(%)"
                        onChange={(e) => {
                            resetIdle()
                            setReturnDraft(
                                e.target.value.replace(/[^0-9.-]/g, ""),
                            )
                        }}
                        style={{
                            textAlign: "right",
                            fontSize: 34,
                            color: "#7b61ff",
                        }}
                    />
                    <span
                        aria-hidden="true"
                        style={{
                            fontSize: 30,
                            fontWeight: 800,
                            color: "#7b61ff",
                            flexShrink: 0,
                        }}
                    >
                        %
                    </span>
                </div>
                <div style={{ display: "flex", gap: 7, marginBottom: 20 }}>
                    {RETURN_RATE_PRESETS.map((p) => (
                        <button
                            key={p.value}
                            type="button"
                            onClick={() => {
                                resetIdle()
                                setReturnDraft(String(p.value))
                            }}
                            style={{
                                flex: 1,
                                height: 36,
                                border: "1px solid #e8e8e8",
                                borderRadius: 999,
                                background: "#fff",
                                font: "inherit",
                                fontSize: 12.5,
                                fontWeight: 700,
                                color: "#666",
                                cursor: "pointer",
                            }}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>

                {saveFailed && (
                    <div
                        role="alert"
                        className="error-box"
                        style={{ marginBottom: 12 }}
                    >
                        저장하지 못했어요. 다시 시도해 주세요.
                    </div>
                )}

                <Button
                    variant="primary"
                    style={{
                        width: "100%",
                        background: ACCENT,
                        boxShadow: "0 8px 22px -8px #7b61ff",
                    }}
                    onClick={() => {
                        resetIdle()
                        void save()
                    }}
                    loading={saving}
                >
                    저장
                </Button>
            </div>
        </div>
    )
}
