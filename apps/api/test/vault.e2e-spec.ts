// vault e2e 시나리오. setup/unlock/CRUD/export/import/lock/CSRF/backoff/재시작 후 미노출 검증.
import { Test } from "@nestjs/testing"
import { INestApplication, ValidationPipe } from "@nestjs/common"
import request from "supertest"
import * as path from "node:path"
import { execSync } from "node:child_process"
import { AppModule } from "../src/app.module"
import { HttpExceptionFilter } from "../src/common/http-exception.filter"
import { PrismaService } from "../src/prisma/prisma.service"

const ORIGIN = "http://127.0.0.1:3000"
const MASTER = "super-strong-master-pw-12345"
const VAULT_COOKIE = "vault_session=1"

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

type SuperServer = Parameters<typeof request>[0]

function vaultPost(server: SuperServer, url: string, withCookie = true) {
    const r = request(server)
        .post(url)
        .set("Origin", ORIGIN)
        .set("X-Vault-Request", "1")
    return withCookie ? r.set("Cookie", VAULT_COOKIE) : r
}

function vaultPatch(server: SuperServer, url: string) {
    return request(server)
        .patch(url)
        .set("Origin", ORIGIN)
        .set("X-Vault-Request", "1")
        .set("Cookie", VAULT_COOKIE)
}

function vaultDelete(server: SuperServer, url: string) {
    return request(server)
        .delete(url)
        .set("Origin", ORIGIN)
        .set("X-Vault-Request", "1")
        .set("Cookie", VAULT_COOKIE)
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
        await prisma?.$disconnect()
        await app?.close()
    })

    beforeEach(async () => {
        await prisma.vaultEntry.deleteMany()
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

    it("잠금 상태에서 entries 호출은 401 VAULT_LOCKED 를 반환한다", async () => {
        const server = app.getHttpServer()
        await vaultPost(server, "/vault/setup", false)
            .send({ master: MASTER })
            .expect(201)
        await vaultPost(server, "/vault/lock").expect(200)

        const res = await request(server).get("/vault/entries").expect(401)
        expect(res.body.code).toBe("VAULT_LOCKED")
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

    it("CRUD 라운드트립이 동작한다", async () => {
        const server = app.getHttpServer()
        await vaultPost(server, "/vault/setup", false)
            .send({ master: MASTER })
            .expect(201)

        const created = await vaultPost(server, "/vault/entries")
            .send({
                category: "CARD",
                label: "국민카드 메인",
                cardIssuer: "KB국민",
                cardNumber: "1234-5678-9012-3456",
                cardExpiry: "12/29",
                cardCvc: "123",
                cardPassword: "0000",
            })
            .expect(201)

        expect(created.body.id).toBeDefined()
        expect(created.body.payload.cardNumber).toBe("1234-5678-9012-3456")

        const list = await request(server)
            .get("/vault/entries")
            .query({ q: "국민" })
            .expect(200)
        expect(list.body).toHaveLength(1)
        expect(list.body[0].payload.cardNumber).toBe("1234-5678-9012-3456")

        await vaultPatch(server, `/vault/entries/${created.body.id}`)
            .send({
                category: "CARD",
                label: "국민카드 메인",
                cardIssuer: "KB국민",
                cardNumber: "0000-0000-0000-0000",
                cardExpiry: "12/29",
                cardCvc: "999",
                cardPassword: "1111",
            })
            .expect(200)

        const after = await request(server)
            .get(`/vault/entries/${created.body.id}`)
            .expect(200)
        expect(after.body.payload.cardNumber).toBe("0000-0000-0000-0000")

        await vaultDelete(server, `/vault/entries/${created.body.id}`).expect(
            200,
        )
        const empty = await request(server).get("/vault/entries").expect(200)
        expect(empty.body).toHaveLength(0)
    }, 60_000)

    it("CSRF 헤더 누락 시 403 CSRF_INVALID 를 반환한다 (한 단계 라우트)", async () => {
        const server = app.getHttpServer()
        await vaultPost(server, "/vault/setup", false)
            .send({ master: MASTER })
            .expect(201)

        const res = await request(server)
            .post("/vault/entries")
            .set("Origin", ORIGIN)
            .send({
                category: "OTHER",
                label: "csrf-test",
            })
        expect(res.status).toBe(403)
        expect(res.body.code).toBe("CSRF_INVALID")
    }, 30_000)

    it("CSRF 헤더 누락 시 다단계 라우트도 403 (PATCH /vault/entries/:id)", async () => {
        const server = app.getHttpServer()
        await vaultPost(server, "/vault/setup", false)
            .send({ master: MASTER })
            .expect(201)
        const created = await vaultPost(server, "/vault/entries")
            .send({ category: "OTHER", label: "multi-route" })
            .expect(201)

        const res = await request(server)
            .patch(`/vault/entries/${created.body.id}`)
            .set("Origin", ORIGIN)
            .send({ category: "OTHER", label: "multi-route" })
        expect(res.status).toBe(403)
        expect(res.body.code).toBe("CSRF_INVALID")
    }, 30_000)

    it("SameSite 쿠키 없이는 쓰기 요청이 403 으로 차단된다", async () => {
        const server = app.getHttpServer()
        await vaultPost(server, "/vault/setup", false)
            .send({ master: MASTER })
            .expect(201)

        const res = await request(server)
            .post("/vault/entries")
            .set("Origin", ORIGIN)
            .set("X-Vault-Request", "1")
            .send({ category: "OTHER", label: "no-cookie" })
        expect(res.status).toBe(403)
        expect(res.body.code).toBe("CSRF_INVALID")
    }, 30_000)

    it("export → 새 DB import 라운드트립 후 평문이 복원된다", async () => {
        const server = app.getHttpServer()
        await vaultPost(server, "/vault/setup", false)
            .send({ master: MASTER })
            .expect(201)

        await vaultPost(server, "/vault/entries")
            .send({
                category: "SHOPPING",
                label: "쿠팡",
                siteName: "쿠팡",
                siteUrl: "https://www.coupang.com",
                loginId: "me",
                loginPassword: "pw",
            })
            .expect(201)

        const exportRes = await vaultPost(server, "/vault/export")
            .buffer(true)
            .parse((res, callback) => {
                const chunks: Buffer[] = []
                res.on("data", (chunk: Buffer) => chunks.push(chunk))
                res.on("end", () => callback(null, Buffer.concat(chunks)))
            })
        expect(exportRes.status).toBe(200)
        const containerBuf = exportRes.body as Buffer
        const containerBase64 = containerBuf.toString("base64")

        await prisma.vaultEntry.deleteMany()

        const imported = await vaultPost(server, "/vault/import")
            .send({ container: containerBase64, master: MASTER })
            .expect(200)
        expect(imported.body.imported).toBe(1)

        const list = await request(server).get("/vault/entries").expect(200)
        expect(list.body).toHaveLength(1)
        expect(list.body[0].payload.loginPassword).toBe("pw")
    }, 60_000)

    it("손상된 컨테이너 import 는 400 IMPORT_CORRUPT", async () => {
        const server = app.getHttpServer()
        await vaultPost(server, "/vault/setup", false)
            .send({ master: MASTER })
            .expect(201)

        const garbled = Buffer.from('{"magic":"WRONG"}', "utf8").toString(
            "base64",
        )
        const res = await vaultPost(server, "/vault/import")
            .send({ container: garbled, master: MASTER })
            .expect(400)
        expect(res.body.code).toBe("IMPORT_CORRUPT")
    }, 30_000)

    it("import 충돌 - 기본은 409, mode=replace 는 덮어쓰기", async () => {
        const server = app.getHttpServer()
        await vaultPost(server, "/vault/setup", false)
            .send({ master: MASTER })
            .expect(201)
        await vaultPost(server, "/vault/entries")
            .send({ category: "OTHER", label: "dup", memo: "old" })
            .expect(201)

        const exportRes = await vaultPost(server, "/vault/export")
            .buffer(true)
            .parse((res, callback) => {
                const chunks: Buffer[] = []
                res.on("data", (chunk: Buffer) => chunks.push(chunk))
                res.on("end", () => callback(null, Buffer.concat(chunks)))
            })
        const containerBase64 = (exportRes.body as Buffer).toString("base64")

        const conflict = await vaultPost(server, "/vault/import")
            .send({ container: containerBase64, master: MASTER })
            .expect(409)
        expect(conflict.body.code).toBe("CATEGORY_LABEL_CONFLICT")

        const replaced = await vaultPost(server, "/vault/import")
            .query({ mode: "replace" })
            .send({ container: containerBase64, master: MASTER })
            .expect(200)
        expect(replaced.body.replaced).toBe(1)

        const skipped = await vaultPost(server, "/vault/import")
            .query({ mode: "skip" })
            .send({ container: containerBase64, master: MASTER })
            .expect(200)
        expect(skipped.body.skipped).toBe(1)
        expect(skipped.body.imported).toBe(0)
    }, 60_000)

    it("재시작 후 평문은 노출되지 않는다 (locked 상태)", async () => {
        const server = app.getHttpServer()
        await vaultPost(server, "/vault/setup", false)
            .send({ master: MASTER })
            .expect(201)
        await vaultPost(server, "/vault/entries")
            .send({
                category: "BANK",
                label: "신한 메인",
                bankName: "신한",
                accountNumber: "110-123-456789",
                loginId: "me",
                loginPassword: "pw",
                otpSeed: "seed",
            })
            .expect(201)

        await app.close()
        const boot = await bootstrap()
        app = boot.app
        prisma = boot.prisma

        const server2 = app.getHttpServer()
        const status = await request(server2).get("/vault/status").expect(200)
        expect(status.body.state).toBe("locked")
        await request(server2).get("/vault/entries").expect(401)
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
        expect(typeof blocked.body.retryAfterSeconds).toBe("number")
        expect(blocked.body.retryAfterSeconds).toBeGreaterThan(0)
    }, 120_000)

    it("OTHER 카테고리에서 key 중복은 400 으로 거부된다", async () => {
        const server = app.getHttpServer()
        await vaultPost(server, "/vault/setup", false)
            .send({ master: MASTER })
            .expect(201)

        const res = await vaultPost(server, "/vault/entries").send({
            category: "OTHER",
            label: "wifi",
            customFields: [
                { key: "ssid", value: "a" },
                { key: "ssid", value: "b" },
            ],
        })
        expect(res.status).toBe(400)
    }, 30_000)

    it("카테고리 DTO 부적합 (BANK 에 카드 필드만) → forbidNonWhitelisted 위반 400", async () => {
        const server = app.getHttpServer()
        await vaultPost(server, "/vault/setup", false)
            .send({ master: MASTER })
            .expect(201)

        // class-validator 의 forbidNonWhitelisted 는 화이트리스트 밖 필드를 차단한다.
        // BANK 카테고리는 cardNumber/cardCvc 같은 카드 필드를 받지 못한다(다만 DTO 가 카테고리별 분기 없이
        // 모두 허용하므로 여기서는 정의되지 않은 필드 'unknownField' 로 검증한다).
        const res = await vaultPost(server, "/vault/entries").send({
            category: "BANK",
            label: "신한",
            unknownField: "nope",
        })
        expect(res.status).toBe(400)
    }, 30_000)

    it("1KB 라벨도 저장·검색이 가능하다", async () => {
        const server = app.getHttpServer()
        await vaultPost(server, "/vault/setup", false)
            .send({ master: MASTER })
            .expect(201)
        const longLabel = "L" + "A".repeat(1022)
        await vaultPost(server, "/vault/entries")
            .send({ category: "OTHER", label: longLabel })
            .expect(201)
        const list = await request(server)
            .get("/vault/entries")
            .query({ q: longLabel.slice(0, 50) })
            .expect(200)
        expect(list.body).toHaveLength(1)
        expect(list.body[0].label.length).toBe(1023)
    }, 30_000)

    it("유니코드/이모지 라벨은 NFKC 정규화 후 저장된다", async () => {
        const server = app.getHttpServer()
        await vaultPost(server, "/vault/setup", false)
            .send({ master: MASTER })
            .expect(201)

        const rawLabel = "🔑 메인 계좌"
        const created = await vaultPost(server, "/vault/entries")
            .send({ category: "BANK", label: rawLabel })
            .expect(201)

        expect(created.body.label).toBe(rawLabel.normalize("NFKC"))
        const list = await request(server)
            .get("/vault/entries")
            .query({ q: "메인" })
            .expect(200)
        expect(list.body).toHaveLength(1)
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

    it("마스터 미설정 상태에서도 unlock 응답은 최소 시간을 보장한다 (타이밍 누설 차단)", async () => {
        const server = app.getHttpServer()
        const t0 = Date.now()
        const res = await vaultPost(server, "/vault/unlock", false).send({
            master: "any-master-pw-1234",
        })
        const elapsed = Date.now() - t0
        expect(res.status).toBe(400)
        // MIN_UNLOCK_DURATION_MS = 500 — 마스터 조회 즉시 분기되더라도 동일 시간만큼 패딩한다.
        expect(elapsed).toBeGreaterThanOrEqual(490)
    }, 30_000)

    it("ciphertext 변조 시 500 으로 응답하고 평문은 노출되지 않는다", async () => {
        const server = app.getHttpServer()
        await vaultPost(server, "/vault/setup", false)
            .send({ master: MASTER })
            .expect(201)
        const created = await vaultPost(server, "/vault/entries")
            .send({
                category: "OTHER",
                label: "corrupt-target",
                memo: "super-secret-plaintext",
            })
            .expect(201)

        const row = await prisma.vaultEntry.findUnique({
            where: { id: created.body.id },
        })
        if (!row) throw new Error("생성된 entry 를 찾지 못했습니다.")
        const corrupted = Buffer.from(row.ciphertext)
        corrupted[0] = corrupted[0] ^ 0xff
        await prisma.vaultEntry.update({
            where: { id: created.body.id },
            data: { ciphertext: corrupted },
        })

        const res = await request(server).get(
            `/vault/entries/${created.body.id}`,
        )
        expect(res.status).toBe(500)
        const serialized = JSON.stringify(res.body)
        expect(serialized).not.toContain("super-secret-plaintext")
    }, 30_000)

    it("Origin 화이트리스트 위반 시 403 CSRF_INVALID 를 반환한다", async () => {
        const server = app.getHttpServer()
        await vaultPost(server, "/vault/setup", false)
            .send({ master: MASTER })
            .expect(201)

        const res = await request(server)
            .post("/vault/entries")
            .set("Origin", "http://evil.example.com")
            .set("X-Vault-Request", "1")
            .set("Cookie", VAULT_COOKIE)
            .send({ category: "OTHER", label: "origin-spoof" })
        expect(res.status).toBe(403)
        expect(res.body.code).toBe("CSRF_INVALID")
    }, 30_000)

    it("동시 lock 호출 중 두 번째 요청은 423 VAULT_LOCKING 을 반환한다", async () => {
        const server = app.getHttpServer()
        await vaultPost(server, "/vault/setup", false)
            .send({ master: MASTER })
            .expect(201)

        const first = vaultPost(server, "/vault/lock")
        // first 의 컨트롤러 핸들러가 service.session.lock() 까지 진행하도록 한 차례 macrotask 양보.
        await new Promise((resolve) => setImmediate(resolve))
        const second = vaultPost(server, "/vault/lock")

        const responses = await Promise.all([first, second])
        const statuses = responses.map((r) => r.status).sort()
        expect(statuses).toEqual([200, 423])
        const blocked = responses.find((r) => r.status === 423)
        expect(blocked?.body.code).toBe("VAULT_LOCKING")
    }, 30_000)

    it("rekey 는 모든 entry 를 새 마스터로 재암호화한다", async () => {
        const server = app.getHttpServer()
        await vaultPost(server, "/vault/setup", false)
            .send({ master: MASTER })
            .expect(201)
        await vaultPost(server, "/vault/entries")
            .send({ category: "OTHER", label: "rekey-target", memo: "secret" })
            .expect(201)

        const NEW_MASTER = "another-strong-master-67890"
        const res = await vaultPost(server, "/vault/rekey")
            .send({ currentMaster: MASTER, newMaster: NEW_MASTER })
            .expect(200)
        expect(res.body.rotated).toBe(1)

        await vaultPost(server, "/vault/lock").expect(200)
        await vaultPost(server, "/vault/unlock", false)
            .send({ master: MASTER })
            .expect(401)
        await vaultPost(server, "/vault/unlock", false)
            .send({ master: NEW_MASTER })
            .expect(200)

        const list = await request(server).get("/vault/entries").expect(200)
        expect(list.body[0].payload.memo).toBe("secret")
    }, 120_000)
})
