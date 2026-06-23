// vault e2e. 마스터 setup/unlock/lock/status, backoff, 타이밍 패딩, CSRF, 동시 lock,
// 재시작 후 잠금, rekey(Secret 재암호화)를 검증한다. 비밀번호 CRUD 는 store.e2e 가 다룬다.
import { Test } from "@nestjs/testing"
import { INestApplication, ValidationPipe } from "@nestjs/common"
import request from "supertest"
import { execSync } from "node:child_process"
import * as path from "node:path"
import { AppModule } from "../src/app.module"
import { HttpExceptionFilter } from "../src/common/http-exception.filter"
import { PrismaService } from "../src/prisma/prisma.service"
import { VaultSessionService } from "../src/vault/vault-session.service"
import { VaultBackoffService } from "../src/vault/vault-backoff.service"

const ORIGIN = "http://127.0.0.1:3000"
const MASTER = "super-strong-master-pw-12345"
const VAULT_COOKIE = "vault_session=1"
const PIN = "246810"

type SuperServer = Parameters<typeof request>[0]

async function bootstrap(): Promise<{
    app: INestApplication
    prisma: PrismaService
}> {
    const moduleRef = await Test.createTestingModule({
        imports: [AppModule],
    }).compile()
    const app = moduleRef.createNestApplication()
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
        }),
    )
    app.useGlobalFilters(new HttpExceptionFilter())
    await app.init()
    const prisma = app.get(PrismaService)
    return { app, prisma }
}

function vaultPost(server: SuperServer, url: string, withCookie = true) {
    const r = request(server)
        .post(url)
        .set("Origin", ORIGIN)
        .set("X-Vault-Request", "1")
    return withCookie ? r.set("Cookie", VAULT_COOKIE) : r
}

function extractCookie(
    res: { headers: Record<string, unknown> },
    name: string,
): string {
    const cookies = ([] as string[]).concat(
        (res.headers["set-cookie"] as string[] | undefined) ?? [],
    )
    const raw = cookies.find((c) => c.startsWith(`${name}=`))
    return raw ? raw.split(";")[0] : ""
}

describe("Vault e2e", () => {
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

        const boot = await bootstrap()
        app = boot.app
        prisma = boot.prisma
    }, 60_000)

    afterAll(async () => {
        await app?.get(VaultSessionService).lock()
        await prisma?.$disconnect()
        await app?.close()
    })

    beforeEach(async () => {
        await app.get(VaultSessionService).lock()
        app.get(VaultBackoffService).reset()
        await prisma.secret.deleteMany()
        await prisma.category.deleteMany()
        await prisma.site.deleteMany()
        await prisma.pinCredential.deleteMany()
        await prisma.vaultMaster.deleteMany()
    })

    it("setup 직후 status 가 unlocked 가 되고 SameSite=Strict 쿠키가 발행된다", async () => {
        const server = app.getHttpServer()
        const setupRes = await vaultPost(server, "/vault/setup", false)
            .send({ master: MASTER })
            .expect(201)
        const cookies = ([] as string[]).concat(
            setupRes.headers["set-cookie"] ?? [],
        )
        expect(
            cookies.some(
                (c) =>
                    /vault_session=1/.test(c) &&
                    /SameSite=Strict/i.test(c) &&
                    /HttpOnly/i.test(c),
            ),
        ).toBe(true)

        const status = await request(server).get("/vault/status").expect(200)
        expect(status.body.state).toBe("unlocked")
    }, 30_000)

    it("setup 재호출은 409 SETUP_EXISTS 를 반환한다", async () => {
        const server = app.getHttpServer()
        await vaultPost(server, "/vault/setup", false)
            .send({ master: MASTER })
            .expect(201)
        const res = await vaultPost(server, "/vault/setup")
            .send({ master: MASTER })
            .expect(409)
        expect(res.body.code).toBe("SETUP_EXISTS")
    }, 30_000)

    it("잘못된 마스터로 unlock 하면 401 MASTER_INVALID 를 반환한다", async () => {
        const server = app.getHttpServer()
        await vaultPost(server, "/vault/setup", false)
            .send({ master: MASTER })
            .expect(201)
        await vaultPost(server, "/vault/lock").expect(200)

        const res = await vaultPost(server, "/vault/unlock", false)
            .send({ master: "wrong-master-pw" })
            .expect(401)
        expect(res.body.code).toBe("MASTER_INVALID")
    }, 30_000)

    it("마스터 양쪽 whitespace 는 trim 되어 unlock 한다", async () => {
        const server = app.getHttpServer()
        await vaultPost(server, "/vault/setup", false)
            .send({ master: "  " + MASTER + "  " })
            .expect(201)
        await vaultPost(server, "/vault/lock").expect(200)
        await vaultPost(server, "/vault/unlock", false)
            .send({ master: MASTER })
            .expect(200)
    }, 30_000)

    it("lock 후 status 는 locked 다", async () => {
        const server = app.getHttpServer()
        await vaultPost(server, "/vault/setup", false)
            .send({ master: MASTER })
            .expect(201)
        await vaultPost(server, "/vault/lock").expect(200)
        const status = await request(server).get("/vault/status").expect(200)
        expect(status.body.state).toBe("locked")
    }, 30_000)

    it("재시작 후 status 는 locked 다 (세션 키 메모리 폐기)", async () => {
        const server = app.getHttpServer()
        await vaultPost(server, "/vault/setup", false)
            .send({ master: MASTER })
            .expect(201)

        await app.close()
        const boot = await bootstrap()
        app = boot.app
        prisma = boot.prisma

        const status = await request(app.getHttpServer())
            .get("/vault/status")
            .expect(200)
        expect(status.body.state).toBe("locked")
    }, 60_000)

    it("5회 연속 unlock 실패 후 6번째는 429 RATE_LIMITED + retryAfterSeconds", async () => {
        const server = app.getHttpServer()
        await vaultPost(server, "/vault/setup", false)
            .send({ master: MASTER })
            .expect(201)
        await vaultPost(server, "/vault/lock").expect(200)

        for (let i = 0; i < 5; i += 1) {
            await vaultPost(server, "/vault/unlock", false)
                .send({ master: "wrong-master-attempt-x" })
                .expect(401)
        }
        const blocked = await vaultPost(server, "/vault/unlock", false).send({
            master: "wrong-master-attempt-x",
        })
        expect(blocked.status).toBe(429)
        expect(blocked.body.code).toBe("RATE_LIMITED")
        expect(blocked.body.retryAfterSeconds).toBeGreaterThan(0)
    }, 120_000)

    it("마스터 미설정 상태에서도 unlock 응답은 최소 시간을 보장한다 (타이밍 누설 차단)", async () => {
        const server = app.getHttpServer()
        const t0 = Date.now()
        const res = await vaultPost(server, "/vault/unlock", false).send({
            master: "any-master-pw-1234",
        })
        const elapsed = Date.now() - t0
        expect(res.status).toBe(400)
        expect(elapsed).toBeGreaterThanOrEqual(490)
    }, 30_000)

    it("동시 lock 호출 중 두 번째 요청은 423 VAULT_LOCKING 을 반환한다", async () => {
        const server = app.getHttpServer()
        await vaultPost(server, "/vault/setup", false)
            .send({ master: MASTER })
            .expect(201)

        const first = vaultPost(server, "/vault/lock")
        await new Promise((resolve) => setImmediate(resolve))
        const second = vaultPost(server, "/vault/lock")

        const responses = await Promise.all([first, second])
        const statuses = responses.map((r) => r.status).sort()
        expect(statuses).toEqual([200, 423])
        const blocked = responses.find((r) => r.status === 423)
        expect(blocked?.body.code).toBe("VAULT_LOCKING")
    }, 30_000)

    it("CSRF: X-Vault-Request 헤더 누락 시 403 CSRF_INVALID", async () => {
        const server = app.getHttpServer()
        await vaultPost(server, "/vault/setup", false)
            .send({ master: MASTER })
            .expect(201)
        const res = await request(server)
            .post("/vault/rekey")
            .set("Origin", ORIGIN)
            .set("Cookie", VAULT_COOKIE)
            .send({ currentMaster: MASTER })
        expect(res.status).toBe(403)
        expect(res.body.code).toBe("CSRF_INVALID")
    }, 30_000)

    it("CSRF: Origin 화이트리스트 위반 시 403 CSRF_INVALID", async () => {
        const server = app.getHttpServer()
        await vaultPost(server, "/vault/setup", false)
            .send({ master: MASTER })
            .expect(201)
        const res = await request(server)
            .post("/vault/rekey")
            .set("Origin", "http://evil.example.com")
            .set("X-Vault-Request", "1")
            .set("Cookie", VAULT_COOKIE)
            .send({ currentMaster: MASTER })
        expect(res.status).toBe(403)
        expect(res.body.code).toBe("CSRF_INVALID")
    }, 30_000)

    it("CSRF: 마커 쿠키 없이는 쓰기 요청이 403 으로 차단된다", async () => {
        const server = app.getHttpServer()
        await vaultPost(server, "/vault/setup", false)
            .send({ master: MASTER })
            .expect(201)
        const res = await request(server)
            .post("/vault/rekey")
            .set("Origin", ORIGIN)
            .set("X-Vault-Request", "1")
            .send({ currentMaster: MASTER })
        expect(res.status).toBe(403)
        expect(res.body.code).toBe("CSRF_INVALID")
    }, 30_000)

    it("rekey 는 모든 Secret 을 새 마스터로 재암호화한다", async () => {
        const server = app.getHttpServer()

        const pinRes = await request(server)
            .post("/pin/setup")
            .set("Origin", ORIGIN)
            .set("X-Pin-Request", "1")
            .send({ pin: PIN })
            .expect(201)
        const pinCookie = extractCookie(pinRes, "pin_session")

        await vaultPost(server, "/vault/setup", false)
            .send({ master: MASTER })
            .expect(201)

        const siteRes = await request(server)
            .post("/sites")
            .set("Origin", ORIGIN)
            .set("X-Vault-Request", "1")
            .set("Cookie", pinCookie)
            .send({ label: "우리은행" })
            .expect(201)
        const secretRes = await request(server)
            .post("/secrets")
            .set("Origin", ORIGIN)
            .set("X-Vault-Request", "1")
            .set("Cookie", pinCookie)
            .send({ siteId: siteRes.body.id, label: "로그인", value: "plain-secret" })
            .expect(201)
        const secretId = secretRes.body.id as string

        const NEW_MASTER = "another-strong-master-67890"
        const rekeyRes = await vaultPost(server, "/vault/rekey")
            .send({ currentMaster: MASTER, newMaster: NEW_MASTER })
            .expect(200)
        expect(rekeyRes.body.rotated).toBe(1)

        await vaultPost(server, "/vault/lock").expect(200)
        await vaultPost(server, "/vault/unlock", false)
            .send({ master: MASTER })
            .expect(401)
        await vaultPost(server, "/vault/unlock", false)
            .send({ master: NEW_MASTER })
            .expect(200)

        const reveal = await request(server)
            .get(`/secrets/${secretId}`)
            .set("Cookie", pinCookie)
            .expect(200)
        expect(reveal.body.value).toBe("plain-secret")
    }, 120_000)
})
