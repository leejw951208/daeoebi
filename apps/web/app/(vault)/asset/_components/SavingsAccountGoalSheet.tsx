"use client"
// 적금 목표 수정 바텀시트. 현재 저축액(base)은 유지한 채 목표 금액만 바꾼다.
// 저장=updateSavingsAccount(id, sealAccount({base,goal})). 계좌 자체를 지우는 "적금 삭제"도 여기서 처리한다.
import { useState } from "react"
import { Button } from "@/components/Button"
import { toast } from "@/components/toast"
import { useVault } from "../../_lib/vault-context"
import { updateSavingsAccount, deleteSavingsAccount } from "@/lib/vault-client"
import { sealAccount } from "../_lib/asset-payload"
import {
    formatAmount,
    formatWon,
    SAVINGS_GOAL_PRESETS,
} from "../_lib/asset-categories"

const MAX_AMOUNT_DIGITS = 12
const ACCENT = "#20a4a4"

// 목표 시트가 다루는 계좌 정보. base 는 그대로 유지, goal 만 수정 대상이다.
// month 는 "현재 모았어요" 안내 문구 표시용(수정 대상 아님, total=base+month).
export interface EditingAccount {
    id: string
    name: string
    color: string
    base: number
    goal: number
    month: number
}

interface Props {
    account: EditingAccount
    onChanged: () => void | Promise<void>
    onClose: () => void
}

export function SavingsAccountGoalSheet({
    account,
    onChanged,
    onClose,
}: Props) {
    const { vaultKey, resetIdle } = useVault()
    const [goal, setGoal] = useState(
        account.goal > 0 ? String(account.goal) : "",
    )
    const [saving, setSaving] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [focused, setFocused] = useState(false)
    const goalValue = Number(goal || "0")
    const currentTotal = account.base + account.month

    async function save() {
        if (saving || goalValue <= 0) return
        setSaving(true)
        try {
            const blob = await sealAccount(vaultKey, {
                base: account.base,
                goal: goalValue,
            })
            await updateSavingsAccount(account.id, blob)
            await onChanged()
            onClose()
        } catch {
            toast("저장하지 못했어요. 다시 시도해 주세요.")
        } finally {
            setSaving(false)
        }
    }

    async function deleteAccount() {
        if (deleting) return
        setDeleting(true)
        try {
            await deleteSavingsAccount(account.id)
            await onChanged()
            onClose()
        } catch {
            toast("삭제하지 못했어요. 다시 시도해 주세요.")
        } finally {
            setDeleting(false)
        }
    }

    return (
        <div
            className="dialog-backdrop"
            role="dialog"
            aria-modal="true"
            aria-label={`${account.name} 목표`}
            onClick={(e) => {
                if (e.target === e.currentTarget && !saving && !deleting)
                    onClose()
            }}
        >
            <div className="sheet">
                <div className="sheet-grip" aria-hidden="true" />
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 9,
                        marginBottom: 4,
                    }}
                >
                    <span
                        style={{
                            width: 11,
                            height: 11,
                            borderRadius: "50%",
                            background: account.color,
                        }}
                    />
                    <div
                        style={{
                            fontSize: 18,
                            fontWeight: 800,
                            letterSpacing: "-0.02em",
                        }}
                    >
                        {account.name} 목표
                    </div>
                </div>
                <p
                    className="muted"
                    style={{
                        fontSize: 13,
                        color: "#9a9a9a",
                        lineHeight: 1.5,
                        marginBottom: 18,
                    }}
                >
                    이 적금에서 모을 금액을 정하면 진행률이 자동으로 계산돼요.
                    현재 {formatWon(currentTotal)} 모았어요.
                </p>

                <div
                    style={{
                        fontSize: 11.5,
                        fontWeight: 700,
                        color: "#a0a0a0",
                        marginBottom: 7,
                    }}
                >
                    목표 금액
                </div>
                <div
                    className="income-input"
                    style={{
                        marginBottom: 12,
                        ...(focused ? { borderColor: ACCENT } : {}),
                    }}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                >
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

                <Button
                    variant="primary"
                    style={{
                        width: "100%",
                        background: ACCENT,
                        boxShadow: "0 8px 22px -8px #20a4a4",
                    }}
                    onClick={() => {
                        resetIdle()
                        void save()
                    }}
                    loading={saving}
                    disabled={goalValue <= 0}
                >
                    저장
                </Button>
                <button
                    type="button"
                    className="btn-text"
                    style={{
                        width: "100%",
                        height: 46,
                        justifyContent: "center",
                        marginTop: 2,
                        fontWeight: 700,
                        color: "#e5484d",
                    }}
                    disabled={saving || deleting}
                    onClick={() => {
                        resetIdle()
                        void deleteAccount()
                    }}
                >
                    적금 삭제
                </button>
            </div>
        </div>
    )
}
