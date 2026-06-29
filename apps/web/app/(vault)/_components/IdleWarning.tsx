"use client"
// 자동잠금 임박(60초 이하) 경고. idle 컨텍스트만 구독하는 잎 컴포넌트라
// 목록 화면 본문을 매초 리렌더하지 않는다.
import { useIdleSeconds } from "../_lib/vault-context"

export function IdleWarning() {
    const idle = useIdleSeconds()
    if (idle > 60) return null
    return (
        <div role="alert" className="error-box">
            {idle}초 후 자동 잠금됩니다.
        </div>
    )
}
