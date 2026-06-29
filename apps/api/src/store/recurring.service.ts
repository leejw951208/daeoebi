// 고정 지출 템플릿(RecurringExpense) CRUD. 본문은 클라이언트 E2E 암호문 패스스루.
// dayOfMonth·active 만 평문이며, 매월 인스턴스 자동 생성은 클라이언트가 수행한다.
import { Injectable, NotFoundException } from "@nestjs/common"
import { PrismaService } from "../prisma/prisma.service"
import { fromBase64url, toBase64url } from "../common/base64url"
import { CreateRecurringDto, UpdateRecurringDto } from "./dto/recurring.dto"
import { STORE_ERRORS } from "./store.types"

function prismaBytes(value: Uint8Array): Uint8Array<ArrayBuffer> {
    return new Uint8Array(value)
}

interface RecurringRow {
    id: string
    dayOfMonth: number
    active: boolean
    iv: Uint8Array
    ciphertext: Uint8Array
    authTag: Uint8Array
}

function toView(row: RecurringRow) {
    return {
        id: row.id,
        dayOfMonth: row.dayOfMonth,
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
                iv: prismaBytes(fromBase64url(dto.iv)),
                ciphertext: prismaBytes(fromBase64url(dto.ciphertext)),
                authTag: prismaBytes(fromBase64url(dto.authTag)),
            },
        })
        return toView(row)
    }

    async update(id: string, dto: UpdateRecurringDto) {
        await this.ensureExists(id)
        const data: Record<string, unknown> = {}
        if (dto.dayOfMonth !== undefined) data.dayOfMonth = dto.dayOfMonth
        if (dto.active !== undefined) data.active = dto.active
        if (dto.iv !== undefined) data.iv = prismaBytes(fromBase64url(dto.iv))
        if (dto.ciphertext !== undefined) {
            data.ciphertext = prismaBytes(fromBase64url(dto.ciphertext))
        }
        if (dto.authTag !== undefined) {
            data.authTag = prismaBytes(fromBase64url(dto.authTag))
        }
        const row = await this.prisma.recurringExpense.update({
            where: { id },
            data,
        })
        return toView(row)
    }

    // 템플릿 삭제 = 고정 지출 해지. 기존 인스턴스의 recurringId 는 SetNull 로 남는다(과거 기록 보존).
    async remove(id: string): Promise<void> {
        await this.ensureExists(id)
        await this.prisma.recurringExpense.delete({ where: { id } })
    }

    private async ensureExists(id: string): Promise<void> {
        const found = await this.prisma.recurringExpense.findUnique({
            where: { id },
            select: { id: true },
        })
        if (!found) {
            throw new NotFoundException({
                code: STORE_ERRORS.RECURRING_NOT_FOUND,
                message: "고정 지출을 찾을 수 없습니다.",
            })
        }
    }
}
