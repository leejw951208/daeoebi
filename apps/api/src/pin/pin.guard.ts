// PIN 로그인 여부를 검사하는 가드. 보호가 필요한 컨트롤러에 적용한다.
import {
    CanActivate,
    ExecutionContext,
    Injectable,
    UnauthorizedException,
} from "@nestjs/common"
import type { Request } from "express"
import { PinSessionService } from "./pin-session.service"
import { PIN_SESSION_COOKIE, readCookie } from "./pin-cookies"
import { PIN_ERRORS } from "./pin.types"

@Injectable()
export class PinGuard implements CanActivate {
    constructor(private readonly session: PinSessionService) {}

    canActivate(context: ExecutionContext): boolean {
        const req = context.switchToHttp().getRequest<Request>()
        const token = readCookie(req, PIN_SESSION_COOKIE)
        if (!this.session.isValid(token)) {
            throw new UnauthorizedException({
                code: PIN_ERRORS.PIN_REQUIRED,
                message: "PIN 로그인이 필요합니다.",
            })
        }
        return true
    }
}
