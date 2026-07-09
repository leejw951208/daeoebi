// FIELD_SUGGESTIONS 단위 테스트. 추천 목록의 이름 유일성을 검증한다.
import { FIELD_SUGGESTIONS } from "./field-suggestions"

describe("FIELD_SUGGESTIONS", () => {
    it("추천 목록은 이름이 중복되지 않는다", () => {
        const names = FIELD_SUGGESTIONS.map((s) => s.name)
        expect(new Set(names).size).toBe(names.length)
    })
})
