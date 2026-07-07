// vault 전용 API 클라이언트. /auth/* 인증과 store(/sites,/categories,/secrets) 엔드포인트를 호출한다.
// 모든 쓰기 요청에 X-Vault-Request 헤더를 자동 부착한다(CSRF).
import axios, { AxiosError, AxiosInstance } from "axios"
import type {
    AuthenticationResponseJSON,
    PublicKeyCredentialCreationOptionsJSON,
    PublicKeyCredentialRequestOptionsJSON,
    RegistrationResponseJSON,
} from "@simplewebauthn/browser"
import { ApiError } from "./api-error"

const baseURL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000"

export const vaultClient: AxiosInstance = axios.create({
    baseURL,
    timeout: 15_000,
    withCredentials: true,
    headers: {
        "X-Vault-Request": "1",
    },
})

vaultClient.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => Promise.reject(ApiError.fromAxios(error)),
)

// ─── 인증(/auth) ───────────────────────────────────────────────

// 서버 인증 상태. registered=등록 여부, authenticated=세션(서버 측) 유효 여부.
export interface AuthStatus {
    registered: boolean
    authenticated: boolean
}

// 첫 등록 시 register/verify 로 보내는 복구 래핑. verifier=SHA-256(복구코드 바이트)(H-1).
export interface RecoveryRegisterPayload {
    rcSalt: string
    wrappedVkRc: string
    verifier: string
}

// recovery/verify 성공 응답. 복구 래핑(언랩용). verifier 는 서버 내부 비교용이라 미반환.
export interface RecoveryWrapPayload {
    rcSalt: string
    wrappedVkRc: string
}

// register/verify 요청 본문. 첫 등록은 recovery 필수, 기기 추가/복구 재등록은 생략.
export interface RegisterVerifyInput {
    response: RegistrationResponseJSON
    prfSalt: string
    wrappedVkPrf: string
    nickname?: string
    recovery?: RecoveryRegisterPayload
    // 첫 등록 게이트 토큰. 서버가 아는 비밀 토큰과 일치해야 등록을 허용한다.
    bootstrapToken?: string
}

// login/verify 응답. 사용된 credential 기준 PRF 래핑 블롭과 salt.
export interface LoginVerifyResult {
    wrappedVkPrf: string
    prfSalt: string
}

export async function getAuthStatus(): Promise<AuthStatus> {
    const { data } = await vaultClient.get<AuthStatus>("/auth/status")
    return data
}

export async function getRegisterOptions(): Promise<PublicKeyCredentialCreationOptionsJSON> {
    const { data } = await vaultClient.post<{
        options: PublicKeyCredentialCreationOptionsJSON
    }>("/auth/register/options", {})
    return data.options
}

export async function postRegisterVerify(
    input: RegisterVerifyInput,
): Promise<void> {
    await vaultClient.post("/auth/register/verify", input)
}

export async function getLoginOptions(): Promise<PublicKeyCredentialRequestOptionsJSON> {
    const { data } = await vaultClient.post<{
        options: PublicKeyCredentialRequestOptionsJSON
    }>("/auth/login/options", {})
    return data.options
}

export async function postLoginVerify(
    response: AuthenticationResponseJSON,
): Promise<LoginVerifyResult> {
    const { data } = await vaultClient.post<LoginVerifyResult>(
        "/auth/login/verify",
        { response },
    )
    return data
}

// 복구코드를 서버에 제출해 검증한다(H-1). 성공 시 복구 래핑 반환 + 단기 복구 세션 쿠키 발급.
// recoveryCode 는 interop 확정 와이어 포맷이다. 복구코드 문자열을 디코드한 20바이트의 base64url(원문 아님).
// 서버는 base64url 디코드 후 SHA-256→verifier 상수시간 비교. 실패 401, 미존재 404, 한도 초과 429 RATE_LIMITED.
export async function postRecoveryVerify(
    recoveryCode: string,
): Promise<RecoveryWrapPayload> {
    const { data } = await vaultClient.post<RecoveryWrapPayload>(
        "/auth/recovery/verify",
        { recoveryCode },
    )
    return data
}

export async function postLogout(): Promise<void> {
    await vaultClient.post("/auth/logout", {})
}

// 비운영 전용 dev 세션 발급(패스키 우회). 운영에선 서버가 404 로 막는다. lib/dev-auth.ts 에서만 호출한다.
export async function postDevLogin(): Promise<void> {
    await vaultClient.post("/auth/dev/login", {})
}

// ─── store: 사이트(/sites) ─────────────────────────────────────

export interface Site {
    id: string
    label: string
    icon?: string | null
    createdAt: string
    updatedAt: string
}

export interface CreateSiteInput {
    label: string
    icon?: string
}

export async function listSites(): Promise<Site[]> {
    const { data } = await vaultClient.get<Site[]>("/sites")
    return data
}

export async function getSite(id: string): Promise<Site> {
    const { data } = await vaultClient.get<Site>(`/sites/${id}`)
    return data
}

export async function createSite(input: CreateSiteInput): Promise<Site> {
    const { data } = await vaultClient.post<Site>("/sites", input)
    return data
}

export async function updateSite(
    id: string,
    input: Partial<CreateSiteInput>,
): Promise<Site> {
    const { data } = await vaultClient.patch<Site>(`/sites/${id}`, input)
    return data
}

export async function deleteSite(id: string): Promise<void> {
    await vaultClient.delete(`/sites/${id}`)
}

// ─── store: 카테고리(/categories) ──────────────────────────────

export interface Category {
    id: string
    siteId: string
    label: string
    createdAt: string
    updatedAt: string
}

export async function listCategories(siteId: string): Promise<Category[]> {
    const { data } = await vaultClient.get<Category[]>("/categories", {
        params: { siteId },
    })
    return data
}

export async function createCategory(
    siteId: string,
    label: string,
): Promise<Category> {
    const { data } = await vaultClient.post<Category>("/categories", {
        siteId,
        label,
    })
    return data
}

export async function updateCategory(
    id: string,
    label: string,
): Promise<Category> {
    const { data } = await vaultClient.patch<Category>(`/categories/${id}`, {
        label,
    })
    return data
}

export async function deleteCategory(id: string): Promise<void> {
    await vaultClient.delete(`/categories/${id}`)
}

// ─── store: 시크릿(/secrets) ───────────────────────────────────

// 목록 응답(메타만). 본문 블롭은 포함하지 않는다.
export interface SecretMeta {
    id: string
    siteId: string
    categoryId: string | null
    label: string
    createdAt: string
    updatedAt: string
}

// 상세 응답(암호문 블롭 포함). iv/ciphertext/authTag 는 base64url.
export interface SecretDetail extends SecretMeta {
    iv: string
    ciphertext: string
    authTag: string
}

// 시크릿 생성·수정 입력. label 은 평문, 본문은 클라이언트에서 seal 한 블롭.
export interface SecretWriteInput {
    siteId: string
    categoryId?: string | null
    label: string
    iv: string
    ciphertext: string
    authTag: string
}

export async function listSecrets(
    siteId: string,
    categoryId?: string,
): Promise<SecretMeta[]> {
    const { data } = await vaultClient.get<SecretMeta[]>("/secrets", {
        params: categoryId ? { siteId, categoryId } : { siteId },
    })
    return data
}

export async function getSecret(id: string): Promise<SecretDetail> {
    const { data } = await vaultClient.get<SecretDetail>(`/secrets/${id}`)
    return data
}

export async function createSecret(
    input: SecretWriteInput,
): Promise<SecretMeta> {
    const { data } = await vaultClient.post<SecretMeta>("/secrets", input)
    return data
}

export async function updateSecret(
    id: string,
    input: Partial<Omit<SecretWriteInput, "siteId">>,
): Promise<SecretMeta> {
    const { data } = await vaultClient.patch<SecretMeta>(
        `/secrets/${id}`,
        input,
    )
    return data
}

export async function deleteSecret(id: string): Promise<void> {
    await vaultClient.delete(`/secrets/${id}`)
}

// /search 응답. 서버는 사이트·카테고리·비밀번호 라벨 일치 결과를 묶어서 돌려준다(search.service.ts).
interface SearchResult {
    sites: unknown[]
    categories: unknown[]
    secrets: SecretMeta[]
}

// 라벨 검색. 비밀번호 메타만 추려서 반환한다.
// (서버는 {sites,categories,secrets} 객체를 주므로 secrets 만 꺼낸다 — 과거 배열로 오인해 검색이 항상 빈 화면이던 버그.)
export async function searchSecrets(q: string): Promise<SecretMeta[]> {
    const { data } = await vaultClient.get<SearchResult>("/search", {
        params: { q },
    })
    return data.secrets
}

// ─── 백업/복원(/store) ─────────────────────────────────────────

export type ImportMode = "reject" | "skip" | "replace"

// 행 유형별 처리 건수. 서버 응답 shape(backup.service.ts) 과 동일.
export interface ImportCounts {
    created: number
    skipped: number
    replaced: number
}

// import 응답은 사이트/카테고리/비밀번호 각각의 처리 건수를 중첩으로 돌려준다.
export interface ImportResult {
    sites: ImportCounts
    categories: ImportCounts
    secrets: ImportCounts
}

// 전체 행(암호문 블롭 포함) JSON 을 그대로 받는다(E2E 패스스루).
export async function exportStore(): Promise<Blob> {
    const { data } = await vaultClient.get<Blob>("/store/export", {
        responseType: "blob",
    })
    return data
}

// 백업 JSON 을 업로드한다. 서버는 복호화하지 않고 행만 수용한다.
export async function importStore(
    payload: unknown,
    mode: ImportMode = "reject",
): Promise<ImportResult> {
    const { data } = await vaultClient.post<ImportResult>(
        "/store/import",
        payload,
        { params: { mode } },
    )
    return data
}

// ─── 자산 관리(/income·/expenses·/recurring) ───────────────────
// 금액·항목·카테고리는 클라이언트 E2E 암호문 블롭(iv/ciphertext/authTag, base64url)으로 주고받는다.

// ─── 자산 카테고리(/asset-categories) — 평문 이름·색 ─────────────
export interface AssetCategory {
    id: string
    name: string
    color: string
    code: string | null // 사용자 지정 분류 코드. null = 미지정.
    kind: "NORMAL" | "SAVINGS" | "INVESTMENT" // 저축/투자 식별용 시스템 마커. name/code 는 사용자가 바꿀 수 있어 앵커로 쓰지 않는다.
    createdAt: string
    updatedAt: string
}

export async function listAssetCategories(): Promise<AssetCategory[]> {
    const { data } = await vaultClient.get<AssetCategory[]>("/asset-categories")
    return data
}

export async function createAssetCategory(
    name: string,
    color: string,
    code?: string,
): Promise<AssetCategory> {
    const { data } = await vaultClient.post<AssetCategory>(
        "/asset-categories",
        {
            name,
            color,
            ...(code !== undefined ? { code } : {}),
        },
    )
    return data
}

export async function updateAssetCategory(
    id: string,
    patch: { name?: string; color?: string; code?: string },
): Promise<AssetCategory> {
    const { data } = await vaultClient.patch<AssetCategory>(
        `/asset-categories/${id}`,
        patch,
    )
    return data
}

export async function deleteAssetCategory(id: string): Promise<void> {
    await vaultClient.delete(`/asset-categories/${id}`)
}

export interface SavingsGoalView extends SealedBlobDto {
    id: string
    name: string
}

export async function getSavingsGoal(): Promise<SavingsGoalView | null> {
    const { data } = await vaultClient.get<SavingsGoalView | null>(
        "/savings-goal",
    )
    return data ?? null
}

export async function saveSavingsGoal(
    name: string,
    blob: SealedBlobDto,
): Promise<SavingsGoalView> {
    const { data } = await vaultClient.put<SavingsGoalView>("/savings-goal", {
        name,
        ...blob,
    })
    return data
}

// 저축·투자 카테고리(저축/투자)의 전 기간 적립 지출.
export async function listContributions(
    categoryIds: string[],
): Promise<ExpenseView[]> {
    const { data } = await vaultClient.get<ExpenseView[]>(
        "/expenses/contributions",
        { params: { categoryIds: categoryIds.join(",") } },
    )
    return data
}

export interface SealedBlobDto {
    iv: string
    ciphertext: string
    authTag: string
}

export interface IncomeView extends SealedBlobDto {
    id: string
    month: string
}

export interface ExpenseView extends SealedBlobDto {
    id: string
    date: string // "YYYY-MM-DD"
    recurringId: string | null
    period: string | null
    categoryId: string | null
}

export interface RecurringView extends SealedBlobDto {
    id: string
    dayOfMonth: number
    startMonth: string
    termMonths: number | null
    active: boolean
    categoryId: string | null
}

export async function listIncomes(month: string): Promise<IncomeView[]> {
    const { data } = await vaultClient.get<IncomeView[]>("/income", {
        params: { month },
    })
    return data
}

export interface CreateIncomeInput extends SealedBlobDto {
    month: string
}

export async function createIncome(
    input: CreateIncomeInput,
): Promise<IncomeView> {
    const { data } = await vaultClient.post<IncomeView>("/income", input)
    return data
}

export async function updateIncome(
    id: string,
    blob: SealedBlobDto,
): Promise<IncomeView> {
    const { data } = await vaultClient.patch<IncomeView>(`/income/${id}`, blob)
    return data
}

export async function deleteIncome(id: string): Promise<void> {
    await vaultClient.delete(`/income/${id}`)
}

export async function listExpenses(month: string): Promise<ExpenseView[]> {
    const { data } = await vaultClient.get<ExpenseView[]>("/expenses", {
        params: { month },
    })
    return data
}

export async function getExpense(id: string): Promise<ExpenseView> {
    const { data } = await vaultClient.get<ExpenseView>(`/expenses/${id}`)
    return data
}

export interface CreateExpenseInput extends SealedBlobDto {
    date: string
    recurringId?: string
    period?: string
    categoryId?: string
}

export async function createExpense(
    input: CreateExpenseInput,
): Promise<ExpenseView> {
    const { data } = await vaultClient.post<ExpenseView>("/expenses", input)
    return data
}

export async function updateExpense(
    id: string,
    input: Partial<SealedBlobDto> & {
        date?: string
        removed?: boolean
        categoryId?: string
    },
): Promise<ExpenseView> {
    const { data } = await vaultClient.patch<ExpenseView>(
        `/expenses/${id}`,
        input,
    )
    return data
}

export async function deleteExpense(id: string): Promise<void> {
    await vaultClient.delete(`/expenses/${id}`)
}

export async function listRecurring(): Promise<RecurringView[]> {
    const { data } = await vaultClient.get<RecurringView[]>("/recurring")
    return data
}

export async function createRecurring(
    input: SealedBlobDto & {
        dayOfMonth: number
        startMonth: string
        termMonths?: number
        categoryId?: string
    },
): Promise<RecurringView> {
    const { data } = await vaultClient.post<RecurringView>("/recurring", input)
    return data
}

export async function updateRecurring(
    id: string,
    input: Partial<SealedBlobDto> & {
        dayOfMonth?: number
        active?: boolean
        categoryId?: string
    },
): Promise<RecurringView> {
    const { data } = await vaultClient.patch<RecurringView>(
        `/recurring/${id}`,
        input,
    )
    return data
}

export async function deleteRecurring(id: string): Promise<void> {
    await vaultClient.delete(`/recurring/${id}`)
}
