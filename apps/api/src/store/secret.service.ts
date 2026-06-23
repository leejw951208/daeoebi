// 비밀번호(Secret) CRUD. 본문은 마스터 해제 세션 키로 AES-256-GCM 암호화·복호화한다.
import {
    BadRequestException,
    Injectable,
    InternalServerErrorException,
    NotFoundException,
    UnauthorizedException,
} from "@nestjs/common"
import { PrismaService } from "../prisma/prisma.service"
import { VaultSessionService } from "../vault/vault-session.service"
import { VaultCryptoService } from "../vault/vault-crypto.service"
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

// Prisma Bytes 입력은 Uint8Array<ArrayBuffer> 를 기대하므로 Buffer 를 복사해 변환한다.
function prismaBytes(value: Uint8Array): Uint8Array<ArrayBuffer> {
    return new Uint8Array(value)
}

@Injectable()
export class SecretService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly session: VaultSessionService,
        private readonly crypto: VaultCryptoService,
    ) {}

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

    async create(dto: CreateSecretDto) {
        await this.ensureSite(dto.siteId)
        const categoryId = dto.categoryId ?? null
        if (categoryId) await this.ensureCategoryInSite(categoryId, dto.siteId)
        const key = this.requireKey()
        const blob = this.crypto.seal(key, Buffer.from(dto.value, "utf8"))
        const created = await this.prisma.secret.create({
            data: {
                siteId: dto.siteId,
                categoryId,
                label: dto.label,
                iv: prismaBytes(blob.iv),
                ciphertext: prismaBytes(blob.ciphertext),
                authTag: prismaBytes(blob.authTag),
            },
            select: LIST_SELECT,
        })
        return created
    }

    async reveal(id: string) {
        const secret = await this.prisma.secret.findUnique({ where: { id } })
        if (!secret) throw this.notFound()
        const key = this.requireKey()
        const plain = this.crypto.open(key, {
            iv: Buffer.from(secret.iv),
            ciphertext: Buffer.from(secret.ciphertext),
            authTag: Buffer.from(secret.authTag),
        })
        if (!plain) {
            throw new InternalServerErrorException({
                code: STORE_ERRORS.DECRYPT_FAILED,
                message: "복호화에 실패했습니다.",
            })
        }
        return {
            id: secret.id,
            siteId: secret.siteId,
            categoryId: secret.categoryId,
            label: secret.label,
            value: plain.toString("utf8"),
            createdAt: secret.createdAt,
            updatedAt: secret.updatedAt,
        }
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
        if (dto.value !== undefined) {
            const key = this.requireKey()
            const blob = this.crypto.seal(key, Buffer.from(dto.value, "utf8"))
            data.iv = prismaBytes(blob.iv)
            data.ciphertext = prismaBytes(blob.ciphertext)
            data.authTag = prismaBytes(blob.authTag)
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

    private requireKey(): Buffer {
        const key = this.session.getKey()
        if (!key) {
            throw new UnauthorizedException({
                code: STORE_ERRORS.VAULT_LOCKED,
                message: "보관함이 잠겨 있습니다. 마스터로 해제하세요.",
            })
        }
        return key
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
