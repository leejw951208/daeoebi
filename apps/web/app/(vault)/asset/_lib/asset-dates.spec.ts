// asset-dates 순수 함수 테스트.
import { addMonth, clampedDate, monthOf } from "./asset-dates"

describe("monthOf", () => {
    it("YYYY-MM-DD 에서 YYYY-MM 만 취한다", () => {
        expect(monthOf("2026-06-17")).toBe("2026-06")
    })
})

describe("addMonth", () => {
    it("다음 달", () => {
        expect(addMonth("2026-06", 1)).toBe("2026-07")
    })

    it("이전 달", () => {
        expect(addMonth("2026-06", -1)).toBe("2026-05")
    })

    it("연말은 다음 해 1월로 롤오버", () => {
        expect(addMonth("2026-12", 1)).toBe("2027-01")
    })
})

describe("clampedDate", () => {
    it("해당 월에 존재하는 날은 그대로", () => {
        expect(clampedDate("2026-06", 17)).toBe("2026-06-17")
    })

    it("말일을 넘는 날은 그 달 말일로 클램프", () => {
        expect(clampedDate("2026-02", 31)).toBe("2026-02-28")
    })

    it("1 미만은 1일로 클램프", () => {
        expect(clampedDate("2026-06", 0)).toBe("2026-06-01")
    })
})
