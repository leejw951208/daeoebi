// PIN 쓰기 요청 CSRF 정책. Origin 화이트리스트 + 커스텀 헤더 X-Pin-Request: 1 을 요구한다.
// 세션 쿠키는 SameSite=Strict 라 cross-site 전송이 차단되므로 쿠키 보유는 별도로 강제하지 않는다.
import { ForbiddenException, Injectable, NestMiddleware } from "@nestjs/common"
import type { NextFunction, Request, Response } from "express"
import { PIN_ERRORS } from "./pin.types"

const DEFAULT_ALLOWED_ORIGINS = "http://localhost:3000,http://127.0.0.1:3000"
const ALLOWED_ORIGINS = new Set(
    (process.env.VAULT_ALLOWED_ORIGINS ?? DEFAULT_ALLOWED_ORIGINS)
        .split(",")
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0),
)
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"])

@Injectable()
export class PinCsrfMiddleware implements NestMiddleware {
    use(req: Request, _res: Response, next: NextFunction): void {
        if (SAFE_METHODS.has(req.method.toUpperCase())) {
            next()
            return
        }

        const origin = (req.headers.origin as string | undefined) ?? ""
        if (!ALLOWED_ORIGINS.has(origin)) {
            throw new ForbiddenException({
                code: PIN_ERRORS.CSRF_INVALID,
                message: "Origin 이 허용되지 않습니다.",
            })
        }

        const marker = req.headers["x-pin-request"]
        if (marker !== "1") {
            throw new ForbiddenException({
                code: PIN_ERRORS.CSRF_INVALID,
                message: "X-Pin-Request 헤더가 필요합니다.",
            })
        }

        next()
    }
}
