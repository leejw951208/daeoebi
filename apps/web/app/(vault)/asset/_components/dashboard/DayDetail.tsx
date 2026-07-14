"use client"
// 자산 대시보드의 선택일 상세. 그 날 지출 합계와 항목 목록(고정 배지 포함)을 그린다.
import Link from "next/link"
import { resolveCategory, formatWon } from "../../_lib/asset-categories"
import { totalSpent, type ComputedExpense } from "../../_lib/asset-compute"
import { monthDayLabel } from "../../_lib/asset-dates"
import type { AssetCategory } from "@/lib/vault-client"

interface Props {
    selectedDay: string
    dayExpenses: ComputedExpense[]
    categories: AssetCategory[]
}

export function DayDetail({ selectedDay, dayExpenses, categories }: Props) {
    // 디자인 구조: 헤더 / 목록(또는 빈 상태)을 부모 stagger 의 개별 형제로 둔다.
    // 헤더↔첫 카드 간격은 부모 stagger gap(12)이 만들고, 목록 카드끼리는 자체 gap 9.
    return (
        <>
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    margin: "6px 2px 0",
                }}
            >
                <span style={{ fontSize: 13, fontWeight: 800 }}>
                    {monthDayLabel(selectedDay)}
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
                        color: "#bcbcbc",
                        fontWeight: 600,
                    }}
                >
                    이 날은 지출이 없어요
                </div>
            ) : (
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 9,
                    }}
                >
                    {dayExpenses.map((e) => {
                        const resolved = resolveCategory(
                            e.categoryId,
                            categories,
                        )
                        // 예정 항목은 DB 에 없는 합성 행이라 수정 화면이 없다. 링크로 만들지 않는다.
                        const Row = e.projected ? "div" : Link
                        const rowProps = e.projected
                            ? {}
                            : { href: `/asset/${e.id}` }
                        return (
                            <Row
                                key={e.id}
                                {...(rowProps as { href: string })}
                                className="entry-card"
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 13,
                                    padding: "13px 14px",
                                    borderRadius: 16,
                                    ...(e.projected
                                        ? { opacity: 0.62, cursor: "default" }
                                        : {}),
                                }}
                            >
                                <span
                                    aria-hidden="true"
                                    style={{
                                        flexShrink: 0,
                                        width: 40,
                                        height: 40,
                                        borderRadius: 12,
                                        background: `${resolved.color}1f`,
                                        color: resolved.color,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontSize: 15,
                                        fontWeight: 800,
                                    }}
                                >
                                    {(e.item || resolved.name).slice(0, 1)}
                                </span>
                                <span
                                    className="entry-main"
                                    style={{ minWidth: 0 }}
                                >
                                    <span
                                        className="entry-label"
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 6,
                                            fontSize: 15,
                                        }}
                                    >
                                        {e.item || resolved.name}
                                        {e.recurringId && (
                                            <span className="recur-badge">
                                                고정
                                            </span>
                                        )}
                                        {e.projected && (
                                            <span className="recur-badge">
                                                예정
                                            </span>
                                        )}
                                    </span>
                                    <span
                                        style={{
                                            fontSize: 12,
                                            color: "#a3a3a3",
                                            fontWeight: 500,
                                        }}
                                    >
                                        {resolved.name} ·{" "}
                                        {monthDayLabel(e.date)}
                                    </span>
                                </span>
                                <span
                                    style={{
                                        fontSize: 15,
                                        fontWeight: 800,
                                        letterSpacing: "-0.02em",
                                        color: "#1f1f1f",
                                    }}
                                >
                                    -{formatWon(e.amount)}
                                </span>
                            </Row>
                        )
                    })}
                </div>
            )}
        </>
    )
}
