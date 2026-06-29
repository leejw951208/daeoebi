// 지출(Expense) 생성·수정 DTO. 본문은 클라이언트 E2E 암호문 블롭({item,amount,category,method}).
// date 는 평문(월 범위·달력용), recurringId/period 는 고정 지출 자동 생성 멱등 키다.
import { IsBase64url } from "../../common/base64url"
import {
    IsBoolean,
    IsISO8601,
    IsOptional,
    IsString,
    Matches,
    MinLength,
} from "class-validator"

// "YYYY-MM" 월 키. 목록 조회·고정 인스턴스 period 에 쓰인다.
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/

export class CreateExpenseDto {
    // "YYYY-MM-DD" 또는 ISO 8601. 서버는 날짜(@db.Date)로 저장한다.
    @IsISO8601()
    date!: string

    @IsOptional()
    @IsString()
    @MinLength(1)
    recurringId?: string

    @IsOptional()
    @Matches(MONTH_RE, { message: "period 는 YYYY-MM 형식이어야 합니다." })
    period?: string

    @IsBase64url()
    iv!: string

    @IsBase64url()
    ciphertext!: string

    @IsBase64url()
    authTag!: string
}

export class UpdateExpenseDto {
    @IsOptional()
    @IsISO8601()
    date?: string

    // 본문 갱신 시 세 필드를 함께 보낸다(부분 암호문 불허).
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
    @IsBoolean()
    removed?: boolean
}
