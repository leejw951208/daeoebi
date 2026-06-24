// auth HTTP 엔드포인트. passkey 등록/로그인 옵션·검증, 복구 검증, 로그아웃을 노출한다.
// 라우트별로 @Public() 을 지정한다. 등록(register/*)은 최초 등록(credential 0개)이 아니면 유효 세션 또는 단기 복구 세션을 요구한다(C-1).
import {
    Body,
    Controller,
    Get,
    HttpCode,
    Post,
    Req,
    Res,
} from "@nestjs/common"
import type { Request, Response } from "express"
import { AuthService } from "./auth.service"
import { SessionService } from "./session.service"
import { Public } from "./public.decorator"
import {
    clearRecoveryCookie,
    clearSessionCookie,
    issueRecoveryCookie,
    issueSessionCookie,
    RECOVERY_COOKIE,
    SESSION_COOKIE,
    readCookie,
} from "./auth-cookies"
import {
    EmptyDto,
    LoginVerifyDto,
    RecoveryVerifyDto,
    RegisterVerifyDto,
} from "./dto/auth.dto"

@Controller("auth")
export class AuthController {
    constructor(
        private readonly service: AuthService,
        private readonly session: SessionService,
    ) {}

    @Get("status")
    @Public()
    status(@Req() req: Request) {
        const token = readCookie(req, SESSION_COOKIE)
        return this.service.status(this.session.isValid(token))
    }

    // 최초 등록(credential 0개)은 public, 그 외(기기 추가/복구 재등록)는 세션 또는 복구 세션 필요.
    @Post("register/options")
    @HttpCode(200)
    @Public()
    registerOptions(@Body() _dto: EmptyDto, @Req() req: Request) {
        return this.service.registerOptions(
            this.canRegister(req),
            this.isRecoverySession(req),
        )
    }

    @Post("register/verify")
    @HttpCode(200)
    @Public()
    async registerVerify(
        @Body() dto: RegisterVerifyDto,
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response,
    ): Promise<{ ok: true }> {
        await this.service.registerVerify(
            dto,
            this.canRegister(req),
            this.isRecoverySession(req),
        )
        // 복구 세션으로 들어온 등록이면 1회용 복구 세션을 폐기한다(one-shot).
        const recoveryToken = readCookie(req, RECOVERY_COOKIE)
        if (this.session.isRecoveryValid(recoveryToken)) {
            this.session.revokeRecovery(recoveryToken)
            clearRecoveryCookie(res)
        }
        issueSessionCookie(res, this.session.issue())
        return { ok: true }
    }

    @Post("login/options")
    @HttpCode(200)
    @Public()
    loginOptions(@Body() _dto: EmptyDto) {
        return this.service.loginOptions()
    }

    @Post("login/verify")
    @HttpCode(200)
    @Public()
    async loginVerify(
        @Body() dto: LoginVerifyDto,
        @Res({ passthrough: true }) res: Response,
    ): Promise<{ wrappedVkPrf: string; prfSalt: string }> {
        const result = await this.service.loginVerify(dto.response)
        issueSessionCookie(res, this.session.issue())
        return result
    }

    // 복구 검증. 성공 시 wrap 블롭 반환 + 단기 복구 세션 쿠키 발급(새 passkey 등록 1회 스코프).
    @Post("recovery/verify")
    @HttpCode(200)
    @Public()
    async recoveryVerify(
        @Body() dto: RecoveryVerifyDto,
        @Res({ passthrough: true }) res: Response,
    ): Promise<{ rcSalt: string; wrappedVkRc: string }> {
        const result = await this.service.recoveryVerify(dto.recoveryCode)
        issueRecoveryCookie(res, this.session.issueRecovery())
        return result
    }

    @Post("logout")
    @HttpCode(200)
    @Public()
    logout(
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response,
    ): { ok: true } {
        this.session.revoke(readCookie(req, SESSION_COOKIE))
        this.session.revokeRecovery(readCookie(req, RECOVERY_COOKIE))
        clearSessionCookie(res)
        clearRecoveryCookie(res)
        return { ok: true }
    }

    // 등록 허용 판정: 유효 일반 세션 또는 단기 복구 세션이 있으면 true.
    private canRegister(req: Request): boolean {
        const session = readCookie(req, SESSION_COOKIE)
        const recovery = readCookie(req, RECOVERY_COOKIE)
        return (
            this.session.isValid(session) ||
            this.session.isRecoveryValid(recovery)
        )
    }

    // 복구 세션 컨텍스트 여부: 복구 재등록은 자격증명 교체(분실 기기 무효화)로 처리한다.
    private isRecoverySession(req: Request): boolean {
        return this.session.isRecoveryValid(readCookie(req, RECOVERY_COOKIE))
    }
}
