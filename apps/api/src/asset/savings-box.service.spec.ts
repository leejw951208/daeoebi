// SavingsBoxService 단위 테스트(Prisma 모킹). 목록 정렬(date desc)·생성 인자·삭제 404 를 검증한다.
import { NotFoundException } from "@nestjs/common"
import { SavingsBoxService } from "./savings-box.service"
import { toBase64url } from "../common/base64url"
import { ASSET_ERRORS } from "./asset.types"

function makePrisma() {
    return {
        savingsBoxTxn: {
            findMany: jest.fn(),
            create: jest.fn(),
            delete: jest.fn(),
        },
    }
}
function makeService(prisma: ReturnType<typeof makePrisma>) {
    return new SavingsBoxService(prisma as unknown as never)
}

const IV = Buffer.alloc(12, 1)
const CT = Buffer.alloc(48, 2)
const TAG = Buffer.alloc(16, 3)
const B = {
    iv: IV.toString("base64url"),
    ciphertext: CT.toString("base64url"),
    authTag: TAG.toString("base64url"),
}

describe("SavingsBoxService", () => {
    it("list 는 date desc 로 정렬해 블롭을 base64url 로 반환한다", async () => {
        const prisma = makePrisma()
        prisma.savingsBoxTxn.findMany.mockResolvedValue([
            {
                id: "s1",
                type: "in",
                source: "cash",
                date: "2026-07-01",
                iv: IV,
                ciphertext: CT,
                authTag: TAG,
            },
        ])
        const out = await makeService(prisma).list()
        expect(prisma.savingsBoxTxn.findMany.mock.calls[0][0]).toMatchObject({
            orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        })
        expect(out[0]).toMatchObject({
            id: "s1",
            type: "in",
            source: "cash",
            date: "2026-07-01",
            iv: toBase64url(IV),
        })
    })

    it("create 는 type·source·date 와 디코드한 바이트를 저장한다", async () => {
        const prisma = makePrisma()
        prisma.savingsBoxTxn.create.mockResolvedValue({
            id: "s9",
            type: "out",
            source: "savings",
            date: "2026-07-06",
            iv: IV,
            ciphertext: CT,
            authTag: TAG,
        })
        await makeService(prisma).create({
            type: "out",
            source: "savings",
            date: "2026-07-06",
            ...B,
        } as never)
        const arg = prisma.savingsBoxTxn.create.mock.calls[0][0]
        expect(arg.data.type).toBe("out")
        expect(arg.data.source).toBe("savings")
        expect(arg.data.date).toBe("2026-07-06")
        expect(Buffer.from(arg.data.iv)).toEqual(IV)
    })

    it("remove 는 없는 id 면 SAVINGS_BOX_NOT_FOUND 를 던진다(delete 가 P2025 로 거부)", async () => {
        const prisma = makePrisma()
        prisma.savingsBoxTxn.delete.mockRejectedValue({ code: "P2025" })
        await expect(makeService(prisma).remove("nope")).rejects.toThrow(
            NotFoundException,
        )
        prisma.savingsBoxTxn.delete.mockRejectedValue({ code: "P2025" })
        await expect(makeService(prisma).remove("nope")).rejects.toMatchObject({
            response: { code: ASSET_ERRORS.SAVINGS_BOX_NOT_FOUND },
        })
    })
})
