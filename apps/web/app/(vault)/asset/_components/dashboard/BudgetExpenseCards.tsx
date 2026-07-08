"use client"
// 자산 대시보드의 예산·지출 요약 카드 한 쌍. 예산 카드 탭 시 예산 설정 시트를 연다.
import { type PointerEvent } from "react"
import { formatWon } from "../../_lib/asset-categories"

interface Props {
    budget: number
    spent: number
    count: number
    onOpenBudget: () => void
}

// 누름(active) 시 축소 스케일. 디자인 style-active 를 인라인 포인터 이벤트로 재현한다.
function pressScale(scale: number) {
    const reset = (e: PointerEvent<HTMLElement>) => {
        e.currentTarget.style.transform = ""
    }
    return {
        onPointerDown: (e: PointerEvent<HTMLElement>) => {
            e.currentTarget.style.transform = `scale(${scale})`
        },
        onPointerUp: reset,
        onPointerLeave: reset,
        onPointerCancel: reset,
    }
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
                style={{
                    flex: 1,
                    textAlign: "left",
                    cursor: "pointer",
                    padding: 16,
                    transition: "transform .12s",
                }}
                onClick={onOpenBudget}
                {...pressScale(0.98)}
            >
                <div className="asset-card-label" style={{ color: "#9a9a9a" }}>
                    이번 달 예산
                </div>
                <div className="asset-card-value">{formatWon(budget)}</div>
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
            <div className="asset-card" style={{ flex: 1, padding: 16 }}>
                <div className="asset-card-label" style={{ color: "#9a9a9a" }}>
                    지출
                </div>
                <div
                    className="asset-card-value"
                    style={{ color: "var(--color-danger-fg)" }}
                >
                    {formatWon(spent)}
                </div>
                <div
                    style={{
                        fontSize: 11,
                        color: "#bcbcbc",
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
