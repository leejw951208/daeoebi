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
    // categories 는 레거시 호환용 빈 배열이다(비밀번호 분류 기능 제거됨).
    async export() {
        const [sites, secrets] = await Promise.all([
            this.prisma.site.findMany({ orderBy: { createdAt: "asc" } }),
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
            categories: [] as never[],
            secrets: secrets.map((s) => ({
                id: s.id,
                siteId: s.siteId,
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
        // 무결성: secret.siteId 참조가 백업 안에서 닫혀 있는지 검사한다.
        // dto.categories 는 레거시 백업 호환용으로 수용만 하고 무시한다(비밀번호 분류 제거됨).
        const siteIds = new Set(dto.sites.map((s) => s.id))
        for (const s of dto.secrets) {
            if (!siteIds.has(s.siteId)) {
                throw new BadRequestException({
                    code: VAULT_ERRORS.IMPORT_INVALID,
                    message: "비밀번호가 참조하는 사이트가 백업에 없습니다.",
                })
            }
        }

        return this.prisma.$transaction(async (tx) => {
            const [existSites, existSecrets] = await Promise.all([
                tx.site.findMany({ select: { id: true } }),
                tx.secret.findMany({ select: { id: true } }),
            ])
            const haveSites = new Set(existSites.map((r) => r.id))
            const haveSecrets = new Set(existSecrets.map((r) => r.id))

            if (mode === "reject") {
                const conflict =
                    dto.sites.some((s) => haveSites.has(s.id)) ||
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
            const secrets = { created: 0, skipped: 0, replaced: 0 }

            // 외래키 순서대로 사이트 → 비밀번호 순으로 적재한다.
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

            // categories 는 레거시 호환용 0건(비밀번호 분류 제거됨).
            const categories = { created: 0, skipped: 0, replaced: 0 }
            return { sites, categories, secrets }
        })
    }
}
