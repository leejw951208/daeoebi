// 사이트 CRUD 엔드포인트. 전역 세션 가드로 보호된다.
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
import { SiteService } from "./site.service"
import { CreateSiteDto, UpdateSiteDto } from "./dto/site.dto"

@Controller("sites")
export class SiteController {
    constructor(private readonly service: SiteService) {}

    @Get()
    list() {
        return this.service.list()
    }

    @Get(":id")
    get(@Param("id") id: string) {
        return this.service.get(id)
    }

    @Post()
    @HttpCode(201)
    create(@Body() dto: CreateSiteDto) {
        return this.service.create(dto)
    }

    @Patch(":id")
    update(@Param("id") id: string, @Body() dto: UpdateSiteDto) {
        return this.service.update(id, dto)
    }

    @Delete(":id")
    @HttpCode(204)
    async remove(@Param("id") id: string): Promise<void> {
        await this.service.remove(id)
    }
}
