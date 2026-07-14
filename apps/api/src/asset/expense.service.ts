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
import { ASSET_ERRORS, MONTH_RE } from "./asset.types"

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
    categoryId: string | null
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
        categoryId: row.categoryId,
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

    // 저축·투자 탭용: 전 기간(모든 달) 비삭제 지출을 카테고리로 필터해 반환(클라가 복호화·집계).
    async listContributions(categoryIds: string[]) {
        if (categoryIds.length === 0) return []
        const rows = await this.prisma.expense.findMany({
            where: { removed: false, categoryId: { in: categoryIds } },
            orderBy: { date: "desc" },
        })
        return rows.map(toView)
    }

    // 템플릿 수정 전파용: 해당 템플릿의 fromPeriod 초과(=미래) 인스턴스를 반환한다.
    // 클라가 새 내용으로 재봉인해 갱신한다(서버는 블롭을 못 읽으므로 여기서 못 한다).
    // @@unique([recurringId, period]) 인덱스를 그대로 타서 추가 인덱스가 필요 없다.
    async listInstancesAfter(recurringId: string, fromPeriod: string) {
        // Prisma 는 undefined 필터를 통째로 무시하므로, 빈 recurringId 를 넘기면
        // 조건이 사라져 다른 템플릿의 인스턴스까지 전부 나온다. 반드시 먼저 막는다.
        if (!recurringId) {
            throw new BadRequestException({
                code: ASSET_ERRORS.INVALID_RECURRING_ID,
                message: "recurringId 는 필수입니다.",
            })
        }
        if (!MONTH_RE.test(fromPeriod)) {
            throw new BadRequestException({
                code: ASSET_ERRORS.INVALID_MONTH,
                message: "fromPeriod 는 YYYY-MM 형식이어야 합니다.",
            })
        }
        const rows = await this.prisma.expense.findMany({
            where: {
                recurringId,
                period: { gt: fromPeriod },
                removed: false, // 이번 달만 삭제된 슬롯은 어떤 조회에도 안 나오므로 갱신 대상이 아니다.
            },
            orderBy: { period: "asc" },
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
            categoryId: dto.categoryId ?? null,
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
        if (dto.categoryId !== undefined) data.categoryId = dto.categoryId
        // 단건 → 고정 전환: 새 템플릿에 연결(recurringId·period 를 함께 세팅해 멱등 키를 채운다).
        if (dto.recurringId !== undefined) data.recurringId = dto.recurringId
        if (dto.period !== undefined) data.period = dto.period

        try {
            const row = await this.prisma.expense.update({
                where: { id },
                data,
            })
            return toView(row)
        } catch (e: unknown) {
            if (this.isRecordNotFound(e)) throw this.notFound()
            // 같은 (recurringId, period) 가 이미 있으면 고정 인스턴스 중복.
            if (this.isUniqueViolation(e)) {
                throw new ConflictException({
                    code: ASSET_ERRORS.EXPENSE_DUPLICATE,
                    message: "해당 월의 고정 지출이 이미 존재합니다.",
                })
            }
            throw e
        }
    }

    async remove(id: string): Promise<void> {
        try {
            await this.prisma.expense.delete({ where: { id } })
        } catch (e: unknown) {
            if (this.isRecordNotFound(e)) throw this.notFound()
            throw e
        }
    }

    private isUniqueViolation(e: unknown): boolean {
        return (
            typeof e === "object" &&
            e !== null &&
            (e as { code?: string }).code === "P2002"
        )
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
            code: ASSET_ERRORS.EXPENSE_NOT_FOUND,
            message: "지출을 찾을 수 없습니다.",
        })
    }
}
