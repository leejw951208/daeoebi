// base64url(패딩 없음) 인코딩 검증·변환 헬퍼와 class-validator 데코레이터.
// API 경계에서 바이트 필드는 전부 이 포맷으로 주고받는다(계약서 §2).
import {
    registerDecorator,
    type ValidationOptions,
    type ValidationArguments,
} from "class-validator"

const BASE64URL_RE = /^[A-Za-z0-9_-]+$/

// 패딩 없는 base64url 문자열인지 검사한다(빈 문자열 불허).
export function isBase64url(value: unknown): value is string {
    return typeof value === "string" && value.length > 0 && BASE64URL_RE.test(value)
}

// base64url 문자열을 Buffer 로 디코드한다. 호출 전 isBase64url 로 검증한다.
export function fromBase64url(value: string): Buffer {
    return Buffer.from(value, "base64url")
}

// Buffer/Uint8Array 를 패딩 없는 base64url 문자열로 인코드한다.
export function toBase64url(value: Uint8Array): string {
    return Buffer.from(value).toString("base64url")
}

// DTO 필드용 검증 데코레이터. 패딩 없는 base64url 만 통과시킨다.
export function IsBase64url(options?: ValidationOptions) {
    return (object: object, propertyName: string): void => {
        registerDecorator({
            name: "isBase64url",
            target: object.constructor,
            propertyName,
            options,
            validator: {
                validate(value: unknown): boolean {
                    return isBase64url(value)
                },
                defaultMessage(args: ValidationArguments): string {
                    return `${args.property} 는 base64url(패딩 없음) 문자열이어야 합니다.`
                },
            },
        })
    }
}
