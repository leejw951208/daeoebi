// 사이트 CRUD. 라벨은 평문이라 마스터 해제 없이 다룬다.
import { Injectable, NotFoundException } from "@nestjs/common"
import { PrismaService } from "../prisma/prisma.service"
import { CreateSiteDto, UpdateSiteDto } from "./dto/site.dto"
import { VAULT_ERRORS } from "./vault.types"

@Injectable()
export class SiteService {
    constructor(private readonly prisma: PrismaService) {}

    list() {
        return this.prisma.site.findMany({
            orderBy: { label: "asc" },
            include: {
                _count: { select: { categories: true, secrets: true } },
            },
        })
    }

    async get(id: string) {
        const site = await this.prisma.site.findUnique({
            where: { id },
            include: {
                categories: { orderBy: { label: "asc" } },
                _count: { select: { secrets: true } },
            },
        })
        if (!site) throw this.notFound()
        return site
    }

    create(dto: CreateSiteDto) {
        return this.prisma.site.create({
            data: { label: dto.label, icon: dto.icon ?? null },
        })
    }

    async update(id: string, dto: UpdateSiteDto) {
        await this.ensureExists(id)
        return this.prisma.site.update({
            where: { id },
            data: {
                ...(dto.label !== undefined ? { label: dto.label } : {}),
                ...(dto.icon !== undefined ? { icon: dto.icon } : {}),
            },
        })
    }

    async remove(id: string): Promise<void> {
        await this.ensureExists(id)
        await this.prisma.site.delete({ where: { id } })
    }

    private async ensureExists(id: string): Promise<void> {
        const found = await this.prisma.site.findUnique({
            where: { id },
            select: { id: true },
        })
        if (!found) throw this.notFound()
    }

    private notFound(): NotFoundException {
        return new NotFoundException({
            code: VAULT_ERRORS.SITE_NOT_FOUND,
            message: "사이트를 찾을 수 없습니다.",
        })
    }
}
