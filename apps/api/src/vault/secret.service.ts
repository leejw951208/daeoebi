// 비밀번호(Secret) CRUD. 본문은 클라이언트 E2E 암호문이므로 서버는 복호화 없이 패스스루한다.
import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from "@nestjs/common"
import { PrismaService } from "../prisma/prisma.service"
import { fromBase64url, toBase64url } from "../common/base64url"
import { CreateSecretDto, UpdateSecretDto } from "./dto/secret.dto"
import { VAULT_ERRORS } from "./vault.types"

const LIST_SELECT = {
    id: true,
    siteId: true,
    label: true,
    createdAt: true,
    updatedAt: true,
} as const

const DETAIL_SELECT = {
    id: true,
    siteId: true,
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

    async listBySite(siteId: string) {
        await this.ensureSite(siteId)
        return this.prisma.secret.findMany({
            where: { siteId },
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
        return this.prisma.secret.create({
            data: {
                siteId: dto.siteId,
                label: dto.label,
                iv: prismaBytes(fromBase64url(dto.iv)),
                ciphertext: prismaBytes(fromBase64url(dto.ciphertext)),
                authTag: prismaBytes(fromBase64url(dto.authTag)),
            },
            select: LIST_SELECT,
        })
    }

    async update(id: string, dto: UpdateSecretDto) {
        const data: Record<string, unknown> = {}
        if (dto.label !== undefined) data.label = dto.label

        // 본문 갱신은 세 필드가 모두 있을 때만 수행한다(부분 암호문 방지).
        const hasIv = dto.iv !== undefined
        const hasCt = dto.ciphertext !== undefined
        const hasTag = dto.authTag !== undefined
        if (hasIv || hasCt || hasTag) {
            if (!hasIv || !hasCt || !hasTag) {
                throw new BadRequestException({
                    code: VAULT_ERRORS.CIPHERTEXT_INCOMPLETE,
                    message:
                        "암호문은 iv·ciphertext·authTag 를 모두 보내야 합니다.",
                })
            }
            data.iv = prismaBytes(fromBase64url(dto.iv as string))
            data.ciphertext = prismaBytes(
                fromBase64url(dto.ciphertext as string),
            )
            data.authTag = prismaBytes(fromBase64url(dto.authTag as string))
        }

        try {
            return await this.prisma.secret.update({
                where: { id },
                data,
                select: LIST_SELECT,
            })
        } catch (e: unknown) {
            if (this.isRecordNotFound(e)) throw this.notFound()
            throw e
        }
    }

    async remove(id: string): Promise<void> {
        try {
            await this.prisma.secret.delete({ where: { id } })
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
            code: VAULT_ERRORS.SECRET_NOT_FOUND,
            message: "비밀번호를 찾을 수 없습니다.",
        })
    }
}
