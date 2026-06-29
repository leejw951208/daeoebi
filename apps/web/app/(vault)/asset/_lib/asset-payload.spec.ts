// 자산 seal/open 라운드트립 테스트. WebCrypto(node global)로 실제 VK 를 생성해 암복호화한다.
import { generateVaultKey } from "@/lib/vault-crypto"
import {
    openExpense,
    openIncome,
    sealExpense,
    sealIncome,
} from "./asset-payload"

describe("asset-payload seal/open", () => {
    it("지출 본문을 라운드트립한다", async () => {
        const vk = await generateVaultKey()
        const payload = {
            item: "점심 김밥천국",
            amount: 8500,
            category: "식비",
            method: "신용카드",
        }
        const blob = await sealExpense(vk, payload)
        await expect(openExpense(vk, blob)).resolves.toEqual(payload)
    })

    it("수입 블롭을 seal→open 라운드트립한다", async () => {
        const vk = await generateVaultKey()
        const blob = await sealIncome(vk, {
            item: "6월 월급",
            amount: 3_200_000,
            category: "월급",
        })
        await expect(openIncome(vk, blob)).resolves.toEqual({
            item: "6월 월급",
            amount: 3_200_000,
            category: "월급",
        })
    })

    it("다른 키로는 복호화되지 않는다", async () => {
        const vk = await generateVaultKey()
        const other = await generateVaultKey()
        const blob = await sealExpense(vk, {
            item: "x",
            amount: 1,
            category: "기타",
            method: "현금",
        })
        await expect(openExpense(other, blob)).rejects.toBeDefined()
    })
})
