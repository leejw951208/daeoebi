"use client"
// 대외비 페이지에서 "홈 화면에 추가" 안내. 7일 dismiss cookie.
import { useEffect, useState } from "react"
import {
    buildInstallBannerDismissCookie,
    shouldShowInstallBanner,
} from "./install-banner-visibility"

function isStandalone(): boolean {
    if (typeof window === "undefined") return false
    if (window.matchMedia("(display-mode: standalone)").matches) return true
    type NavigatorWithStandalone = Navigator & { standalone?: boolean }
    return Boolean((window.navigator as NavigatorWithStandalone).standalone)
}

export function InstallBanner({ dismissedAt }: { dismissedAt: number }) {
    const [visible, setVisible] = useState(() =>
        shouldShowInstallBanner({ dismissedAt, now: Date.now() }),
    )

    useEffect(() => {
        if (isStandalone()) setVisible(false)
    }, [])

    if (!visible) return null

    return (
        <div className="install-banner" role="region" aria-label="설치 안내">
            <span>
                모바일 Safari 의 공유 메뉴에서 &quot;홈 화면에 추가&quot; 로
                앱을 설치할 수 있습니다.
            </span>
            <button
                type="button"
                className="install-banner-dismiss"
                aria-label="닫기"
                onClick={() => {
                    document.cookie = buildInstallBannerDismissCookie(
                        Date.now(),
                    )
                    setVisible(false)
                }}
            >
                ×
            </button>
        </div>
    )
}
