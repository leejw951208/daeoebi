// 지출(Expense) CRUD 엔드포인트. 전역 세션 가드로 보호된다. 본문은 클라이언트 E2E 암호문 패스스루.
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
import { ExpenseService } from "./expense.service"
import { CreateExpenseDto, UpdateExpenseDto } from "./dto/expense.dto"

@Controller("expenses")
export class ExpenseController {
    constructor(private readonly service: ExpenseService) {}

    @Get()
    list(@Query("month") month: string) {
        return this.service.listByMonth(month)
    }

    @Get("contributions")
    contributions(@Query("categoryIds") categoryIds?: string) {
        const ids = (categoryIds ?? "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        return this.service.listContributions(ids)
    }

    // 고정 지출 템플릿 수정을 이후 달에 전파할 때, 이미 만들어진 미래 인스턴스를 찾는다.
    // ":id" 보다 먼저 선언해야 리터럴 경로로 매칭된다.
    @Get("instances")
    instancesAfter(
        @Query("recurringId") recurringId: string,
        @Query("fromPeriod") fromPeriod: string,
    ) {
        return this.service.listInstancesAfter(recurringId, fromPeriod)
    }

    @Get(":id")
    detail(@Param("id") id: string) {
        return this.service.detail(id)
    }

    @Post()
    @HttpCode(201)
    create(@Body() dto: CreateExpenseDto) {
        return this.service.create(dto)
    }

    @Patch(":id")
    update(@Param("id") id: string, @Body() dto: UpdateExpenseDto) {
        return this.service.update(id, dto)
    }

    @Delete(":id")
    @HttpCode(204)
    async remove(@Param("id") id: string): Promise<void> {
        await this.service.remove(id)
    }
}
