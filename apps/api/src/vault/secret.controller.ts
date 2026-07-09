// 비밀번호(Secret) CRUD 엔드포인트. 전역 세션 가드로 보호된다. 본문은 클라이언트 E2E 암호문 패스스루.
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
import { SecretService } from "./secret.service"
import { CreateSecretDto, UpdateSecretDto } from "./dto/secret.dto"

@Controller("secrets")
export class SecretController {
    constructor(private readonly service: SecretService) {}

    @Get()
    list(@Query("siteId") siteId: string) {
        return this.service.listBySite(siteId)
    }

    // 암호문 블롭(base64url)을 포함해 반환한다. 복호화는 클라이언트가 수행한다.
    @Get(":id")
    detail(@Param("id") id: string) {
        return this.service.detail(id)
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
