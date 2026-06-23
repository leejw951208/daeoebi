// 비밀번호(Secret) CRUD 엔드포인트. PIN 로그인 보호. 본문 열람·추가·수정은 마스터 해제가 필요하다.
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
    UseGuards,
} from "@nestjs/common"
import { PinGuard } from "../pin/pin.guard"
import { SecretService } from "./secret.service"
import { CreateSecretDto, UpdateSecretDto } from "./dto/secret.dto"

@Controller("secrets")
@UseGuards(PinGuard)
export class SecretController {
    constructor(private readonly service: SecretService) {}

    @Get()
    list(
        @Query("siteId") siteId: string,
        @Query("categoryId") categoryId?: string,
    ) {
        return this.service.listBySite(siteId, categoryId)
    }

    // 본문(value)을 복호화해 반환한다. 마스터 해제 상태여야 한다.
    @Get(":id")
    reveal(@Param("id") id: string) {
        return this.service.reveal(id)
    }

    @Post()
    @HttpCode(201)
    create(@Body() dto: CreateSecretDto) {
        return this.service.create(dto)
    }

    @Patch(":id")
    update(@Param("id") id: string, @Body() dto: UpdateSecretDto) {
        return this.service.update(id, dto)
    }

    @Delete(":id")
    @HttpCode(204)
    async remove(@Param("id") id: string): Promise<void> {
        await this.service.remove(id)
    }
}
