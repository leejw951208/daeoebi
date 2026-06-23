// 보관함 CRUD e2e. PIN 로그인 + 마스터 해제 후 Site/Category/Secret CRUD·검색·잠금·CSRF 를 검증한다.
import { Test } from "@nestjs/testing"
import { INestApplication, ValidationPipe } from "@nestjs/common"
import request from "supertest"
import { execSync } from "node:child_process"
import * as path from "node:path"
import { AppModule } from "../src/app.module"
import { HttpExceptionFilter } from "../src/common/http-exception.filter"
import { PrismaService } from "../src/prisma/prisma.service"
import { VaultSessionService } from "../src/vault/vault-session.service"

const ORIGIN = "http://localhost:3000"
const PIN = "246810"
const MASTER = "super-strong-master-pw-12345"

describe("Store(보관함) e2e", () => {
    let app: INestApplication
    let prisma: PrismaService
    let session: VaultSessionService
    let pinCookie: string

    function get(url: string) {
        return request(app.getHttpServer()).get(url).set("Cookie", pinCookie)
    }

    function write(method: "post" | "patch" | "delete", url: string) {
        const req = request(app.getHttpServer())
        return req[method](url)
            .set("Origin", ORIGIN)
            .set("X-Vault-Request", "1")
            .set("Cookie", pinCookie)
    }

    async function unlockVault(): Promise<void> {
        await request(app.getHttpServer())
            .post("/vault/setup")
            .set("Origin", ORIGIN)
            .set("X-Vault-Request", "1")
            .send({ master: MASTER })
            .expect(201)
    }

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
        session = app.get(VaultSessionService)
    }, 60_000)

    afterAll(async () => {
        await session?.lock()
        await prisma?.$disconnect()
        await app?.close()
    })

    beforeEach(async () => {
        await session.lock()
        await prisma.secret.deleteMany()
        await prisma.category.deleteMany()
        await prisma.site.deleteMany()
        await prisma.vaultMaster.deleteMany()
        await prisma.pinCredential.deleteMany()

        const setupRes = await request(app.getHttpServer())
            .post("/pin/setup")
            .set("Origin", ORIGIN)
            .set("X-Pin-Request", "1")
            .send({ pin: PIN })
            .expect(201)
        const cookies = ([] as string[]).concat(
            setupRes.headers["set-cookie"] ?? [],
        )
        const raw = cookies.find((c) => c.startsWith("pin_session="))
        pinCookie = raw ? raw.split(";")[0] : ""
    })

    async function createSite(label: string): Promise<string> {
        const res = await write("post", "/sites").send({ label }).expect(201)
        return res.body.id as string
    }

    it("PIN 로그인 없이는 401 PIN_REQUIRED", async () => {
        const res = await request(app.getHttpServer())
            .get("/sites")
            .expect(401)
        expect(res.body.code).toBe("PIN_REQUIRED")
    })

    it("사이트 CRUD 가 동작한다", async () => {
        const id = await createSite("우리은행")
        const listed = await get("/sites").expect(200)
        expect(listed.body).toHaveLength(1)
        expect(listed.body[0].label).toBe("우리은행")

        await write("patch", `/sites/${id}`)
            .send({ icon: "🏦" })
            .expect(200)
        const got = await get(`/sites/${id}`).expect(200)
        expect(got.body.icon).toBe("🏦")

        await write("delete", `/sites/${id}`).expect(204)
        await get(`/sites/${id}`).expect(404)
    })

    it("카테고리 CRUD 와 SetNull 동작", async () => {
        const siteId = await createSite("우리은행")
        const catRes = await write("post", "/categories")
            .send({ siteId, label: "계좌번호" })
            .expect(201)
        const categoryId = catRes.body.id as string

        const list = await get(`/categories?siteId=${siteId}`).expect(200)
        expect(list.body).toHaveLength(1)

        await unlockVault()
        const secretRes = await write("post", "/secrets")
            .send({ siteId, categoryId, label: "로그인", value: "pw-1234" })
            .expect(201)
        const secretId = secretRes.body.id as string

        // 카테고리 삭제 시 비밀번호는 사이트 직속으로 남는다(SetNull).
        await write("delete", `/categories/${categoryId}`).expect(204)
        const after = await get(`/secrets/${secretId}`).expect(200)
        expect(after.body.categoryId).toBeNull()
        expect(after.body.value).toBe("pw-1234")
    })

    it("비밀번호 생성·열람·수정·삭제(암호화)", async () => {
        const siteId = await createSite("네이버페이")
        await unlockVault()

        const created = await write("post", "/secrets")
            .send({ siteId, label: "결제비밀번호", value: "secret-001" })
            .expect(201)
        const id = created.body.id as string
        expect(created.body.value).toBeUndefined() // 목록 응답엔 본문 없음

        const revealed = await get(`/secrets/${id}`).expect(200)
        expect(revealed.body.value).toBe("secret-001")

        await write("patch", `/secrets/${id}`)
            .send({ value: "secret-002" })
            .expect(200)
        const reRevealed = await get(`/secrets/${id}`).expect(200)
        expect(reRevealed.body.value).toBe("secret-002")

        await write("delete", `/secrets/${id}`).expect(204)
        await get(`/secrets/${id}`).expect(404)
    })

    it("잠금 상태에서 비밀번호 생성은 401 VAULT_LOCKED", async () => {
        const siteId = await createSite("우리은행")
        const res = await write("post", "/secrets")
            .send({ siteId, label: "결제비밀번호", value: "pw" })
            .expect(401)
        expect(res.body.code).toBe("VAULT_LOCKED")
    })

    it("라벨 검색이 사이트·카테고리·비밀번호를 반환한다", async () => {
        const siteId = await createSite("우리은행")
        await write("post", "/categories")
            .send({ siteId, label: "우리계좌" })
            .expect(201)
        await unlockVault()
        await write("post", "/secrets")
            .send({ siteId, label: "우리로그인", value: "pw" })
            .expect(201)

        const res = await get("/search?q=우리").expect(200)
        expect(res.body.sites).toHaveLength(1)
        expect(res.body.categories).toHaveLength(1)
        expect(res.body.secrets).toHaveLength(1)
    })

    it("X-Vault-Request 헤더 없으면 403 CSRF_INVALID", async () => {
        const res = await request(app.getHttpServer())
            .post("/sites")
            .set("Origin", ORIGIN)
            .set("Cookie", pinCookie)
            .send({ label: "우리은행" })
            .expect(403)
        expect(res.body.code).toBe("CSRF_INVALID")
    })
})
