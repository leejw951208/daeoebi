import { AssetCategoryService } from "./asset-category.service"
import { ASSET_ERRORS } from "./asset.types"

function makePrisma() {
    return {
        assetCategory: {
            findMany: jest.fn(),
            createMany: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            findUnique: jest.fn(),
        },
    }
}

describe("AssetCategoryService", () => {
    it("목록이 비어 있으면 기본 카테고리를 시드한 뒤 반환한다", async () => {
        const prisma = makePrisma()
        const seeded = [{ id: "1", name: "식비", color: "#f2994a" }]
        prisma.assetCategory.findMany
            .mockResolvedValueOnce([]) // 첫 조회: 비어 있음
            .mockResolvedValueOnce(seeded) // 시드 후 재조회
        const svc = new AssetCategoryService(prisma as never)

        const result = await svc.list()

        expect(prisma.assetCategory.createMany).toHaveBeenCalledTimes(1)
        expect(prisma.assetCategory.createMany).toHaveBeenCalledWith({
            data: expect.arrayContaining([{ name: "식비", color: "#f2994a" }]),
        })
        expect(
            prisma.assetCategory.createMany.mock.calls[0][0].data,
        ).toHaveLength(8)
        expect(result).toEqual(seeded)
    })

    it("목록이 있으면 시드하지 않는다", async () => {
        const prisma = makePrisma()
        prisma.assetCategory.findMany.mockResolvedValue([
            { id: "1", name: "식비", color: "#f2994a" },
        ])
        const svc = new AssetCategoryService(prisma as never)

        await svc.list()

        expect(prisma.assetCategory.createMany).not.toHaveBeenCalled()
    })

    it("create 는 이름·색으로 생성한다", async () => {
        const prisma = makePrisma()
        prisma.assetCategory.create.mockResolvedValue({ id: "9" })
        const svc = new AssetCategoryService(prisma as never)

        const result = await svc.create({ name: "여행", color: "#3bb273" })

        expect(prisma.assetCategory.create).toHaveBeenCalledWith({
            data: { name: "여행", color: "#3bb273" },
        })
        expect(result).toEqual({ id: "9" })
    })

    it("update 는 존재하지 않으면 404(update 가 P2025 로 거부)", async () => {
        const prisma = makePrisma()
        prisma.assetCategory.update.mockRejectedValue({ code: "P2025" })
        const svc = new AssetCategoryService(prisma as never)

        await expect(svc.update("x", { name: "a" })).rejects.toMatchObject({
            response: { code: ASSET_ERRORS.ASSET_CATEGORY_NOT_FOUND },
        })
    })

    it("update 는 이름·색으로 수정한다", async () => {
        const prisma = makePrisma()
        prisma.assetCategory.update.mockResolvedValue({
            id: "1",
            name: "여행",
            color: "#3bb273",
        })
        const svc = new AssetCategoryService(prisma as never)

        await svc.update("1", { name: "여행", color: "#3bb273" })

        expect(prisma.assetCategory.update).toHaveBeenCalledWith({
            where: { id: "1" },
            data: { name: "여행", color: "#3bb273" },
        })
    })

    it("update 는 부분 업데이트를 지원한다", async () => {
        const prisma = makePrisma()
        prisma.assetCategory.update.mockResolvedValue({ id: "1", name: "여행" })
        const svc = new AssetCategoryService(prisma as never)

        await svc.update("1", { name: "여행" })

        expect(prisma.assetCategory.update).toHaveBeenCalledWith({
            where: { id: "1" },
            data: { name: "여행" },
        })
    })

    it("remove 는 삭제한다", async () => {
        const prisma = makePrisma()
        const svc = new AssetCategoryService(prisma as never)

        await svc.remove("1")

        expect(prisma.assetCategory.delete).toHaveBeenCalledWith({
            where: { id: "1" },
        })
    })

    it("remove 는 존재하지 않으면 404(delete 가 P2025 로 거부)", async () => {
        const prisma = makePrisma()
        prisma.assetCategory.delete.mockRejectedValue({ code: "P2025" })
        const svc = new AssetCategoryService(prisma as never)

        await expect(svc.remove("x")).rejects.toMatchObject({
            response: { code: ASSET_ERRORS.ASSET_CATEGORY_NOT_FOUND },
        })
    })
})
