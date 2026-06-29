// ExpenseService 단위 테스트(Prisma 모킹). 월 범위 조회·암호문 패스스루·고정 중복(P2002)·
// 부분 암호문 거부·not-found 경로를 검증한다.
import { NotFoundException } from "@nestjs/common"
import { ExpenseService } from "./expense.service"
import { ASSET_ERRORS } from "./asset.types"

function makePrisma() {
    return {
        expense: {
            findMany: jest.fn(),
            findUnique: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
        },
    }
}
function makeService(prisma: ReturnType<typeof makePrisma>) {
    return new ExpenseService(prisma as unknown as never)
}

const IV = Buffer.alloc(12, 1)
const CT = Buffer.alloc(48, 2)
const TAG = Buffer.alloc(16, 3)
const blob = {
    iv: IV.toString("base64url"),
    ciphertext: CT.toString("base64url"),
    authTag: TAG.toString("base64url"),
}
function row(over: Record<string, unknown> = {}) {
    return {
        id: "e1",
        date: new Date("2026-06-27"),
        recurringId: null,
        period: null,
        iv: IV,
        ciphertext: CT,
        authTag: TAG,
        ...over,
    }
}

describe("ExpenseService.listByMonth", () => {
    it("잘못된 month 형식은 INVALID_MONTH", async () => {
        const prisma = makePrisma()
        await expect(makeService(prisma).listByMonth("2026/6")).rejects.toMatchObject(
            { response: { code: ASSET_ERRORS.INVALID_MONTH } },
        )
    })

    it("해당 월 범위[start, nextMonth)로 조회하고 view 로 매핑한다", async () => {
        const prisma = makePrisma()
        prisma.expense.findMany.mockResolvedValue([row()])
        const out = await makeService(prisma).listByMonth("2026-06")
        const where = prisma.expense.findMany.mock.calls[0][0].where
        expect(where.date.gte).toEqual(new Date(Date.UTC(2026, 5, 1)))
        expect(where.date.lt).toEqual(new Date(Date.UTC(2026, 6, 1)))
        expect(out[0]).toMatchObject({
            id: "e1",
            date: "2026-06-27",
            iv: blob.iv,
            ciphertext: blob.ciphertext,
            authTag: blob.authTag,
        })
    })
})

describe("ExpenseService.create", () => {
    it("암호문 블롭을 디코드해 저장하고 view 를 반환한다", async () => {
        const prisma = makePrisma()
        prisma.expense.create.mockResolvedValue(row())
        await makeService(prisma).create({ date: "2026-06-27", ...blob } as never)
        const data = prisma.expense.create.mock.calls[0][0].data
        expect(Buffer.from(data.iv)).toEqual(IV)
        expect(data.recurringId).toBeNull()
    })

    it("고정 인스턴스 중복(P2002)은 EXPENSE_DUPLICATE 로 변환한다", async () => {
        const prisma = makePrisma()
        prisma.expense.create.mockRejectedValue({ code: "P2002" })
        await expect(
            makeService(prisma).create({
                date: "2026-06-27",
                recurringId: "r1",
                period: "2026-06",
                ...blob,
            } as never),
        ).rejects.toMatchObject({ response: { code: ASSET_ERRORS.EXPENSE_DUPLICATE } })
    })
})

describe("ExpenseService.update", () => {
    it("없으면 EXPENSE_NOT_FOUND", async () => {
        const prisma = makePrisma()
        prisma.expense.findUnique.mockResolvedValue(null)
        await expect(
            makeService(prisma).update("x", { date: "2026-06-01" } as never),
        ).rejects.toThrow(NotFoundException)
    })

    it("암호문 일부만 보내면 CIPHERTEXT_INCOMPLETE_ASSET", async () => {
        const prisma = makePrisma()
        prisma.expense.findUnique.mockResolvedValue({ id: "e1" })
        await expect(
            makeService(prisma).update("e1", { iv: blob.iv } as never),
        ).rejects.toMatchObject({
            response: { code: ASSET_ERRORS.CIPHERTEXT_INCOMPLETE_ASSET },
        })
    })

    it("날짜만 갱신하면 본문은 건드리지 않는다", async () => {
        const prisma = makePrisma()
        prisma.expense.findUnique.mockResolvedValue({ id: "e1" })
        prisma.expense.update.mockResolvedValue(row({ date: new Date("2026-06-01") }))
        await makeService(prisma).update("e1", { date: "2026-06-01" } as never)
        const data = prisma.expense.update.mock.calls[0][0].data
        expect(Object.keys(data)).toEqual(["date"])
    })
})

describe("ExpenseService.remove", () => {
    it("없으면 404, 있으면 삭제", async () => {
        const prisma = makePrisma()
        prisma.expense.findUnique.mockResolvedValueOnce(null)
        await expect(makeService(prisma).remove("x")).rejects.toThrow(
            NotFoundException,
        )
        prisma.expense.findUnique.mockResolvedValueOnce({ id: "e1" })
        prisma.expense.delete.mockResolvedValue(row())
        await makeService(prisma).remove("e1")
        expect(prisma.expense.delete).toHaveBeenCalledWith({ where: { id: "e1" } })
    })
})
