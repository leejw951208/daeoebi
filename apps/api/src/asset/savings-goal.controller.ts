// 저축 목표 엔드포인트. 전역 세션 가드 + CsrfMiddleware. 본문 암호문 패스스루.
import { Body, Controller, Get, Put } from "@nestjs/common"
import { SavingsGoalService } from "./savings-goal.service"
import { SaveSavingsGoalDto } from "./dto/savings-goal.dto"

@Controller("savings-goal")
export class SavingsGoalController {
    constructor(private readonly service: SavingsGoalService) {}

    @Get()
    get() {
        return this.service.get()
    }

    @Put()
    save(@Body() dto: SaveSavingsGoalDto) {
        return this.service.upsert(dto)
    }
}
