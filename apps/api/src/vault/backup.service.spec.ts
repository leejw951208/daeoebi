// BackupService 단위 테스트(Prisma 모킹). export 형태, import 무결성 검사·충돌 모드(reject/skip/replace)를 검증한다.
// 서버는 본문을 복호화하지 않고 암호문 블롭(base64url)을 패스스루한다.
import { BadRequestException } from "@nestjs/common"
import { BackupService } from "./backup.service"
import { toBase64url } from "../common/base64url"
import { VAULT_ERRORS } from "./vault.types"
import type { ImportBackupDto, ImportMode } from "./dto/backup.dto"

const IV = Buffer.alloc(12, 1).toString("base64url")
const CT = Buffer.alloc(64, 2).toString("base64url")
const TAG = Buffer.alloc(16, 3).toString("base64url")
const ISO = "2026-01-01T00:00:00.000Z"

function siteRow(id: string): ImportBackupDto["sites"][number] {
    return {
        id,
        label: `라벨-${id}`,
        icon: null,
        createdAt: ISO,
        updatedAt: ISO,
    }
}
function secretRow(
    id: string,
    siteId: string,
    categoryId: string | null = null,
): ImportBackupDto["secrets"][number] {
    return {
        id,
        siteId,
        categoryId,
        label: `비번-${id}`,
        iv: IV,
        ciphertext: CT,
        authTag: TAG,
        createdAt: ISO,
        updatedAt: ISO,
    }
}

// import 트랜잭션용 tx 모킹. existing* 로 기존 행 id 를 주입한다.
function makeTx(existing: {
    sites?: string[]
    categories?: string[]
    secrets?: string[]
}) {
    const ids = (arr?: string[]) => (arr ?? []).map((id) => ({ id }))
    return {
        site: {
            findMany: jest.fn().mockResolvedValue(ids(existing.sites)),
            createMany: jest.fn().mockResolvedValue({ count: 0 }),
            update: jest.fn().mockResolvedValue({}),
        },
        category: {
            findMany: jest.fn().mockResolvedValue(ids(existing.categories)),
            createMany: jest.fn().mockResolvedValue({ count: 0 }),
            update: jest.fn().mockResolvedValue({}),
        },
        secret: {
            findMany: jest.fn().mockResolvedValue(ids(existing.secrets)),
            createMany: jest.fn().mockResolvedValue({ count: 0 }),
            update: jest.fn().mockResolvedValue({}),
        },
    }
}

function makePrismaForImport(existing: Parameters<typeof makeTx>[0]) {
    const tx = makeTx(existing)
    const prisma = {
        $transaction: jest.fn((cb: (t: typeof tx) => unknown) => cb(tx)),
    }
    return { prisma, tx }
}

function importDto(partial: Partial<ImportBackupDto> = {}): ImportBackupDto {
    return {
        version: "1",
        sites: [],
        categories: [],
        secrets: [],
        ...partial,
    }
}

describe("BackupService.export", () => {
    it("모든 행을 base64url 블롭 포함해 version 1 로 내보낸다", async () => {
        const prisma = {
            site: {
                findMany: jest.fn().mockResolvedValue([
                    {
                        id: "site1",
                        label: "내 보관함",
                        icon: null,
                        createdAt: new Date(ISO),
                        updatedAt: new Date(ISO),
                    },
                ]),
            },
            category: { findMany: jest.fn().mockResolvedValue([]) },
            secret: {
                findMany: jest.fn().mockResolvedValue([
                    {
                        id: "s1",
                        siteId: "site1",
                        categoryId: null,
                        label: "깃허브",
                        iv: Buffer.alloc(12, 1),
                        ciphertext: Buffer.alloc(64, 2),
                        authTag: Buffer.alloc(16, 3),
                        createdAt: new Date(ISO),
                        updatedAt: new Date(ISO),
                    },
                ]),
            },
        }
        const service = new BackupService(prisma as unknown as never)
        const out = await service.export()
        expect(out.version).toBe("1")
        expect(out.sites).toHaveLength(1)
        expect(out.secrets[0]).toMatchObject({
            id: "s1",
            label: "깃허브",
            iv: toBase64url(Buffer.alloc(12, 1)),
            ciphertext: toBase64url(Buffer.alloc(64, 2)),
            authTag: toBase64url(Buffer.alloc(16, 3)),
            createdAt: ISO,
        })
    })
})

describe("BackupService.import 무결성", () => {
    it("카테고리가 참조하는 사이트가 백업에 없으면 IMPORT_INVALID", async () => {
        const { prisma } = makePrismaForImport({})
        const service = new BackupService(prisma as unknown as never)
        const dto = importDto({
            categories: [
                {
                    id: "c1",
                    siteId: "ghost",
                    label: "x",
                    createdAt: ISO,
                    updatedAt: ISO,
                },
            ],
        })
        await expect(service.import(dto, "reject")).rejects.toMatchObject({
            response: { code: VAULT_ERRORS.IMPORT_INVALID },
        })
        expect(prisma.$transaction).not.toHaveBeenCalled()
    })

    it("비밀번호가 참조하는 사이트가 백업에 없으면 IMPORT_INVALID", async () => {
        const { prisma } = makePrismaForImport({})
        const service = new BackupService(prisma as unknown as never)
        const dto = importDto({ secrets: [secretRow("s1", "ghost")] })
        await expect(service.import(dto, "reject")).rejects.toThrow(
            BadRequestException,
        )
    })
})

describe("BackupService.import 충돌 모드", () => {
    it("reject: 기존 id 와 충돌하면 IMPORT_CONFLICT", async () => {
        const { prisma } = makePrismaForImport({ sites: ["site1"] })
        const service = new BackupService(prisma as unknown as never)
        const dto = importDto({ sites: [siteRow("site1")] })
        await expect(service.import(dto, "reject")).rejects.toMatchObject({
            response: { code: VAULT_ERRORS.IMPORT_CONFLICT },
        })
    })

    it("skip: 충돌 행은 건너뛰고 신규만 생성한다", async () => {
        const { prisma, tx } = makePrismaForImport({ sites: ["site1"] })
        const service = new BackupService(prisma as unknown as never)
        const dto = importDto({ sites: [siteRow("site1"), siteRow("site2")] })
        const result = await service.import(dto, "skip" as ImportMode)
        expect(result.sites).toEqual({ created: 1, skipped: 1, replaced: 0 })
        expect(tx.site.createMany).toHaveBeenCalledTimes(1)
        expect(tx.site.createMany.mock.calls[0][0].data).toHaveLength(1)
        expect(tx.site.update).not.toHaveBeenCalled()
    })

    it("replace: 충돌 행은 덮어쓰고 신규는 생성한다", async () => {
        const { prisma, tx } = makePrismaForImport({ secrets: ["s1"] })
        const service = new BackupService(prisma as unknown as never)
        const dto = importDto({
            sites: [siteRow("site1")],
            secrets: [secretRow("s1", "site1"), secretRow("s2", "site1")],
        })
        const result = await service.import(dto, "replace" as ImportMode)
        expect(result.secrets).toEqual({ created: 1, skipped: 0, replaced: 1 })
        expect(tx.secret.update).toHaveBeenCalledTimes(1)
        expect(tx.secret.createMany).toHaveBeenCalledTimes(1)
        expect(tx.secret.createMany.mock.calls[0][0].data).toHaveLength(1)
    })

    it("신규 전부면 created 카운트만 증가한다", async () => {
        const { prisma, tx } = makePrismaForImport({})
        const service = new BackupService(prisma as unknown as never)
        const dto = importDto({
            sites: [siteRow("site1")],
            secrets: [secretRow("s1", "site1")],
        })
        const result = await service.import(dto, "reject")
        expect(result.sites.created).toBe(1)
        expect(result.secrets.created).toBe(1)
        // 신규 secret 은 암호문 블롭을 디코드해 저장한다.
        const data = tx.secret.createMany.mock.calls[0][0].data[0]
        expect(Buffer.from(data.iv)).toEqual(Buffer.alloc(12, 1))
    })
})
