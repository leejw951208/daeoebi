"use client"
// 자산 대시보드의 카테고리별 지출 카드. 카테고리마다 색 점·비율·금액·진행 바를 그린다.
// 지출이 없으면(빈 목록) 목업의 noCats 빈 상태 카드를 대신 렌더한다.
import { formatWon } from "../../_lib/asset-categories"
import type { CategoryBreakdown as CategorySlice } from "../../_lib/asset-compute"

interface Props {
    cats: CategorySlice[]
}

export function CategoryBreakdown({ cats }: Props) {
    if (cats.length === 0) {
        return (
            <div
                className="asset-card"
                style={{ padding: "30px 18px", textAlign: "center" }}
            >
                <div
                    style={{
                        fontSize: 13.5,
                        fontWeight: 700,
                        color: "#8a8a8a",
                        marginBottom: 5,
                    }}
                >
                    아직 지출이 없어요
                </div>
                <div
                    style={{
                        fontSize: 12.5,
                        color: "#bcbcbc",
                        lineHeight: 1.5,
                    }}
                >
                    지출을 추가하면 카테고리별 분석이
                    <br />
                    여기에 표시돼요
                </div>
            </div>
        )
    }
    // 진행 바 폭은 최대 지출 카테고리 대비 비율(가장 큰 카테고리가 100%).
    // 라벨의 %는 총 지출 대비 비율(c.pct)로 별개 기준이다.
    const maxAmount = Math.max(...cats.map((c) => c.amount), 1)
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
                                        color: "#bcbcbc",
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
                                    width: `${(c.amount / maxAmount) * 100}%`,
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
