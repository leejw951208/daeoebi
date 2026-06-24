// auth 엔드포인트 요청 DTO. WebAuthn 응답 객체와 클라이언트가 만든 래핑 블롭(base64url)을 검증한다.
import { Type } from "class-transformer"
import {
    IsObject,
    IsOptional,
    IsString,
    MaxLength,
    ValidateNested,
} from "class-validator"
import { IsBase64url } from "../base64url"

// 복구코드로 래핑한 VK 블롭 + 복구코드 verifier. 첫 등록 시 필수, 기기 추가 시 생략.
export class RecoveryWrapDto {
    @IsBase64url()
    rcSalt!: string

    @IsBase64url()
    wrappedVkRc!: string

    // verifier = SHA-256(복구코드 바이트). 복구 시점 상수시간 비교용(서버는 평문/HKDF 키 미보유).
    @IsBase64url()
    verifier!: string
}

// 등록 옵션·로그인 옵션 요청은 본문이 비어 있다(빈 객체 허용).
export class EmptyDto {}

// 복구 검증 요청. recoveryCode = 클라가 Crockford 디코딩한 20바이트의 base64url(문자열 코드 아님).
// 서버는 Base32 를 모른다. base64url-디코딩 후 SHA-256 으로만 verifier 비교한다(상호운용 확정).
export class RecoveryVerifyDto {
    @IsBase64url()
    recoveryCode!: string
}

export class RegisterVerifyDto {
    // @simplewebauthn/browser 의 RegistrationResponseJSON. 구조 검증은 라이브러리가 수행한다.
    @IsObject()
    response!: Record<string, unknown>

    @IsBase64url()
    prfSalt!: string

    @IsBase64url()
    wrappedVkPrf!: string

    @IsOptional()
    @IsString()
    @MaxLength(100)
    nickname?: string

    // 첫 등록이면 필수, 기기 추가면 생략. 존재 여부는 서비스에서 등록 상태로 판정한다.
    @IsOptional()
    @ValidateNested()
    @Type(() => RecoveryWrapDto)
    recovery?: RecoveryWrapDto

    // 첫 등록 게이트 토큰. 기기 추가 시 생략. 서버 BOOTSTRAP_TOKEN 과 일치해야 첫 등록을 허용한다.
    @IsOptional()
    @IsString()
    @MaxLength(200)
    bootstrapToken?: string
}

export class LoginVerifyDto {
    // @simplewebauthn/browser 의 AuthenticationResponseJSON.
    @IsObject()
    response!: Record<string, unknown>
}
