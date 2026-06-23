// 비밀번호(Secret) 생성·수정 DTO. value 는 본문이며 저장 전 AES-256-GCM 으로 암호화된다.
import {
    IsOptional,
    IsString,
    MaxLength,
    MinLength,
    ValidateIf,
} from "class-validator"

export class CreateSecretDto {
    @IsString()
    @MinLength(1)
    siteId!: string

    // null 또는 미지정이면 사이트 직속이다.
    @IsOptional()
    @ValidateIf((o) => o.categoryId !== null)
    @IsString()
    @MinLength(1)
    categoryId?: string | null

    @IsString()
    @MinLength(1)
    @MaxLength(200)
    label!: string

    @IsString()
    @MinLength(1)
    @MaxLength(4096)
    value!: string
}

export class UpdateSecretDto {
    @IsOptional()
    @IsString()
    @MinLength(1)
    @MaxLength(200)
    label?: string

    // null 을 보내면 사이트 직속으로 옮긴다.
    @IsOptional()
    @ValidateIf((o) => o.categoryId !== null)
    @IsString()
    @MinLength(1)
    categoryId?: string | null

    @IsOptional()
    @IsString()
    @MinLength(1)
    @MaxLength(4096)
    value?: string
}
