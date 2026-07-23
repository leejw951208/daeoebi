// 고정 지출 템플릿(RecurringExpense) CRUD. 본문은 클라이언트 E2E 암호문 패스스루.
// dayOfMonth·active 만 평문이며, 매월 인스턴스 자동 생성은 클라이언트가 수행한다.
import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from "@nestjs/common"
import { PrismaService } from "../prisma/prisma.service"
import { fromBase64url, toBase64url } from "../common/base64url"
import { CreateRecurringDto, UpdateRecurringDto } from "./dto/recurring.dto"
import { ASSET_ERRORS } from "./asset.types"

function prismaBytes(value: Uint8Array): Uint8Array<ArrayBuffer> {
    return new Uint8Array(value)
}

interface RecurringRow {
    id: string
    dayOfMonth: number
    startMonth: string
    termMonths: number | null
    categoryId: string | null
    method: string | null
    active: boolean
    iv: Uint8Array
    ciphertext: Uint8Array
    authTag: Uint8Array
}

function toView(row: RecurringRow) {
    return {
        id: row.id,
        dayOfMonth: row.dayOfMonth,
        startMonth: row.startMonth,
        termMonths: row.termMonths,
        categoryId: row.categoryId,
        method: row.method,
        active: row.active,
        iv: toBase64url(row.iv),
        ciphertext: toBase64url(row.ciphertext),
        authTag: toBase64url(row.authTag),
    }
}

@Injectable()
export class RecurringService {
    constructor(private readonly prisma: PrismaService) {}

    // 활성 템플릿을 암호문 블롭 포함해 반환한다(클라가 복호화 후 머티리얼라이즈).
    async listActive() {
        const rows = await this.prisma.recurringExpense.findMany({
            where: { active: true },
            orderBy: { createdAt: "asc" },
        })
        return rows.map(toView)
    }

    async create(dto: CreateRecurringDto) {
        const row = await this.prisma.recurringExpense.create({
            data: {
                dayOfMonth: dto.dayOfMonth,
                startMonth: dto.startMonth,
                termMonths: dto.termMonths ?? null,
                categoryId: dto.categoryId ?? null,
                method: dto.method ?? null,
                iv: prismaBytes(fromBase64url(dto.iv)),
                ciphertext: prismaBytes(fromBase64url(dto.ciphertext)),
                authTag: prismaBytes(fromBase64url(dto.authTag)),
            },
        })
        return toView(row)
    }

    async update(id: string, dto: UpdateRecurringDto) {
        const data: Record<string, unknown> = {}
        if (dto.dayOfMonth !== undefined) data.dayOfMonth = dto.dayOfMonth
        if (dto.active !== undefined) data.active = dto.active
        if (dto.termMonths !== undefined) data.termMonths = dto.termMonths
        if (dto.categoryId !== undefined) data.categoryId = dto.categoryId
        if (dto.method !== undefined) data.method = dto.method

        // 암호문은 전부 아니면 전무다. 일부만 갈아끼우면 AES-GCM 인증이 영원히 깨져
        // 서버도 클라도 못 여는 블롭이 된다(복구 경로 없음).
        const hasIv = dto.iv !== undefined
        const hasCt = dto.ciphertext !== undefined
        const hasTag = dto.authTag !== undefined
        if (hasIv || hasCt || hasTag) {
            if (!hasIv || !hasCt || !hasTag) {
                throw new BadRequestException({
                    code: ASSET_ERRORS.CIPHERTEXT_INCOMPLETE_ASSET,
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
            const row = await this.prisma.recurringExpense.update({
                where: { id },
                data,
            })
            return toView(row)
        } catch (e: unknown) {
            if (this.isRecordNotFound(e)) throw this.notFound()
            throw e
        }
    }

    // 템플릿 삭제 = 고정 지출 "전체 삭제". FK onDelete Cascade 라 이 템플릿의 모든 인스턴스도 함께 삭제된다.
    // (앞으로 자동 생성만 멈추고 기록은 남기는 "해제"는 update({active:false}) 로 별도 처리한다.)
    async remove(id: string): Promise<void> {
        try {
            await this.prisma.recurringExpense.delete({ where: { id } })
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
            code: ASSET_ERRORS.RECURRING_NOT_FOUND,
            message: "고정 지출을 찾을 수 없습니다.",
        })
    }
}
