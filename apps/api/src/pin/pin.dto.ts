// PIN 입력 DTO. 6자리 숫자만 허용한다.
import { IsString, Matches } from "class-validator"

export class PinDto {
    @IsString()
    @Matches(/^\d{6}$/, { message: "PIN 은 6자리 숫자여야 합니다." })
    pin!: string
}
