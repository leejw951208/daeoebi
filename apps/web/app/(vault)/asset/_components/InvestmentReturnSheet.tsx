"use client"
// 투자 수익률 입력 바텀시트. 원금(base)은 그대로 유지한 채 수익률(returnRate)만 수정한다.
// 저장 시 base 를 다시 sealInvestment 로 암호화해 returnRate 와 함께 보낸다(base 는 평문 그대로 유지).
import { useState } from "react"
import { Button } from "@/components/Button"
import { useVault } from "../../_lib/vault-context"
import { saveInvestment } from "@/lib/vault-client"
import { sealInvestment } from "../_lib/asset-payload"
import { RETURN_RATE_PRESETS } from "../_lib/asset-categories"

interface Props {
    base: number // 기존 투자 원금(수정 대상 아님, 그대로 재암호화해 보낸다).
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
    const [saving, setSaving] = useState(false)
    const [saveFailed, setSaveFailed] = useState(false)

    async function save() {
        if (saving) return
        setSaving(true)
        setSaveFailed(false)
        try {
            const blob = await sealInvestment(vaultKey, { base })
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
                <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>
                    투자 수익률
                </div>
                <p className="muted" style={{ fontSize: 13, marginBottom: 16 }}>
                    현재 수익률을 입력하면 평가금액과 손익이 자동으로 계산돼요.
                </p>

                <div
                    className="income-input"
                    style={{
                        height: 64,
                        marginBottom: 12,
                        borderColor: "#ececec",
                    }}
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

                <div style={{ display: "flex", gap: 9 }}>
                    <Button
                        variant="secondary"
                        style={{ flex: 1 }}
                        onClick={onClose}
                        disabled={saving}
                    >
                        취소
                    </Button>
                    <Button
                        variant="primary"
                        style={{ flex: 2 }}
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
        </div>
    )
}
