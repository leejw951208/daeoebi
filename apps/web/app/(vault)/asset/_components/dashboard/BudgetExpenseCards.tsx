"use client"
// 자산 대시보드의 예산·지출 요약 카드 한 쌍. 예산 카드 탭 시 예산 설정 시트를 연다.
import { formatWon } from "../../_lib/asset-categories"

interface Props {
    budget: number
    spent: number
    count: number
    onOpenBudget: () => void
}

export function BudgetExpenseCards({
    budget,
    spent,
    count,
    onOpenBudget,
}: Props) {
    return (
        <div style={{ display: "flex", gap: 12 }}>
            <button
                type="button"
                className="asset-card"
                style={{ flex: 1, textAlign: "left", cursor: "pointer" }}
                onClick={onOpenBudget}
            >
                <div className="asset-card-label">이번 달 예산</div>
                <div className="asset-card-value">
                    {budget ? formatWon(budget) : "설정하기"}
                </div>
                <div
                    style={{
                        fontSize: 11,
                        color: "var(--ac)",
                        fontWeight: 700,
                        marginTop: 5,
                    }}
                >
                    수정 ›
                </div>
            </button>
            <div className="asset-card" style={{ flex: 1 }}>
                <div className="asset-card-label">지출</div>
                <div
                    className="asset-card-value"
                    style={{ color: "var(--color-danger-fg)" }}
                >
                    {formatWon(spent)}
                </div>
                <div
                    style={{
                        fontSize: 11,
                        color: "var(--color-text-muted)",
                        fontWeight: 600,
                        marginTop: 5,
                    }}
                >
                    {count}건
                </div>
            </div>
        </div>
    )
}
