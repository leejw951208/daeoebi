"use client"
// 저축·투자 탭. 저축/투자 순자산·이번 달 적립·저축 목표 진행률·적립 내역을 보여준다.
// 데이터(누적/월별/목표)는 부모(asset/page)가 복호화해 props 로 넘긴다.
import Link from "next/link"
import type { SavingsSummary } from "../../_lib/asset-compute"
import { goalProgress } from "../../_lib/asset-compute"
import { formatWon } from "../../_lib/asset-categories"

export interface Contribution {
    id: string
    item: string
    amount: number
    categoryName: string
    date: string
}

interface SavingsTabProps {
    summary: SavingsSummary
    savedMonth: number
    investMonth: number
    goalName: string | null
    goalAmount: number
    contributions: Contribution[]
    onEditGoal: () => void
}

export function SavingsTab({
    summary,
    savedMonth,
    investMonth,
    goalName,
    goalAmount,
    contributions,
    onEditGoal,
}: SavingsTabProps) {
    const pct = goalProgress(summary.savedTotal, goalAmount)
    const monthContrib = savedMonth + investMonth
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* 순자산 */}
            <div className="asset-card" style={{ borderRadius: 20 }}>
                <div className="asset-card-label">저축·투자 순자산</div>
                <div
                    style={{
                        fontSize: 32,
                        fontWeight: 800,
                        letterSpacing: "-0.03em",
                    }}
                >
                    {formatWon(summary.netWorth)}
                </div>
                <div
                    style={{
                        fontSize: 12.5,
                        color: "var(--color-text-muted)",
                        fontWeight: 600,
                        marginTop: 8,
                    }}
                >
                    이번 달 {formatWon(monthContrib)} 적립 ·{" "}
                    {contributions.length}건
                </div>
            </div>

            {/* 저축 / 투자 카드 */}
            <div style={{ display: "flex", gap: 12 }}>
                <div className="asset-card" style={{ flex: 1 }}>
                    <div className="asset-card-label">저축</div>
                    <div className="asset-card-value">
                        {formatWon(summary.savedTotal)}
                    </div>
                    <div
                        style={{
                            fontSize: 11,
                            color: "#20a4a4",
                            fontWeight: 700,
                            marginTop: 5,
                        }}
                    >
                        이번 달 {formatWon(savedMonth)}
                    </div>
                </div>
                <div className="asset-card" style={{ flex: 1 }}>
                    <div className="asset-card-label">투자</div>
                    <div className="asset-card-value">
                        {formatWon(summary.investTotal)}
                    </div>
                    <div
                        style={{
                            fontSize: 11,
                            color: "#7b61ff",
                            fontWeight: 700,
                            marginTop: 5,
                        }}
                    >
                        이번 달 {formatWon(investMonth)}
                    </div>
                </div>
            </div>

            {/* 저축 목표 */}
            <button
                type="button"
                className="asset-card"
                onClick={onEditGoal}
                style={{ textAlign: "left", cursor: "pointer" }}
            >
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: 12,
                    }}
                >
                    <span style={{ fontWeight: 800, fontSize: 13 }}>
                        저축 목표{goalName ? ` · ${goalName}` : ""}
                    </span>
                    <span
                        style={{
                            fontWeight: 800,
                            fontSize: 12.5,
                            color: "#20a4a4",
                        }}
                    >
                        {goalAmount > 0 ? `${pct}%` : "설정하기"}
                    </span>
                </div>
                <div className="asset-bar">
                    <div
                        className="asset-bar-fill"
                        style={{ width: `${pct}%`, background: "#20a4a4" }}
                    />
                </div>
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 12,
                        color: "var(--color-text-muted)",
                        fontWeight: 600,
                        marginTop: 9,
                    }}
                >
                    <span>{formatWon(summary.savedTotal)}</span>
                    <span>
                        목표 {goalAmount > 0 ? formatWon(goalAmount) : "-"}
                    </span>
                </div>
            </button>

            {/* 이번 달 적립 내역 */}
            <div className="asset-card">
                <div
                    style={{ fontWeight: 800, fontSize: 13, marginBottom: 12 }}
                >
                    이번 달 적립 내역
                </div>
                {contributions.length === 0 ? (
                    <div
                        style={{
                            textAlign: "center",
                            padding: "18px 0",
                            fontSize: 13,
                            color: "var(--color-text-muted)",
                            fontWeight: 600,
                        }}
                    >
                        이번 달 적립이 없어요
                    </div>
                ) : (
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 9,
                        }}
                    >
                        {contributions.map((c) => (
                            <Link
                                key={c.id}
                                href={`/asset/${c.id}`}
                                className="entry-card"
                                style={{ justifyContent: "space-between" }}
                            >
                                <span style={{ fontSize: 15, fontWeight: 700 }}>
                                    {c.item}
                                </span>
                                <span
                                    style={{
                                        fontSize: 12,
                                        color: "var(--color-text-muted)",
                                    }}
                                >
                                    {c.categoryName}
                                </span>
                                <span style={{ fontSize: 15, fontWeight: 800 }}>
                                    {formatWon(c.amount)}
                                </span>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
