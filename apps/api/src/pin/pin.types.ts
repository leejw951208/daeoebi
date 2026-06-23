// PIN 접속 인증 관련 상수와 에러 코드.
export const PIN_ERRORS = {
    SETUP_EXISTS: "SETUP_EXISTS",
    PIN_INVALID: "PIN_INVALID",
    PIN_REQUIRED: "PIN_REQUIRED",
    RATE_LIMITED: "RATE_LIMITED",
    CSRF_INVALID: "CSRF_INVALID",
} as const

// 5회 연속 실패 시 60초 backoff. PinCredential 에 영속되어 재시작에도 유지된다.
export const PIN_MAX_FAILURES = 5
export const PIN_BACKOFF_MS = 60 * 1000

// login 응답 최소 소요. argon2 소요와 무관하게 일정 시간을 보장해 타이밍 누설을 막는다.
export const MIN_LOGIN_DURATION_MS = 200

// PinCredential 단일 행 강제용 고정 id.
export const PIN_SINGLETON_ID = "singleton"
