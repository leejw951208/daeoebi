"use client"
// 저축·투자 탭. 저축/투자 순자산·이번 달 적립·저축 목표 진행률·적립 내역을 보여준다.
// 데이터(누적/월별/목표)는 부모(asset/page)가 복호화해 props 로 넘긴다.
import Link from "next/link"
import type {
    SavingsSummary,
    SavingsAccountView,
    InvestmentView,
} from "../../_lib/asset-compute"
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
    // 적금 계좌 목록(계산된 뷰). 목표가 없는 계좌의 진행바는 계좌들 중 최대 total 대비 상대값으로 채운다.
    accounts: SavingsAccountView[]
    onAddAccount: () => void
    // 이름으로 계좌를 식별해 목표 시트를 연다(이름은 생성 시 중복이 막혀 있어 앵커로 쓸 수 있다).
    onEditAccountGoal: (name: string) => void
    // 투자 원금·평가금액·손익(수익률 적용 결과). 탭하면 onEditReturn 으로 수익률 수정 시트를 연다.
    investment: InvestmentView
    onEditReturn: () => void
}

// 평가손익 색(음수만 빨강, 그 외엔 다크). 배지의 수익률 텍스트에도 같은 색을 쓴다.
function pnlColor(pnl: number): string {
    return pnl < 0 ? "#e5484d" : "#171717"
}

// 수익률 배지 표기. 미설정(null)이면 "0%", 그 외엔 부호 포함 소수 첫째 자리까지.
function formatReturnRate(rate: number | null): string {
    if (rate === null) return "0%"
    const rounded = Math.round(rate * 10) / 10
    return `${rounded > 0 ? "+" : ""}${rounded}%`
}

// 평가손익 금액 표기(부호 + 통화). 0 이상은 +, 음수는 -.
function formatPnl(pnl: number): string {
    return `${pnl < 0 ? "-" : "+"}${formatWon(Math.abs(pnl))}`
}

export function SavingsTab({
    summary,
    savedMonth,
    investMonth,
    goalName,
    goalAmount,
    contributions,
    onEditGoal,
    accounts,
    onAddAccount,
    onEditAccountGoal,
    investment,
    onEditReturn,
}: SavingsTabProps) {
    const pct = goalProgress(summary.savedTotal, goalAmount)
    const monthContrib = savedMonth + investMonth
    // 목표 미설정 계좌의 진행바 상대 채움 기준(0 나눔 방지를 위해 최소 1).
    const maxAccountTotal = Math.max(1, ...accounts.map((a) => a.total))
    const investPnlColor = pnlColor(investment.pnl)
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
                        {formatWon(investment.value)}
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

            {/* 적금 계좌 목록 */}
            <div className="asset-card">
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: 13,
                    }}
                >
                    <span style={{ fontSize: 13, fontWeight: 800 }}>
                        저축 현황
                    </span>
                    <span
                        style={{
                            fontSize: 12,
                            color: "var(--color-text-muted)",
                            fontWeight: 600,
                        }}
                    >
                        {accounts.length}개 적금
                    </span>
                </div>
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 10,
                    }}
                >
                    {accounts.length === 0 && (
                        <div
                            style={{
                                textAlign: "center",
                                padding: "8px 8px 14px",
                                fontSize: 13,
                                color: "var(--color-text-muted)",
                                fontWeight: 600,
                            }}
                        >
                            아직 등록한 적금이 없어요.
                        </div>
                    )}
                    {accounts.map((a) => {
                        const hasGoal = a.goal > 0
                        const fillPct = hasGoal
                            ? a.goalPct
                            : (a.total / maxAccountTotal) * 100
                        return (
                            <button
                                key={a.name}
                                type="button"
                                onClick={() => onEditAccountGoal(a.name)}
                                style={{
                                    textAlign: "left",
                                    width: "100%",
                                    border: "1px solid var(--color-border)",
                                    borderRadius: 14,
                                    background: "var(--tint)",
                                    padding: "13px 14px",
                                    cursor: "pointer",
                                    font: "inherit",
                                    color: "inherit",
                                }}
                            >
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        marginBottom: 8,
                                    }}
                                >
                                    <div
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 8,
                                            minWidth: 0,
                                        }}
                                    >
                                        <span
                                            style={{
                                                flexShrink: 0,
                                                width: 9,
                                                height: 9,
                                                borderRadius: "50%",
                                                background: a.color,
                                            }}
                                        />
                                        <span
                                            style={{
                                                fontSize: 13.5,
                                                fontWeight: 700,
                                                color: "#333",
                                                whiteSpace: "nowrap",
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                            }}
                                        >
                                            {a.name}
                                        </span>
                                        {a.month > 0 && (
                                            <span
                                                style={{
                                                    flexShrink: 0,
                                                    fontSize: 11,
                                                    fontWeight: 700,
                                                    color: "#20a4a4",
                                                    background: "#fff",
                                                    padding: "2px 7px",
                                                    borderRadius: 6,
                                                }}
                                            >
                                                +{formatWon(a.month)}
                                            </span>
                                        )}
                                    </div>
                                    <span
                                        style={{
                                            flexShrink: 0,
                                            fontSize: 14,
                                            fontWeight: 800,
                                            letterSpacing: "-0.02em",
                                            color: "#1f1f1f",
                                        }}
                                    >
                                        {formatWon(a.total)}
                                    </span>
                                </div>
                                <div
                                    style={{
                                        height: 7,
                                        borderRadius: 999,
                                        background: "#fff",
                                        overflow: "hidden",
                                    }}
                                >
                                    <div
                                        style={{
                                            height: "100%",
                                            borderRadius: 999,
                                            background: a.color,
                                            width: `${fillPct}%`,
                                            transition:
                                                "width .55s cubic-bezier(.22,1,.36,1)",
                                        }}
                                    />
                                </div>
                                <div
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        fontSize: 11.5,
                                        fontWeight: 600,
                                        color: "#a3a3a3",
                                        marginTop: 7,
                                    }}
                                >
                                    {hasGoal ? (
                                        <span
                                            style={{
                                                color: a.color,
                                                fontWeight: 800,
                                            }}
                                        >
                                            {a.goalPct}%
                                        </span>
                                    ) : (
                                        <span
                                            style={{
                                                color: "#20a4a4",
                                                fontWeight: 700,
                                            }}
                                        >
                                            + 목표 설정
                                        </span>
                                    )}
                                    <span>
                                        {hasGoal
                                            ? `목표 ${formatWon(a.goal)} · ${formatWon(a.remain)} 남음`
                                            : "목표 미설정"}
                                    </span>
                                </div>
                            </button>
                        )
                    })}
                    <button
                        type="button"
                        onClick={onAddAccount}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 6,
                            width: "100%",
                            height: 46,
                            border: "1.5px dashed #d8d8d8",
                            borderRadius: 13,
                            background: "none",
                            font: "inherit",
                            fontSize: 14,
                            fontWeight: 700,
                            color: "#20a4a4",
                            cursor: "pointer",
                        }}
                    >
                        + 적금 추가
                    </button>
                </div>
            </div>

            {/* 투자 수익률 */}
            <button
                type="button"
                className="asset-card"
                onClick={onEditReturn}
                style={{ textAlign: "left", cursor: "pointer" }}
            >
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: 14,
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 2,
                        }}
                    >
                        <span style={{ fontSize: 13, fontWeight: 800 }}>
                            투자 수익률
                        </span>
                        <span
                            style={{
                                fontSize: 11,
                                color: "#b0b0b0",
                                fontWeight: 600,
                            }}
                        >
                            탭하여 수익률 수정
                        </span>
                    </div>
                    <span
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            border: "1.5px solid #e7e2ff",
                            background: "#f6f4ff",
                            borderRadius: 999,
                            padding: "6px 12px",
                        }}
                    >
                        <span
                            style={{
                                fontSize: 16,
                                fontWeight: 800,
                                letterSpacing: "-0.02em",
                                color: investPnlColor,
                            }}
                        >
                            {formatReturnRate(investment.rate)}
                        </span>
                    </span>
                </div>
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 10,
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                        }}
                    >
                        <span
                            style={{
                                fontSize: 13,
                                fontWeight: 600,
                                color: "var(--color-text-muted)",
                            }}
                        >
                            투자 원금
                        </span>
                        <span
                            style={{
                                fontSize: 14,
                                fontWeight: 700,
                                color: "#444",
                            }}
                        >
                            {formatWon(investment.principal)}
                        </span>
                    </div>
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                        }}
                    >
                        <span
                            style={{
                                fontSize: 13,
                                fontWeight: 600,
                                color: "var(--color-text-muted)",
                            }}
                        >
                            평가금액
                        </span>
                        <span
                            style={{
                                fontSize: 15,
                                fontWeight: 800,
                                letterSpacing: "-0.02em",
                            }}
                        >
                            {formatWon(investment.value)}
                        </span>
                    </div>
                    <div
                        style={{
                            height: 1,
                            background: "#f2f2f2",
                            margin: "2px 0",
                        }}
                    />
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                        }}
                    >
                        <span
                            style={{
                                fontSize: 13,
                                fontWeight: 700,
                                color: "#555",
                            }}
                        >
                            평가손익
                        </span>
                        <span
                            style={{
                                fontSize: 16,
                                fontWeight: 800,
                                letterSpacing: "-0.02em",
                                color: investPnlColor,
                            }}
                        >
                            {formatPnl(investment.pnl)}
                        </span>
                    </div>
                </div>
            </button>

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
