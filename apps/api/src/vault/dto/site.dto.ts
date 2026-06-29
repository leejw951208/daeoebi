// 사이트 생성·수정 DTO.
import { IsOptional, IsString, MaxLength, MinLength } from "class-validator"

export class CreateSiteDto {
    @IsString()
    @MinLength(1)
    @MaxLength(100)
    label!: string

    @IsOptional()
    @IsString()
    @MaxLength(200)
    icon?: string
}

export class UpdateSiteDto {
    @IsOptional()
    @IsString()
    @MinLength(1)
    @MaxLength(100)
    label?: string

    @IsOptional()
    @IsString()
    @MaxLength(200)
    icon?: string
}
