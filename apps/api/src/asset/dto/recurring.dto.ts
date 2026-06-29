// 고정 지출 템플릿(RecurringExpense) DTO. dayOfMonth·active 는 평문 스케줄 메타,
// 본문은 클라이언트 E2E 암호문 블롭({item,amount,category,method}).
import { IsBase64url } from "../../common/base64url"
import {
    IsBoolean,
    IsInt,
    IsOptional,
    Matches,
    Max,
    Min,
} from "class-validator"

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/

export class CreateRecurringDto {
    @IsInt()
    @Min(1)
    @Max(31)
    dayOfMonth!: number

    @Matches(MONTH_RE, { message: "startMonth 는 YYYY-MM 형식이어야 합니다." })
    startMonth!: string

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
