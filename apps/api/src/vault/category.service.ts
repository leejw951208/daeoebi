// 카테고리 CRUD. 사이트 하위의 선택적 1계층이며 라벨은 평문이다.
import { Injectable, NotFoundException } from "@nestjs/common"
import { PrismaService } from "../prisma/prisma.service"
import { CreateCategoryDto, UpdateCategoryDto } from "./dto/category.dto"
import { VAULT_ERRORS } from "./vault.types"

@Injectable()
export class CategoryService {
    constructor(private readonly prisma: PrismaService) {}

    async listBySite(siteId: string) {
        await this.ensureSite(siteId)
        return this.prisma.category.findMany({
            where: { siteId },
            orderBy: { label: "asc" },
        })
    }

    async create(dto: CreateCategoryDto) {
        await this.ensureSite(dto.siteId)
        return this.prisma.category.create({
            data: { siteId: dto.siteId, label: dto.label },
        })
    }

    async update(id: string, dto: UpdateCategoryDto) {
        try {
            return await this.prisma.category.update({
                where: { id },
                data: dto.label !== undefined ? { label: dto.label } : {},
            })
        } catch (e: unknown) {
            if (this.isRecordNotFound(e)) throw this.notFound()
            throw e
        }
    }

    async remove(id: string): Promise<void> {
        // 하위 Secret 은 FK SetNull 로 사이트 직속이 된다.
        try {
            await this.prisma.category.delete({ where: { id } })
        } catch (e: unknown) {
            if (this.isRecordNotFound(e)) throw this.notFound()
            throw e
        }
    }

    private async ensureSite(siteId: string): Promise<void> {
        const found = await this.prisma.site.findUnique({
            where: { id: siteId },
            select: { id: true },
        })
        if (!found) {
            throw new NotFoundException({
                code: VAULT_ERRORS.SITE_NOT_FOUND,
                message: "사이트를 찾을 수 없습니다.",
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
            code: VAULT_ERRORS.CATEGORY_NOT_FOUND,
            message: "카테고리를 찾을 수 없습니다.",
        })
    }
}
