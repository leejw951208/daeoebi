// 월 수입(Income) CRUD 엔드포인트. 전역 세션 가드로 보호된다. 본문은 클라이언트 E2E 암호문 패스스루.
import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    Param,
    Patch,
    Post,
    Query,
} from "@nestjs/common"
import { IncomeService } from "./income.service"
import { CreateIncomeDto, UpdateIncomeDto } from "./dto/income.dto"

@Controller("income")
export class IncomeController {
    constructor(private readonly service: IncomeService) {}

    @Get()
    list(@Query("month") month: string) {
        return this.service.listByMonth(month)
    }

    @Post()
    @HttpCode(201)
    create(@Body() dto: CreateIncomeDto) {
        return this.service.create(dto)
    }

    @Patch(":id")
    update(@Param("id") id: string, @Body() dto: UpdateIncomeDto) {
        return this.service.update(id, dto)
    }

    @Delete(":id")
    @HttpCode(204)
    async remove(@Param("id") id: string): Promise<void> {
        await this.service.remove(id)
    }
}
