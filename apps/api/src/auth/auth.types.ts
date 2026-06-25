// auth(passkey + PRF + 복구코드) 도메인 공용 상수와 에러 코드.
// 세션 idle 타임아웃·백오프 임계치는 구 vault 상수와 동일 값을 재사용한다.

export const AUTH_ERRORS = {
    NOT_REGISTERED: "NOT_REGISTERED",
    ALREADY_REGISTERED: "ALREADY_REGISTERED",
    RECOVERY_REQUIRED: "RECOVERY_REQUIRED",
    CHALLENGE_INVALID: "CHALLENGE_INVALID",
    VERIFICATION_FAILED: "VERIFICATION_FAILED",
    CREDENTIAL_NOT_FOUND: "CREDENTIAL_NOT_FOUND",
    RECOVERY_NOT_FOUND: "RECOVERY_NOT_FOUND",
    SESSION_REQUIRED: "SESSION_REQUIRED",
    CSRF_INVALID: "CSRF_INVALID",
    RATE_LIMITED: "RATE_LIMITED",
    VALIDATION_FAILED: "VALIDATION_FAILED",
    BOOTSTRAP_REQUIRED: "BOOTSTRAP_REQUIRED",
    BOOTSTRAP_INVALID: "BOOTSTRAP_INVALID",
} as const

// 세션 idle 만료(구 vault 와 동일한 15분).
export const IDLE_TIMEOUT_MS = 15 * 60 * 1000
// 단기 복구 세션 TTL. 복구 검증 성공 후 새 passkey 등록 1회 용도라 짧게 둔다(5분).
export const RECOVERY_SESSION_TTL_MS = 5 * 60 * 1000
// 챌린지 TTL. 1회용·짧은 수명으로 재사용을 막는다.
export const CHALLENGE_TTL_MS = 60 * 1000
// 로그인 실패 백오프(구 vault 와 동일한 5회/60초).
export const MAX_LOGIN_FAILURES = 5
export const BACKOFF_DURATION_MS = 60 * 1000
// 옵션(챌린지 생성) 레이트리밋. 단일 사용자 가용성 보호 수준(M-3).
export const OPTIONS_WINDOW_MS = 60 * 1000
export const OPTIONS_MAX_PER_WINDOW = 20

// RP 식별자·표시명. 환경 변수로 덮어쓸 수 있고, 기본은 로컬 개발 도메인이다.
export const RP_ID = process.env.WEBAUTHN_RP_ID ?? "localhost"
export const RP_NAME = process.env.WEBAUTHN_RP_NAME ?? "대외비"
// 기대 origin 화이트리스트. CSRF 미들웨어와 동일한 기본값을 사용한다.
export const EXPECTED_ORIGINS = (
    process.env.VAULT_ALLOWED_ORIGINS ??
    "http://localhost:3000,http://127.0.0.1:3000"
)
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0)

// 단일 사용자 모델: WebAuthn user 핸들은 고정 식별자 한 개면 충분하다.
export const SINGLETON_USER_NAME = "daeoebi-user"

// 패스키 첫 등록(credential 0개) 게이트 토큰. 외부 제3자의 첫 등록 선점을 막는다.
// 미설정(빈 문자열)이면 첫 등록 자체를 차단한다(fail-closed). 기기 추가에는 사용하지 않는다.
export const BOOTSTRAP_TOKEN = process.env.BOOTSTRAP_TOKEN ?? ""
