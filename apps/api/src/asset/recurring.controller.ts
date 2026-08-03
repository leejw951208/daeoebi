// 고정 지출 템플릿(RecurringExpense) CRUD 엔드포인트. 전역 세션 가드로 보호된다.
import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    Param,
    Patch,
    Post,
} from "@nestjs/common"
import { RecurringService } from "./recurring.service"
import { CreateRecurringDto, UpdateRecurringDto } from "./dto/recurring.dto"

@Controller("recurring")
export class RecurringController {
    constructor(private readonly service: RecurringService) {}

    @Get()
    list() {
        return this.service.listActive()
    }

    // 새 리터럴 경로(예: "/recurring/xxx")를 추가할 때는 ":id" 보다 먼저 선언해야 리터럴
    // 경로로 매칭된다.
    @Get(":id")
    detail(@Param("id") id: string) {
        return this.service.detail(id)
    }

    @Post()
    @HttpCode(201)
    create(@Body() dto: CreateRecurringDto) {
        return this.service.create(dto)
    }

    @Patch(":id")
    update(@Param("id") id: string, @Body() dto: UpdateRecurringDto) {
        return this.service.update(id, dto)
    }

    @Delete(":id")
    @HttpCode(204)
    async remove(@Param("id") id: string): Promise<void> {
        await this.service.remove(id)
    }
}
