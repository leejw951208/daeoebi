"use client"
// 민감 필드 표시·클립보드 복사 + 30초 자동 클리어. aria-live 영역으로 진행 상황을 안내한다.
import { useEffect, useRef, useState } from "react"
import { scheduleClipboardClear } from "./clipboard-clear"

interface Props {
    label: string
    value: string
    sensitive?: boolean
}

const CLEAR_AFTER_MS = 30_000

export function CopyField({ label, value, sensitive }: Props) {
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

    return (
        <div className="secret-plate">
            <span className="secret-label">{label}</span>
            <span
                className={`secret-value${masked ? " masked" : revealed ? " revealed" : ""}`}
            >
                {masked ? MASK : value}
            </span>
            <span className="secret-actions">
                {sensitive && (
                    <button
                        type="button"
                        className="secret-btn"
                        onClick={() => setRevealed((v) => !v)}
                        aria-pressed={revealed}
                    >
                        {revealed ? "숨기기" : "보기"}
                    </button>
                )}
                <button
                    type="button"
                    className="secret-btn"
                    onClick={handleCopy}
                >
                    복사
                </button>
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

// 길이를 노출하지 않도록 고정 길이 마스크.
const MASK = "•".repeat(10)
