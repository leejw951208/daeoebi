// 자산(지출) 카테고리 CRUD 엔드포인트. 전역 세션 가드 + CsrfMiddleware 로 보호된다.
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
import { AssetCategoryService } from "./asset-category.service"
import {
    CreateAssetCategoryDto,
    UpdateAssetCategoryDto,
} from "./dto/asset-category.dto"

@Controller("asset-categories")
export class AssetCategoryController {
    constructor(private readonly service: AssetCategoryService) {}

    @Get()
    list() {
        return this.service.list()
    }

    @Post()
    @HttpCode(201)
    create(@Body() dto: CreateAssetCategoryDto) {
        return this.service.create(dto)
    }

    @Patch(":id")
    update(@Param("id") id: string, @Body() dto: UpdateAssetCategoryDto) {
        return this.service.update(id, dto)
    }

    @Delete(":id")
    @HttpCode(204)
    async remove(@Param("id") id: string): Promise<void> {
        await this.service.remove(id)
    }
}
