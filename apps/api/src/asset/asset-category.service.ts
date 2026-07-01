// 자산(지출) 카테고리 CRUD. 전역 평문. 목록이 비면 기본 8종을 시드한다.
import {
    ConflictException,
    Injectable,
    NotFoundException,
} from "@nestjs/common"
import { PrismaService } from "../prisma/prisma.service"
import {
    CreateAssetCategoryDto,
    UpdateAssetCategoryDto,
} from "./dto/asset-category.dto"
import { ASSET_ERRORS } from "./asset.types"

// 기존 디자인 고정 카테고리(asset-categories.ts 의 CATEGORIES 와 동일). 첫 사용 시 시드한다.
const DEFAULT_CATEGORIES: { name: string; color: string }[] = [
    { name: "식비", color: "#f2994a" },
    { name: "교통", color: "#4a90d9" },
    { name: "주거·공과금", color: "#9b6bd6" },
    { name: "쇼핑", color: "#e0689a" },
    { name: "문화", color: "#3bb273" },
    { name: "저축", color: "#14b8a6" },
    { name: "투자", color: "#eab308" },
    { name: "기타", color: "#98a0a8" },
]

@Injectable()
export class AssetCategoryService {
    constructor(private readonly prisma: PrismaService) {}

    async list() {
        const rows = await this.prisma.assetCategory.findMany({
            orderBy: { createdAt: "asc" },
        })
        if (rows.length > 0) return rows
        await this.prisma.assetCategory.createMany({ data: DEFAULT_CATEGORIES })
        return this.prisma.assetCategory.findMany({
            orderBy: { createdAt: "asc" },
        })
    }

    async create(dto: CreateAssetCategoryDto) {
        await this.assertNameAvailable(dto.name)
        return this.prisma.assetCategory.create({
            data: { name: dto.name, color: dto.color },
        })
    }

    async update(id: string, dto: UpdateAssetCategoryDto) {
        const data: { name?: string; color?: string } = {}
        if (dto.name !== undefined) {
            await this.assertNameAvailable(dto.name, id)
            data.name = dto.name
        }
        if (dto.color !== undefined) data.color = dto.color
        try {
            return await this.prisma.assetCategory.update({
                where: { id },
                data,
            })
        } catch (e: unknown) {
            if (this.isRecordNotFound(e)) throw this.notFound()
            throw e
        }
    }

    async remove(id: string): Promise<void> {
        // 하위 Expense·RecurringExpense 는 FK SetNull 로 미분류가 된다.
        try {
            await this.prisma.assetCategory.delete({ where: { id } })
        } catch (e: unknown) {
            if (this.isRecordNotFound(e)) throw this.notFound()
            throw e
        }
    }

    // 같은 이름의 카테고리가 이미 있으면 거부한다(수정 시 자기 자신은 제외).
    private async assertNameAvailable(
        name: string,
        excludeId?: string,
    ): Promise<void> {
        const existing = await this.prisma.assetCategory.findFirst({
            where: excludeId ? { name, id: { not: excludeId } } : { name },
            select: { id: true },
        })
        if (existing) {
            throw new ConflictException({
                code: ASSET_ERRORS.ASSET_CATEGORY_DUPLICATE,
                message: "같은 이름의 카테고리가 이미 있습니다.",
            })
        }
    }

    private isRecordNotFound(e: unknown): boolean {
        return (
            typeof e === "object" &&
            e !== null &&
            (e as { code?: string }).code === "P2025"
        )
    }

    private notFound(): NotFoundException {
        return new NotFoundException({
            code: ASSET_ERRORS.ASSET_CATEGORY_NOT_FOUND,
            message: "카테고리를 찾을 수 없습니다.",
        })
    }
}
