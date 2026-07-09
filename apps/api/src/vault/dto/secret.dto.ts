// 비밀번호(Secret) 생성·수정 DTO. 본문은 클라이언트 E2E 암호문(iv/ciphertext/authTag, base64url)으로 전달된다.
import { IsOptional, IsString, MaxLength, MinLength } from "class-validator"
import { IsBase64url } from "../../common/base64url"

export class CreateSecretDto {
    @IsString()
    @MinLength(1)
    siteId!: string

    @IsString()
    @MinLength(1)
    @MaxLength(200)
    label!: string

    // 클라이언트가 VK 로 봉인한 암호문 블롭. 서버는 복호화하지 않는다.
    @IsBase64url()
    iv!: string

    @IsBase64url()
    ciphertext!: string

    @IsBase64url()
    authTag!: string
}

export class UpdateSecretDto {
    @IsOptional()
    @IsString()
    @MinLength(1)
    @MaxLength(200)
    label?: string

    // 본문 갱신 시 세 필드를 함께 보낸다(부분 암호문은 허용하지 않는다).
    @IsOptional()
    @IsBase64url()
    iv?: string

    @IsOptional()
    @IsBase64url()
    ciphertext?: string

    @IsOptional()
    @IsBase64url()
    authTag?: string
}
