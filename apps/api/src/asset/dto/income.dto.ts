// 월 수입(Income) 생성·수정 DTO. 본문은 클라이언트 E2E 암호문 블롭({item,amount,category}).
// month 는 평문(월 범위 조회 귀속 키)이다.
import { IsBase64url } from "../../common/base64url"
import { IsOptional, Matches } from "class-validator"
import { MONTH_RE } from "../asset.types"

export class CreateIncomeDto {
    @Matches(MONTH_RE, { message: "month 는 YYYY-MM 형식이어야 합니다." })
    month!: string

    @IsBase64url() iv!: string
    @IsBase64url() ciphertext!: string
    @IsBase64url() authTag!: string
}

export class UpdateIncomeDto {
    // 본문 갱신 시 세 필드를 함께 보낸다(부분 암호문 불허).
    @IsOptional() @IsBase64url() iv?: string
    @IsOptional() @IsBase64url() ciphertext?: string
    @IsOptional() @IsBase64url() authTag?: string
}
