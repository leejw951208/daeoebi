"use client"
// 적금 추가 바텀시트. 이름 + 현재 저축액(base, 선택) + 목표 금액(goal, 선택) + 목표 프리셋.
// 본문(base/goal)은 VK 로 암호화 저장(sealAccount → createSavingsAccount). 색은 ADD_COLORS 를
// 계좌 개수만큼 순환해 배정한다(설계 v5 ADD_COLORS 팔레트).
import { useState } from "react"
import { Button } from "@/components/Button"
import { useVault } from "../../_lib/vault-context"
import { createSavingsAccount } from "@/lib/vault-client"
import { sealAccount } from "../_lib/asset-payload"
import { formatAmount, SAVINGS_GOAL_PRESETS } from "../_lib/asset-categories"

const MAX_AMOUNT_DIGITS = 12
const MAX_NAME_LENGTH = 40

// 디자인 v5 ADD_COLORS: 새 적금에 순환 배정하는 저축 톤 팔레트.
const ADD_COLORS = [
    "#178a8a",
    "#2bb3a8",
    "#3a9d94",
    "#5cbdb9",
    "#0f766e",
    "#7cc9c4",
]

interface Props {
    // 색 순환 배정에 쓰는 현재 계좌 수.
    accountCount: number
    // 중복 이름 방지(이름이 계좌 식별 앵커라 클라이언트에서 먼저 막는다).
    existingNames: readonly string[]
    onSaved: () => void | Promise<void>
    onClose: () => void
}

export function SavingsAccountAddSheet({
    accountCount,
    existingNames,
    onSaved,
    onClose,
}: Props) {
    const { vaultKey, resetIdle } = useVault()
    const [name, setName] = useState("")
    const [base, setBase] = useState("")
    const [goal, setGoal] = useState("")
    const [saving, setSaving] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)

    const baseValue = Number(base || "0")
    const goalValue = Number(goal || "0")
    const trimmedName = name.trim()

    async function save() {
        if (saving || !trimmedName) return
        if (existingNames.includes(trimmedName)) {
            setErrorMessage("이미 있는 적금 이름이에요.")
            return
        }
        setSaving(true)
        setErrorMessage(null)
        try {
            const color = ADD_COLORS[accountCount % ADD_COLORS.length]
            const blob = await sealAccount(vaultKey, {
                base: baseValue,
                goal: goalValue,
            })
            await createSavingsAccount(trimmedName, color, blob)
            await onSaved()
            onClose()
        } catch {
            setErrorMessage("저장하지 못했어요. 다시 시도해 주세요.")
        } finally {
            setSaving(false)
        }
    }

    return (
        <div
            className="dialog-backdrop"
            role="dialog"
            aria-modal="true"
            aria-label="적금 추가"
            onClick={(e) => {
                if (e.target === e.currentTarget && !saving) onClose()
            }}
        >
            <div className="sheet">
                <div className="sheet-grip" aria-hidden="true" />
                <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>
                    적금 추가
                </div>
                <p className="muted" style={{ fontSize: 13, marginBottom: 16 }}>
                    지출을 이 이름의 &lsquo;저축&rsquo;으로 분류하면 매달
                    자동으로 합산돼요.
                </p>

                <div
                    style={{
                        fontSize: 11.5,
                        fontWeight: 700,
                        color: "#a0a0a0",
                        marginBottom: 7,
                    }}
                >
                    적금 이름
                </div>
                <input
                    className="field-control"
                    placeholder="예: 청년도약계좌, 여행 자금"
                    value={name}
                    maxLength={MAX_NAME_LENGTH}
                    aria-label="적금 이름"
                    onChange={(e) => {
                        resetIdle()
                        setName(e.target.value)
                        setErrorMessage(null)
                    }}
                    style={{ marginBottom: 16 }}
                />

                <div
                    style={{
                        fontSize: 11.5,
                        fontWeight: 700,
                        color: "#a0a0a0",
                        marginBottom: 7,
                    }}
                >
                    현재 저축액{" "}
                    <span style={{ color: "#cbcbcb", fontWeight: 600 }}>
                        · 선택
                    </span>
                </div>
                <div className="income-input" style={{ marginBottom: 16 }}>
                    <span aria-hidden="true">₩</span>
                    <input
                        inputMode="numeric"
                        value={base ? formatAmount(baseValue) : ""}
                        placeholder="0"
                        aria-label="현재 저축액"
                        onChange={(e) => {
                            resetIdle()
                            setBase(
                                e.target.value
                                    .replace(/[^\d]/g, "")
                                    .slice(0, MAX_AMOUNT_DIGITS),
                            )
                        }}
                    />
                </div>

                <div
                    style={{
                        fontSize: 11.5,
                        fontWeight: 700,
                        color: "#a0a0a0",
                        marginBottom: 7,
                    }}
                >
                    목표 금액{" "}
                    <span style={{ color: "#cbcbcb", fontWeight: 600 }}>
                        · 선택
                    </span>
                </div>
                <div className="income-input" style={{ marginBottom: 12 }}>
                    <span aria-hidden="true">₩</span>
                    <input
                        inputMode="numeric"
                        value={goal ? formatAmount(goalValue) : ""}
                        placeholder="0"
                        aria-label="목표 금액"
                        onChange={(e) => {
                            resetIdle()
                            setGoal(
                                e.target.value
                                    .replace(/[^\d]/g, "")
                                    .slice(0, MAX_AMOUNT_DIGITS),
                            )
                        }}
                    />
                </div>
                <div style={{ display: "flex", gap: 7, marginBottom: 20 }}>
                    {SAVINGS_GOAL_PRESETS.map((p) => (
                        <button
                            key={p.value}
                            type="button"
                            onClick={() => {
                                resetIdle()
                                setGoal(String(p.value))
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

                {errorMessage && (
                    <div
                        role="alert"
                        className="error-box"
                        style={{ marginBottom: 12 }}
                    >
                        {errorMessage}
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
                        disabled={!trimmedName}
                    >
                        적금 추가
                    </Button>
                </div>
            </div>
        </div>
    )
}
