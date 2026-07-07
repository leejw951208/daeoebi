// 저축 박스(SavingsBoxTxn) 엔드포인트. 전역 세션 가드 + CsrfMiddleware. 본문은 클라이언트 E2E 암호문 패스스루.
import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    Param,
    Post,
} from "@nestjs/common"
import { SavingsBoxService } from "./savings-box.service"
import { CreateSavingsBoxTxnDto } from "./dto/savings-box.dto"

@Controller("savings-box")
export class SavingsBoxController {
    constructor(private readonly service: SavingsBoxService) {}

    @Get()
    list() {
        return this.service.list()
    }

    @Post()
    @HttpCode(201)
    create(@Body() dto: CreateSavingsBoxTxnDto) {
        return this.service.create(dto)
    }

    @Delete(":id")
    @HttpCode(204)
    async remove(@Param("id") id: string): Promise<void> {
        await this.service.remove(id)
    }
}
