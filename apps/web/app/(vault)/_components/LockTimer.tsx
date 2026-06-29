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
export function LockTimer({ compact = false }: { compact?: boolean }) {
    const idle = useIdleSeconds()
    const { onLock } = useVault()
    const remaining = Math.max(0, idle)
    return (
        <button
            type="button"
            className={`lock-timer${idle <= 60 ? " urgent" : ""}`}
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
