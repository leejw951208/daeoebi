// 적금 계좌(SavingsAccount) CRUD 엔드포인트. 전역 세션 가드 + CsrfMiddleware. 본문은 클라이언트 E2E 암호문 패스스루.
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
import { SavingsAccountService } from "./savings-account.service"
import {
    CreateSavingsAccountDto,
    UpdateSavingsAccountDto,
} from "./dto/savings-account.dto"

@Controller("savings-accounts")
export class SavingsAccountController {
    constructor(private readonly service: SavingsAccountService) {}

    @Get()
    list() {
        return this.service.list()
    }

    @Post()
    @HttpCode(201)
    create(@Body() dto: CreateSavingsAccountDto) {
        return this.service.create(dto)
    }

    @Patch(":id")
    update(@Param("id") id: string, @Body() dto: UpdateSavingsAccountDto) {
        return this.service.update(id, dto)
    }

    @Delete(":id")
    @HttpCode(204)
    async remove(@Param("id") id: string): Promise<void> {
        await this.service.remove(id)
    }
}
