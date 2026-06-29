// 지출(Expense) CRUD. 본문은 클라이언트 E2E 암호문이라 서버는 복호화 없이 패스스루한다.
// date(@db.Date)·recurringId·period 만 평문 메타로 다룬다(월 범위 조회·고정 자동생성 멱등).
import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from "@nestjs/common"
import { PrismaService } from "../prisma/prisma.service"
import { fromBase64url, toBase64url } from "../common/base64url"
import { CreateExpenseDto, UpdateExpenseDto } from "./dto/expense.dto"
import { ASSET_ERRORS } from "./asset.types"

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/

function prismaBytes(value: Uint8Array): Uint8Array<ArrayBuffer> {
    return new Uint8Array(value)
}

// "YYYY-MM-DD" 로 직렬화(@db.Date 는 UTC 자정 Date 라 slice 가 안전하다).
function toDateStr(date: Date): string {
    return date.toISOString().slice(0, 10)
}

interface ExpenseRow {
    id: string
    date: Date
    recurringId: string | null
    period: string | null
    iv: Uint8Array
    ciphertext: Uint8Array
    authTag: Uint8Array
}

function toView(row: ExpenseRow) {
    return {
        id: row.id,
        date: toDateStr(row.date),
        recurringId: row.recurringId,
        period: row.period,
        iv: toBase64url(row.iv),
        ciphertext: toBase64url(row.ciphertext),
        authTag: toBase64url(row.authTag),
    }
}

@Injectable()
export class ExpenseService {
    constructor(private readonly prisma: PrismaService) {}

    // 해당 월의 지출을 암호문 블롭 포함해 반환한다(클라가 복호화·집계).
    async listByMonth(month: string) {
        if (!MONTH_RE.test(month)) {
            throw new BadRequestException({
                code: ASSET_ERRORS.INVALID_MONTH,
                message: "month 는 YYYY-MM 형식이어야 합니다.",
            })
        }
        const [y, m] = month.split("-").map(Number)
        const start = new Date(Date.UTC(y, m - 1, 1))
        const end = new Date(Date.UTC(y, m, 1))
        const rows = await this.prisma.expense.findMany({
            where: { date: { gte: start, lt: end }, removed: false },
            orderBy: { date: "desc" },
        })
        return rows.map(toView)
    }

    async detail(id: string) {
        const row = await this.prisma.expense.findUnique({ where: { id } })
        if (!row) throw this.notFound()
        return toView(row)
    }

    async create(dto: CreateExpenseDto) {
        const data = {
            date: new Date(dto.date),
            recurringId: dto.recurringId ?? null,
            period: dto.period ?? null,
            iv: prismaBytes(fromBase64url(dto.iv)),
            ciphertext: prismaBytes(fromBase64url(dto.ciphertext)),
            authTag: prismaBytes(fromBase64url(dto.authTag)),
        }
        try {
            const row = await this.prisma.expense.create({ data })
            return toView(row)
        } catch (e) {
            // 같은 (recurringId, period) 중복 = 고정 인스턴스가 이미 있음(멱등 머티리얼라이즈).
            if (this.isUniqueViolation(e)) {
                throw new ConflictException({
                    code: ASSET_ERRORS.EXPENSE_DUPLICATE,
                    message: "해당 월의 고정 지출이 이미 존재합니다.",
                })
            }
            throw e
        }
    }

    async update(id: string, dto: UpdateExpenseDto) {
        const found = await this.prisma.expense.findUnique({
            where: { id },
            select: { id: true },
        })
        if (!found) throw this.notFound()

        const data: Record<string, unknown> = {}
        if (dto.date !== undefined) data.date = new Date(dto.date)

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

        if (dto.removed !== undefined) data.removed = dto.removed

        const row = await this.prisma.expense.update({ where: { id }, data })
        return toView(row)
    }

    async remove(id: string): Promise<void> {
        const found = await this.prisma.expense.findUnique({
            where: { id },
            select: { id: true },
        })
        if (!found) throw this.notFound()
        await this.prisma.expense.delete({ where: { id } })
    }

    private isUniqueViolation(e: unknown): boolean {
        return (
            typeof e === "object" &&
            e !== null &&
            (e as { code?: string }).code === "P2002"
        )
    }

    private notFound(): NotFoundException {
        return new NotFoundException({
            code: ASSET_ERRORS.EXPENSE_NOT_FOUND,
            message: "지출을 찾을 수 없습니다.",
        })
    }
}
