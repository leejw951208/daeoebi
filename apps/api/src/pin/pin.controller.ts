// PIN 접속 인증 HTTP 엔드포인트. setup/login/logout/status 를 노출한다.
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
import { PinService } from "./pin.service"
import { PinSessionService } from "./pin-session.service"
import { PinDto } from "./pin.dto"
import {
    clearPinCookie,
    issuePinCookie,
    PIN_SESSION_COOKIE,
    readCookie,
} from "./pin-cookies"

@Controller("pin")
export class PinController {
    constructor(
        private readonly service: PinService,
        private readonly session: PinSessionService,
    ) {}

    @Get("status")
    async status() {
        return this.service.status()
    }

    @Post("setup")
    @HttpCode(201)
    async setup(@Body() dto: PinDto, @Res({ passthrough: true }) res: Response) {
        await this.service.setup(dto.pin)
        issuePinCookie(res, this.session.issue())
        return { state: "logged-in" }
    }

    @Post("login")
    @HttpCode(200)
    async login(@Body() dto: PinDto, @Res({ passthrough: true }) res: Response) {
        await this.service.verify(dto.pin)
        issuePinCookie(res, this.session.issue())
        return { state: "logged-in" }
    }

    @Post("logout")
    @HttpCode(200)
    async logout(
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response,
    ) {
        this.session.revoke(readCookie(req, PIN_SESSION_COOKIE))
        clearPinCookie(res)
        return { state: "logged-out" }
    }
}
