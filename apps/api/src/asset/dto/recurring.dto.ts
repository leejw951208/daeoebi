// 고정 지출 템플릿(RecurringExpense) DTO. dayOfMonth·active 는 평문 스케줄 메타,
// 본문은 클라이언트 E2E 암호문 블롭({item,amount,category,method}).
import { IsBase64url } from "../../common/base64url"
import {
    IsBoolean,
    IsInt,
    IsOptional,
    IsString,
    Matches,
    Max,
    Min,
    MinLength,
} from "class-validator"
import { MONTH_RE } from "../asset.types"

export class CreateRecurringDto {
    @IsInt()
    @Min(1)
    @Max(31)
    dayOfMonth!: number

    @Matches(MONTH_RE, { message: "startMonth 는 YYYY-MM 형식이어야 합니다." })
    startMonth!: string

    // 개월 수(기간 제한). 미지정 = 무기한.
    @IsOptional()
    @IsInt()
    @Min(1)
    termMonths?: number

    @IsOptional()
    @IsString()
    @MinLength(1)
    categoryId?: string

    @IsBase64url()
    iv!: string

    @IsBase64url()
    ciphertext!: string

    @IsBase64url()
    authTag!: string
}

export class UpdateRecurringDto {
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(31)
    dayOfMonth?: number

    @IsOptional()
    @IsBoolean()
    active?: boolean

    // 개월 수(기간 제한). null 을 보내면 무기한으로 되돌린다.
    @IsOptional()
    @IsInt()
    @Min(1)
    termMonths?: number | null

    @IsOptional()
    @IsBase64url()
    iv?: string

    @IsOptional()
    @IsBase64url()
    ciphertext?: string

    @IsOptional()
    @IsBase64url()
    authTag?: string

    @IsOptional()
    @IsString()
    @MinLength(1)
    categoryId?: string
}
