"use client"
// 자산 대시보드의 "이번 달 남은 예산" hero 카드. 남은 예산·지출 진행 바·예산을 보여준다.
import { formatWon } from "../../_lib/asset-categories"

interface Props {
    left: number
    pct: number
    budget: number
}

export function RemainingHero({ left, pct, budget }: Props) {
    return (
        <div
            className="asset-card"
            style={{ borderRadius: 20, padding: "20px 18px" }}
        >
            <div
                style={{
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: "var(--color-text-muted)",
                    marginBottom: 7,
                }}
            >
                이번 달 남은 예산
            </div>
            <div
                style={{
                    fontSize: 34,
                    fontWeight: 800,
                    letterSpacing: "-0.03em",
                    color: left < 0 ? "var(--color-danger-fg)" : "#171717",
                }}
            >
                {formatWon(left)}
            </div>
            <div className="asset-bar" style={{ margin: "16px 0 10px" }}>
                <div
                    className="asset-bar-fill"
                    style={{
                        width: `${pct}%`,
                        background:
                            pct >= 100 ? "var(--color-danger-fg)" : "var(--ac)",
                    }}
                />
            </div>
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--color-text-muted)",
                }}
            >
                <span>지출 {pct}%</span>
                <span>예산 {formatWon(budget)}</span>
            </div>
        </div>
    )
}
