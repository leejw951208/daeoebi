"use client"
// 세이빙 박스 입출금 내역 바텀시트. 복호화된 거래를 날짜 내림차순으로 보여주고
// 개별 삭제·더보기 페이지네이션을 지원한다. 목록은 page 가 복호화해 props 로 넘긴다.
import { useState } from "react"
import { useVault } from "../../_lib/vault-context"
import { deleteSavingsBoxTxn } from "@/lib/vault-client"
import { formatWon } from "../_lib/asset-categories"

// 복호화된 세이빙 박스 거래 1건(메타 + 본문).
export interface BoxTxnRow {
    id: string
    type: "in" | "out"
    source: "cash" | "savings"
    date: string
    amount: number
    memo: string
}

interface Props {
    balance: number
    txns: BoxTxnRow[]
    onChanged: () => void | Promise<void>
    onClose: () => void
}

const PAGE_SIZE = 10

// 메모가 비어 있으면 유형별 기본 라벨을 보여준다.
function rowLabel(t: BoxTxnRow): string {
    return t.memo.trim() || (t.type === "in" ? "입금" : "출금")
}

export function SavingsBoxDetailSheet({
    balance,
    txns,
    onChanged,
    onClose,
}: Props) {
    const { resetIdle } = useVault()
    const [shown, setShown] = useState(PAGE_SIZE)
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)

    const sorted = [...txns].sort((a, b) => b.date.localeCompare(a.date))
    const rows = sorted.slice(0, shown)
    const moreCount = sorted.length - rows.length

    async function handleDelete(id: string) {
        resetIdle()
        setDeletingId(id)
        setErrorMessage(null)
        try {
            await deleteSavingsBoxTxn(id)
            await onChanged()
        } catch {
            setErrorMessage("삭제하지 못했어요. 다시 시도해 주세요.")
        } finally {
            setDeletingId(null)
        }
    }

    return (
        <div
            className="dialog-backdrop"
            role="dialog"
            aria-modal="true"
            aria-label="세이빙 박스 내역"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose()
            }}
        >
            <div className="sheet">
                <div className="sheet-grip" aria-hidden="true" />
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: 12,
                    }}
                >
                    <div style={{ fontSize: 16, fontWeight: 800 }}>
                        세이빙 박스 내역
                    </div>
                    <button
                        type="button"
                        className="btn-text"
                        onClick={() => {
                            resetIdle()
                            onClose()
                        }}
                    >
                        닫기
                    </button>
                </div>
                <div
                    style={{
                        display: "flex",
                        alignItems: "baseline",
                        justifyContent: "space-between",
                        marginBottom: 16,
                    }}
                >
                    <span
                        style={{
                            fontSize: 12.5,
                            fontWeight: 700,
                            color: "#a3a3a3",
                        }}
                    >
                        현재 잔액
                    </span>
                    <span
                        style={{
                            fontSize: 22,
                            fontWeight: 800,
                            letterSpacing: "-0.03em",
                        }}
                    >
                        {formatWon(balance)}
                    </span>
                </div>

                {errorMessage && (
                    <div
                        role="alert"
                        className="error-box"
                        style={{ marginBottom: 12 }}
                    >
                        {errorMessage}
                    </div>
                )}

                {rows.length === 0 ? (
                    <div
                        style={{
                            textAlign: "center",
                            padding: "36px 8px",
                            fontSize: 13,
                            color: "var(--color-text-muted)",
                            fontWeight: 600,
                            lineHeight: 1.5,
                        }}
                    >
                        아직 기록이 없어요.
                        <br />
                        남은 돈을 입금해 보세요.
                    </div>
                ) : (
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 8,
                        }}
                    >
                        {rows.map((t) => (
                            <div
                                key={t.id}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 12,
                                    padding: "10px 13px",
                                    border: "1px solid #f1f1f1",
                                    borderRadius: 14,
                                    background: "var(--tint)",
                                }}
                            >
                                <span
                                    aria-hidden="true"
                                    style={{
                                        flexShrink: 0,
                                        width: 30,
                                        height: 30,
                                        borderRadius: 10,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontSize: 15,
                                        fontWeight: 800,
                                        background:
                                            t.type === "in"
                                                ? "#fdf6e3"
                                                : "#f1f1f1",
                                        color:
                                            t.type === "in"
                                                ? "#c08a15"
                                                : "#888",
                                    }}
                                >
                                    {t.type === "in" ? "+" : "−"}
                                </span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 6,
                                            minWidth: 0,
                                        }}
                                    >
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
                                            {rowLabel(t)}
                                        </span>
                                        {t.type === "in" &&
                                            t.source === "savings" && (
                                                <span
                                                    style={{
                                                        flexShrink: 0,
                                                        fontSize: 10,
                                                        fontWeight: 800,
                                                        color: "#20a4a4",
                                                        background: "#fff",
                                                        padding: "2px 6px",
                                                        borderRadius: 6,
                                                    }}
                                                >
                                                    저축
                                                </span>
                                            )}
                                    </div>
                                    <div
                                        style={{
                                            fontSize: 11.5,
                                            color: "#a3a3a3",
                                            fontWeight: 600,
                                        }}
                                    >
                                        {t.date}
                                    </div>
                                </div>
                                <span
                                    style={{
                                        flexShrink: 0,
                                        fontSize: 15,
                                        fontWeight: 800,
                                        letterSpacing: "-0.02em",
                                        color:
                                            t.type === "in"
                                                ? "#171717"
                                                : "#e5484d",
                                    }}
                                >
                                    {t.type === "in" ? "+" : "-"}
                                    {formatWon(t.amount)}
                                </span>
                                <button
                                    type="button"
                                    className="btn-text"
                                    disabled={deletingId === t.id}
                                    onClick={() => void handleDelete(t.id)}
                                    style={{
                                        flexShrink: 0,
                                        color: "#c9525a",
                                        fontSize: 12.5,
                                    }}
                                >
                                    삭제
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {moreCount > 0 && (
                    <button
                        type="button"
                        onClick={() => {
                            resetIdle()
                            setShown((s) => s + PAGE_SIZE)
                        }}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 6,
                            width: "100%",
                            height: 48,
                            marginTop: 10,
                            border: "1px solid #ececec",
                            borderRadius: 14,
                            background: "#fff",
                            font: "inherit",
                            fontSize: 14,
                            fontWeight: 700,
                            color: "#555",
                            cursor: "pointer",
                        }}
                    >
                        {moreCount}개 더 보기
                    </button>
                )}
            </div>
        </div>
    )
}
