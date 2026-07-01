// 백업 export/import 로직. E2E 암호문을 복호화 없이 내보내고 들여온다(계약서 §7).
import {
    BadRequestException,
    ConflictException,
    Injectable,
} from "@nestjs/common"
import { PrismaService } from "../prisma/prisma.service"
import { fromBase64url, toBase64url } from "../common/base64url"
import { VAULT_ERRORS } from "./vault.types"
import type { ImportBackupDto, ImportMode } from "./dto/backup.dto"

// Prisma Bytes 입력은 Uint8Array<ArrayBuffer> 를 기대하므로 복사해 변환한다.
function prismaBytes(value: Uint8Array): Uint8Array<ArrayBuffer> {
    return new Uint8Array(value)
}

@Injectable()
export class BackupService {
    constructor(private readonly prisma: PrismaService) {}

    // 전체 행을 암호문 블롭(base64url) 포함해 내보낸다.
    async export() {
        const [sites, categories, secrets] = await Promise.all([
            this.prisma.site.findMany({ orderBy: { createdAt: "asc" } }),
            this.prisma.category.findMany({ orderBy: { createdAt: "asc" } }),
            this.prisma.secret.findMany({ orderBy: { createdAt: "asc" } }),
        ])

        return {
            version: "1",
            exportedAt: new Date().toISOString(),
            sites: sites.map((s) => ({
                id: s.id,
                label: s.label,
                icon: s.icon,
                createdAt: s.createdAt.toISOString(),
                updatedAt: s.updatedAt.toISOString(),
            })),
            categories: categories.map((c) => ({
                id: c.id,
                siteId: c.siteId,
                label: c.label,
                createdAt: c.createdAt.toISOString(),
                updatedAt: c.updatedAt.toISOString(),
            })),
            secrets: secrets.map((s) => ({
                id: s.id,
                siteId: s.siteId,
                categoryId: s.categoryId,
                label: s.label,
                iv: toBase64url(s.iv),
                ciphertext: toBase64url(s.ciphertext),
                authTag: toBase64url(s.authTag),
                createdAt: s.createdAt.toISOString(),
                updatedAt: s.updatedAt.toISOString(),
            })),
        }
    }

    // 백업을 수용한다. id 충돌 시 mode 로 처리한다(서버는 복호화하지 않는다).
    // reject: 충돌 1건이라도 있으면 전체 거부. skip: 충돌 행만 건너뜀. replace: 충돌 행 덮어씀.
    async import(
        dto: ImportBackupDto,
        mode: ImportMode,
    ): Promise<{
        sites: { created: number; skipped: number; replaced: number }
        categories: { created: number; skipped: number; replaced: number }
        secrets: { created: number; skipped: number; replaced: number }
    }> {
        // 무결성: secret.siteId / category.siteId 참조가 백업 안에서 닫혀 있는지 검사한다.
        const siteIds = new Set(dto.sites.map((s) => s.id))
        const categoryIds = new Set(dto.categories.map((c) => c.id))
        for (const c of dto.categories) {
            if (!siteIds.has(c.siteId)) {
                throw new BadRequestException({
                    code: VAULT_ERRORS.IMPORT_INVALID,
                    message: "카테고리가 참조하는 사이트가 백업에 없습니다.",
                })
            }
        }
        for (const s of dto.secrets) {
            if (!siteIds.has(s.siteId)) {
                throw new BadRequestException({
                    code: VAULT_ERRORS.IMPORT_INVALID,
                    message: "비밀번호가 참조하는 사이트가 백업에 없습니다.",
                })
            }
            if (s.categoryId && !categoryIds.has(s.categoryId)) {
                throw new BadRequestException({
                    code: VAULT_ERRORS.IMPORT_INVALID,
                    message: "비밀번호가 참조하는 카테고리가 백업에 없습니다.",
                })
            }
        }

        return this.prisma.$transaction(async (tx) => {
            const [existSites, existCats, existSecrets] = await Promise.all([
                tx.site.findMany({ select: { id: true } }),
                tx.category.findMany({ select: { id: true } }),
                tx.secret.findMany({ select: { id: true } }),
            ])
            const haveSites = new Set(existSites.map((r) => r.id))
            const haveCats = new Set(existCats.map((r) => r.id))
            const haveSecrets = new Set(existSecrets.map((r) => r.id))

            if (mode === "reject") {
                const conflict =
                    dto.sites.some((s) => haveSites.has(s.id)) ||
                    dto.categories.some((c) => haveCats.has(c.id)) ||
                    dto.secrets.some((s) => haveSecrets.has(s.id))
                if (conflict) {
                    throw new ConflictException({
                        code: VAULT_ERRORS.IMPORT_CONFLICT,
                        message:
                            "기존 항목과 id 가 충돌합니다. skip 또는 replace 모드를 사용하세요.",
                    })
                }
            }

            const sites = { created: 0, skipped: 0, replaced: 0 }
            const categories = { created: 0, skipped: 0, replaced: 0 }
            const secrets = { created: 0, skipped: 0, replaced: 0 }

            // 외래키 순서대로 사이트 → 카테고리 → 비밀번호 순으로 적재한다.
            // 신규 행은 테이블별 createMany 로 일괄 삽입(왕복 최소화), 충돌 행만 개별 update.
            const newSites = dto.sites.filter((s) => !haveSites.has(s.id))
            const conflictSites = dto.sites.filter((s) => haveSites.has(s.id))
            if (mode === "skip") {
                sites.skipped += conflictSites.length
            } else {
                for (const s of conflictSites) {
                    await tx.site.update({
                        where: { id: s.id },
                        data: { label: s.label, icon: s.icon ?? null },
                    })
                    sites.replaced += 1
                }
            }
            if (newSites.length > 0) {
                await tx.site.createMany({
                    data: newSites.map((s) => ({
                        id: s.id,
                        label: s.label,
                        icon: s.icon ?? null,
                        createdAt: new Date(s.createdAt),
                        updatedAt: new Date(s.updatedAt),
                    })),
                })
                sites.created += newSites.length
            }

            const newCats = dto.categories.filter((c) => !haveCats.has(c.id))
            const conflictCats = dto.categories.filter((c) =>
                haveCats.has(c.id),
            )
            if (mode === "skip") {
                categories.skipped += conflictCats.length
            } else {
                for (const c of conflictCats) {
                    await tx.category.update({
                        where: { id: c.id },
                        data: { siteId: c.siteId, label: c.label },
                    })
                    categories.replaced += 1
                }
            }
            if (newCats.length > 0) {
                await tx.category.createMany({
                    data: newCats.map((c) => ({
                        id: c.id,
                        siteId: c.siteId,
                        label: c.label,
                        createdAt: new Date(c.createdAt),
                        updatedAt: new Date(c.updatedAt),
                    })),
                })
                categories.created += newCats.length
            }

            const newSecrets = dto.secrets.filter((s) => !haveSecrets.has(s.id))
            const conflictSecrets = dto.secrets.filter((s) =>
                haveSecrets.has(s.id),
            )
            if (mode === "skip") {
                secrets.skipped += conflictSecrets.length
            } else {
                for (const s of conflictSecrets) {
                    await tx.secret.update({
                        where: { id: s.id },
                        data: {
                            siteId: s.siteId,
                            categoryId: s.categoryId ?? null,
                            label: s.label,
                            iv: prismaBytes(fromBase64url(s.iv)),
                            ciphertext: prismaBytes(
                                fromBase64url(s.ciphertext),
                            ),
                            authTag: prismaBytes(fromBase64url(s.authTag)),
                        },
                    })
                    secrets.replaced += 1
                }
            }
            if (newSecrets.length > 0) {
                await tx.secret.createMany({
                    data: newSecrets.map((s) => ({
                        id: s.id,
                        siteId: s.siteId,
                        categoryId: s.categoryId ?? null,
                        label: s.label,
                        iv: prismaBytes(fromBase64url(s.iv)),
                        ciphertext: prismaBytes(fromBase64url(s.ciphertext)),
                        authTag: prismaBytes(fromBase64url(s.authTag)),
                        createdAt: new Date(s.createdAt),
                        updatedAt: new Date(s.updatedAt),
                    })),
                })
                secrets.created += newSecrets.length
            }

            return { sites, categories, secrets }
        })
    }
}
