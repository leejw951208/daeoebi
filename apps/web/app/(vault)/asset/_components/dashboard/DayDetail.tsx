"use client"
// 자산 대시보드의 선택일 상세. 그 날 지출 합계와 항목 목록(고정 배지 포함)을 그린다.
import Link from "next/link"
import { categoryColor, formatWon } from "../../_lib/asset-categories"
import { totalSpent, type ComputedExpense } from "../../_lib/asset-compute"

interface Props {
    selectedDay: string
    dayExpenses: ComputedExpense[]
}

export function DayDetail({ selectedDay, dayExpenses }: Props) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    margin: "6px 2px 0",
                }}
            >
                <span style={{ fontSize: 13, fontWeight: 800 }}>
                    {Number(selectedDay.slice(8, 10))}일
                </span>
                <span
                    style={{
                        fontSize: 13,
                        fontWeight: 800,
                        color: "var(--color-danger-fg)",
                    }}
                >
                    {formatWon(totalSpent(dayExpenses))}
                </span>
            </div>
            {dayExpenses.length === 0 ? (
                <div
                    style={{
                        textAlign: "center",
                        padding: "22px 0",
                        fontSize: 13,
                        color: "var(--color-text-muted)",
                        fontWeight: 600,
                    }}
                >
                    이 날은 지출이 없어요
                </div>
            ) : (
                dayExpenses.map((e) => (
                    <Link
                        key={e.id}
                        href={`/asset/${e.id}`}
                        className="entry-card"
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 13,
                        }}
                    >
                        <span
                            className="avatar"
                            aria-hidden="true"
                            style={{ background: categoryColor(e.category) }}
                        >
                            {e.category.slice(0, 1)}
                        </span>
                        <span className="entry-main" style={{ minWidth: 0 }}>
                            <span
                                className="entry-label"
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 6,
                                }}
                            >
                                {e.item || e.category}
                                {e.recurringId && (
                                    <span className="recur-badge">고정</span>
                                )}
                            </span>
                            <span
                                style={{
                                    fontSize: 12,
                                    color: "var(--color-text-muted)",
                                    fontWeight: 500,
                                }}
                            >
                                {e.category}
                            </span>
                        </span>
                        <span
                            style={{
                                fontSize: 15,
                                fontWeight: 800,
                                letterSpacing: "-0.02em",
                            }}
                        >
                            {formatWon(e.amount)}
                        </span>
                    </Link>
                ))
            )}
        </div>
    )
}
