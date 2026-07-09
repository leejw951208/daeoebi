// 자산(지출) 카테고리 생성·수정 DTO. 사용자 생성 카테고리는 이름·색만 가진다(코드 없음).
// 색은 #rrggbb 형식. 고정 카테고리는 시드로만 만들며 이 DTO 로 생성·수정하지 않는다.
import {
    IsOptional,
    IsString,
    Matches,
    MaxLength,
    MinLength,
} from "class-validator"

const HEX_RE = /^#[0-9a-fA-F]{6}$/
// 카테고리 이름 최대 길이. 클라이언트 입력 상한(maxLength=20)과 일치시킨다.
const NAME_MAX = 20

export class CreateAssetCategoryDto {
    @IsString()
    @MinLength(1)
    @MaxLength(NAME_MAX)
    name!: string

    @Matches(HEX_RE, { message: "color 는 #rrggbb 형식이어야 합니다." })
    color!: string
}

export class UpdateAssetCategoryDto {
    @IsOptional()
    @IsString()
    @MinLength(1)
    @MaxLength(NAME_MAX)
    name?: string

    @IsOptional()
    @Matches(HEX_RE, { message: "color 는 #rrggbb 형식이어야 합니다." })
    color?: string
}
