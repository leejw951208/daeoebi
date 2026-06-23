// PIN 세션 쿠키 상수와 발행/제거·읽기 헬퍼.
import type { Request, Response } from "express"

export const PIN_SESSION_COOKIE = "pin_session"

const baseOptions = {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: false,
    path: "/",
}

export function issuePinCookie(res: Response, token: string): void {
    res.cookie(PIN_SESSION_COOKIE, token, baseOptions)
}

export function clearPinCookie(res: Response): void {
    res.clearCookie(PIN_SESSION_COOKIE, baseOptions)
}

// cookie-parser 없이 직접 파싱한다(vault 와 동일한 방식).
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
