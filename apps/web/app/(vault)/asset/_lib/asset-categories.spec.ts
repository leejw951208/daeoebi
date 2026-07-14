// 금액 표기 테스트. 순자산·남은 예산은 음수가 될 수 있어 부호 위치가 중요하다.
import { formatAmount, formatWon } from "./asset-categories"

describe("formatAmount", () => {
    it("천 단위로 끊는다", () => {
        expect(formatAmount(8500)).toBe("8,500")
        expect(formatAmount(0)).toBe("0")
    })
})

describe("formatWon", () => {
    it("양수는 통화 기호를 앞에 붙인다", () => {
        expect(formatWon(8500)).toBe("₩8,500")
        expect(formatWon(0)).toBe("₩0")
    })

    // "₩-8,500" 이 아니라 "-₩8,500" 이어야 한다(예산 초과·저축 초과 이체 표시).
    it("음수는 부호를 통화 기호 앞에 둔다", () => {
        expect(formatWon(-8500)).toBe("-₩8,500")
        expect(formatWon(-1_234_567)).toBe("-₩1,234,567")
    })
})
