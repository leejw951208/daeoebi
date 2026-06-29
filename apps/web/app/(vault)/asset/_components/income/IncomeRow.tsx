"use client"
// 수입 관리 시트의 한 행. 카테고리 색 점·카테고리·항목명·금액 + 편집/삭제.
import { incomeCategoryColor, formatWon } from "../../_lib/asset-categories"
import type { ComputedIncome } from "../../_lib/asset-compute"

interface Props {
    income: ComputedIncome
    onEdit: () => void
    onDelete: () => void
}

export function IncomeRow({ income, onEdit, onDelete }: Props) {
    return (
        <div
            className="entry-card"
            style={{ display: "flex", alignItems: "center", gap: 13 }}
        >
            <button
                type="button"
                onClick={onEdit}
                aria-label={`${income.item || income.category} 편집`}
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 13,
                    flex: 1,
                    minWidth: 0,
                    background: "none",
                    border: "none",
                    font: "inherit",
                    textAlign: "left",
                    cursor: "pointer",
                    padding: 0,
                }}
            >
                <span
                    className="avatar"
                    aria-hidden="true"
                    style={{ background: incomeCategoryColor(income.category) }}
                >
                    {income.category.slice(0, 1)}
                </span>
                <span className="entry-main" style={{ minWidth: 0 }}>
                    <span className="entry-label">
                        {income.item || income.category}
                    </span>
                    <span
                        style={{
                            fontSize: 12,
                            color: "var(--color-text-muted)",
                            fontWeight: 500,
                        }}
                    >
                        {income.category}
                    </span>
                </span>
                <span
                    style={{
                        fontSize: 15,
                        fontWeight: 800,
                        letterSpacing: "-0.02em",
                    }}
                >
                    {formatWon(income.amount)}
                </span>
            </button>
            <button
                type="button"
                className="secret-btn"
                style={{ color: "#d99" }}
                onClick={onDelete}
                aria-label={`${income.item || income.category} 삭제`}
            >
                ✕
            </button>
        </div>
    )
}
