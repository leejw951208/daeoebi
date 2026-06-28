// SecretService 단위 테스트(Prisma 모킹). 사이트/카테고리 검증, 암호문 base64url 패스스루,
// 부분 암호문 거부(CIPHERTEXT_INCOMPLETE), not-found 경로를 검증한다. 서버는 본문을 복호화하지 않는다.
import { NotFoundException } from "@nestjs/common"
import { SecretService } from "./secret.service"
import { toBase64url } from "../auth/base64url"
import { STORE_ERRORS } from "./store.types"

function makePrisma() {
    return {
        site: { findUnique: jest.fn() },
        category: { findUnique: jest.fn() },
        secret: {
            findMany: jest.fn(),
            findUnique: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
        },
    }
}

function makeService(prisma: ReturnType<typeof makePrisma>) {
    return new SecretService(prisma as unknown as never)
}

// 12/64/16 바이트 더미 블롭의 base64url.
const IV = Buffer.alloc(12, 1).toString("base64url")
const CT = Buffer.alloc(64, 2).toString("base64url")
const TAG = Buffer.alloc(16, 3).toString("base64url")

describe("SecretService.listBySite", () => {
    it("사이트가 없으면 404(SITE_NOT_FOUND)", async () => {
        const prisma = makePrisma()
        prisma.site.findUnique.mockResolvedValue(null)
        await expect(makeService(prisma).listBySite("nope")).rejects.toThrow(
            NotFoundException,
        )
    })

    it("categoryId 가 주어지면 where 에 포함해 조회한다", async () => {
        const prisma = makePrisma()
        prisma.site.findUnique.mockResolvedValue({ id: "site1" })
        prisma.secret.findMany.mockResolvedValue([])
        await makeService(prisma).listBySite("site1", "cat1")
        expect(prisma.secret.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { siteId: "site1", categoryId: "cat1" },
            }),
        )
    })
})

describe("SecretService.detail", () => {
    it("없으면 404(SECRET_NOT_FOUND)", async () => {
        const prisma = makePrisma()
        prisma.secret.findUnique.mockResolvedValue(null)
        await expect(makeService(prisma).detail("x")).rejects.toThrow(
            NotFoundException,
        )
    })

    it("암호문 Buffer 를 base64url 로 변환해 반환한다(서버 복호화 없음)", async () => {
        const prisma = makePrisma()
        const iv = Buffer.alloc(12, 1)
        const ct = Buffer.alloc(64, 2)
        const tag = Buffer.alloc(16, 3)
        prisma.secret.findUnique.mockResolvedValue({
            id: "s1",
            siteId: "site1",
            categoryId: null,
            label: "깃허브",
            iv,
            ciphertext: ct,
            authTag: tag,
            createdAt: new Date(0),
            updatedAt: new Date(0),
        })
        const detail = await makeService(prisma).detail("s1")
        expect(detail.iv).toBe(toBase64url(iv))
        expect(detail.ciphertext).toBe(toBase64url(ct))
        expect(detail.authTag).toBe(toBase64url(tag))
        expect(detail.label).toBe("깃허브")
    })
})

describe("SecretService.create", () => {
    it("사이트가 없으면 404", async () => {
        const prisma = makePrisma()
        prisma.site.findUnique.mockResolvedValue(null)
        await expect(
            makeService(prisma).create({
                siteId: "nope",
                label: "x",
                iv: IV,
                ciphertext: CT,
                authTag: TAG,
            } as never),
        ).rejects.toThrow(NotFoundException)
    })

    it("categoryId 가 다른 사이트 소속이면 CATEGORY_SITE_MISMATCH", async () => {
        const prisma = makePrisma()
        prisma.site.findUnique.mockResolvedValue({ id: "site1" })
        prisma.category.findUnique.mockResolvedValue({ siteId: "other" })
        await expect(
            makeService(prisma).create({
                siteId: "site1",
                categoryId: "cat1",
                label: "x",
                iv: IV,
                ciphertext: CT,
                authTag: TAG,
            } as never),
        ).rejects.toMatchObject({
            response: { code: STORE_ERRORS.CATEGORY_SITE_MISMATCH },
        })
    })

    it("정상 입력은 base64url 을 디코드해 생성한다", async () => {
        const prisma = makePrisma()
        prisma.site.findUnique.mockResolvedValue({ id: "site1" })
        prisma.secret.create.mockResolvedValue({ id: "s1" })
        await makeService(prisma).create({
            siteId: "site1",
            label: "깃허브",
            iv: IV,
            ciphertext: CT,
            authTag: TAG,
        } as never)
        const data = prisma.secret.create.mock.calls[0][0].data
        expect(data.label).toBe("깃허브")
        expect(data.categoryId).toBeNull()
        expect(Buffer.from(data.iv)).toEqual(Buffer.alloc(12, 1))
        expect(Buffer.from(data.ciphertext)).toEqual(Buffer.alloc(64, 2))
        expect(Buffer.from(data.authTag)).toEqual(Buffer.alloc(16, 3))
    })
})

describe("SecretService.update", () => {
    it("없으면 404", async () => {
        const prisma = makePrisma()
        prisma.secret.findUnique.mockResolvedValue(null)
        await expect(
            makeService(prisma).update("x", { label: "y" } as never),
        ).rejects.toThrow(NotFoundException)
    })

    it("암호문 일부만 보내면 CIPHERTEXT_INCOMPLETE 로 거부한다", async () => {
        const prisma = makePrisma()
        prisma.secret.findUnique.mockResolvedValue({ id: "s1", siteId: "site1" })
        await expect(
            makeService(prisma).update("s1", { iv: IV } as never),
        ).rejects.toMatchObject({
            response: { code: STORE_ERRORS.CIPHERTEXT_INCOMPLETE },
        })
    })

    it("라벨만 갱신하면 본문은 건드리지 않는다", async () => {
        const prisma = makePrisma()
        prisma.secret.findUnique.mockResolvedValue({ id: "s1", siteId: "site1" })
        prisma.secret.update.mockResolvedValue({ id: "s1" })
        await makeService(prisma).update("s1", { label: "새이름" } as never)
        const data = prisma.secret.update.mock.calls[0][0].data
        expect(data).toEqual({ label: "새이름" })
    })

    it("iv·ciphertext·authTag 가 모두 있으면 본문을 갱신한다", async () => {
        const prisma = makePrisma()
        prisma.secret.findUnique.mockResolvedValue({ id: "s1", siteId: "site1" })
        prisma.secret.update.mockResolvedValue({ id: "s1" })
        await makeService(prisma).update("s1", {
            iv: IV,
            ciphertext: CT,
            authTag: TAG,
        } as never)
        const data = prisma.secret.update.mock.calls[0][0].data
        expect(Buffer.from(data.iv)).toEqual(Buffer.alloc(12, 1))
        expect(Buffer.from(data.ciphertext)).toEqual(Buffer.alloc(64, 2))
        expect(Buffer.from(data.authTag)).toEqual(Buffer.alloc(16, 3))
    })
})

describe("SecretService.remove", () => {
    it("없으면 404", async () => {
        const prisma = makePrisma()
        prisma.secret.findUnique.mockResolvedValue(null)
        await expect(makeService(prisma).remove("x")).rejects.toThrow(
            NotFoundException,
        )
    })

    it("있으면 삭제한다", async () => {
        const prisma = makePrisma()
        prisma.secret.findUnique.mockResolvedValue({ id: "s1" })
        prisma.secret.delete.mockResolvedValue({ id: "s1" })
        await makeService(prisma).remove("s1")
        expect(prisma.secret.delete).toHaveBeenCalledWith({ where: { id: "s1" } })
    })
})
