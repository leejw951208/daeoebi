// 비밀번호(Secret) CRUD. 본문은 클라이언트 E2E 암호문이므로 서버는 복호화 없이 패스스루한다.
import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from "@nestjs/common"
import { PrismaService } from "../prisma/prisma.service"
import { fromBase64url, toBase64url } from "../auth/base64url"
import { CreateSecretDto, UpdateSecretDto } from "./dto/secret.dto"
import { STORE_ERRORS } from "./store.types"

const LIST_SELECT = {
    id: true,
    siteId: true,
    categoryId: true,
    label: true,
    createdAt: true,
    updatedAt: true,
} as const

const DETAIL_SELECT = {
    id: true,
    siteId: true,
    categoryId: true,
    label: true,
    iv: true,
    ciphertext: true,
    authTag: true,
    createdAt: true,
    updatedAt: true,
} as const

// Prisma Bytes 입력은 Uint8Array<ArrayBuffer> 를 기대하므로 복사해 변환한다.
function prismaBytes(value: Uint8Array): Uint8Array<ArrayBuffer> {
    return new Uint8Array(value)
}

@Injectable()
export class SecretService {
    constructor(private readonly prisma: PrismaService) {}

    async listBySite(siteId: string, categoryId?: string) {
        await this.ensureSite(siteId)
        return this.prisma.secret.findMany({
            where: {
                siteId,
                ...(categoryId !== undefined ? { categoryId } : {}),
            },
            orderBy: { label: "asc" },
            select: LIST_SELECT,
        })
    }

    // 상세 조회는 암호문 블롭(base64url)을 포함해 반환한다. 복호화는 클라이언트에서 수행한다.
    async detail(id: string) {
        const secret = await this.prisma.secret.findUnique({
            where: { id },
            select: DETAIL_SELECT,
        })
        if (!secret) throw this.notFound()
        return {
            id: secret.id,
            siteId: secret.siteId,
            categoryId: secret.categoryId,
            label: secret.label,
            iv: toBase64url(secret.iv),
            ciphertext: toBase64url(secret.ciphertext),
            authTag: toBase64url(secret.authTag),
            createdAt: secret.createdAt,
            updatedAt: secret.updatedAt,
        }
    }

    async create(dto: CreateSecretDto) {
        await this.ensureSite(dto.siteId)
        const categoryId = dto.categoryId ?? null
        if (categoryId) await this.ensureCategoryInSite(categoryId, dto.siteId)
        return this.prisma.secret.create({
            data: {
                siteId: dto.siteId,
                categoryId,
                label: dto.label,
                iv: prismaBytes(fromBase64url(dto.iv)),
                ciphertext: prismaBytes(fromBase64url(dto.ciphertext)),
                authTag: prismaBytes(fromBase64url(dto.authTag)),
            },
            select: LIST_SELECT,
        })
    }

    async update(id: string, dto: UpdateSecretDto) {
        const secret = await this.prisma.secret.findUnique({
            where: { id },
            select: { id: true, siteId: true },
        })
        if (!secret) throw this.notFound()

        const data: Record<string, unknown> = {}
        if (dto.label !== undefined) data.label = dto.label
        if (dto.categoryId !== undefined) {
            if (dto.categoryId) {
                await this.ensureCategoryInSite(dto.categoryId, secret.siteId)
            }
            data.categoryId = dto.categoryId
        }

        // 본문 갱신은 세 필드가 모두 있을 때만 수행한다(부분 암호문 방지).
        const hasIv = dto.iv !== undefined
        const hasCt = dto.ciphertext !== undefined
        const hasTag = dto.authTag !== undefined
        if (hasIv || hasCt || hasTag) {
            if (!hasIv || !hasCt || !hasTag) {
                throw new BadRequestException({
                    code: STORE_ERRORS.CIPHERTEXT_INCOMPLETE,
                    message: "암호문은 iv·ciphertext·authTag 를 모두 보내야 합니다.",
                })
            }
            data.iv = prismaBytes(fromBase64url(dto.iv as string))
            data.ciphertext = prismaBytes(fromBase64url(dto.ciphertext as string))
            data.authTag = prismaBytes(fromBase64url(dto.authTag as string))
        }

        return this.prisma.secret.update({
            where: { id },
            data,
            select: LIST_SELECT,
        })
    }

    async remove(id: string): Promise<void> {
        const found = await this.prisma.secret.findUnique({
            where: { id },
            select: { id: true },
        })
        if (!found) throw this.notFound()
        await this.prisma.secret.delete({ where: { id } })
    }

    private async ensureSite(siteId: string): Promise<void> {
        const found = await this.prisma.site.findUnique({
            where: { id: siteId },
            select: { id: true },
        })
        if (!found) {
            throw new NotFoundException({
                code: STORE_ERRORS.SITE_NOT_FOUND,
                message: "사이트를 찾을 수 없습니다.",
            })
        }
    }

    private async ensureCategoryInSite(
        categoryId: string,
        siteId: string,
    ): Promise<void> {
        const category = await this.prisma.category.findUnique({
            where: { id: categoryId },
            select: { siteId: true },
        })
        if (!category) {
            throw new NotFoundException({
                code: STORE_ERRORS.CATEGORY_NOT_FOUND,
                message: "카테고리를 찾을 수 없습니다.",
            })
        }
        if (category.siteId !== siteId) {
            throw new BadRequestException({
                code: STORE_ERRORS.CATEGORY_SITE_MISMATCH,
                message: "카테고리가 사이트에 속하지 않습니다.",
            })
        }
    }

    private notFound(): NotFoundException {
        return new NotFoundException({
            code: STORE_ERRORS.SECRET_NOT_FOUND,
            message: "비밀번호를 찾을 수 없습니다.",
        })
    }
}
