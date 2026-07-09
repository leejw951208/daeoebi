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
                _count: { select: { secrets: true } },
            },
        })
    }

    async get(id: string) {
        const site = await this.prisma.site.findUnique({
            where: { id },
            include: {
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
        try {
            return await this.prisma.site.update({
                where: { id },
                data: {
                    ...(dto.label !== undefined ? { label: dto.label } : {}),
                    ...(dto.icon !== undefined ? { icon: dto.icon } : {}),
                },
            })
        } catch (e: unknown) {
            if (this.isRecordNotFound(e)) throw this.notFound()
            throw e
        }
    }

    async remove(id: string): Promise<void> {
        try {
            await this.prisma.site.delete({ where: { id } })
        } catch (e: unknown) {
            if (this.isRecordNotFound(e)) throw this.notFound()
            throw e
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
            code: VAULT_ERRORS.SITE_NOT_FOUND,
            message: "사이트를 찾을 수 없습니다.",
        })
    }
}
