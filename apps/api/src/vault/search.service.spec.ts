// SearchService 단위 테스트(Prisma 모킹). 라벨 부분 일치·빈 질의 단락·응답 형태(secrets 메타)를 검증한다.
// 회귀 고정: secret select 가 SecretMeta(웹 클라이언트가 기대하는 형태)에 필요한 createdAt/updatedAt 을 포함해야 한다.
// categories 는 레거시 호환용 빈 배열이다(비밀번호 분류 제거됨).
import { SearchService } from "./search.service"

function makePrisma() {
    return {
        site: { findMany: jest.fn().mockResolvedValue([]) },
        secret: { findMany: jest.fn().mockResolvedValue([]) },
    }
}

function makeService(prisma: ReturnType<typeof makePrisma>) {
    return new SearchService(prisma as unknown as never)
}

describe("SearchService", () => {
    it("빈/공백 질의는 DB 조회 없이 빈 결과를 반환한다", async () => {
        const prisma = makePrisma()
        const service = makeService(prisma)

        await expect(service.search("")).resolves.toEqual({
            sites: [],
            categories: [],
            secrets: [],
        })
        await expect(service.search("   ")).resolves.toEqual({
            sites: [],
            categories: [],
            secrets: [],
        })
        expect(prisma.site.findMany).not.toHaveBeenCalled()
        expect(prisma.secret.findMany).not.toHaveBeenCalled()
    })

    it("질의를 trim 해 대소문자 무시 부분 일치(contains)로 조회한다", async () => {
        const prisma = makePrisma()
        const service = makeService(prisma)

        await service.search("  PASS  ")

        const contains = { contains: "PASS", mode: "insensitive" }
        expect(prisma.site.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { label: contains } }),
        )
        expect(prisma.secret.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { label: contains } }),
        )
    })

    it("secret 조회 select 가 SecretMeta 형태(createdAt/updatedAt 포함)를 갖춘다", async () => {
        const prisma = makePrisma()
        const service = makeService(prisma)

        await service.search("네이버")

        const arg = prisma.secret.findMany.mock.calls[0][0]
        expect(arg.select).toEqual(
            expect.objectContaining({
                id: true,
                siteId: true,
                label: true,
                createdAt: true,
                updatedAt: true,
            }),
        )
    })

    it("결과를 {sites,categories,secrets} 로 묶어 반환한다(categories 는 빈 배열)", async () => {
        const prisma = makePrisma()
        const secretRow = {
            id: "s1",
            siteId: "site1",
            label: "PASS 앱",
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
            updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        }
        prisma.secret.findMany.mockResolvedValue([secretRow])
        const service = makeService(prisma)

        const result = await service.search("PASS")
        expect(result.secrets).toEqual([secretRow])
        expect(result.sites).toEqual([])
        expect(result.categories).toEqual([])
    })
})
