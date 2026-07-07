"use client"
// 월 예산 설정 바텀시트. 금액 하나만 입력한다. 서버는 Income 모델을 그대로 재사용하며
// 저장 시 단건으로 수렴한다(planBudgetSave). 금액은 VK 로 암호화 저장.
import { useState } from "react"
import { Button } from "@/components/Button"
import { isApiError } from "@/lib/api-error"
import { useVault } from "../../../_lib/vault-context"
import {
    createIncome,
    updateIncome,
    deleteIncome,
    listIncomes,
} from "@/lib/vault-client"
import {
    BUDGET_CATEGORY,
    BUDGET_ITEM,
    sealIncome,
} from "../../_lib/asset-payload"
import { formatAmount } from "../../_lib/asset-categories"
import {
    planBudgetSave,
    totalIncome,
    type ComputedIncome,
} from "../../_lib/asset-compute"

const MAX_AMOUNT_DIGITS = 12

interface Props {
    month: string
    monthLabel: string
    budgetRows: ComputedIncome[] // 이 달 Income 행. 옛 다건 데이터도 저장 시 1건으로 정리된다.
    onChanged: () => void | Promise<void> // 대시보드 load 재호출
    onClose: () => void
}

// 이미 지워진 행(404)은 성공으로 간주한다. 재시도·다른 탭과의 경합에서 저장이 막히지 않게.
async function deleteRowIgnoringGone(id: string): Promise<void> {
    try {
        await deleteIncome(id)
    } catch (e) {
        if (!(isApiError(e) && e.status === 404)) throw e
    }
}

export function BudgetSheet({ month, budgetRows, onChanged, onClose }: Props) {
    const { vaultKey, resetIdle } = useVault()
    const initialAmount = totalIncome(budgetRows)
    // onChange 에서 digits-only 로 정제해 state 에는 항상 숫자 문자열만 있다.
    const [amount, setAmount] = useState(
        initialAmount > 0 ? String(initialAmount) : "",
    )
    const [saving, setSaving] = useState(false)
    const [saveFailed, setSaveFailed] = useState(false)

    const value = Number(amount || "0")

    async function save() {
        if (saving) return
        setSaving(true)
        setSaveFailed(false)
        try {
            const blob = await sealIncome(vaultKey, {
                item: BUDGET_ITEM,
                amount: value,
                category: BUDGET_CATEGORY,
            })
            // 계획은 서버의 최신 행 기준으로 세운다(id 만 쓰므로 복호화 불필요).
            // stale prop 재시도·다른 탭 변경·복호화 실패로 필터된 행 잔존을 모두 막는다.
            const freshRows = await listIncomes(month)
            const plan = planBudgetSave(freshRows)
            if (plan.kind === "create") {
                await createIncome({ month, ...blob })
            } else {
                // 업데이트 먼저: 여기서 실패하면 기존 행이 그대로 남아 유실이 없다.
                await updateIncome(plan.updateId, blob)
                await Promise.all(plan.deleteIds.map(deleteRowIgnoringGone))
            }
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
            aria-label="월 예산 설정"
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
                    }}
                >
                    월 예산
                </div>
                <p className="muted" style={{ fontSize: 13, marginBottom: 16 }}>
                    이번 달 쓸 수 있는 돈을 정해두세요.
                </p>

                <div className="income-input">
                    <span aria-hidden="true">₩</span>
                    <input
                        inputMode="numeric"
                        style={{ fontSize: 26, letterSpacing: "-0.02em" }}
                        value={amount ? formatAmount(value) : ""}
                        onChange={(e) => {
                            resetIdle()
                            setAmount(
                                e.target.value
                                    .replace(/[^\d]/g, "")
                                    .slice(0, MAX_AMOUNT_DIGITS),
                            )
                        }}
                        placeholder="0"
                        aria-label="월 예산 금액"
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

                <div style={{ marginTop: 16 }}>
                    <Button
                        variant="primary"
                        style={{
                            width: "100%",
                            height: 54,
                            borderRadius: 16,
                            background: "var(--ac)",
                        }}
                        onClick={() => {
                            resetIdle()
                            void save()
                        }}
                        loading={saving}
                        disabled={value <= 0}
                    >
                        저장
                    </Button>
                </div>
            </div>
        </div>
    )
}
