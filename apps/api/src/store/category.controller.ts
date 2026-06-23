// 카테고리 CRUD 엔드포인트. PIN 로그인 보호.
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
import { CategoryService } from "./category.service"
import { CreateCategoryDto, UpdateCategoryDto } from "./dto/category.dto"

@Controller("categories")
@UseGuards(PinGuard)
export class CategoryController {
    constructor(private readonly service: CategoryService) {}

    @Get()
    list(@Query("siteId") siteId: string) {
        return this.service.listBySite(siteId)
    }

    @Post()
    @HttpCode(201)
    create(@Body() dto: CreateCategoryDto) {
        return this.service.create(dto)
    }

    @Patch(":id")
    update(@Param("id") id: string, @Body() dto: UpdateCategoryDto) {
        return this.service.update(id, dto)
    }

    @Delete(":id")
    @HttpCode(204)
    async remove(@Param("id") id: string): Promise<void> {
        await this.service.remove(id)
    }
}
