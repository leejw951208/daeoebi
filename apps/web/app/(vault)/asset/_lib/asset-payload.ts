// 자산(수입·지출) 본문 평문 구조의 seal/open 헬퍼. 금액·항목·카테고리·결제방법을 VK 로 암호화한다.
// secret-payload 와 동일하게 vault-crypto 의 seal/open(AES-256-GCM)을 사용한다(서버는 복호화 안 함).
import { open, seal, type SealedBlob } from "@/lib/vault-crypto"

const PAYLOAD_VERSION = 1

// 지출 1건의 평문 본문. date·recurring 메타는 서버 컬럼이라 여기 포함하지 않는다.
export interface ExpensePayload {
    item: string
    amount: number
    category: string
    method: string
}

export interface IncomePayload {
    amount: number
}

export async function sealExpense(
    vaultKey: CryptoKey,
    payload: ExpensePayload,
): Promise<SealedBlob> {
    return seal(vaultKey, JSON.stringify({ v: PAYLOAD_VERSION, ...payload }))
}

export async function openExpense(
    vaultKey: CryptoKey,
    blob: SealedBlob,
): Promise<ExpensePayload> {
    const parsed = JSON.parse(
        await open(vaultKey, blob),
    ) as Partial<ExpensePayload>
    return {
        item: String(parsed.item ?? ""),
        amount: typeof parsed.amount === "number" ? parsed.amount : 0,
        category: String(parsed.category ?? "기타"),
        method: String(parsed.method ?? "카드"),
    }
}

export async function sealIncome(
    vaultKey: CryptoKey,
    payload: IncomePayload,
): Promise<SealedBlob> {
    return seal(vaultKey, JSON.stringify({ v: PAYLOAD_VERSION, ...payload }))
}

export async function openIncome(
    vaultKey: CryptoKey,
    blob: SealedBlob,
): Promise<IncomePayload> {
    const parsed = JSON.parse(
        await open(vaultKey, blob),
    ) as Partial<IncomePayload>
    return { amount: typeof parsed.amount === "number" ? parsed.amount : 0 }
}
