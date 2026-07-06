"use client"
// 저축 목표 설정 바텀시트. 이름 + 금액(₩). 금액은 VK 로 암호화 저장(sealGoal → saveSavingsGoal).
import { useState } from "react"
import { Button } from "@/components/Button"
import { useVault } from "../../_lib/vault-context"
import { saveSavingsGoal } from "@/lib/vault-client"
import { sealGoal } from "../_lib/asset-payload"
import { formatAmount } from "../_lib/asset-categories"

const MAX_AMOUNT_DIGITS = 12

interface Props {
    initialName: string
    initialAmount: number
    onSaved: () => void | Promise<void>
    onClose: () => void
}

export function SavingsGoalSheet({
    initialName,
    initialAmount,
    onSaved,
    onClose,
}: Props) {
    const { vaultKey, resetIdle } = useVault()
    const [name, setName] = useState(initialName)
    const [amount, setAmount] = useState(
        initialAmount > 0 ? String(initialAmount) : "",
    )
    const [saving, setSaving] = useState(false)
    const [saveFailed, setSaveFailed] = useState(false)
    const value = Number(amount || "0")

    async function save() {
        if (saving || !name.trim() || value <= 0) return
        setSaving(true)
        setSaveFailed(false)
        try {
            const blob = await sealGoal(vaultKey, { amount: value })
            await saveSavingsGoal(name.trim(), blob)
            await onSaved()
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
            aria-label="저축 목표 설정"
            onClick={(e) => {
                if (e.target === e.currentTarget && !saving) onClose()
            }}
        >
            <div className="sheet">
                <div className="sheet-grip" aria-hidden="true" />
                <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>
                    저축 목표
                </div>
                <p className="muted" style={{ fontSize: 13, marginBottom: 16 }}>
                    목표 이름과 금액을 정해두세요.
                </p>
                <input
                    className="field-control"
                    placeholder="예: 비상금"
                    value={name}
                    maxLength={40}
                    aria-label="저축 목표 이름"
                    onChange={(e) => {
                        resetIdle()
                        setName(e.target.value)
                    }}
                    style={{ marginBottom: 12 }}
                />
                <div className="income-input">
                    <span aria-hidden="true">₩</span>
                    <input
                        inputMode="numeric"
                        value={amount ? formatAmount(value) : ""}
                        placeholder="0"
                        aria-label="저축 목표 금액"
                        onChange={(e) => {
                            resetIdle()
                            setAmount(
                                e.target.value
                                    .replace(/[^\d]/g, "")
                                    .slice(0, MAX_AMOUNT_DIGITS),
                            )
                        }}
                    />
                </div>
                {saveFailed && (
                    <div
                        role="alert"
                        className="error-box"
                        style={{ marginTop: 12 }}
                    >
                        저장하지 못했어요. 다시 시도해 주세요.
                    </div>
                )}
                <div style={{ display: "flex", gap: 9, marginTop: 16 }}>
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
                        disabled={!name.trim() || value <= 0}
                    >
                        저장
                    </Button>
                </div>
            </div>
        </div>
    )
}
