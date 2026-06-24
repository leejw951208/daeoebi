// 인증·store e2e. WebAuthn 서명 검증(verifyRegistration/AuthenticationResponse)만 모킹하고
// 가드·CSRF·세션·게이팅·암호문 패스스루는 실제 파이프라인으로 검증한다(C-1 류 회귀 고정 목적).
import { createHash, randomBytes } from "node:crypto"
// DATABASE_URL 등 env 는 jest setupFiles(test/setup-env.ts)가 모듈 평가 전에 주입한다.

// @simplewebauthn/server 모킹: generate* 는 실제 사용(챌린지 흐름 유지), verify* 만 제어한다.
jest.mock("@simplewebauthn/server", () => {
    const actual = jest.requireActual("@simplewebauthn/server")
    return {
        ...actual,
        verifyRegistrationResponse: jest.fn(),
        verifyAuthenticationResponse: jest.fn(),
    }
})

import { Test } from "@nestjs/testing"
import { INestApplication, ValidationPipe } from "@nestjs/common"
import request from "supertest"
import { execSync } from "node:child_process"
import * as path from "node:path"
import {
    verifyAuthenticationResponse,
    verifyRegistrationResponse,
} from "@simplewebauthn/server"
import { AppModule } from "../src/app.module"
import { HttpExceptionFilter } from "../src/common/http-exception.filter"
import { PrismaService } from "../src/prisma/prisma.service"

const ORIGIN = "http://localhost:3000"
const mockVerifyReg = verifyRegistrationResponse as jest.Mock
const mockVerifyAuth = verifyAuthenticationResponse as jest.Mock

// base64url 20바이트 더미 블롭(crypto 필드/래핑/복구 입력용).
function b64(bytes = 20): string {
    return randomBytes(bytes).toString("base64url")
}

// 고정 credential id(base64url). 등록·로그인 모킹이 공유한다.
const CRED_ID = randomBytes(16).toString("base64url")
const PUBKEY = randomBytes(32)
// 복구코드 = 20바이트. recoveryCode 와 verifier 가 같은 바이트에서 나오게 한다.
const RECOVERY_BYTES = randomBytes(20)
const RECOVERY_CODE = RECOVERY_BYTES.toString("base64url")
const RECOVERY_VERIFIER = createHash("sha256")
    .update(RECOVERY_BYTES)
    .digest("base64url")

describe("auth·store e2e (WebAuthn 검증만 모킹)", () => {
    let app: INestApplication
    let prisma: PrismaService

    function cookieHeader(res: request.Response): string {
        const set = res.headers["set-cookie"] as unknown as string[] | undefined
        return (set ?? []).map((c) => c.split(";")[0]).join("; ")
    }

    function write(method: "post" | "patch" | "delete", url: string) {
        const agent = request(app.getHttpServer())
        return agent[method](url)
            .set("Origin", ORIGIN)
            .set("X-Vault-Request", "1")
    }

    // 최초 passkey 등록(verify 성공 모킹) → sm_session 쿠키 반환.
    async function registerFirst(): Promise<string> {
        mockVerifyReg.mockResolvedValueOnce({
            verified: true,
            registrationInfo: {
                credential: { id: CRED_ID, publicKey: PUBKEY, counter: 0 },
                credentialDeviceType: "singleDevice",
                credentialBackedUp: false,
            },
        })
        await write("post", "/auth/register/options").send({}).expect(200)
        const res = await write("post", "/auth/register/verify")
            .send({
                response: { id: CRED_ID, type: "public-key" },
                prfSalt: b64(),
                wrappedVkPrf: b64(48),
                recovery: {
                    rcSalt: b64(),
                    wrappedVkRc: b64(48),
                    verifier: RECOVERY_VERIFIER,
                },
            })
            .expect(200)
        return cookieHeader(res)
    }

    beforeAll(async () => {
        if (!process.env.DATABASE_URL) {
            throw new Error("e2e 는 PostgreSQL DATABASE_URL 이 필요하다.")
        }
        const prismaBin = path.join(
            __dirname,
            "..",
            "node_modules",
            ".bin",
            "prisma",
        )
        execSync(`"${prismaBin}" migrate deploy`, {
            cwd: path.join(__dirname, ".."),
            stdio: "pipe",
            env: { ...process.env, RUST_LOG: "info" },
        })

        const moduleRef = await Test.createTestingModule({
            imports: [AppModule],
        }).compile()
        app = moduleRef.createNestApplication()
        app.useGlobalPipes(
            new ValidationPipe({
                whitelist: true,
                forbidNonWhitelisted: true,
                transform: true,
            }),
        )
        app.useGlobalFilters(new HttpExceptionFilter())
        await app.init()
        prisma = app.get(PrismaService)
    })

    afterAll(async () => {
        await app?.close()
    })

    beforeEach(async () => {
        mockVerifyReg.mockReset()
        mockVerifyAuth.mockReset()
        // 단일 사용자 모델: 매 테스트마다 빈 DB 로 시작한다.
        await prisma.secret.deleteMany()
        await prisma.category.deleteMany()
        await prisma.site.deleteMany()
        await prisma.webauthnCredential.deleteMany()
        await prisma.recoveryWrap.deleteMany()
    })

    describe("C-1 등록 게이팅", () => {
        it("credential 0개면 무세션 등록을 허용한다", async () => {
            const cookie = await registerFirst()
            expect(cookie).toContain("sm_session=")
        })

        it("credential 1개 이상이면 무세션 register/options 를 401 로 거부한다", async () => {
            await registerFirst()
            const res = await write("post", "/auth/register/options")
                .send({})
                .expect(401)
            expect(res.body.code).toBe("SESSION_REQUIRED")
        })

        it("유효 세션이 있으면 기기 추가 register/options 를 허용한다", async () => {
            const cookie = await registerFirst()
            await write("post", "/auth/register/options")
                .set("Cookie", cookie)
                .send({})
                .expect(200)
        })
    })

    describe("세션 가드", () => {
        it("무세션 GET /secrets 는 401", async () => {
            const res = await request(app.getHttpServer())
                .get("/secrets?siteId=x")
                .expect(401)
            expect(res.body.code).toBe("SESSION_REQUIRED")
        })

        it("무세션 POST /store/import 는 401", async () => {
            await write("post", "/store/import?mode=reject")
                .send({ version: "1", sites: [], categories: [], secrets: [] })
                .expect(401)
        })

        it("유효 세션이면 GET /secrets 통과(빈 목록 또는 사이트 검증)", async () => {
            const cookie = await registerFirst()
            // 사이트 없으면 404(SITE_NOT_FOUND) — 가드는 통과했다는 의미다.
            const res = await request(app.getHttpServer())
                .get("/secrets?siteId=does-not-exist")
                .set("Cookie", cookie)
            expect(res.status).not.toBe(401)
        })
    })

    describe("CSRF", () => {
        it("X-Vault-Request 헤더 없는 쓰기는 403", async () => {
            const cookie = await registerFirst()
            const res = await request(app.getHttpServer())
                .post("/sites")
                .set("Origin", ORIGIN)
                .set("Cookie", cookie)
                .send({ label: "사이트" })
                .expect(403)
            expect(res.body.code).toBe("CSRF_INVALID")
        })

        it("Origin 헤더가 없어도 X-Vault-Request 가 있으면 통과한다(Safari same-origin)", async () => {
            const cookie = await registerFirst()
            // Safari(WebKit)는 same-origin POST 에서 Origin 을 생략한다. 커스텀 헤더만으로 검증되어야 한다.
            const res = await request(app.getHttpServer())
                .post("/sites")
                .set("X-Vault-Request", "1")
                .set("Cookie", cookie)
                .send({ label: "사이트" })
            expect(res.status).not.toBe(403)
            expect(res.status).toBe(201)
        })

        it("허용되지 않은 Origin 은 여전히 403", async () => {
            const cookie = await registerFirst()
            const res = await request(app.getHttpServer())
                .post("/sites")
                .set("Origin", "https://evil.example.com")
                .set("X-Vault-Request", "1")
                .set("Cookie", cookie)
                .send({ label: "사이트" })
                .expect(403)
            expect(res.body.code).toBe("CSRF_INVALID")
        })
    })

    describe("store 암호문 패스스루", () => {
        it("생성한 secret 의 상세가 동일 블롭(iv/ct/authTag base64url)을 반환한다(서버 복호화 없음)", async () => {
            const cookie = await registerFirst()
            const site = await write("post", "/sites")
                .set("Cookie", cookie)
                .send({ label: "내 보관함" })
                .expect(201)
            const iv = b64(12)
            const ciphertext = b64(64)
            const authTag = b64(16)
            const created = await write("post", "/secrets")
                .set("Cookie", cookie)
                .send({ siteId: site.body.id, label: "깃허브", iv, ciphertext, authTag })
                .expect(201)
            // 목록 응답은 메타만(블롭 없음).
            expect(created.body.iv).toBeUndefined()

            const detail = await request(app.getHttpServer())
                .get(`/secrets/${created.body.id}`)
                .set("Cookie", cookie)
                .expect(200)
            expect(detail.body.iv).toBe(iv)
            expect(detail.body.ciphertext).toBe(ciphertext)
            expect(detail.body.authTag).toBe(authTag)
            expect(detail.body.label).toBe("깃허브")
        })
    })

    describe("복구 검증", () => {
        it("verifier 불일치는 401 VERIFICATION_FAILED", async () => {
            await registerFirst()
            const wrong = Buffer.alloc(20, 0xee).toString("base64url")
            const res = await write("post", "/auth/recovery/verify")
                .send({ recoveryCode: wrong })
                .expect(401)
            expect(res.body.code).toBe("VERIFICATION_FAILED")
        })

        it("일치하면 wrap 반환 + sm_recovery 발급", async () => {
            await registerFirst()
            const res = await write("post", "/auth/recovery/verify")
                .send({ recoveryCode: RECOVERY_CODE })
                .expect(200)
            expect(res.body.rcSalt).toBeDefined()
            expect(res.body.wrappedVkRc).toBeDefined()
            expect(cookieHeader(res)).toContain("sm_recovery=")
        })

        it("불일치 누적이 한도를 넘으면 429 RATE_LIMITED", async () => {
            await registerFirst()
            const wrong = Buffer.alloc(20, 0xee).toString("base64url")
            for (let i = 0; i < 5; i++) {
                await write("post", "/auth/recovery/verify")
                    .send({ recoveryCode: wrong })
                    .expect(401)
            }
            const res = await write("post", "/auth/recovery/verify")
                .send({ recoveryCode: RECOVERY_CODE })
                .expect(429)
            expect(res.body.code).toBe("RATE_LIMITED")
            expect(res.body.retryAfterSeconds).toBeGreaterThan(0)
        })
    })
})
