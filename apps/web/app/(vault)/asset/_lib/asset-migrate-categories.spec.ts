import { matchCategoryId } from "./asset-migrate-categories"

const CATS = [
    {
        id: "c1",
        name: "식비",
        color: "#f2994a",
        code: null,
        kind: "NORMAL" as const,
        createdAt: "",
        updatedAt: "",
    },
    {
        id: "c2",
        name: "교통",
        color: "#4a90d9",
        code: null,
        kind: "NORMAL" as const,
        createdAt: "",
        updatedAt: "",
    },
]

describe("matchCategoryId", () => {
    it("이름이 일치하면 id 반환", () => {
        expect(matchCategoryId("식비", CATS)).toBe("c1")
    })
    it("일치 없으면 null", () => {
        expect(matchCategoryId("없는카테고리", CATS)).toBeNull()
    })
    it("name 이 null 이면 null", () => {
        expect(matchCategoryId(null, CATS)).toBeNull()
    })
})
