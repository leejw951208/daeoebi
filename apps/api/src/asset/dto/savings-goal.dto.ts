// 저축 목표 저장 DTO. name 평문 + 암호문 블롭({amount}) 3필드.
import { IsBase64url } from "../../common/base64url"
import { IsString, MaxLength, MinLength } from "class-validator"

export class SaveSavingsGoalDto {
    @IsString() @MinLength(1) @MaxLength(40) name!: string
    @IsBase64url() iv!: string
    @IsBase64url() ciphertext!: string
    @IsBase64url() authTag!: string
}
