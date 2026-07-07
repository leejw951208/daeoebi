// 적금 계좌(SavingsAccount) 생성·수정 DTO. name·color 는 평문. 색은 #rrggbb 형식.
// 본문(암호문 블롭)은 클라이언트 E2E 암호문 base64url 패스스루.
import {
    IsOptional,
    IsString,
    Matches,
    MaxLength,
    MinLength,
} from "class-validator"
import { IsBase64url } from "../../common/base64url"

const HEX_RE = /^#[0-9a-fA-F]{6}$/
// 계좌 이름 최대 길이.
const NAME_MAX = 40

export class CreateSavingsAccountDto {
    @IsString()
    @MinLength(1)
    @MaxLength(NAME_MAX)
    name!: string

    @Matches(HEX_RE, { message: "color 는 #rrggbb 형식이어야 합니다." })
    color!: string

    @IsBase64url() iv!: string
    @IsBase64url() ciphertext!: string
    @IsBase64url() authTag!: string
}

export class UpdateSavingsAccountDto {
    @IsOptional()
    @Matches(HEX_RE, { message: "color 는 #rrggbb 형식이어야 합니다." })
    color?: string

    // 본문 갱신 시 세 필드를 함께 보낸다(부분 암호문 불허). 셋 다 없으면 색만 갱신한다.
    @IsOptional() @IsBase64url() iv?: string
    @IsOptional() @IsBase64url() ciphertext?: string
    @IsOptional() @IsBase64url() authTag?: string
}
