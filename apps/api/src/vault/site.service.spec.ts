// SiteService 단위 테스트(Prisma 모킹). 목록/조회(_count 포함)·생성·갱신·삭제와 not-found 경로를 검증한다.
import { NotFoundException } from "@nestjs/common"
import { SiteService } from "./site.service"
import { VAULT_ERRORS } from "./vault.types"

function makePrisma() {
    return {
        site: {
            findMany: jest.fn(),
            findUnique: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
        },
    }
}

function makeService(prisma: ReturnType<typeof makePrisma>) {
    return new SiteService(prisma as unknown as never)
}

describe("SiteService.list", () => {
    it("라벨 오름차순 + 카테고리/비밀번호 개수를 포함해 조회한다", async () => {
        const prisma = makePrisma()
        prisma.site.findMany.mockResolvedValue([])
        await makeService(prisma).list()
        expect(prisma.site.findMany).toHaveBeenCalledWith({
            orderBy: { label: "asc" },
            include: { _count: { select: { categories: true, secrets: true } } },
        })
    })
})

describe("SiteService.get", () => {
    it("없으면 SITE_NOT_FOUND", async () => {
        const prisma = makePrisma()
        prisma.site.findUnique.mockResolvedValue(null)
        await expect(makeService(prisma).get("x")).rejects.toMatchObject({
            response: { code: VAULT_ERRORS.SITE_NOT_FOUND },
        })
    })

    it("있으면 카테고리·비밀번호 개수를 포함해 반환한다", async () => {
        const prisma = makePrisma()
        const site = { id: "site1", label: "내 보관함", categories: [] }
        prisma.site.findUnique.mockResolvedValue(site)
        await expect(makeService(prisma).get("site1")).resolves.toBe(site)
    })
})

describe("SiteService.create", () => {
    it("icon 미지정이면 null 로 생성한다", async () => {
        const prisma = makePrisma()
        prisma.site.create.mockResolvedValue({ id: "site1" })
        await makeService(prisma).create({ label: "내 보관함" } as never)
        expect(prisma.site.create).toHaveBeenCalledWith({
            data: { label: "내 보관함", icon: null },
        })
    })
})

describe("SiteService.update", () => {
    it("없으면 SITE_NOT_FOUND", async () => {
        const prisma = makePrisma()
        prisma.site.findUnique.mockResolvedValue(null)
        await expect(
            makeService(prisma).update("x", { label: "y" } as never),
        ).rejects.toThrow(NotFoundException)
    })

    it("주어진 필드만 부분 갱신한다", async () => {
        const prisma = makePrisma()
        prisma.site.findUnique.mockResolvedValue({ id: "site1" })
        prisma.site.update.mockResolvedValue({ id: "site1" })
        await makeService(prisma).update("site1", { label: "새이름" } as never)
        expect(prisma.site.update).toHaveBeenCalledWith({
            where: { id: "site1" },
            data: { label: "새이름" },
        })
    })
})

describe("SiteService.remove", () => {
    it("없으면 SITE_NOT_FOUND", async () => {
        const prisma = makePrisma()
        prisma.site.findUnique.mockResolvedValue(null)
        await expect(makeService(prisma).remove("x")).rejects.toThrow(
            NotFoundException,
        )
    })

    it("있으면 삭제한다", async () => {
        const prisma = makePrisma()
        prisma.site.findUnique.mockResolvedValue({ id: "site1" })
        prisma.site.delete.mockResolvedValue({ id: "site1" })
        await makeService(prisma).remove("site1")
        expect(prisma.site.delete).toHaveBeenCalledWith({
            where: { id: "site1" },
        })
    })
})
