// 자산(지출) 카테고리 CRUD. 전역 평문.
// 카테고리는 고정(code 보유, 수정·삭제 불가)과 사용자 생성(code null)으로 나뉜다.
// 고정 12종은 list() 에서 code 기준으로 멱등 시드한다. 저축·투자 대시보드는 code 를 앵커로 쓴다.
import {
    ConflictException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from "@nestjs/common"
import { PrismaService } from "../prisma/prisma.service"
import {
    CreateAssetCategoryDto,
    UpdateAssetCategoryDto,
} from "./dto/asset-category.dto"
import { ASSET_ERRORS } from "./asset.types"

// 고정 카테고리 12종. code 는 안정 식별자(고유)이며 색은 자동 배정값이다.
// 순서는 목록 정렬(고정 먼저)에 사용한다. INVESTMENT/SAVINGS 는 저축·투자 대시보드 앵커.
export const FIXED_CATEGORIES: { name: string; color: string; code: string }[] =
    [
        { name: "식비", color: "#f2994a", code: "FOOD" },
        { name: "카페·간식", color: "#eb5757", code: "CAFE" },
        { name: "편의점·마트", color: "#e0689a", code: "MART" },
        { name: "쇼핑", color: "#9b6bd6", code: "SHOPPING" },
        { name: "의료·건강", color: "#7b61ff", code: "HEALTH" },
        { name: "주거·통신", color: "#4a90d9", code: "HOUSING" },
        { name: "보험·세금", color: "#2d9cdb", code: "INSURANCE_TAX" },
        { name: "미용", color: "#20a4a4", code: "BEAUTY" },
        { name: "교통", color: "#3bb273", code: "TRANSPORT" },
        { name: "투자", color: "#6fcf97", code: "INVESTMENT" },
        { name: "저축", color: "#f2c94c", code: "SAVINGS" },
        { name: "기타", color: "#98a0a8", code: "ETC" },
    ]

// 고정 카테고리 정렬 우선순위(code → 순번).
const FIXED_ORDER = new Map(FIXED_CATEGORIES.map((c, i) => [c.code, i]))

@Injectable()
export class AssetCategoryService {
    constructor(private readonly prisma: PrismaService) {}

    async list() {
        // 정상 상태(고정 12종 이미 시드됨)에서는 조회 1번으로 끝난다.
        // 누락 고정이 있을 때만 createMany + 재조회한다(사실상 최초 1회뿐).
        let rows = await this.prisma.assetCategory.findMany({
            orderBy: { createdAt: "asc" },
        })
        const missing = this.missingFixedCategories(rows)
        if (missing.length > 0) {
            await this.prisma.assetCategory.createMany({
                data: missing,
                skipDuplicates: true,
            })
            rows = await this.prisma.assetCategory.findMany({
                orderBy: { createdAt: "asc" },
            })
        }
        return this.sortFixedThenUser(rows)
    }

    async create(dto: CreateAssetCategoryDto) {
        await this.assertNameAvailable(dto.name)
        // 사용자 생성 카테고리는 code 를 갖지 않는다(스키마 기본값 null).
        return this.prisma.assetCategory.create({
            data: { name: dto.name, color: dto.color },
        })
    }

    async update(id: string, dto: UpdateAssetCategoryDto) {
        await this.assertUserCategory(id)
        const data: { name?: string; color?: string } = {}
        if (dto.name !== undefined) {
            await this.assertNameAvailable(dto.name, id)
            data.name = dto.name
        }
        if (dto.color !== undefined) data.color = dto.color
        try {
            return await this.prisma.assetCategory.update({
                where: { id },
                data,
            })
        } catch (e: unknown) {
            if (this.isRecordNotFound(e)) throw this.notFound()
            throw e
        }
    }

    async remove(id: string): Promise<void> {
        await this.assertUserCategory(id)
        // 하위 Expense·RecurringExpense 는 FK SetNull 로 미분류가 된다.
        try {
            await this.prisma.assetCategory.delete({ where: { id } })
        } catch (e: unknown) {
            if (this.isRecordNotFound(e)) throw this.notFound()
            throw e
        }
    }

    // 이미 조회한 rows 에서 아직 없는 고정 카테고리 정의를 골라낸다(추가 쿼리 없음).
    private missingFixedCategories(
        rows: readonly { code: string | null }[],
    ): { name: string; color: string; code: string }[] {
        const existingCodes = new Set(
            rows.map((r) => r.code).filter((c): c is string => c !== null),
        )
        return FIXED_CATEGORIES.filter((c) => !existingCodes.has(c.code))
    }

    // 고정(code 있음)을 정의 순서로, 이어서 사용자 생성(code null)을 생성순으로 정렬한다.
    private sortFixedThenUser<T extends { code: string | null }>(
        rows: T[],
    ): T[] {
        const fixed = rows
            .filter((r) => r.code !== null)
            .sort(
                (a, b) =>
                    (FIXED_ORDER.get(a.code as string) ?? 0) -
                    (FIXED_ORDER.get(b.code as string) ?? 0),
            )
        const users = rows.filter((r) => r.code === null)
        return [...fixed, ...users]
    }

    // 고정 카테고리는 수정·삭제할 수 없다. 존재하지 않으면 404, 고정이면 403.
    private async assertUserCategory(id: string): Promise<void> {
        const target = await this.prisma.assetCategory.findUnique({
            where: { id },
            select: { code: true },
        })
        if (!target) throw this.notFound()
        if (target.code !== null) {
            throw new ForbiddenException({
                code: ASSET_ERRORS.ASSET_CATEGORY_FIXED_READONLY,
                message: "고정 카테고리는 수정하거나 삭제할 수 없습니다.",
            })
        }
    }

    // 같은 이름의 카테고리가 이미 있으면 거부한다(수정 시 자기 자신은 제외).
    private async assertNameAvailable(
        name: string,
        excludeId?: string,
    ): Promise<void> {
        const existing = await this.prisma.assetCategory.findFirst({
            where: excludeId ? { name, id: { not: excludeId } } : { name },
            select: { id: true },
        })
        if (existing) {
            throw new ConflictException({
                code: ASSET_ERRORS.ASSET_CATEGORY_DUPLICATE,
                message: "같은 이름의 카테고리가 이미 있습니다.",
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
            code: ASSET_ERRORS.ASSET_CATEGORY_NOT_FOUND,
            message: "카테고리를 찾을 수 없습니다.",
        })
    }
}
