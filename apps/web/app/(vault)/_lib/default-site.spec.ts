// pickDefaultSiteId 단위 테스트. 중복 사이트가 있어도 결정적으로 원본(가장 오래된)을 고른다.
import { pickDefaultSiteId } from "./default-site"

describe("pickDefaultSiteId", () => {
    it("후보가 없으면 null", () => {
        expect(pickDefaultSiteId([])).toBeNull()
    })

    it("가장 오래된(createdAt) 사이트의 id 를 고른다", () => {
        const sites = [
            { id: "b", createdAt: "2026-02-01T00:00:00.000Z" },
            { id: "a", createdAt: "2026-01-01T00:00:00.000Z" },
            { id: "c", createdAt: "2026-03-01T00:00:00.000Z" },
        ]
        expect(pickDefaultSiteId(sites)).toBe("a")
    })

    it("입력 순서·중복 라벨과 무관하게 결정적이다", () => {
        // 같은 라벨의 두 사이트(원본=오래된 것)가 어떤 순서로 와도 원본을 고른다.
        const original = {
            id: "site-old",
            createdAt: "2026-01-01T00:00:00.000Z",
        }
        const dup = { id: "site-new", createdAt: "2026-06-01T00:00:00.000Z" }
        expect(pickDefaultSiteId([original, dup])).toBe("site-old")
        expect(pickDefaultSiteId([dup, original])).toBe("site-old")
    })

    it("createdAt 이 같으면 id 사전순으로 안정 정렬한다", () => {
        const sites = [
            { id: "zzz", createdAt: "2026-01-01T00:00:00.000Z" },
            { id: "aaa", createdAt: "2026-01-01T00:00:00.000Z" },
        ]
        expect(pickDefaultSiteId(sites)).toBe("aaa")
    })

    it("원본 배열을 변형하지 않는다(불변)", () => {
        const sites = [
            { id: "b", createdAt: "2026-02-01T00:00:00.000Z" },
            { id: "a", createdAt: "2026-01-01T00:00:00.000Z" },
        ]
        const snapshot = sites.map((s) => s.id)
        pickDefaultSiteId(sites)
        expect(sites.map((s) => s.id)).toEqual(snapshot)
    })
})
