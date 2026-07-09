import {
    AssetCategoryService,
    FIXED_CATEGORIES,
} from "./asset-category.service"
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
    describe("list", () => {
        it("없는 고정 카테고리를 시드하고 고정→사용자 순으로 정렬한다", async () => {
            const prisma = makePrisma()
            // ensureFixedCategories: 고정이 하나도 없음
            prisma.assetCategory.findMany
                .mockResolvedValueOnce([]) // where code not null
                .mockResolvedValueOnce([
                    // 목록 재조회: 사용자 먼저, 고정이 뒤섞인 상태
                    { id: "u1", name: "여행", color: "#111111", code: null },
                    {
                        id: "f-etc",
                        name: "기타",
                        color: "#98a0a8",
                        code: "ETC",
                    },
                    {
                        id: "f-food",
                        name: "식비",
                        color: "#f2994a",
                        code: "FOOD",
                    },
                ])
            const svc = new AssetCategoryService(prisma as never)

            const result = await svc.list()

            expect(prisma.assetCategory.createMany).toHaveBeenCalledTimes(1)
            expect(
                prisma.assetCategory.createMany.mock.calls[0][0].data,
            ).toHaveLength(FIXED_CATEGORIES.length)
            expect(
                prisma.assetCategory.createMany.mock.calls[0][0].skipDuplicates,
            ).toBe(true)
            // 고정(FOOD → ETC 순) 다음 사용자
            expect(result.map((c: { id: string }) => c.id)).toEqual([
                "f-food",
                "f-etc",
                "u1",
            ])
        })

        it("고정이 모두 있으면 시드하지 않는다", async () => {
            const prisma = makePrisma()
            prisma.assetCategory.findMany
                .mockResolvedValueOnce(
                    FIXED_CATEGORIES.map((c) => ({ code: c.code })),
                )
                .mockResolvedValueOnce([])
            const svc = new AssetCategoryService(prisma as never)

            await svc.list()

            expect(prisma.assetCategory.createMany).not.toHaveBeenCalled()
        })
    })

    describe("create", () => {
        it("이름·색으로 사용자 카테고리를 생성한다(code 없음)", async () => {
            const prisma = makePrisma()
            prisma.assetCategory.create.mockResolvedValue({ id: "9" })
            const svc = new AssetCategoryService(prisma as never)

            const result = await svc.create({ name: "여행", color: "#3bb273" })

            expect(prisma.assetCategory.create).toHaveBeenCalledWith({
                data: { name: "여행", color: "#3bb273" },
            })
            expect(result).toEqual({ id: "9" })
        })

        it("같은 이름이 있으면 409 DUPLICATE", async () => {
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
    })

    describe("update", () => {
        it("고정 카테고리면 403 FIXED_READONLY", async () => {
            const prisma = makePrisma()
            prisma.assetCategory.findUnique.mockResolvedValue({ code: "FOOD" })
            const svc = new AssetCategoryService(prisma as never)

            await expect(
                svc.update("f-food", { name: "밥값" }),
            ).rejects.toMatchObject({
                response: { code: ASSET_ERRORS.ASSET_CATEGORY_FIXED_READONLY },
            })
            expect(prisma.assetCategory.update).not.toHaveBeenCalled()
        })

        it("존재하지 않으면 404", async () => {
            const prisma = makePrisma()
            prisma.assetCategory.findUnique.mockResolvedValue(null)
            const svc = new AssetCategoryService(prisma as never)

            await expect(svc.update("x", { name: "a" })).rejects.toMatchObject({
                response: { code: ASSET_ERRORS.ASSET_CATEGORY_NOT_FOUND },
            })
        })

        it("사용자 카테고리의 이름·색을 수정한다", async () => {
            const prisma = makePrisma()
            prisma.assetCategory.findUnique.mockResolvedValue({ code: null })
            prisma.assetCategory.update.mockResolvedValue({ id: "u1" })
            const svc = new AssetCategoryService(prisma as never)

            await svc.update("u1", { name: "여행", color: "#3bb273" })

            expect(prisma.assetCategory.update).toHaveBeenCalledWith({
                where: { id: "u1" },
                data: { name: "여행", color: "#3bb273" },
            })
        })

        it("부분 업데이트를 지원한다(색만)", async () => {
            const prisma = makePrisma()
            prisma.assetCategory.findUnique.mockResolvedValue({ code: null })
            prisma.assetCategory.update.mockResolvedValue({ id: "u1" })
            const svc = new AssetCategoryService(prisma as never)

            await svc.update("u1", { color: "#3bb273" })

            expect(prisma.assetCategory.update).toHaveBeenCalledWith({
                where: { id: "u1" },
                data: { color: "#3bb273" },
            })
            expect(prisma.assetCategory.findFirst).not.toHaveBeenCalled()
        })

        it("이름이 다른 카테고리와 겹치면 409 DUPLICATE", async () => {
            const prisma = makePrisma()
            prisma.assetCategory.findUnique.mockResolvedValue({ code: null })
            prisma.assetCategory.findFirst.mockResolvedValue({ id: "other" })
            const svc = new AssetCategoryService(prisma as never)

            await expect(
                svc.update("u1", { name: "식비" }),
            ).rejects.toMatchObject({
                response: { code: ASSET_ERRORS.ASSET_CATEGORY_DUPLICATE },
            })
            expect(prisma.assetCategory.update).not.toHaveBeenCalled()
        })
    })

    describe("remove", () => {
        it("고정 카테고리면 403 FIXED_READONLY", async () => {
            const prisma = makePrisma()
            prisma.assetCategory.findUnique.mockResolvedValue({ code: "ETC" })
            const svc = new AssetCategoryService(prisma as never)

            await expect(svc.remove("f-etc")).rejects.toMatchObject({
                response: { code: ASSET_ERRORS.ASSET_CATEGORY_FIXED_READONLY },
            })
            expect(prisma.assetCategory.delete).not.toHaveBeenCalled()
        })

        it("존재하지 않으면 404", async () => {
            const prisma = makePrisma()
            prisma.assetCategory.findUnique.mockResolvedValue(null)
            const svc = new AssetCategoryService(prisma as never)

            await expect(svc.remove("x")).rejects.toMatchObject({
                response: { code: ASSET_ERRORS.ASSET_CATEGORY_NOT_FOUND },
            })
        })

        it("사용자 카테고리를 삭제한다", async () => {
            const prisma = makePrisma()
            prisma.assetCategory.findUnique.mockResolvedValue({ code: null })
            const svc = new AssetCategoryService(prisma as never)

            await svc.remove("u1")

            expect(prisma.assetCategory.delete).toHaveBeenCalledWith({
                where: { id: "u1" },
            })
        })
    })
})
