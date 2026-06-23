// 카테고리 생성·수정 DTO. 카테고리는 사이트 하위의 선택적 1계층이다.
import { IsOptional, IsString, MaxLength, MinLength } from "class-validator"

export class CreateCategoryDto {
    @IsString()
    @MinLength(1)
    siteId!: string

    @IsString()
    @MinLength(1)
    @MaxLength(100)
    label!: string
}

export class UpdateCategoryDto {
    @IsOptional()
    @IsString()
    @MinLength(1)
    @MaxLength(100)
    label?: string
}
