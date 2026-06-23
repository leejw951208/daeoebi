// vault 쓰기 요청에 대한 CSRF 정책. Origin 화이트리스트 + 커스텀 헤더 X-Vault-Request: 1 + SameSite=Strict 마커 쿠키를 요구한다.
import { Injectable, NestMiddleware, ForbiddenException } from "@nestjs/common"
import type { Request, Response, NextFunction } from "express"
import { VAULT_ERRORS } from "./vault.types"
import { VAULT_CSRF_COOKIE } from "./vault-cookies"

// 환경 변수 VAULT_ALLOWED_ORIGINS 로 운영 시 화이트리스트를 덮어쓸 수 있다 (쉼표 구분).
// 미설정 시 localhost:3000, 127.0.0.1:3000 만 허용한다.
const DEFAULT_ALLOWED_ORIGINS = "http://localhost:3000,http://127.0.0.1:3000"
const ALLOWED_ORIGINS = new Set(
    (process.env.VAULT_ALLOWED_ORIGINS ?? DEFAULT_ALLOWED_ORIGINS)
        .split(",")
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0),
)
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"])

// vault setup/unlock 은 아직 마커 쿠키가 없을 수 있어 쿠키 검사를 제외한다.
const COOKIE_EXEMPT_PATHS = new Set(["/vault/setup", "/vault/unlock"])

@Injectable()
export class VaultCsrfMiddleware implements NestMiddleware {
    use(req: Request, _res: Response, next: NextFunction): void {
        const rawUrl = req.originalUrl ?? req.url ?? ""
        const path = rawUrl.split("?")[0]
        if (!path.startsWith("/vault")) {
            next()
            return
        }

        if (SAFE_METHODS.has(req.method.toUpperCase())) {
            next()
            return
        }

        const origin = (req.headers.origin as string | undefined) ?? ""
        if (!ALLOWED_ORIGINS.has(origin)) {
            throw new ForbiddenException({
                code: VAULT_ERRORS.CSRF_INVALID,
                message: "Origin 이 허용되지 않습니다.",
            })
        }

        const marker = req.headers["x-vault-request"]
        if (marker !== "1") {
            throw new ForbiddenException({
                code: VAULT_ERRORS.CSRF_INVALID,
                message: "X-Vault-Request 헤더가 필요합니다.",
            })
        }

        if (!COOKIE_EXEMPT_PATHS.has(path)) {
            const cookieHeader =
                (req.headers.cookie as string | undefined) ?? ""
            const hasMarker = cookieHeader
                .split(";")
                .some((part) => part.trim().startsWith(`${VAULT_CSRF_COOKIE}=`))
            if (!hasMarker) {
                throw new ForbiddenException({
                    code: VAULT_ERRORS.CSRF_INVALID,
                    message: "세션 쿠키가 없습니다. unlock 후 다시 시도하세요.",
                })
            }
        }

        next()
    }
}
