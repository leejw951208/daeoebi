// 적금 계좌(SavingsAccount) CRUD. 본문은 클라이언트 E2E 암호문이라 서버 복호화 없이 패스스루한다.
// color 는 평문 메타(탭 렌더용)이며 iv/ciphertext/authTag 는 셋 다 함께이거나 없어야 한다(부분 암호문 불허).
import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from "@nestjs/common"
import { PrismaService } from "../prisma/prisma.service"
import { fromBase64url, toBase64url } from "../common/base64url"
import {
    CreateSavingsAccountDto,
    UpdateSavingsAccountDto,
} from "./dto/savings-account.dto"
import { ASSET_ERRORS } from "./asset.types"

function prismaBytes(value: Uint8Array): Uint8Array<ArrayBuffer> {
    return new Uint8Array(value)
}

interface SavingsAccountRow {
    id: string
    name: string
    color: string
    iv: Uint8Array
    ciphertext: Uint8Array
    authTag: Uint8Array
}

function toView(row: SavingsAccountRow) {
    return {
        id: row.id,
        name: row.name,
        color: row.color,
        iv: toBase64url(row.iv),
        ciphertext: toBase64url(row.ciphertext),
        authTag: toBase64url(row.authTag),
    }
}

@Injectable()
export class SavingsAccountService {
    constructor(private readonly prisma: PrismaService) {}

    async list() {
        const rows = await this.prisma.savingsAccount.findMany({
            orderBy: { createdAt: "asc" },
        })
        return rows.map(toView)
    }

    async create(dto: CreateSavingsAccountDto) {
        const row = await this.prisma.savingsAccount.create({
            data: {
                name: dto.name,
                color: dto.color,
                iv: prismaBytes(fromBase64url(dto.iv)),
                ciphertext: prismaBytes(fromBase64url(dto.ciphertext)),
                authTag: prismaBytes(fromBase64url(dto.authTag)),
            },
        })
        return toView(row)
    }

    async update(id: string, dto: UpdateSavingsAccountDto) {
        const hasIv = dto.iv !== undefined
        const hasCt = dto.ciphertext !== undefined
        const hasTag = dto.authTag !== undefined
        const hasAnyCipherField = hasIv || hasCt || hasTag
        const hasAllCipherFields = hasIv && hasCt && hasTag
        if (hasAnyCipherField && !hasAllCipherFields) {
            throw new BadRequestException({
                code: ASSET_ERRORS.CIPHERTEXT_INCOMPLETE_ASSET,
                message:
                    "암호문은 iv·ciphertext·authTag 를 모두 보내야 합니다.",
            })
        }
        const data = {
            ...(dto.color !== undefined ? { color: dto.color } : {}),
            ...(hasAllCipherFields
                ? {
                      iv: prismaBytes(fromBase64url(dto.iv as string)),
                      ciphertext: prismaBytes(
                          fromBase64url(dto.ciphertext as string),
                      ),
                      authTag: prismaBytes(
                          fromBase64url(dto.authTag as string),
                      ),
                  }
                : {}),
        }
        try {
            const row = await this.prisma.savingsAccount.update({
                where: { id },
                data,
            })
            return toView(row)
        } catch (e: unknown) {
            if (this.isRecordNotFound(e)) throw this.notFound()
            throw e
        }
    }

    async remove(id: string): Promise<void> {
        try {
            await this.prisma.savingsAccount.delete({ where: { id } })
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
            code: ASSET_ERRORS.SAVINGS_ACCOUNT_NOT_FOUND,
            message: "적금 계좌를 찾을 수 없습니다.",
        })
    }
}
