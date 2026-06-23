// PIN 접속 인증 e2e. setup/login/logout/status, 6자리 검증, 5회 backoff, CSRF 를 검증한다.
import { Test } from "@nestjs/testing"
import { INestApplication, ValidationPipe } from "@nestjs/common"
import request from "supertest"
import { execSync } from "node:child_process"
import * as path from "node:path"
import { AppModule } from "../src/app.module"
import { HttpExceptionFilter } from "../src/common/http-exception.filter"
import { PrismaService } from "../src/prisma/prisma.service"

const ORIGIN = "http://localhost:3000"
const PIN = "135790"

type SuperServer = Parameters<typeof request>[0]

function pinPost(server: SuperServer, url: string) {
    return request(server)
        .post(url)
        .set("Origin", ORIGIN)
        .set("X-Pin-Request", "1")
}

describe("PIN e2e", () => {
    let app: INestApplication
    let prisma: PrismaService

    beforeAll(async () => {
        if (!process.env.DATABASE_URL) {
            throw new Error(
                "e2e 테스트는 PostgreSQL DATABASE_URL 이 설정되어야 한다.",
            )
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
    }, 60_000)

    afterAll(async () => {
        await prisma?.$disconnect()
        await app?.close()
    })

    beforeEach(async () => {
        await prisma.pinCredential.deleteMany()
    })

    it("setup 전 status 는 setup-required 다", async () => {
        const res = await request(app.getHttpServer())
            .get("/pin/status")
            .expect(200)
        expect(res.body.state).toBe("setup-required")
    })

    it("setup 후 logged-in 쿠키가 발행되고 status 는 ready 다", async () => {
        const setupRes = await pinPost(app.getHttpServer(), "/pin/setup")
            .send({ pin: PIN })
            .expect(201)
        const cookies = ([] as string[]).concat(
            setupRes.headers["set-cookie"] ?? [],
        )
        expect(
            cookies.some(
                (c) =>
                    /pin_session=/.test(c) &&
                    /SameSite=Strict/i.test(c) &&
                    /HttpOnly/i.test(c),
            ),
        ).toBe(true)

        const statusRes = await request(app.getHttpServer())
            .get("/pin/status")
            .expect(200)
        expect(statusRes.body.state).toBe("ready")
    })

    it("setup 재호출은 409 SETUP_EXISTS", async () => {
        await pinPost(app.getHttpServer(), "/pin/setup")
            .send({ pin: PIN })
            .expect(201)
        const res = await pinPost(app.getHttpServer(), "/pin/setup")
            .send({ pin: PIN })
            .expect(409)
        expect(res.body.code).toBe("SETUP_EXISTS")
    })

    it("올바른 PIN 으로 login 성공", async () => {
        await pinPost(app.getHttpServer(), "/pin/setup")
            .send({ pin: PIN })
            .expect(201)
        const res = await pinPost(app.getHttpServer(), "/pin/login")
            .send({ pin: PIN })
            .expect(200)
        expect(res.body.state).toBe("logged-in")
    })

    it("틀린 PIN 은 401 PIN_INVALID", async () => {
        await pinPost(app.getHttpServer(), "/pin/setup")
            .send({ pin: PIN })
            .expect(201)
        const res = await pinPost(app.getHttpServer(), "/pin/login")
            .send({ pin: "000000" })
            .expect(401)
        expect(res.body.code).toBe("PIN_INVALID")
    })

    it("6자리 숫자가 아니면 400 VALIDATION_FAILED", async () => {
        await pinPost(app.getHttpServer(), "/pin/setup")
            .send({ pin: "12ab" })
            .expect(400)
    })

    it("X-Pin-Request 헤더 없으면 403 CSRF_INVALID", async () => {
        const res = await request(app.getHttpServer())
            .post("/pin/setup")
            .set("Origin", ORIGIN)
            .send({ pin: PIN })
            .expect(403)
        expect(res.body.code).toBe("CSRF_INVALID")
    })

    it("5회 연속 실패 후 6번째는 429 RATE_LIMITED", async () => {
        await pinPost(app.getHttpServer(), "/pin/setup")
            .send({ pin: PIN })
            .expect(201)
        for (let i = 0; i < 5; i += 1) {
            await pinPost(app.getHttpServer(), "/pin/login")
                .send({ pin: "000000" })
                .expect(401)
        }
        const res = await pinPost(app.getHttpServer(), "/pin/login")
            .send({ pin: PIN })
            .expect(429)
        expect(res.body.code).toBe("RATE_LIMITED")
        expect(res.body.retryAfterSeconds).toBeGreaterThan(0)
    })

    it("logout 은 logged-out 상태를 반환한다", async () => {
        await pinPost(app.getHttpServer(), "/pin/setup")
            .send({ pin: PIN })
            .expect(201)
        const res = await pinPost(app.getHttpServer(), "/pin/logout").expect(200)
        expect(res.body.state).toBe("logged-out")
    })
})
