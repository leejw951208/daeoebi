// isSensitiveFieldName 단위 테스트. 추천 목록 정확 일치 + 키워드 휴리스틱 + 비민감 판정을 검증한다.
import { isSensitiveFieldName, FIELD_SUGGESTIONS } from "./field-suggestions"

describe("isSensitiveFieldName", () => {
    it("추천 목록의 민감 항목은 true(대소문자·공백 무시)", () => {
        expect(isSensitiveFieldName("비밀번호")).toBe(true)
        expect(isSensitiveFieldName("  PIN ")).toBe(true)
        expect(isSensitiveFieldName("cvc")).toBe(true)
    })

    it("추천 목록의 비민감 항목은 false", () => {
        expect(isSensitiveFieldName("아이디")).toBe(false)
        expect(isSensitiveFieldName("URL")).toBe(false)
        expect(isSensitiveFieldName("유효기간")).toBe(false)
    })

    it("목록에 없어도 키워드가 들어가면 민감으로 추정한다", () => {
        expect(isSensitiveFieldName("로그인 password")).toBe(true)
        expect(isSensitiveFieldName("계좌 비밀")).toBe(true)
        expect(isSensitiveFieldName("OTP 시드값")).toBe(true)
        expect(isSensitiveFieldName("my secret token")).toBe(true)
    })

    it("키워드가 없는 임의 이름은 비민감으로 본다", () => {
        expect(isSensitiveFieldName("닉네임")).toBe(false)
        expect(isSensitiveFieldName("이메일")).toBe(false)
        expect(isSensitiveFieldName("메모")).toBe(false)
    })

    it("추천 목록은 이름이 중복되지 않는다", () => {
        const names = FIELD_SUGGESTIONS.map((s) => s.name)
        expect(new Set(names).size).toBe(names.length)
    })
})
