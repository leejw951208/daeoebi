// 월 수입(Income) 엔드포인트. 전역 세션 가드로 보호된다. 본문은 클라이언트 E2E 암호문 패스스루.
import { Body, Controller, Get, Put } from "@nestjs/common"
import { IncomeService } from "./income.service"
import { UpsertIncomeDto } from "./dto/income.dto"

@Controller("income")
export class IncomeController {
    constructor(private readonly service: IncomeService) {}

    @Get()
    get() {
        return this.service.get()
    }

    @Put()
    upsert(@Body() dto: UpsertIncomeDto) {
        return this.service.upsert(dto)
    }
}
