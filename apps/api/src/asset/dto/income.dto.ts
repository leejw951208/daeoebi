// 월 수입(Income) upsert DTO. 금액은 클라이언트 E2E 암호문 블롭({amount})으로 전달된다.
import { IsBase64url } from "../../common/base64url"

export class UpsertIncomeDto {
    @IsBase64url()
    iv!: string

    @IsBase64url()
    ciphertext!: string

    @IsBase64url()
    authTag!: string
}
