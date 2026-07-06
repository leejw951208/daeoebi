// 자산(지출) 카테고리 생성·수정 DTO. 이름·색은 평문. 색은 #rrggbb 형식.
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
// 사용자 지정 분류 코드 최대 길이. 클라이언트 입력 상한(maxLength=32)과 일치시킨다.
const CODE_MAX = 32

export class CreateAssetCategoryDto {
    @IsString()
    @MinLength(1)
    @MaxLength(NAME_MAX)
    name!: string

    @Matches(HEX_RE, { message: "color 는 #rrggbb 형식이어야 합니다." })
    color!: string

    // 선택. 빈 문자열은 서비스에서 null(미지정)로 정규화한다.
    @IsOptional()
    @IsString()
    @MaxLength(CODE_MAX)
    code?: string
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

    // 선택. 빈 문자열은 서비스에서 null(미지정)로 정규화해 코드를 해제한다.
    @IsOptional()
    @IsString()
    @MaxLength(CODE_MAX)
    code?: string
}
