// 자산(수입·지출) 본문 평문 구조의 seal/open 헬퍼. 지출 블롭은 항목·금액만, 수입 블롭은 항목·금액·카테고리를 VK 로 암호화한다.
// secret-payload 와 동일하게 vault-crypto 의 seal/open(AES-256-GCM)을 사용한다(서버는 복호화 안 함).
import { open, seal, type SealedBlob } from "@/lib/vault-crypto"

const PAYLOAD_VERSION = 1

// 지출 1건의 평문 본문. date·recurring 메타는 서버 컬럼이라 여기 포함하지 않는다.
// category 는 서버 FK 컬럼으로 이전되어 블롭에서 제거됨.
export interface ExpensePayload {
    item: string
    amount: number
}

export interface IncomePayload {
    item: string
    amount: number
    category: string
}

// 예산 행 마커. Income 블롭에 저장되는 평문 키라 변경하면 기존 데이터 해석이 갈라진다.
export const BUDGET_ITEM = "월 예산"
export const BUDGET_CATEGORY = "예산"

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
    }
}

// 옛 블롭에 남아 있을 수 있는 평문 category 이름을 읽는다(없으면 null). 마이그레이션 전용.
export async function readLegacyCategory(
    vaultKey: CryptoKey,
    blob: SealedBlob,
): Promise<string | null> {
    try {
        const parsed = JSON.parse(await open(vaultKey, blob)) as {
            category?: unknown
        }
        return typeof parsed.category === "string" ? parsed.category : null
    } catch {
        return null
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
    return {
        item: String(parsed.item ?? ""),
        amount: typeof parsed.amount === "number" ? parsed.amount : 0,
        category: String(parsed.category ?? "기타"),
    }
}

export interface GoalPayload {
    amount: number
}

export async function sealGoal(
    vaultKey: CryptoKey,
    payload: GoalPayload,
): Promise<SealedBlob> {
    return seal(vaultKey, JSON.stringify({ v: PAYLOAD_VERSION, ...payload }))
}

export async function openGoal(
    vaultKey: CryptoKey,
    blob: SealedBlob,
): Promise<GoalPayload> {
    const parsed = JSON.parse(await open(vaultKey, blob)) as {
        amount?: unknown
    }
    return { amount: typeof parsed.amount === "number" ? parsed.amount : 0 }
}

// 적금 계좌 본문. base=초기 적립액, goal=목표 금액(0=미설정).
export interface AccountPayload {
    base: number
    goal: number
}

export async function sealAccount(
    vaultKey: CryptoKey,
    payload: AccountPayload,
): Promise<SealedBlob> {
    return seal(vaultKey, JSON.stringify({ v: PAYLOAD_VERSION, ...payload }))
}

export async function openAccount(
    vaultKey: CryptoKey,
    blob: SealedBlob,
): Promise<AccountPayload> {
    const parsed = JSON.parse(await open(vaultKey, blob)) as {
        base?: unknown
        goal?: unknown
    }
    return {
        base: typeof parsed.base === "number" ? parsed.base : 0,
        goal: typeof parsed.goal === "number" ? parsed.goal : 0,
    }
}
