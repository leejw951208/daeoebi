// 저축 박스(SavingsBoxTxn) 생성 DTO. type·source·date 는 평문 메타(정렬·조회용).
// 본문(암호문 블롭)은 클라이언트 E2E 암호문 base64url 패스스루. update 는 없다(생성·삭제만).
import { IsIn, Matches } from "class-validator"
import { IsBase64url } from "../../common/base64url"

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export class CreateSavingsBoxTxnDto {
    @IsIn(["in", "out"], { message: "type 은 in 또는 out 이어야 합니다." })
    type!: "in" | "out"

    @IsIn(["cash", "savings"], {
        message: "source 는 cash 또는 savings 이어야 합니다.",
    })
    source!: "cash" | "savings"

    @Matches(DATE_RE, { message: "date 는 YYYY-MM-DD 형식이어야 합니다." })
    date!: string

    @IsBase64url() iv!: string
    @IsBase64url() ciphertext!: string
    @IsBase64url() authTag!: string
}
