"use client"
// 세이빙 박스 입출금 바텀시트. 입금 시 출처(직접 입금/저축에서 이체)를 고르고 금액·메모를 입력해
// createSavingsBoxTxn 으로 저장한다. 출금은 출처 선택 없이 금액·메모만 받는다(source 는 "cash" 고정).
import { useState } from "react"
import { Button } from "@/components/Button"
import { useVault } from "../../_lib/vault-context"
import { createSavingsBoxTxn } from "@/lib/vault-client"
import { sealBoxTxn } from "../_lib/asset-payload"
import { formatAmount, formatWon } from "../_lib/asset-categories"

const MAX_AMOUNT_DIGITS = 12
const MAX_MEMO_LENGTH = 60
const ACCENT = "#e9b949"

type BoxSource = "cash" | "savings"

interface Props {
    mode: "in" | "out"
    // 저축 가용 잔액(표시용). 출처=저축 선택 시 안내 문구에만 쓰인다(계좌 자체를 차감하지 않는다).
    savedAvailable: number
    // 새 거래에 쓸 날짜("YYYY-MM-DD"). 오늘 날짜(asset-dates 의 todayISO)를 그대로 받는다.
    date: string
    onSaved: () => void | Promise<void>
    onClose: () => void
}

// 출처 세그먼트의 선택된 버튼 스타일(세이빙 박스 accent #e9b949 톤).
const SOURCE_ACTIVE_STYLE = {
    borderColor: "#e9b949",
    background: "#fdf6e3",
    color: "#5b4407",
} as const

export function SavingsBoxSheet({
    mode,
    savedAvailable,
    date,
    onSaved,
    onClose,
}: Props) {
    const { vaultKey, resetIdle } = useVault()
    const [source, setSource] = useState<BoxSource>("cash")
    const [amount, setAmount] = useState("")
    const [memo, setMemo] = useState("")
    const [saving, setSaving] = useState(false)
    const [saveFailed, setSaveFailed] = useState(false)
    const [amountFocused, setAmountFocused] = useState(false)

    const isIn = mode === "in"
    const title = isIn ? "입금" : "출금"
    const desc = isIn
        ? "남는 돈을 세이빙 박스에 모아두세요."
        : "필요한 만큼 세이빙 박스에서 꺼내 쓰세요."
    const memoPlaceholder = !isIn
        ? "예: 여행 경비로 사용"
        : source === "savings"
          ? "예: 적금에서 일부 이체"
          : "예: 용돈에서 남은 돈"
    const amountValue = Number(amount || "0")

    async function save() {
        if (saving || amountValue <= 0) return
        setSaving(true)
        setSaveFailed(false)
        try {
            const blob = await sealBoxTxn(vaultKey, {
                amount: amountValue,
                memo: memo.trim(),
            })
            await createSavingsBoxTxn(mode, isIn ? source : "cash", date, blob)
            await onSaved()
            onClose()
        } catch {
            setSaveFailed(true)
        } finally {
            setSaving(false)
        }
    }

    return (
        <div
            className="dialog-backdrop"
            role="dialog"
            aria-modal="true"
            aria-label={`세이빙 박스 ${title}`}
            onClick={(e) => {
                if (e.target === e.currentTarget && !saving) onClose()
            }}
        >
            <div className="sheet">
                <div className="sheet-grip" aria-hidden="true" />
                <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>
                    세이빙 박스 {title}
                </div>
                <p className="muted" style={{ fontSize: 13, marginBottom: 18 }}>
                    {desc}
                </p>

                {isIn && (
                    <>
                        <div
                            style={{
                                fontSize: 11.5,
                                fontWeight: 700,
                                color: "#a0a0a0",
                                marginBottom: 7,
                            }}
                        >
                            입금 출처
                        </div>
                        <div
                            style={{
                                display: "flex",
                                gap: 7,
                                marginBottom: source === "savings" ? 8 : 16,
                            }}
                        >
                            <button
                                type="button"
                                aria-pressed={source === "cash"}
                                onClick={() => {
                                    resetIdle()
                                    setSource("cash")
                                }}
                                style={{
                                    flex: 1,
                                    height: 44,
                                    borderRadius: 13,
                                    font: "inherit",
                                    fontSize: 14,
                                    fontWeight: 700,
                                    cursor: "pointer",
                                    border: "1.5px solid #ececec",
                                    background: "#fff",
                                    color: "#444",
                                    ...(source === "cash"
                                        ? SOURCE_ACTIVE_STYLE
                                        : {}),
                                }}
                            >
                                직접 입금
                            </button>
                            <button
                                type="button"
                                aria-pressed={source === "savings"}
                                onClick={() => {
                                    resetIdle()
                                    setSource("savings")
                                }}
                                style={{
                                    flex: 1,
                                    height: 44,
                                    borderRadius: 13,
                                    font: "inherit",
                                    fontSize: 14,
                                    fontWeight: 700,
                                    cursor: "pointer",
                                    border: "1.5px solid #ececec",
                                    background: "#fff",
                                    color: "#444",
                                    ...(source === "savings"
                                        ? SOURCE_ACTIVE_STYLE
                                        : {}),
                                }}
                            >
                                저축에서 이체
                            </button>
                        </div>
                        {source === "savings" && (
                            <div
                                style={{
                                    fontSize: 12,
                                    color: "#20a4a4",
                                    fontWeight: 700,
                                    marginBottom: 16,
                                    lineHeight: 1.5,
                                }}
                            >
                                저축 잔액 {formatWon(savedAvailable)} · 이체하면
                                저축에서 차감돼요
                            </div>
                        )}
                    </>
                )}

                <div
                    style={{
                        fontSize: 11.5,
                        fontWeight: 700,
                        color: "#a0a0a0",
                        marginBottom: 7,
                    }}
                >
                    금액
                </div>
                <div
                    className="income-input"
                    style={{
                        marginBottom: 16,
                        ...(amountFocused ? { borderColor: ACCENT } : {}),
                    }}
                    onFocus={() => setAmountFocused(true)}
                    onBlur={() => setAmountFocused(false)}
                >
                    <span aria-hidden="true">₩</span>
                    <input
                        inputMode="numeric"
                        value={amount ? formatAmount(amountValue) : ""}
                        placeholder="0"
                        aria-label="금액"
                        onChange={(e) => {
                            resetIdle()
                            setAmount(
                                e.target.value
                                    .replace(/[^\d]/g, "")
                                    .slice(0, MAX_AMOUNT_DIGITS),
                            )
                        }}
                    />
                </div>

                <div
                    style={{
                        fontSize: 11.5,
                        fontWeight: 700,
                        color: "#a0a0a0",
                        marginBottom: 7,
                    }}
                >
                    메모{" "}
                    <span style={{ color: "#cbcbcb", fontWeight: 600 }}>
                        · 선택
                    </span>
                </div>
                <input
                    className="field-control"
                    placeholder={memoPlaceholder}
                    value={memo}
                    maxLength={MAX_MEMO_LENGTH}
                    aria-label="메모"
                    onChange={(e) => {
                        resetIdle()
                        setMemo(e.target.value)
                    }}
                    style={{ marginBottom: 20 }}
                />

                {saveFailed && (
                    <div
                        role="alert"
                        className="error-box"
                        style={{ marginBottom: 12 }}
                    >
                        저장하지 못했어요. 다시 시도해 주세요.
                    </div>
                )}

                <Button
                    variant="primary"
                    style={{ width: "100%", background: "#171717" }}
                    onClick={() => {
                        resetIdle()
                        void save()
                    }}
                    loading={saving}
                    disabled={amountValue <= 0}
                >
                    {title}
                </Button>
            </div>
        </div>
    )
}
