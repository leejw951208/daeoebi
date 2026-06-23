// Vault 도메인 공용 타입. KDF 파라미터와 에러 코드, 세션 상수를 한 곳에 모은다.

export interface KdfParams {
    version: number
    algorithm: "argon2id"
    memoryKiB: number
    iterations: number
    parallelism: number
    saltLength: number
}

export const KDF_V1: KdfParams = {
    version: 1,
    algorithm: "argon2id",
    memoryKiB: 65536,
    iterations: 3,
    parallelism: 1,
    saltLength: 16,
}

export const VERIFY_PLAINTEXT = "VAULT_VERIFY"

export const VAULT_ERRORS = {
    SETUP_EXISTS: "SETUP_EXISTS",
    MASTER_INVALID: "MASTER_INVALID",
    VAULT_LOCKED: "VAULT_LOCKED",
    VAULT_LOCKING: "VAULT_LOCKING",
    CSRF_INVALID: "CSRF_INVALID",
    RATE_LIMITED: "RATE_LIMITED",
    VALIDATION_FAILED: "VALIDATION_FAILED",
} as const

export const IDLE_TIMEOUT_MS = 15 * 60 * 1000
// unlock 응답 최소 소요. spec §"보안" 의 타이밍 누설 차단 항목을 실효화한다 (Argon2id 소요와 무관하게 일정).
export const MIN_UNLOCK_DURATION_MS = 500
export const MAX_UNLOCK_FAILURES = 5
export const BACKOFF_DURATION_MS = 60 * 1000
// lock 처리 도중 동시 요청이 isLocking() 을 관찰할 수 있도록 둔 macrotask 윈도우.
export const LOCK_WINDOW_MS = 100
