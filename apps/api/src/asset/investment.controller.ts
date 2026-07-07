// 투자 포지션 엔드포인트. 전역 세션 가드 + CsrfMiddleware. 본문 암호문 패스스루.
import { Body, Controller, Get, Put } from "@nestjs/common"
import { InvestmentService } from "./investment.service"
import { SaveInvestmentDto } from "./dto/investment.dto"

@Controller("investment")
export class InvestmentController {
    constructor(private readonly service: InvestmentService) {}

    @Get()
    get() {
        return this.service.get()
    }

    @Put()
    save(@Body() dto: SaveInvestmentDto) {
        return this.service.upsert(dto)
    }
}
