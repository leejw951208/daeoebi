// searchSecrets 계약 테스트(axios 모킹). 회귀 고정:
// /search 응답은 {sites,categories,secrets} 객체이므로 클라이언트는 secrets 배열만 추려 반환해야 한다.
// (과거 응답을 배열로 오인해 EntriesScreen 에서 .length 가 undefined 가 되어 검색이 항상 빈 화면이던 버그.)

const mockGet = jest.fn()
jest.mock("axios", () => ({
    __esModule: true,
    default: {
        create: () => ({
            get: mockGet,
            post: jest.fn(),
            patch: jest.fn(),
            delete: jest.fn(),
            interceptors: { response: { use: jest.fn() } },
        }),
    },
}))

import { searchSecrets } from "@/lib/vault-client"

const meta = {
    id: "s1",
    siteId: "site1",
    label: "PASS 앱",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
}

describe("searchSecrets", () => {
    beforeEach(() => mockGet.mockReset())

    it("응답 객체에서 secrets 배열만 추려 반환한다", async () => {
        mockGet.mockResolvedValue({
            data: { sites: [{ id: "x" }], categories: [], secrets: [meta] },
        })
        const result = await searchSecrets("PASS")
        expect(result).toEqual([meta])
    })

    it("q 를 쿼리 파라미터로 /search 에 전달한다", async () => {
        mockGet.mockResolvedValue({
            data: { sites: [], categories: [], secrets: [] },
        })
        await searchSecrets("네이버")
        expect(mockGet).toHaveBeenCalledWith("/search", {
            params: { q: "네이버" },
        })
    })

    it("일치하는 secret 이 없으면 빈 배열을 반환한다", async () => {
        mockGet.mockResolvedValue({
            data: { sites: [], categories: [], secrets: [] },
        })
        await expect(searchSecrets("zzz")).resolves.toEqual([])
    })
})
