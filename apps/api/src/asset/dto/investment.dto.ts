// 투자 포지션 저장 DTO. returnRate 평문(정렬·표시용 소수 문자열) + 암호문 블롭({base}) 3필드.
import { IsBase64url } from "../../common/base64url"
import { Matches } from "class-validator"

export class SaveInvestmentDto {
    // 빈값 또는 소수(선택적 음수·선행 소수점 허용). 클라이언트 입력 필터와 일치.
    @Matches(/^$|^-?(\d+(\.\d+)?|\.\d+)$/) returnRate!: string
    @IsBase64url() iv!: string
    @IsBase64url() ciphertext!: string
    @IsBase64url() authTag!: string
}
