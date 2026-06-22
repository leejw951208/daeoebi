// 설치 안내 배너의 7일 숨김 상태를 판정하고 cookie 로 저장한다.
export const INSTALL_BANNER_DISMISS_COOKIE =
    "secretsmanager_install_banner_dismissed_at"
export const INSTALL_BANNER_DISMISS_SECONDS = 7 * 24 * 60 * 60

const SEVEN_DAYS_MS = INSTALL_BANNER_DISMISS_SECONDS * 1000

export function shouldShowInstallBanner({
    dismissedAt,
    now,
    standalone = false,
}: {
    dismissedAt: number
    now: number
    standalone?: boolean
}): boolean {
    if (standalone) return false
    if (!dismissedAt) return true
    return now - dismissedAt >= SEVEN_DAYS_MS
}

export function buildInstallBannerDismissCookie(now: number): string {
    return [
        `${INSTALL_BANNER_DISMISS_COOKIE}=${now}`,
        `Max-Age=${INSTALL_BANNER_DISMISS_SECONDS}`,
        "Path=/",
        "SameSite=Lax",
    ].join("; ")
}
