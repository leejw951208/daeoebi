// asset-dates 순수 함수 테스트.
import {
    addMonth,
    clampedDate,
    monthOf,
    monthsBetween,
    monthRange,
} from "./asset-dates"

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

describe("monthsBetween", () => {
    it("같은 달이면 0 이다", () => {
        expect(monthsBetween("2026-06", "2026-06")).toBe(0)
    })

    it("해를 넘겨도 개월 수를 센다", () => {
        expect(monthsBetween("2026-11", "2027-02")).toBe(3)
    })

    it("to 가 from 보다 앞이면 음수다", () => {
        expect(monthsBetween("2026-06", "2026-03")).toBe(-3)
    })
})

describe("monthRange", () => {
    it("양끝을 포함한 월 목록을 만든다", () => {
        expect(monthRange("2026-11", "2027-01")).toEqual([
            "2026-11",
            "2026-12",
            "2027-01",
        ])
    })

    it("같은 달이면 한 개다", () => {
        expect(monthRange("2026-06", "2026-06")).toEqual(["2026-06"])
    })

    it("to 가 from 보다 앞이면 빈 배열이다", () => {
        expect(monthRange("2026-06", "2026-03")).toEqual([])
    })
})
