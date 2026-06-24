// AuthService 보안 핵심 경로 단위 테스트(Prisma 모킹). C-1 등록 게이팅과 H-1 복구 검증을 검증한다.
import { HttpException, UnauthorizedException } from "@nestjs/common"
import { AuthService } from "./auth.service"
import { ChallengeService } from "./challenge.service"
import { SessionService } from "./session.service"
import { BackoffService } from "./backoff.service"
import { computeVerifier } from "./recovery-code"
import { AUTH_ERRORS } from "./auth.types"

// credential 개수와 recoveryWrap 행만 흉내내는 최소 Prisma 모킹.
function makePrisma(opts: {
    credentialCount: number
    recoveryWrap?: { rcSalt: Buffer; wrappedVkRc: Buffer; verifier: Buffer } | null
}) {
    // findMany 는 credentialCount 만큼의 더미 행을 반환해 length 기반 판정과 일치시킨다.
    const rows = Array.from({ length: opts.credentialCount }, () => ({
        credentialId: Buffer.from([1]),
        transports: [],
        prfSalt: Buffer.from([2]),
    }))
    return {
        webauthnCredential: {
            count: jest.fn().mockResolvedValue(opts.credentialCount),
            findMany: jest.fn().mockResolvedValue(rows),
        },
        recoveryWrap: {
            findUnique: jest.fn().mockResolvedValue(opts.recoveryWrap ?? null),
        },
    } as unknown as ConstructorParameters<typeof AuthService>[0]
}

function makeService(prisma: ConstructorParameters<typeof AuthService>[0]) {
    return new AuthService(
        prisma,
        new ChallengeService(),
        new SessionService(),
        new BackoffService(),
    )
}

describe("AuthService 등록 게이팅(C-1)", () => {
    it("credential 0개(최초)면 무인증 register/options 를 허용한다", async () => {
        const service = makeService(makePrisma({ credentialCount: 0 }))
        await expect(
            service.registerOptions(false, false),
        ).resolves.toHaveProperty("options")
    })

    it("credential 1개 이상이고 미인증이면 register/options 를 401 로 거부한다", async () => {
        const service = makeService(makePrisma({ credentialCount: 1 }))
        await expect(
            service.registerOptions(false, false),
        ).rejects.toBeInstanceOf(UnauthorizedException)
    })

    it("credential 1개 이상이라도 인증(세션/복구세션)되면 register/options 를 허용한다", async () => {
        const service = makeService(makePrisma({ credentialCount: 1 }))
        await expect(
            service.registerOptions(true, false),
        ).resolves.toHaveProperty("options")
    })
})

describe("AuthService 복구 검증(H-1)", () => {
    // recoveryCode = 20바이트의 base64url(클라가 Crockford 디코딩한 결과). 서버는 Base32 미구현.
    const codeBytes = Buffer.from("000b16212c37424d58636e79848f9aa5b0bbc6d1", "hex")
    const code = codeBytes.toString("base64url")
    const wrongCode = Buffer.alloc(20, 0xee).toString("base64url")
    const verifier = computeVerifier(codeBytes)
    const wrap = {
        rcSalt: Buffer.from([1, 2, 3]),
        wrappedVkRc: Buffer.from([4, 5, 6]),
        verifier,
    }

    it("올바른 복구코드면 wrap 블롭을 반환한다", async () => {
        const service = makeService(
            makePrisma({ credentialCount: 1, recoveryWrap: wrap }),
        )
        const result = await service.recoveryVerify(code)
        expect(result.rcSalt).toBe(Buffer.from(wrap.rcSalt).toString("base64url"))
        expect(result.wrappedVkRc).toBe(
            Buffer.from(wrap.wrappedVkRc).toString("base64url"),
        )
    })

    it("틀린 복구코드는 401 VERIFICATION_FAILED 로 거부한다", async () => {
        const service = makeService(
            makePrisma({ credentialCount: 1, recoveryWrap: wrap }),
        )
        await expect(service.recoveryVerify(wrongCode)).rejects.toMatchObject({
            response: { code: AUTH_ERRORS.VERIFICATION_FAILED },
        })
    })

    it("틀린 시도가 누적되면 429 RATE_LIMITED 로 백오프된다", async () => {
        const service = makeService(
            makePrisma({ credentialCount: 1, recoveryWrap: wrap }),
        )
        for (let i = 0; i < 5; i++) {
            await expect(service.recoveryVerify(wrongCode)).rejects.toBeDefined()
        }
        // 5회 실패 후 백오프 발동 → 올바른 코드여도 429.
        await expect(service.recoveryVerify(code)).rejects.toBeInstanceOf(
            HttpException,
        )
    })
})
