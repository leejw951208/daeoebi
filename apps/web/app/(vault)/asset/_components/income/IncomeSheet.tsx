"use client"
// 월 수입 관리 바텀시트. 그 달 수입 목록 + 추가/편집/삭제. 금액·항목·카테고리는 VK 로 암호화 저장.
import { useState } from "react"
import { ConfirmDialog } from "@/components/ConfirmDialog"
import { useVault } from "../../../_lib/vault-context"
import { createIncome, updateIncome, deleteIncome } from "@/lib/vault-client"
import { sealIncome } from "../../_lib/asset-payload"
import { formatWon } from "../../_lib/asset-categories"
import { totalIncome, type ComputedIncome } from "../../_lib/asset-compute"
import { IncomeRow } from "./IncomeRow"
import { IncomeEntryForm, type IncomeDraft } from "./IncomeEntryForm"

interface Props {
    month: string
    monthLabel: string
    incomes: ComputedIncome[]
    onChanged: () => void | Promise<void> // 대시보드 load 재호출
    onClose: () => void
}

type Mode =
    | { kind: "list" }
    | { kind: "add" }
    | { kind: "edit"; target: ComputedIncome }

export function IncomeSheet({
    month,
    monthLabel,
    incomes,
    onChanged,
    onClose,
}: Props) {
    const { vaultKey, resetIdle } = useVault()
    const [mode, setMode] = useState<Mode>({ kind: "list" })
    const [saving, setSaving] = useState(false)
    const [pendingDelete, setPendingDelete] = useState<ComputedIncome | null>(
        null,
    )

    async function save(draft: IncomeDraft) {
        if (saving) return
        setSaving(true)
        try {
            const blob = await sealIncome(vaultKey, draft)
            if (mode.kind === "edit") {
                await updateIncome(mode.target.id, blob)
            } else {
                await createIncome({ month, ...blob })
            }
            setMode({ kind: "list" })
            await onChanged()
        } catch {
            // 실패 시 폼 유지(사용자 재시도).
        } finally {
            setSaving(false)
        }
    }

    async function confirmDelete() {
        if (!pendingDelete) return
        const target = pendingDelete
        setPendingDelete(null)
        try {
            await deleteIncome(target.id)
            await onChanged()
        } catch {
            // 무시(목록 그대로).
        }
    }

    return (
        <div
            className="dialog-backdrop"
            role="dialog"
            aria-modal="true"
            aria-label="월 수입 관리"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose()
            }}
        >
            <div className="sheet">
                <div className="sheet-grip" aria-hidden="true" />
                <div
                    style={{
                        display: "flex",
                        alignItems: "baseline",
                        justifyContent: "space-between",
                        marginBottom: 4,
                    }}
                >
                    <div style={{ fontSize: 18, fontWeight: 800 }}>월 수입</div>
                    <div
                        style={{
                            fontSize: 12,
                            color: "var(--color-text-muted)",
                            fontWeight: 600,
                        }}
                    >
                        {monthLabel}
                    </div>
                </div>
                <p className="muted" style={{ fontSize: 13, marginBottom: 16 }}>
                    이 달 총수입 {formatWon(totalIncome(incomes))}
                </p>

                {mode.kind === "list" ? (
                    <>
                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 9,
                            }}
                        >
                            {incomes.length === 0 ? (
                                <div
                                    style={{
                                        textAlign: "center",
                                        padding: "22px 0",
                                        fontSize: 13,
                                        color: "var(--color-text-muted)",
                                        fontWeight: 600,
                                    }}
                                >
                                    이 달 수입이 없어요
                                </div>
                            ) : (
                                incomes.map((inc) => (
                                    <IncomeRow
                                        key={inc.id}
                                        income={inc}
                                        onEdit={() => {
                                            resetIdle()
                                            setMode({
                                                kind: "edit",
                                                target: inc,
                                            })
                                        }}
                                        onDelete={() => {
                                            resetIdle()
                                            setPendingDelete(inc)
                                        }}
                                    />
                                ))
                            )}
                        </div>
                        <button
                            type="button"
                            className="btn"
                            style={{ width: "100%", marginTop: 16 }}
                            onClick={() => {
                                resetIdle()
                                setMode({ kind: "add" })
                            }}
                        >
                            + 수입 추가
                        </button>
                    </>
                ) : (
                    <IncomeEntryForm
                        initial={
                            mode.kind === "edit"
                                ? {
                                      item: mode.target.item,
                                      amount: mode.target.amount,
                                      category: mode.target.category,
                                  }
                                : undefined
                        }
                        saving={saving}
                        onSubmit={save}
                        onCancel={() => {
                            resetIdle()
                            setMode({ kind: "list" })
                        }}
                        onActivity={resetIdle}
                    />
                )}
            </div>

            {pendingDelete && (
                <ConfirmDialog
                    open
                    title="수입 삭제"
                    message={`'${pendingDelete.item || pendingDelete.category}' 수입을 삭제할까요?`}
                    confirmLabel="삭제"
                    destructive
                    onConfirm={confirmDelete}
                    onCancel={() => setPendingDelete(null)}
                />
            )}
        </div>
    )
}
