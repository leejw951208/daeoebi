"use client"
// 자산 대시보드의 카테고리별 지출 카드. 카테고리마다 색 점·비율·금액·진행 바를 그린다.
// 지출이 있는 카테고리만 넘어온다고 가정한다(빈 목록은 상위에서 렌더하지 않음).
import { formatWon } from "../../_lib/asset-categories"
import type { CategoryBreakdown as CategorySlice } from "../../_lib/asset-compute"

interface Props {
    cats: CategorySlice[]
}

export function CategoryBreakdown({ cats }: Props) {
    return (
        <div className="asset-card" style={{ padding: "18px 18px 20px" }}>
            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 15 }}>
                카테고리별 지출
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {cats.map((c) => (
                    <div key={c.key}>
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                marginBottom: 7,
                            }}
                        >
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                }}
                            >
                                <span
                                    aria-hidden="true"
                                    style={{
                                        width: 9,
                                        height: 9,
                                        borderRadius: "50%",
                                        background: c.color,
                                    }}
                                />
                                <span
                                    style={{
                                        fontSize: 13.5,
                                        fontWeight: 700,
                                        color: "#333",
                                    }}
                                >
                                    {c.name}
                                </span>
                                <span
                                    style={{
                                        fontSize: 11.5,
                                        color: "var(--color-text-muted)",
                                        fontWeight: 600,
                                    }}
                                >
                                    {c.pct}%
                                </span>
                            </div>
                            <span
                                style={{
                                    fontSize: 13,
                                    fontWeight: 700,
                                    color: "#444",
                                }}
                            >
                                {formatWon(c.amount)}
                            </span>
                        </div>
                        <div className="asset-bar" style={{ height: 7 }}>
                            <div
                                className="asset-bar-fill"
                                style={{
                                    width: `${c.pct}%`,
                                    background: c.color,
                                }}
                            />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
