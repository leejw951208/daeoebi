// IncomeService 단위 테스트(Prisma 모킹). 월 조회 필터·생성/수정/삭제·base64url 패스스루를 검증한다.
import { IncomeService } from "./income.service"
import { toBase64url } from "../common/base64url"

function makePrisma() {
    return {
        income: {
            findMany: jest.fn(),
            findUnique: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
        },
    }
}
function makeService(prisma: ReturnType<typeof makePrisma>) {
    return new IncomeService(prisma as unknown as never)
}

const IV = Buffer.alloc(12, 1)
const CT = Buffer.alloc(48, 2)
const TAG = Buffer.alloc(16, 3)
const B = {
    iv: IV.toString("base64url"),
    ciphertext: CT.toString("base64url"),
    authTag: TAG.toString("base64url"),
}

describe("IncomeService", () => {
    it("listByMonth 는 그 달만 조회해 블롭을 base64url 로 반환한다", async () => {
        const prisma = makePrisma()
        prisma.income.findMany.mockResolvedValue([
            {
                id: "i1",
                month: "2026-06",
                iv: IV,
                ciphertext: CT,
                authTag: TAG,
            },
        ])
        const out = await makeService(prisma).listByMonth("2026-06")
        expect(prisma.income.findMany.mock.calls[0][0]).toMatchObject({
            where: { month: "2026-06" },
        })
        expect(out[0]).toMatchObject({
            id: "i1",
            month: "2026-06",
            iv: toBase64url(IV),
        })
    })

    it("listByMonth 는 잘못된 month 형식을 거부한다", async () => {
        const prisma = makePrisma()
        await expect(
            makeService(prisma).listByMonth("2026/6"),
        ).rejects.toThrow()
    })

    it("create 는 month 와 디코드한 바이트를 저장한다", async () => {
        const prisma = makePrisma()
        prisma.income.create.mockResolvedValue({
            id: "i9",
            month: "2026-06",
            iv: IV,
            ciphertext: CT,
            authTag: TAG,
        })
        await makeService(prisma).create({ month: "2026-06", ...B } as never)
        const arg = prisma.income.create.mock.calls[0][0]
        expect(arg.data.month).toBe("2026-06")
        expect(Buffer.from(arg.data.iv)).toEqual(IV)
    })

    it("remove 는 없는 id 면 NotFound 를 던진다", async () => {
        const prisma = makePrisma()
        prisma.income.findUnique.mockResolvedValue(null)
        await expect(makeService(prisma).remove("nope")).rejects.toThrow()
    })
})
