"use client"
// 민감 필드 표시·클립보드 복사 + 30초 자동 클리어. aria-live 영역으로 진행 상황을 안내한다.
import { useEffect, useRef, useState } from "react"
import { scheduleClipboardClear } from "../_lib/clipboard-clear"

interface Props {
    label: string
    value: string
    sensitive?: boolean
    // 복사·보기 등 사용자 활동 시 자동잠금 타이머를 초기화하는 콜백.
    onActivity?: () => void
    // 지정 시 이 필드만 삭제하는 휴지통 버튼을 노출한다(상세 화면 전용).
    onDelete?: () => void
}

const CLEAR_AFTER_MS = 30_000

export function CopyField({
    label,
    value,
    sensitive,
    onActivity,
    onDelete,
}: Props) {
    const [revealed, setRevealed] = useState(false)
    const [status, setStatus] = useState<string>("")
    const [remaining, setRemaining] = useState<number | null>(null)
    const cancelRef = useRef<(() => void) | null>(null)

    useEffect(() => {
        return () => {
            cancelRef.current?.()
        }
    }, [])

    async function handleCopy() {
        onActivity?.()
        try {
            if (typeof navigator === "undefined" || !navigator.clipboard) {
                setStatus("이 환경에선 클립보드 API 를 사용할 수 없습니다.")
                return
            }
            await navigator.clipboard.writeText(value)
            setStatus(`${label} 이(가) 클립보드에 복사되었습니다.`)
            setRemaining(CLEAR_AFTER_MS / 1000)

            cancelRef.current?.()
            cancelRef.current = scheduleClipboardClear({
                value,
                clipboard: navigator.clipboard,
                totalMs: CLEAR_AFTER_MS,
                intervalMs: 1_000,
                onTick: (rem) => setRemaining(rem > 0 ? rem : null),
                onComplete: (result) => {
                    cancelRef.current = null
                    setRemaining(null)
                    if (result === "cleared") {
                        setStatus("클립보드를 비웠습니다.")
                    } else if (result === "denied") {
                        setStatus(
                            "클립보드 권한이 없어 자동 클리어를 건너뜁니다.",
                        )
                    }
                },
            })
        } catch (e) {
            setStatus(`복사 실패. ${(e as Error).message}`)
        }
    }

    const masked = sensitive && !revealed
    const maskDots = "•".repeat(Math.min(12, value.length || 8))

    return (
        <div className="secret-plate">
            <div className="secret-plate-head">
                <span className="secret-label" style={{ color: "#a0a0a0" }}>
                    {label}
                </span>
                <span className="secret-actions">
                    {sensitive && (
                        <button
                            type="button"
                            className="secret-btn"
                            style={{
                                fontSize: 12,
                                minWidth: 0,
                                minHeight: 0,
                                padding: "2px 6px",
                                color: "#999",
                            }}
                            onClick={() => {
                                onActivity?.()
                                setRevealed((v) => !v)
                            }}
                            aria-pressed={revealed}
                        >
                            {revealed ? "숨김" : "표시"}
                        </button>
                    )}
                    <button
                        type="button"
                        className="secret-btn accent"
                        style={{
                            fontSize: 12,
                            minWidth: 0,
                            minHeight: 0,
                            padding: "2px 4px",
                        }}
                        onClick={handleCopy}
                    >
                        {remaining !== null ? `복사됨 ${remaining}s` : "복사"}
                    </button>
                    {onDelete && (
                        <button
                            type="button"
                            className="secret-btn"
                            style={{
                                fontSize: 12,
                                minWidth: 0,
                                minHeight: 0,
                                padding: "2px 6px",
                                color: "#d99",
                            }}
                            onClick={() => {
                                onActivity?.()
                                onDelete()
                            }}
                            aria-label={`${label} 필드 삭제`}
                        >
                            삭제
                        </button>
                    )}
                </span>
            </div>
            <span
                className={`secret-value${masked ? " masked" : revealed ? " revealed" : ""}`}
            >
                {masked ? maskDots : value}
            </span>

            {remaining !== null && (
                <div
                    className="secret-drain"
                    aria-label={`${remaining}초 후 클립보드 자동 삭제`}
                >
                    <span className="secret-drain-track">
                        <span
                            className="secret-drain-fill"
                            style={{
                                width: `${(remaining / (CLEAR_AFTER_MS / 1000)) * 100}%`,
                            }}
                        />
                    </span>
                    <span className="secret-drain-count" aria-hidden="true">
                        {remaining}s
                    </span>
                </div>
            )}

            <span
                role="status"
                aria-live="polite"
                style={{ position: "absolute", left: -9999 }}
            >
                {status}
            </span>
        </div>
    )
}
