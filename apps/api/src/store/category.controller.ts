// 카테고리 CRUD 엔드포인트. 전역 세션 가드로 보호된다.
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
import { CategoryService } from "./category.service"
import { CreateCategoryDto, UpdateCategoryDto } from "./dto/category.dto"

@Controller("categories")
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
