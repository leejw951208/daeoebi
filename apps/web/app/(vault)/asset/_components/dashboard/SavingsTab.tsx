"use client"
// 저축·투자 탭. 저축/투자 순자산·이번 달 적립·적립 내역을 보여준다.
// 데이터(계좌·투자·박스)는 부모(asset/page)가 복호화해 props 로 넘긴다.
// 저축 합계는 적금 계좌 모델(savingsAccountsView) 기준이다 — 지출 파생 단일 목표 모델은 쓰지 않는다.
import Link from "next/link"
import type {
    SavingsAccountView,
    InvestmentView,
} from "../../_lib/asset-compute"
import { formatWon } from "../../_lib/asset-categories"

export interface Contribution {
    id: string
    item: string
    amount: number
    categoryName: string
    date: string
    color?: string
    recurring?: boolean
}

// ISO("YYYY-MM-DD") → "M월 D일".
function formatMonthDay(iso: string): string {
    const m = Number(iso.slice(5, 7))
    const d = Number(iso.slice(8, 10))
    return `${m}월 ${d}일`
}

// 세이빙 박스 카드 표시용 요약. balance/fromSavings 는 asset-compute 의 savingsBoxBalance 결과,
// count 는 전체 거래 건수(내역 배지 "{n}건 기록"에 쓴다).
export interface SavingsBoxSummary {
    balance: number
    fromSavings: number
    count: number
}

interface SavingsTabProps {
    // 저축·투자 순자산(hero) = 계좌 기반 저축 합계 + 투자 평가금액. 부모가 미리 더해 넘긴다.
    netWorth: number
    // 계좌 기반 저축 합계·이번 달 적립(savingsAccountsView 의 savedTotal/savedMonth).
    savedTotal: number
    savedMonth: number
    investMonth: number
    contributions: Contribution[]
    // 적금 계좌 목록(계산된 뷰). 목표가 없는 계좌의 진행바는 계좌들 중 최대 total 대비 상대값으로 채운다.
    accounts: SavingsAccountView[]
    onAddAccount: () => void
    // 이름으로 계좌를 식별해 목표 시트를 연다(이름은 생성 시 중복이 막혀 있어 앵커로 쓸 수 있다).
    onEditAccountGoal: (name: string) => void
    // 투자 원금·평가금액·손익(수익률 적용 결과). 탭하면 onEditReturn 으로 수익률 수정 시트를 연다.
    investment: InvestmentView
    onEditReturn: () => void
    // 세이빙 박스 잔액·건수. 저축에서 박스로 이체한 금액(fromSavings)은 "저축" 표시에서 뺀다
    // (같은 돈이 저축·박스 두 곳에 동시에 잡히지 않도록).
    box: SavingsBoxSummary
    onBoxIn: () => void
    onBoxOut: () => void
    onBoxDetail: () => void
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
    netWorth,
    savedTotal,
    savedMonth,
    investMonth,
    contributions,
    accounts,
    onAddAccount,
    onEditAccountGoal,
    investment,
    onEditReturn,
    box,
    onBoxIn,
    onBoxOut,
    onBoxDetail,
}: SavingsTabProps) {
    // 세이빙 박스로 이체한 저축분은 "저축" 표시에서 뺀다(박스 카드 잔액과 중복 집계 방지).
    const displayedSaved = Math.max(0, savedTotal - box.fromSavings)
    const monthContrib = savedMonth + investMonth
    // 목표 미설정 계좌의 진행바 상대 채움 기준(0 나눔 방지를 위해 최소 1).
    const maxAccountTotal = Math.max(1, ...accounts.map((a) => a.total))
    const investPnlColor = pnlColor(investment.pnl)
    return (
        <div
            className="stagger"
            style={{ display: "flex", flexDirection: "column", gap: 12 }}
        >
            {/* 순자산 */}
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
                    저축·투자 순자산
                </div>
                <div
                    style={{
                        fontSize: 34,
                        fontWeight: 800,
                        letterSpacing: "-0.03em",
                    }}
                >
                    {formatWon(netWorth)}
                </div>
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 7,
                        marginTop: 10,
                    }}
                >
                    <span
                        style={{
                            fontSize: 12.5,
                            fontWeight: 800,
                            color: "#171717",
                        }}
                    >
                        이번 달 {formatWon(monthContrib)} 적립
                    </span>
                    <span
                        style={{
                            fontSize: 11.5,
                            color: "#bcbcbc",
                            fontWeight: 600,
                        }}
                    >
                        · 지출 {contributions.length}건 자동 연동
                    </span>
                </div>
            </div>

            {/* 저축 / 투자 카드 */}
            <div style={{ display: "flex", gap: 12 }}>
                <div className="asset-card" style={{ flex: 1, padding: 16 }}>
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 7,
                            marginBottom: 6,
                        }}
                    >
                        <span
                            style={{
                                width: 9,
                                height: 9,
                                borderRadius: "50%",
                                background: "#20a4a4",
                            }}
                        />
                        <span
                            style={{
                                fontSize: 12,
                                fontWeight: 700,
                                color: "#9a9a9a",
                            }}
                        >
                            저축
                        </span>
                    </div>
                    <div className="asset-card-value">
                        {formatWon(displayedSaved)}
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
                <div className="asset-card" style={{ flex: 1, padding: 16 }}>
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 7,
                            marginBottom: 6,
                        }}
                    >
                        <span
                            style={{
                                width: 9,
                                height: 9,
                                borderRadius: "50%",
                                background: "#7b61ff",
                            }}
                        />
                        <span
                            style={{
                                fontSize: 12,
                                fontWeight: 700,
                                color: "#9a9a9a",
                            }}
                        >
                            투자
                        </span>
                    </div>
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

            {/* 세이빙 박스 */}
            <div className="asset-card" style={{ padding: "20px 18px 16px" }}>
                <div
                    style={{
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        marginBottom: 13,
                    }}
                >
                    <div style={{ fontSize: 13, fontWeight: 800 }}>
                        세이빙 박스
                    </div>
                    <span
                        style={{
                            flexShrink: 0,
                            fontSize: 11,
                            fontWeight: 700,
                            color: "#c08a15",
                            background: "#fbf1d7",
                            padding: "4px 9px",
                            borderRadius: 999,
                        }}
                    >
                        {box.count}건 기록
                    </span>
                </div>
                <div
                    style={{
                        fontSize: 30,
                        fontWeight: 800,
                        letterSpacing: "-0.03em",
                        color: "#171717",
                        marginBottom: 16,
                    }}
                >
                    {formatWon(box.balance)}
                </div>
                <div style={{ display: "flex", gap: 9, marginBottom: 8 }}>
                    <button
                        type="button"
                        onClick={onBoxIn}
                        className="sv-box-btn"
                        style={{
                            flex: 1,
                            height: 46,
                            border: "none",
                            borderRadius: 13,
                            background: "#e9b949",
                            color: "#5b4407",
                            font: "inherit",
                            fontSize: 14,
                            fontWeight: 800,
                            cursor: "pointer",
                        }}
                    >
                        입금
                    </button>
                    <button
                        type="button"
                        onClick={onBoxOut}
                        className="sv-box-btn"
                        style={{
                            flex: 1,
                            height: 46,
                            border: "1.5px solid #ececec",
                            borderRadius: 13,
                            background: "#fff",
                            color: "#444",
                            font: "inherit",
                            fontSize: 14,
                            fontWeight: 800,
                            cursor: "pointer",
                        }}
                    >
                        출금
                    </button>
                </div>
                <button
                    type="button"
                    onClick={onBoxDetail}
                    className="sv-detail"
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 5,
                        width: "100%",
                        height: 42,
                        border: "none",
                        background: "none",
                        font: "inherit",
                        fontSize: 13,
                        fontWeight: 700,
                        color: "#8a8a8a",
                        cursor: "pointer",
                    }}
                >
                    입출금 내역 보기
                    <svg
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                    >
                        <path d="M9 6l6 6-6 6" />
                    </svg>
                </button>
            </div>

            {/* 적금 계좌 목록 */}
            <div className="asset-card" style={{ padding: "18px 16px 16px" }}>
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: 14,
                        padding: "0 2px",
                    }}
                >
                    <span style={{ fontSize: 13, fontWeight: 800 }}>
                        저축 현황
                    </span>
                    {accounts.length > 0 && (
                        <span
                            style={{
                                fontSize: 11.5,
                                color: "#bcbcbc",
                                fontWeight: 700,
                            }}
                        >
                            {accounts.length}개 적금
                        </span>
                    )}
                </div>
                {accounts.length === 0 && (
                    <div
                        style={{
                            textAlign: "center",
                            padding: "16px 12px 4px",
                        }}
                    >
                        <div
                            style={{
                                fontSize: 13.5,
                                fontWeight: 700,
                                color: "#8a8a8a",
                                marginBottom: 5,
                            }}
                        >
                            아직 적금이 없어요
                        </div>
                        <p
                            style={{
                                fontSize: 12.5,
                                fontWeight: 600,
                                lineHeight: 1.5,
                                color: "#bcbcbc",
                            }}
                        >
                            적금을 추가하고 목표를 설정하면
                            <br />
                            매달 저축 현황이 자동으로 쌓여요.
                        </p>
                    </div>
                )}
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 12,
                    }}
                >
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
                                className="sv-acct"
                                style={{
                                    textAlign: "left",
                                    width: "100%",
                                    border: "1px solid #f1f1f1",
                                    borderRadius: 15,
                                    background: "var(--tint)",
                                    padding: "14px 15px",
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
                                        marginBottom: 9,
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
                                                fontSize: 14,
                                                fontWeight: 700,
                                                color: "#222",
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
                                                    fontSize: 10,
                                                    fontWeight: 800,
                                                    color: "#20a4a4",
                                                    background: "#e6f6f5",
                                                    padding: "2px 6px",
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
                                            fontSize: 15,
                                            fontWeight: 800,
                                            letterSpacing: "-0.02em",
                                            color: "#171717",
                                        }}
                                    >
                                        {formatWon(a.total)}
                                    </span>
                                </div>
                                <div
                                    style={{
                                        height: 7,
                                        borderRadius: 999,
                                        background: "#ececec",
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
                                        alignItems: "center",
                                        fontSize: 11.5,
                                        fontWeight: 600,
                                        color: "#a0a0a0",
                                        marginTop: 7,
                                    }}
                                >
                                    {hasGoal ? (
                                        <span>
                                            {`목표 ${formatWon(a.goal)} · ${formatWon(a.remain)} 남음`}
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
                                    {hasGoal && (
                                        <span
                                            style={{
                                                color: a.color,
                                                fontWeight: 800,
                                            }}
                                        >
                                            {a.goalPct}%
                                        </span>
                                    )}
                                </div>
                            </button>
                        )
                    })}
                </div>
                <button
                    type="button"
                    onClick={onAddAccount}
                    className="sv-add"
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        width: "100%",
                        height: 48,
                        marginTop: 12,
                        border: "1.5px dashed #d6d6d6",
                        borderRadius: 14,
                        background: "none",
                        font: "inherit",
                        fontSize: 13.5,
                        fontWeight: 700,
                        color: "#20a4a4",
                        cursor: "pointer",
                    }}
                >
                    <span
                        style={{ fontSize: 17, lineHeight: 1, marginTop: -1 }}
                    >
                        +
                    </span>{" "}
                    적금 추가
                </button>
            </div>

            {/* 투자 수익률 */}
            <button
                type="button"
                className="asset-card sv-return"
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
                        <svg
                            width="13"
                            height="13"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="#7b61ff"
                            strokeWidth="2.4"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                        >
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                        </svg>
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
                                color: "#9a9a9a",
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
                                color: "#9a9a9a",
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

            {/* 이번 달 적립 내역 */}
            <div className="asset-card" style={{ padding: "18px 16px 16px" }}>
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: 14,
                        padding: "0 2px",
                    }}
                >
                    <span style={{ fontSize: 13, fontWeight: 800 }}>
                        이번 달 적립 내역
                    </span>
                    <span
                        style={{
                            fontSize: 12,
                            color: "#9a9a9a",
                            fontWeight: 600,
                        }}
                    >
                        지출 연동 · {contributions.length}건
                    </span>
                </div>
                {contributions.length === 0 ? (
                    <div
                        style={{
                            textAlign: "center",
                            padding: "14px 8px 8px",
                            fontSize: 13,
                            color: "#bcbcbc",
                            fontWeight: 600,
                            lineHeight: 1.5,
                        }}
                    >
                        지출을 &lsquo;저축&rsquo;·&lsquo;투자&rsquo;로 분류하면
                        <br />
                        여기에 자동으로 모여요.
                    </div>
                ) : (
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 9,
                        }}
                    >
                        {contributions.map((c) => {
                            const accent = c.color ?? "#20a4a4"
                            return (
                                <Link
                                    key={c.id}
                                    href={`/asset/${c.id}`}
                                    className="entry-card"
                                    style={{ gap: 13, padding: "13px 14px" }}
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
                                            background: `${accent}1f`,
                                            color: accent,
                                        }}
                                    >
                                        {c.item.trim().charAt(0) || "저"}
                                    </span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 6,
                                                fontSize: 15,
                                                fontWeight: 700,
                                                letterSpacing: "-0.01em",
                                                color: "#1c1c1c",
                                                minWidth: 0,
                                            }}
                                        >
                                            <span
                                                style={{
                                                    whiteSpace: "nowrap",
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis",
                                                }}
                                            >
                                                {c.item}
                                            </span>
                                            {c.recurring && (
                                                <span className="recur-badge">
                                                    고정
                                                </span>
                                            )}
                                        </div>
                                        <div
                                            style={{
                                                fontSize: 12,
                                                color: "#a3a3a3",
                                                fontWeight: 500,
                                            }}
                                        >
                                            {`${c.categoryName} · ${formatMonthDay(c.date)}`}
                                        </div>
                                    </div>
                                    <span
                                        style={{
                                            flexShrink: 0,
                                            fontSize: 15,
                                            fontWeight: 800,
                                            letterSpacing: "-0.02em",
                                            color: c.color ?? "#171717",
                                        }}
                                    >
                                        {"+" + formatWon(c.amount)}
                                    </span>
                                </Link>
                            )
                        })}
                    </div>
                )}
            </div>
            {/* mock 파리티: 인라인으로 표현 불가한 :active/:hover 상태.
                stagger 자식 순서에 영향을 주지 않도록 마지막에 둔다(<style>은 display:none). */}
            <style
                dangerouslySetInnerHTML={{
                    __html: `.sv-box-btn{transition:transform .12s}.sv-box-btn:active{transform:scale(.97)}.sv-detail:active{opacity:.6}.sv-acct{transition:transform .12s}.sv-acct:active{transform:scale(.99)}.sv-add{transition:all .14s}.sv-add:active{transform:scale(.99)}.sv-add:hover{border-color:#20a4a4;background:#f2fbfa}.sv-return{transition:transform .12s}.sv-return:active{transform:scale(.99)}`,
                }}
            />
        </div>
    )
}
