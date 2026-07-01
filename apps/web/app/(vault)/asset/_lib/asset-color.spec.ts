import { isValidHexColor, normalizeHexInput } from "./asset-categories"

describe("isValidHexColor", () => {
    it("#rrggbb 6자리는 유효", () => {
        expect(isValidHexColor("#f2994a")).toBe(true)
        expect(isValidHexColor("#ABCDEF")).toBe(true)
    })
    it("형식 불일치는 무효", () => {
        expect(isValidHexColor("")).toBe(false)
        expect(isValidHexColor("#fff")).toBe(false)
        expect(isValidHexColor("f2994a")).toBe(false)
        expect(isValidHexColor("#f2994g")).toBe(false)
        expect(isValidHexColor("#f2994a1")).toBe(false)
    })
})

describe("normalizeHexInput", () => {
    it("선행 # 를 보정하고 소문자로", () => {
        expect(normalizeHexInput("f2994a")).toBe("#f2994a")
        expect(normalizeHexInput("#F2994A")).toBe("#f2994a")
    })
    it("허용문자 외 제거, 중복 # 정리, 최대 7자", () => {
        expect(normalizeHexInput("##f2994a")).toBe("#f2994a")
        expect(normalizeHexInput("#f2 99 4a")).toBe("#f2994a")
        expect(normalizeHexInput("#f2994azzz99")).toBe("#f2994a")
    })
    it("빈 입력은 빈 문자열", () => {
        expect(normalizeHexInput("")).toBe("")
        expect(normalizeHexInput("#")).toBe("")
    })
})
