// 월 수입(Income) CRUD. 본문은 클라이언트 E2E 암호문이라 서버는 복호화 없이 패스스루한다.
// month 만 평문 메타로 다룬다(월 범위 조회 귀속).
import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from "@nestjs/common"
import { PrismaService } from "../prisma/prisma.service"
import { fromBase64url, toBase64url } from "../common/base64url"
import { CreateIncomeDto, UpdateIncomeDto } from "./dto/income.dto"
import { ASSET_ERRORS, MONTH_RE } from "./asset.types"

function prismaBytes(value: Uint8Array): Uint8Array<ArrayBuffer> {
    return new Uint8Array(value)
}

interface IncomeRow {
    id: string
    month: string
    iv: Uint8Array
    ciphertext: Uint8Array
    authTag: Uint8Array
}

function toView(row: IncomeRow) {
    return {
        id: row.id,
        month: row.month,
        iv: toBase64url(row.iv),
        ciphertext: toBase64url(row.ciphertext),
        authTag: toBase64url(row.authTag),
    }
}

@Injectable()
export class IncomeService {
    constructor(private readonly prisma: PrismaService) {}

    async listByMonth(month: string) {
        if (!MONTH_RE.test(month)) {
            throw new BadRequestException({
                code: ASSET_ERRORS.INVALID_MONTH,
                message: "month 는 YYYY-MM 형식이어야 합니다.",
            })
        }
        const rows = await this.prisma.income.findMany({
            where: { month },
            orderBy: { createdAt: "asc" },
        })
        return rows.map(toView)
    }

    async create(dto: CreateIncomeDto) {
        const row = await this.prisma.income.create({
            data: {
                month: dto.month,
                iv: prismaBytes(fromBase64url(dto.iv)),
                ciphertext: prismaBytes(fromBase64url(dto.ciphertext)),
                authTag: prismaBytes(fromBase64url(dto.authTag)),
            },
        })
        return toView(row)
    }

    async update(id: string, dto: UpdateIncomeDto) {
        const hasIv = dto.iv !== undefined
        const hasCt = dto.ciphertext !== undefined
        const hasTag = dto.authTag !== undefined
        if (!hasIv || !hasCt || !hasTag) {
            throw new BadRequestException({
                code: ASSET_ERRORS.CIPHERTEXT_INCOMPLETE_ASSET,
                message:
                    "암호문은 iv·ciphertext·authTag 를 모두 보내야 합니다.",
            })
        }
        try {
            const row = await this.prisma.income.update({
                where: { id },
                data: {
                    iv: prismaBytes(fromBase64url(dto.iv as string)),
                    ciphertext: prismaBytes(
                        fromBase64url(dto.ciphertext as string),
                    ),
                    authTag: prismaBytes(fromBase64url(dto.authTag as string)),
                },
            })
            return toView(row)
        } catch (e: unknown) {
            if (this.isRecordNotFound(e)) throw this.notFound()
            throw e
        }
    }

    async remove(id: string): Promise<void> {
        try {
            await this.prisma.income.delete({ where: { id } })
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
            code: ASSET_ERRORS.INCOME_NOT_FOUND,
            message: "수입을 찾을 수 없습니다.",
        })
    }
}
