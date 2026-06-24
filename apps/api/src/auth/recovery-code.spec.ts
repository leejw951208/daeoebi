// 복구코드 verifier 단위 테스트. 서버는 Base32 를 모르고 raw bytes(base64url)에 SHA-256 만 적용한다.
// 웹은 동일 바이트에 recoveryVerifier(SHA-256)를 적용하므로 verifier 가 일치한다.
import { computeVerifier, RECOVERY_CODE_BYTES } from "./recovery-code"

// 20바이트 벡터(bytes = i*11%256). 와이어 recoveryCode = 이 바이트의 base64url.
const BYTES_HEX = "000b16212c37424d58636e79848f9aa5b0bbc6d1"
const VERIFIER_B64URL = "VxTkKk9orYs6yFBBom5S11TjFMy58ZSPjR67fIqITDM"

describe("recovery-code", () => {
    it("복구코드 바이트 길이는 20(160bit)이다", () => {
        expect(RECOVERY_CODE_BYTES).toBe(20)
    })

    it("verifier 는 웹 recoveryVerifier(SHA-256(bytes))와 일치한다", () => {
        const bytes = Buffer.from(BYTES_HEX, "hex")
        const verifier = computeVerifier(bytes)
        expect(verifier.toString("base64url")).toBe(VERIFIER_B64URL)
    })

    it("서로 다른 바이트는 다른 verifier 를 만든다", () => {
        const a = computeVerifier(Buffer.from(BYTES_HEX, "hex"))
        const b = computeVerifier(Buffer.alloc(20, 0xee))
        expect(a.equals(b)).toBe(false)
    })
})
