// AuthController dev 진입 게이트 단위 테스트. 비운영에선 세션 발급, 운영(production)에선 404 로 막힌다.
// 우회 경로가 운영에 새지 않음을 고정한다(보안 회귀 방지).
import { NotFoundException } from "@nestjs/common"
import type { Response } from "express"
import { AuthController } from "./auth.controller"
import { SessionService } from "./session.service"
import { SESSION_COOKIE } from "./auth-cookies"

describe("AuthController.devLogin (비운영 패스키 우회 게이트)", () => {
    const ORIGINAL_ENV = process.env.NODE_ENV
    let controller: AuthController
    let session: SessionService

    beforeEach(() => {
        session = new SessionService()
        // devLogin 은 AuthService 를 쓰지 않으므로 빈 스텁으로 충분하다.
        controller = new AuthController({} as never, session)
    })

    afterEach(() => {
        process.env.NODE_ENV = ORIGINAL_ENV
    })

    function makeRes() {
        return { cookie: jest.fn() } as unknown as Response & { cookie: jest.Mock }
    }

    it("운영(production)에선 NotFoundException 으로 막고 쿠키를 발급하지 않는다", () => {
        process.env.NODE_ENV = "production"
        const res = makeRes()
        expect(() => controller.devLogin(res)).toThrow(NotFoundException)
        expect(res.cookie).not.toHaveBeenCalled()
    })

    it("비운영에선 sm_session 세션 쿠키를 발급한다", () => {
        process.env.NODE_ENV = "development"
        const res = makeRes()
        expect(controller.devLogin(res)).toEqual({ ok: true })
        expect(res.cookie).toHaveBeenCalledWith(
            SESSION_COOKIE,
            expect.any(String),
            expect.any(Object),
        )
        // 발급된 토큰은 유효 세션으로 인정된다.
        const token = res.cookie.mock.calls[0][1] as string
        expect(session.isValid(token)).toBe(true)
    })
})
