// 백엔드 API 공통 에러 클래스. axios 응답을 단일 ApiError 인스턴스로 정규화한다.
import { AxiosError } from "axios"

interface ApiErrorPayload {
    message?: string | string[]
    code?: string
    retryAfterSeconds?: number
}

export class ApiError extends Error {
    readonly code?: string
    readonly status?: number
    readonly retryAfterSeconds?: number

    constructor(
        message: string,
        opts: {
            code?: string
            status?: number
            retryAfterSeconds?: number
        } = {},
    ) {
        super(message)
        this.name = "ApiError"
        this.code = opts.code
        this.status = opts.status
        this.retryAfterSeconds = opts.retryAfterSeconds
    }

    static fromAxios(
        error: AxiosError,
        fallbackMessage = "요청 처리에 실패했습니다.",
    ): ApiError {
        const payload = (error.response?.data ?? undefined) as
            | ApiErrorPayload
            | undefined
        const status = error.response?.status
        let message = fallbackMessage
        const raw = payload?.message
        if (raw) {
            message = Array.isArray(raw) ? raw.join(" / ") : raw
        } else if (error.message) {
            message = `백엔드 통신 실패. ${error.message}`
        }
        return new ApiError(message, {
            code: payload?.code,
            status,
            retryAfterSeconds: payload?.retryAfterSeconds,
        })
    }
}

export function isApiError(value: unknown): value is ApiError {
    return value instanceof ApiError
}
