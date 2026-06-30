// 자산(지출) 카테고리 생성·수정 DTO. 이름·색은 평문. 색은 #rrggbb 형식.
import {
    IsOptional,
    IsString,
    Matches,
    MaxLength,
    MinLength,
} from "class-validator"

const HEX_RE = /^#[0-9a-fA-F]{6}$/

export class CreateAssetCategoryDto {
    @IsString()
    @MinLength(1)
    @MaxLength(100)
    name!: string

    @Matches(HEX_RE, { message: "color 는 #rrggbb 형식이어야 합니다." })
    color!: string
}

export class UpdateAssetCategoryDto {
    @IsOptional()
    @IsString()
    @MinLength(1)
    @MaxLength(100)
    name?: string

    @IsOptional()
    @Matches(HEX_RE, { message: "color 는 #rrggbb 형식이어야 합니다." })
    color?: string
}
