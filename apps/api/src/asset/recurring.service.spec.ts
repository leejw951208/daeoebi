// RecurringService 단위 테스트(Prisma 모킹). 활성 템플릿 조회·생성·수정·삭제와 not-found 를 검증한다.
import { NotFoundException } from "@nestjs/common"
import { RecurringService } from "./recurring.service"
import { ASSET_ERRORS } from "./asset.types"

function makePrisma() {
    return {
        recurringExpense: {
            findMany: jest.fn(),
            findUnique: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
        },
    }
}
function makeService(prisma: ReturnType<typeof makePrisma>) {
    return new RecurringService(prisma as unknown as never)
}

const IV = Buffer.alloc(12, 1)
const CT = Buffer.alloc(48, 2)
const TAG = Buffer.alloc(16, 3)
const blob = {
    iv: IV.toString("base64url"),
    ciphertext: CT.toString("base64url"),
    authTag: TAG.toString("base64url"),
}
const row = {
    id: "r1",
    dayOfMonth: 25,
    active: true,
    iv: IV,
    ciphertext: CT,
    authTag: TAG,
}

describe("RecurringService", () => {
    it("listActive 는 active=true 만 조회한다", async () => {
        const prisma = makePrisma()
        prisma.recurringExpense.findMany.mockResolvedValue([row])
        const out = await makeService(prisma).listActive()
        expect(prisma.recurringExpense.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { active: true } }),
        )
        expect(out[0]).toMatchObject({ id: "r1", dayOfMonth: 25, active: true })
    })

    it("create 는 dayOfMonth + 디코드한 블롭으로 생성한다", async () => {
        const prisma = makePrisma()
        prisma.recurringExpense.create.mockResolvedValue(row)
        await makeService(prisma).create({ dayOfMonth: 25, ...blob } as never)
        const data = prisma.recurringExpense.create.mock.calls[0][0].data
        expect(data.dayOfMonth).toBe(25)
        expect(Buffer.from(data.iv)).toEqual(IV)
    })

    it("update 는 없으면 RECURRING_NOT_FOUND(update 가 P2025 로 거부)", async () => {
        const prisma = makePrisma()
        prisma.recurringExpense.update.mockRejectedValue({ code: "P2025" })
        await expect(
            makeService(prisma).update("x", { active: false } as never),
        ).rejects.toMatchObject({
            response: { code: ASSET_ERRORS.RECURRING_NOT_FOUND },
        })
    })

    it("update 는 active 만 부분 갱신한다", async () => {
        const prisma = makePrisma()
        prisma.recurringExpense.update.mockResolvedValue({
            ...row,
            active: false,
        })
        await makeService(prisma).update("r1", { active: false } as never)
        const data = prisma.recurringExpense.update.mock.calls[0][0].data
        expect(data).toEqual({ active: false })
    })

    // 암호문을 일부만 갈아끼우면 AES-GCM 인증이 깨져 아무도 못 여는 블롭이 된다(복구 불가).
    it("암호문 일부만 보내면 CIPHERTEXT_INCOMPLETE_ASSET", async () => {
        const prisma = makePrisma()
        await expect(
            makeService(prisma).update("r1", {
                ciphertext: blob.ciphertext,
            } as never),
        ).rejects.toMatchObject({
            response: { code: ASSET_ERRORS.CIPHERTEXT_INCOMPLETE_ASSET },
        })
        expect(prisma.recurringExpense.update).not.toHaveBeenCalled()
    })

    it("암호문 세 필드를 모두 보내면 갱신한다", async () => {
        const prisma = makePrisma()
        prisma.recurringExpense.update.mockResolvedValue(row)
        await makeService(prisma).update("r1", { ...blob } as never)
        const data = prisma.recurringExpense.update.mock.calls[0][0].data
        expect(Object.keys(data).sort()).toEqual([
            "authTag",
            "ciphertext",
            "iv",
        ])
    })

    it("create 는 startMonth 를 저장하고 뷰에 포함한다", async () => {
        const prisma = makePrisma()
        prisma.recurringExpense.create.mockResolvedValue({
            id: "r1",
            dayOfMonth: 25,
            startMonth: "2026-06",
            active: true,
            iv: IV,
            ciphertext: CT,
            authTag: TAG,
        })
        const out = await makeService(prisma).create({
            dayOfMonth: 25,
            startMonth: "2026-06",
            ...blob,
        } as never)
        expect(
            prisma.recurringExpense.create.mock.calls[0][0].data.startMonth,
        ).toBe("2026-06")
        expect(out).toMatchObject({ startMonth: "2026-06" })
    })

    it("create 는 termMonths 를 저장하고(없으면 null) 뷰에 포함한다", async () => {
        const prisma = makePrisma()
        prisma.recurringExpense.create.mockResolvedValue({
            id: "r1",
            dayOfMonth: 25,
            startMonth: "2026-06",
            termMonths: 3,
            active: true,
            iv: IV,
            ciphertext: CT,
            authTag: TAG,
        })
        const out = await makeService(prisma).create({
            dayOfMonth: 25,
            startMonth: "2026-06",
            termMonths: 3,
            ...blob,
        } as never)
        expect(
            prisma.recurringExpense.create.mock.calls[0][0].data.termMonths,
        ).toBe(3)
        expect(out).toMatchObject({ termMonths: 3 })

        const prisma2 = makePrisma()
        prisma2.recurringExpense.create.mockResolvedValue({
            id: "r2",
            dayOfMonth: 1,
            startMonth: "2026-06",
            termMonths: null,
            active: true,
            iv: IV,
            ciphertext: CT,
            authTag: TAG,
        })
        await makeService(prisma2).create({
            dayOfMonth: 1,
            startMonth: "2026-06",
            ...blob,
        } as never)
        expect(
            prisma2.recurringExpense.create.mock.calls[0][0].data.termMonths,
        ).toBeNull()
    })

    it("create 는 categoryId 를 저장하고(없으면 null) 뷰에 포함한다", async () => {
        const prisma = makePrisma()
        prisma.recurringExpense.create.mockResolvedValue({
            id: "r1",
            dayOfMonth: 25,
            startMonth: "2026-06",
            termMonths: null,
            categoryId: "c1",
            active: true,
            iv: IV,
            ciphertext: CT,
            authTag: TAG,
        })
        const out = await makeService(prisma).create({
            dayOfMonth: 25,
            startMonth: "2026-06",
            categoryId: "c1",
            ...blob,
        } as never)
        expect(
            prisma.recurringExpense.create.mock.calls[0][0].data.categoryId,
        ).toBe("c1")
        expect(out).toMatchObject({ categoryId: "c1" })

        const prisma2 = makePrisma()
        prisma2.recurringExpense.create.mockResolvedValue({
            id: "r2",
            dayOfMonth: 1,
            startMonth: "2026-06",
            termMonths: null,
            categoryId: null,
            active: true,
            iv: IV,
            ciphertext: CT,
            authTag: TAG,
        })
        await makeService(prisma2).create({
            dayOfMonth: 1,
            startMonth: "2026-06",
            ...blob,
        } as never)
        expect(
            prisma2.recurringExpense.create.mock.calls[0][0].data.categoryId,
        ).toBeNull()
    })

    it("update 는 termMonths 를 갱신하고 null 이면 무기한으로 되돌린다", async () => {
        const prisma = makePrisma()
        prisma.recurringExpense.update.mockResolvedValue({
            ...row,
            termMonths: 6,
        })
        await makeService(prisma).update("r1", { termMonths: 6 } as never)
        expect(prisma.recurringExpense.update.mock.calls[0][0].data).toEqual({
            termMonths: 6,
        })

        const prisma2 = makePrisma()
        prisma2.recurringExpense.update.mockResolvedValue({
            ...row,
            termMonths: null,
        })
        await makeService(prisma2).update("r1", { termMonths: null } as never)
        expect(prisma2.recurringExpense.update.mock.calls[0][0].data).toEqual({
            termMonths: null,
        })
    })

    it("update 는 블롭·카테고리·dayOfMonth 를 함께 갱신한다(앞으로만 반영)", async () => {
        const prisma = makePrisma()
        prisma.recurringExpense.update.mockResolvedValue(row)
        await makeService(prisma).update("r1", {
            dayOfMonth: 10,
            categoryId: "c2",
            ...blob,
        } as never)
        const data = prisma.recurringExpense.update.mock.calls[0][0].data
        expect(data.dayOfMonth).toBe(10)
        expect(data.categoryId).toBe("c2")
        expect(Buffer.from(data.ciphertext)).toEqual(CT)
    })

    it("create 는 method 를 저장하고(없으면 null) 뷰에 포함한다", async () => {
        const prisma = makePrisma()
        prisma.recurringExpense.create.mockResolvedValue({
            ...row,
            method: "삼성카드",
        })
        const out = await makeService(prisma).create({
            dayOfMonth: 25,
            startMonth: "2026-06",
            method: "삼성카드",
            ...blob,
        } as never)
        expect(
            prisma.recurringExpense.create.mock.calls[0][0].data.method,
        ).toBe("삼성카드")
        expect(out).toMatchObject({ method: "삼성카드" })

        const prisma2 = makePrisma()
        prisma2.recurringExpense.create.mockResolvedValue({
            ...row,
            method: null,
        })
        await makeService(prisma2).create({
            dayOfMonth: 1,
            startMonth: "2026-06",
            ...blob,
        } as never)
        expect(
            prisma2.recurringExpense.create.mock.calls[0][0].data.method,
        ).toBeNull()
    })

    it("update 는 method 만 부분 갱신한다(블롭·타 컬럼 무변경)", async () => {
        const prisma = makePrisma()
        prisma.recurringExpense.update.mockResolvedValue({
            ...row,
            method: "현금",
        })
        const out = await makeService(prisma).update("r1", {
            method: "현금",
        } as never)
        expect(prisma.recurringExpense.update.mock.calls[0][0].data).toEqual({
            method: "현금",
        })
        expect(out).toMatchObject({ method: "현금" })
    })

    it("remove 는 없으면 404(delete 가 P2025 로 거부), 있으면 삭제", async () => {
        const prisma = makePrisma()
        prisma.recurringExpense.delete.mockRejectedValueOnce({ code: "P2025" })
        await expect(makeService(prisma).remove("x")).rejects.toThrow(
            NotFoundException,
        )
        prisma.recurringExpense.delete.mockResolvedValueOnce(undefined)
        await makeService(prisma).remove("r1")
        expect(prisma.recurringExpense.delete).toHaveBeenCalledWith({
            where: { id: "r1" },
        })
    })
})
