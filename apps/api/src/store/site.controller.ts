// 사이트 CRUD 엔드포인트. PIN 로그인 보호.
import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    Param,
    Patch,
    Post,
    UseGuards,
} from "@nestjs/common"
import { PinGuard } from "../pin/pin.guard"
import { SiteService } from "./site.service"
import { CreateSiteDto, UpdateSiteDto } from "./dto/site.dto"

@Controller("sites")
@UseGuards(PinGuard)
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
