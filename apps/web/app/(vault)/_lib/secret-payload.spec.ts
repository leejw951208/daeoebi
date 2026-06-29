// secret-payload seal/open 라운드트립 단위 테스트. WebCrypto(node global)로 실제 VK 를 생성해 암복호화한다.
// 민감 플래그 보존과 구버전(폴백) 데이터 처리(undefined 유지)를 검증한다.
import { generateVaultKey, seal } from "@/lib/vault-crypto"
import { sealPayload, openPayload } from "./secret-payload"

describe("secret-payload seal/open", () => {
    it("필드·메모·sensitive 를 라운드트립한다", async () => {
        const vk = await generateVaultKey()
        const payload = {
            fields: [
                { name: "아이디", value: "neo", sensitive: false },
                { name: "비밀번호", value: "s3cret", sensitive: true },
            ],
            memo: "메인 계정",
        }
        const blob = await sealPayload(vk, payload)
        const restored = await openPayload(vk, blob)
        expect(restored).toEqual(payload)
    })

    it("구버전 데이터(sensitive 없음)는 sensitive 를 undefined 로 복원한다", async () => {
        const vk = await generateVaultKey()
        // v1 이지만 sensitive 키가 빠진 레거시 본문을 직접 seal 한다.
        const legacy = JSON.stringify({
            v: 1,
            fields: [{ name: "토큰", value: "abc" }],
            memo: "",
        })
        const blob = await seal(vk, legacy)
        const restored = await openPayload(vk, blob)
        expect(restored.fields[0].sensitive).toBeUndefined()
        expect(restored.fields[0].name).toBe("토큰")
        expect(restored.fields[0].value).toBe("abc")
    })

    it("fields 가 배열이 아니면 빈 배열로 복원한다", async () => {
        const vk = await generateVaultKey()
        const broken = JSON.stringify({ v: 1, memo: "x" })
        const blob = await seal(vk, broken)
        const restored = await openPayload(vk, blob)
        expect(restored.fields).toEqual([])
        expect(restored.memo).toBe("x")
    })

    it("다른 키로는 복호화되지 않는다(GCM 인증 실패)", async () => {
        const vk = await generateVaultKey()
        const other = await generateVaultKey()
        const blob = await sealPayload(vk, { fields: [], memo: "x" })
        await expect(openPayload(other, blob)).rejects.toBeDefined()
    })
})
