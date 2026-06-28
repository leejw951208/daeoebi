// IncomeService 단위 테스트(Prisma 모킹). 싱글톤 조회(null/블롭)·upsert 패스스루를 검증한다.
import { IncomeService } from "./income.service"
import { toBase64url } from "../auth/base64url"

function makePrisma() {
    return { income: { findUnique: jest.fn(), upsert: jest.fn() } }
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
    it("미설정이면 null 을 반환한다", async () => {
        const prisma = makePrisma()
        prisma.income.findUnique.mockResolvedValue(null)
        await expect(makeService(prisma).get()).resolves.toBeNull()
    })

    it("설정돼 있으면 암호문 블롭을 base64url 로 반환한다", async () => {
        const prisma = makePrisma()
        prisma.income.findUnique.mockResolvedValue({
            iv: IV,
            ciphertext: CT,
            authTag: TAG,
            updatedAt: new Date(0),
        })
        const out = await makeService(prisma).get()
        expect(out).toMatchObject({
            iv: toBase64url(IV),
            ciphertext: toBase64url(CT),
            authTag: toBase64url(TAG),
        })
    })

    it("upsert 는 싱글톤 id 로 디코드한 바이트를 저장한다", async () => {
        const prisma = makePrisma()
        prisma.income.upsert.mockResolvedValue({ updatedAt: new Date(0) })
        await makeService(prisma).upsert(B as never)
        const arg = prisma.income.upsert.mock.calls[0][0]
        expect(arg.where).toEqual({ id: "singleton" })
        expect(Buffer.from(arg.create.iv)).toEqual(IV)
        expect(Buffer.from(arg.update.ciphertext)).toEqual(CT)
    })
})
