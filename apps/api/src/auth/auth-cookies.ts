// 인증 세션 쿠키(sm_session) 상수와 발행/제거·읽기 헬퍼.
import type { Request, Response } from "express"

export const SESSION_COOKIE = "sm_session"
export const RECOVERY_COOKIE = "sm_recovery"

// 운영(HTTPS)에서는 secure 를 켜 평문(http) 전송을 막는다. 로컬 http 개발에서만 false.
// COOKIE_SECURE 로 강제 지정할 수 있고, 미지정 시 NODE_ENV=production 이면 true.
const SECURE_COOKIE =
    (process.env.COOKIE_SECURE ?? "").toLowerCase() === "true" ||
    process.env.NODE_ENV === "production"

const baseOptions = {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: SECURE_COOKIE,
    path: "/",
}

export function issueSessionCookie(res: Response, token: string): void {
    res.cookie(SESSION_COOKIE, token, baseOptions)
}

export function clearSessionCookie(res: Response): void {
    res.clearCookie(SESSION_COOKIE, baseOptions)
}

export function issueRecoveryCookie(res: Response, token: string): void {
    res.cookie(RECOVERY_COOKIE, token, baseOptions)
}

export function clearRecoveryCookie(res: Response): void {
    res.clearCookie(RECOVERY_COOKIE, baseOptions)
}

// cookie-parser 없이 직접 파싱한다(구 vault/pin 과 동일한 방식).
export function readCookie(req: Request, name: string): string | undefined {
    const header = (req.headers.cookie as string | undefined) ?? ""
    for (const part of header.split(";")) {
        const trimmed = part.trim()
        const eq = trimmed.indexOf("=")
        if (eq === -1) continue
        if (trimmed.slice(0, eq) === name) {
            return decodeURIComponent(trimmed.slice(eq + 1))
        }
    }
    return undefined
}
