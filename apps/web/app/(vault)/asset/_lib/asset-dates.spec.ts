// asset-dates 순수 함수 테스트.
import { billingDate } from "./asset-dates"

describe("billingDate", () => {
    it("비카드(deferred=false)는 구매일 그대로", () => {
        expect(billingDate("2026-06-17", false)).toBe("2026-06-17")
    })

    it("카드는 다음 달 같은 일", () => {
        expect(billingDate("2026-06-17", true)).toBe("2026-07-17")
    })

    it("카드 말일 구매는 다음 달 말일로 클램프", () => {
        expect(billingDate("2026-01-31", true)).toBe("2026-02-28")
    })

    it("카드 연말 구매는 다음 해 1월로 롤오버", () => {
        expect(billingDate("2026-12-10", true)).toBe("2027-01-10")
    })
})
