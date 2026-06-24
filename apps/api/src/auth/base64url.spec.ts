// base64url 헬퍼 단위 테스트. API 경계 바이트 인코딩의 정합·검증을 보장한다.
import { fromBase64url, isBase64url, toBase64url } from "./base64url"

describe("base64url", () => {
    it("Uint8Array 를 패딩 없는 base64url 로 인코딩한다", () => {
        const bytes = Uint8Array.from([0, 1, 2, 250, 251, 255])
        const encoded = toBase64url(bytes)
        expect(encoded).not.toMatch(/[+/=]/)
        expect(isBase64url(encoded)).toBe(true)
    })

    it("인코딩↔디코딩이 왕복한다", () => {
        const bytes = Uint8Array.from(Array.from({ length: 32 }, (_, i) => i * 7))
        const roundtrip = fromBase64url(toBase64url(bytes))
        expect(Buffer.from(bytes).equals(roundtrip)).toBe(true)
    })

    it("패딩·표준 base64 문자·빈 문자열을 거부한다", () => {
        expect(isBase64url("")).toBe(false)
        expect(isBase64url("ab=")).toBe(false)
        expect(isBase64url("a+b/c")).toBe(false)
        expect(isBase64url(123)).toBe(false)
        expect(isBase64url(undefined)).toBe(false)
    })

    it("유효한 base64url 문자열을 통과시킨다", () => {
        expect(isBase64url("abcABC012_-")).toBe(true)
    })
})
