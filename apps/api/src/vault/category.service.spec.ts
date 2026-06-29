// CategoryService 단위 테스트(Prisma 모킹). 사이트 검증·존재 검증·CRUD 위임을 검증한다.
import { NotFoundException } from "@nestjs/common"
import { CategoryService } from "./category.service"
import { VAULT_ERRORS } from "./vault.types"

function makePrisma() {
    return {
        site: { findUnique: jest.fn() },
        category: {
            findMany: jest.fn(),
            findUnique: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
        },
    }
}

function makeService(prisma: ReturnType<typeof makePrisma>) {
    return new CategoryService(prisma as unknown as never)
}

describe("CategoryService.listBySite", () => {
    it("사이트가 없으면 SITE_NOT_FOUND", async () => {
        const prisma = makePrisma()
        prisma.site.findUnique.mockResolvedValue(null)
        await expect(makeService(prisma).listBySite("nope")).rejects.toMatchObject(
            { response: { code: VAULT_ERRORS.SITE_NOT_FOUND } },
        )
    })

    it("사이트가 있으면 라벨 오름차순으로 조회한다", async () => {
        const prisma = makePrisma()
        prisma.site.findUnique.mockResolvedValue({ id: "site1" })
        prisma.category.findMany.mockResolvedValue([])
        await makeService(prisma).listBySite("site1")
        expect(prisma.category.findMany).toHaveBeenCalledWith({
            where: { siteId: "site1" },
            orderBy: { label: "asc" },
        })
    })
})

describe("CategoryService.create", () => {
    it("사이트가 없으면 SITE_NOT_FOUND", async () => {
        const prisma = makePrisma()
        prisma.site.findUnique.mockResolvedValue(null)
        await expect(
            makeService(prisma).create({ siteId: "nope", label: "메모" } as never),
        ).rejects.toThrow(NotFoundException)
    })

    it("사이트가 있으면 생성한다", async () => {
        const prisma = makePrisma()
        prisma.site.findUnique.mockResolvedValue({ id: "site1" })
        prisma.category.create.mockResolvedValue({ id: "c1" })
        await makeService(prisma).create({ siteId: "site1", label: "메모" } as never)
        expect(prisma.category.create).toHaveBeenCalledWith({
            data: { siteId: "site1", label: "메모" },
        })
    })
})

describe("CategoryService.update", () => {
    it("없으면 CATEGORY_NOT_FOUND", async () => {
        const prisma = makePrisma()
        prisma.category.findUnique.mockResolvedValue(null)
        await expect(
            makeService(prisma).update("x", { label: "y" } as never),
        ).rejects.toMatchObject({
            response: { code: VAULT_ERRORS.CATEGORY_NOT_FOUND },
        })
    })

    it("라벨이 없으면 빈 데이터로 호출한다(no-op 갱신)", async () => {
        const prisma = makePrisma()
        prisma.category.findUnique.mockResolvedValue({ id: "c1" })
        prisma.category.update.mockResolvedValue({ id: "c1" })
        await makeService(prisma).update("c1", {} as never)
        expect(prisma.category.update).toHaveBeenCalledWith({
            where: { id: "c1" },
            data: {},
        })
    })
})

describe("CategoryService.remove", () => {
    it("없으면 CATEGORY_NOT_FOUND", async () => {
        const prisma = makePrisma()
        prisma.category.findUnique.mockResolvedValue(null)
        await expect(makeService(prisma).remove("x")).rejects.toThrow(
            NotFoundException,
        )
    })

    it("있으면 삭제한다", async () => {
        const prisma = makePrisma()
        prisma.category.findUnique.mockResolvedValue({ id: "c1" })
        prisma.category.delete.mockResolvedValue({ id: "c1" })
        await makeService(prisma).remove("c1")
        expect(prisma.category.delete).toHaveBeenCalledWith({
            where: { id: "c1" },
        })
    })
})
