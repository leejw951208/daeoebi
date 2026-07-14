"use client"
// 고정 지출 탭. 등록해 둔 활성 템플릿(RecurringExpense)을 결제일 순으로 모아 보여준다.
// 읽기 전용이다 — 수정은 이번 달 지출 항목을 통해 한다(템플릿 수정은 "앞으로만 반영").
// 데이터(복호화된 템플릿)는 부모(asset/page)가 넘긴다.
import type { AssetCategory } from "@/lib/vault-client"
import type { ComputedRecurring } from "../../_lib/asset-compute"
import { formatWon, resolveCategory } from "../../_lib/asset-categories"
import {
    formatDayOfMonth,
    formatTerm,
    recurringInMonth,
    sortRecurring,
    totalRecurring,
} from "../../_lib/asset-recurring"

interface RecurringTabProps {
    month: string
    recurrings: ComputedRecurring[]
    categories: AssetCategory[]
}

export function RecurringTab({
    month,
    recurrings,
    categories,
}: RecurringTabProps) {
    // 템플릿은 기간이 끝나도 active 로 남는다. 보고 있는 달에 실제로 나가는 것만 세운다.
    const active = recurringInMonth(recurrings, month)
    const rows = sortRecurring(active)
    const total = totalRecurring(active)

    return (
        <div
            className="stagger"
            style={{ display: "flex", flexDirection: "column", gap: 12 }}
        >
            {/* 매달 나가는 고정 지출 합계 */}
            <div
                className="asset-card"
                style={{ borderRadius: 20, padding: "20px 18px" }}
            >
                <div
                    className="asset-card-label"
                    style={{
                        color: "#9a9a9a",
                        fontSize: 12.5,
                        marginBottom: 7,
                    }}
                >
                    매달 나가는 고정 지출
                </div>
                <div
                    style={{
                        display: "flex",
                        alignItems: "flex-end",
                        justifyContent: "space-between",
                    }}
                >
                    <div
                        style={{
                            fontSize: 34,
                            fontWeight: 800,
                            letterSpacing: "-0.03em",
                        }}
                    >
                        {formatWon(total)}
                    </div>
                    <div
                        style={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: "#bcbcbc",
                            paddingBottom: 6,
                        }}
                    >
                        {rows.length}건
                    </div>
                </div>
            </div>

            {rows.length === 0 ? (
                <div
                    className="asset-card"
                    style={{ textAlign: "center", padding: "34px 20px" }}
                >
                    <div
                        style={{
                            fontSize: 13.5,
                            fontWeight: 700,
                            color: "#8a8a8a",
                            marginBottom: 6,
                        }}
                    >
                        아직 고정 지출이 없어요
                    </div>
                    <p
                        style={{
                            fontSize: 12.5,
                            fontWeight: 600,
                            lineHeight: 1.5,
                            color: "#bcbcbc",
                        }}
                    >
                        지출을 추가할 때 &lsquo;고정 지출&rsquo;을 켜면
                        <br />
                        여기에 모여요.
                    </p>
                </div>
            ) : (
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 9,
                    }}
                >
                    {rows.map((r) => {
                        const { color } = resolveCategory(
                            r.categoryId,
                            categories,
                        )
                        return (
                            <div
                                key={r.id}
                                className="entry-card"
                                style={{
                                    gap: 13,
                                    padding: "13px 14px",
                                    cursor: "default",
                                }}
                            >
                                <span
                                    aria-hidden="true"
                                    style={{
                                        flexShrink: 0,
                                        width: 40,
                                        height: 40,
                                        borderRadius: 12,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontSize: 15,
                                        fontWeight: 800,
                                        background: `${color}1f`,
                                        color,
                                    }}
                                >
                                    {r.item.trim().charAt(0) || "고"}
                                </span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div
                                        style={{
                                            fontSize: 15,
                                            fontWeight: 700,
                                            letterSpacing: "-0.01em",
                                            color: "#1c1c1c",
                                            whiteSpace: "nowrap",
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                        }}
                                    >
                                        {r.item}
                                    </div>
                                    <div
                                        style={{
                                            fontSize: 12,
                                            color: "#a3a3a3",
                                            fontWeight: 500,
                                        }}
                                    >
                                        {`${formatDayOfMonth(r.dayOfMonth)} · ${formatTerm(r.termMonths)}`}
                                    </div>
                                </div>
                                <span
                                    style={{
                                        flexShrink: 0,
                                        fontSize: 15,
                                        fontWeight: 800,
                                        letterSpacing: "-0.02em",
                                        color: "#171717",
                                    }}
                                >
                                    {`-${formatWon(r.amount)}`}
                                </span>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
