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
            findFirst: jest.fn().mockResolvedValue(null),
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
            data: expect.arrayContaining([
                { name: "식비", color: "#f2994a" },
                { name: "저축", color: "#14b8a6", kind: "SAVINGS" },
                { name: "투자", color: "#eab308", kind: "INVESTMENT" },
            ]),
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

    it("create 는 같은 이름이 있으면 409 DUPLICATE", async () => {
        const prisma = makePrisma()
        prisma.assetCategory.findFirst.mockResolvedValue({ id: "existing" })
        const svc = new AssetCategoryService(prisma as never)

        await expect(
            svc.create({ name: "식비", color: "#3bb273" }),
        ).rejects.toMatchObject({
            response: { code: ASSET_ERRORS.ASSET_CATEGORY_DUPLICATE },
        })
        expect(prisma.assetCategory.create).not.toHaveBeenCalled()
    })

    it("update 는 다른 카테고리와 이름이 겹치면 409 DUPLICATE", async () => {
        const prisma = makePrisma()
        prisma.assetCategory.findFirst.mockResolvedValue({ id: "other" })
        const svc = new AssetCategoryService(prisma as never)

        await expect(svc.update("1", { name: "식비" })).rejects.toMatchObject({
            response: { code: ASSET_ERRORS.ASSET_CATEGORY_DUPLICATE },
        })
        expect(prisma.assetCategory.findFirst).toHaveBeenCalledWith({
            where: { name: "식비", id: { not: "1" } },
            select: { id: true },
        })
        expect(prisma.assetCategory.update).not.toHaveBeenCalled()
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

    it("create 는 code 를 함께 저장한다", async () => {
        const prisma = makePrisma()
        prisma.assetCategory.create.mockResolvedValue({ id: "9" })
        const svc = new AssetCategoryService(prisma as never)

        await svc.create({ name: "여행", color: "#3bb273", code: "TRIP" })

        expect(prisma.assetCategory.create).toHaveBeenCalledWith({
            data: { name: "여행", color: "#3bb273", code: "TRIP" },
        })
    })

    it("create 는 빈/공백 code 를 무시한다(data 에 code 없음)", async () => {
        const prisma = makePrisma()
        prisma.assetCategory.create.mockResolvedValue({ id: "9" })
        const svc = new AssetCategoryService(prisma as never)

        await svc.create({ name: "여행", color: "#3bb273", code: "  " })

        expect(prisma.assetCategory.create).toHaveBeenCalledWith({
            data: { name: "여행", color: "#3bb273" },
        })
    })

    it("create 는 같은 code 가 있으면 409 CODE_DUPLICATE", async () => {
        const prisma = makePrisma()
        prisma.assetCategory.findFirst
            .mockResolvedValueOnce(null) // 이름 검사 통과
            .mockResolvedValueOnce({ id: "existing" }) // 코드 중복
        const svc = new AssetCategoryService(prisma as never)

        await expect(
            svc.create({ name: "여행", color: "#3bb273", code: "TRIP" }),
        ).rejects.toMatchObject({
            response: { code: ASSET_ERRORS.ASSET_CATEGORY_CODE_DUPLICATE },
        })
        expect(prisma.assetCategory.create).not.toHaveBeenCalled()
    })

    it("update 는 code 를 수정한다", async () => {
        const prisma = makePrisma()
        prisma.assetCategory.update.mockResolvedValue({ id: "1", code: "A01" })
        const svc = new AssetCategoryService(prisma as never)

        await svc.update("1", { code: "A01" })

        expect(prisma.assetCategory.findFirst).toHaveBeenCalledWith({
            where: { code: "A01", id: { not: "1" } },
            select: { id: true },
        })
        expect(prisma.assetCategory.update).toHaveBeenCalledWith({
            where: { id: "1" },
            data: { code: "A01" },
        })
    })

    it("update 는 빈 code 로 코드를 해제한다(null)", async () => {
        const prisma = makePrisma()
        prisma.assetCategory.update.mockResolvedValue({ id: "1", code: null })
        const svc = new AssetCategoryService(prisma as never)

        await svc.update("1", { code: "" })

        expect(prisma.assetCategory.update).toHaveBeenCalledWith({
            where: { id: "1" },
            data: { code: null },
        })
    })

    it("update 는 다른 카테고리와 code 가 겹치면 409 CODE_DUPLICATE", async () => {
        const prisma = makePrisma()
        prisma.assetCategory.findFirst.mockResolvedValue({ id: "other" })
        const svc = new AssetCategoryService(prisma as never)

        await expect(svc.update("1", { code: "A01" })).rejects.toMatchObject({
            response: { code: ASSET_ERRORS.ASSET_CATEGORY_CODE_DUPLICATE },
        })
        expect(prisma.assetCategory.update).not.toHaveBeenCalled()
    })
})
