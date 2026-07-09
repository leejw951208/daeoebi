// 백업 export/import 페이로드 DTO. 서버는 복호화하지 않고 암호문 블롭(base64url)을 그대로 수용한다.
import { Type } from "class-transformer"
import {
    ArrayMaxSize,
    IsArray,
    IsIn,
    IsISO8601,
    IsOptional,
    IsString,
    MaxLength,
    MinLength,
    ValidateNested,
} from "class-validator"
import { IsBase64url } from "../../common/base64url"

export class BackupSiteDto {
    @IsString()
    @MinLength(1)
    id!: string

    @IsString()
    @MinLength(1)
    @MaxLength(100)
    label!: string

    @IsOptional()
    @IsString()
    @MaxLength(200)
    icon?: string | null

    @IsISO8601()
    createdAt!: string

    @IsISO8601()
    updatedAt!: string
}

export class BackupSecretDto {
    @IsString()
    @MinLength(1)
    id!: string

    @IsString()
    @MinLength(1)
    siteId!: string

    // 레거시 백업 호환: 옛 백업에 남아있을 수 있어 수용만 하고 무시한다(비밀번호 분류 제거됨).
    @IsOptional()
    @IsString()
    categoryId?: string | null

    @IsString()
    @MinLength(1)
    @MaxLength(200)
    label!: string

    // iv 12B·authTag 16B 는 짧고, ciphertext 는 본문 평문 상한(4096) 기준 여유 있게 제한한다(M-2 DoS).
    @IsBase64url()
    @MaxLength(64)
    iv!: string

    @IsBase64url()
    @MaxLength(8192)
    ciphertext!: string

    @IsBase64url()
    @MaxLength(64)
    authTag!: string

    @IsISO8601()
    createdAt!: string

    @IsISO8601()
    updatedAt!: string
}

// import 배열 항목 수 상한(M-2). 행 폭증으로 인한 메모리/트랜잭션 고갈을 막는다.
const MAX_IMPORT_ITEMS = 1000

export class ImportBackupDto {
    @IsString()
    @IsIn(["1"])
    version!: string

    @IsArray()
    @ArrayMaxSize(MAX_IMPORT_ITEMS)
    @ValidateNested({ each: true })
    @Type(() => BackupSiteDto)
    sites!: BackupSiteDto[]

    // 레거시 백업 호환: 옛 백업의 categories 배열을 수용만 하고 무시한다(비밀번호 분류 제거됨).
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(MAX_IMPORT_ITEMS)
    categories?: unknown[]

    @IsArray()
    @ArrayMaxSize(MAX_IMPORT_ITEMS)
    @ValidateNested({ each: true })
    @Type(() => BackupSecretDto)
    secrets!: BackupSecretDto[]
}

export type ImportMode = "reject" | "skip" | "replace"
