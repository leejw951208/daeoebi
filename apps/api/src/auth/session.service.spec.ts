// 세션 서비스 단위 테스트. 일반 세션과 단기 복구 세션의 발급·검증·폐기를 검증한다.
import { SessionService } from "./session.service"

describe("SessionService", () => {
    let service: SessionService

    beforeEach(() => {
        service = new SessionService()
    })

    it("발급한 일반 세션 토큰은 유효하고, 미발급/undefined 는 무효다", () => {
        const token = service.issue()
        expect(service.isValid(token)).toBe(true)
        expect(service.isValid("없는토큰")).toBe(false)
        expect(service.isValid(undefined)).toBe(false)
    })

    it("revoke 후 토큰은 무효가 된다", () => {
        const token = service.issue()
        service.revoke(token)
        expect(service.isValid(token)).toBe(false)
    })

    it("복구 세션과 일반 세션은 분리된다(교차 검증 안 됨)", () => {
        const recovery = service.issueRecovery()
        expect(service.isRecoveryValid(recovery)).toBe(true)
        // 복구 토큰은 일반 세션으로 인정되지 않는다.
        expect(service.isValid(recovery)).toBe(false)

        const normal = service.issue()
        expect(service.isRecoveryValid(normal)).toBe(false)
    })

    it("복구 세션은 revoke 로 폐기된다(one-shot 등록 후 폐기 흐름)", () => {
        const recovery = service.issueRecovery()
        service.revokeRecovery(recovery)
        expect(service.isRecoveryValid(recovery)).toBe(false)
    })
})
