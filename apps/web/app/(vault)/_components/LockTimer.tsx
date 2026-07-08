"use client"
// 헤더의 자동잠금 카운트다운 버튼. 매초 변하는 남은 시간을 표시하므로,
// idle 컨텍스트를 구독하는 이 잎 컴포넌트만 매초 리렌더된다(화면 본문은 영향 없음).
import { useVault, useIdleSeconds } from "../_lib/vault-context"

function formatMmSs(total: number): string {
    const m = Math.floor(total / 60)
    const s = total % 60
    return `${m}:${String(s).padStart(2, "0")}`
}

// compact: 상세 화면처럼 "잠그기" 텍스트 없이 남은 시간만 표시한다.
// bare: 알약(pill) 없이 점+시간만 표시하는 상세 화면용 변형.
export function LockTimer({
    compact = false,
    bare = false,
}: {
    compact?: boolean
    bare?: boolean
}) {
    const idle = useIdleSeconds()
    const { onLock } = useVault()
    const remaining = Math.max(0, idle)

    if (bare) {
        return (
            <button
                type="button"
                onClick={onLock}
                aria-label={`자동 잠금까지 ${remaining}초. 지금 잠그기`}
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#888",
                    border: "none",
                    background: "none",
                    cursor: "pointer",
                    padding: 0,
                }}
            >
                <span
                    aria-hidden="true"
                    style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: "var(--ac)",
                        animation: "pulse 2s infinite",
                    }}
                />
                {compact
                    ? formatMmSs(remaining)
                    : `${formatMmSs(remaining)} 잠그기`}
            </button>
        )
    }

    return (
        <button
            type="button"
            className="lock-timer"
            onClick={onLock}
            aria-label={`자동 잠금까지 ${remaining}초. 지금 잠그기`}
        >
            <span className="dot" aria-hidden="true" />
            {compact
                ? formatMmSs(remaining)
                : `${formatMmSs(remaining)} 잠그기`}
        </button>
    )
}
