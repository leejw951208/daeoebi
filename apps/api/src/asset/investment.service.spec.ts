import { InvestmentService } from "./investment.service"

function makePrisma() {
    return {
        investmentPosition: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn(),
            update: jest.fn(),
        },
    }
}
const dto = { returnRate: "3.5", iv: "aa", ciphertext: "bb", authTag: "cc" }

describe("InvestmentService", () => {
    it("get 은 행이 없으면 null", async () => {
        const svc = new InvestmentService(makePrisma() as never)
        expect(await svc.get()).toBeNull()
    })

    it("get 은 행이 있으면 view 를 반환한다", async () => {
        const p = makePrisma()
        p.investmentPosition.findFirst.mockResolvedValue({
            id: "1",
            returnRate: "3.5",
            iv: new Uint8Array([1]),
            ciphertext: new Uint8Array([2]),
            authTag: new Uint8Array([3]),
        })
        const svc = new InvestmentService(p as never)
        const v = await svc.get()
        expect(v).toMatchObject({ id: "1", returnRate: "3.5" })
        expect(typeof v!.iv).toBe("string")
    })

    it("upsert 는 행이 없으면 create", async () => {
        const p = makePrisma()
        p.investmentPosition.create.mockResolvedValue({
            id: "9",
            returnRate: "3.5",
            iv: new Uint8Array([1]),
            ciphertext: new Uint8Array([2]),
            authTag: new Uint8Array([3]),
        })
        const svc = new InvestmentService(p as never)
        await svc.upsert(dto)
        expect(p.investmentPosition.create).toHaveBeenCalledTimes(1)
        expect(p.investmentPosition.update).not.toHaveBeenCalled()
    })

    it("upsert 는 행이 있으면 update(싱글톤)", async () => {
        const p = makePrisma()
        p.investmentPosition.findFirst.mockResolvedValue({ id: "1" })
        p.investmentPosition.update.mockResolvedValue({
            id: "1",
            returnRate: "3.5",
            iv: new Uint8Array([1]),
            ciphertext: new Uint8Array([2]),
            authTag: new Uint8Array([3]),
        })
        const svc = new InvestmentService(p as never)
        await svc.upsert(dto)
        expect(p.investmentPosition.update).toHaveBeenCalledWith(
            expect.objectContaining({ where: { id: "1" } }),
        )
        expect(p.investmentPosition.create).not.toHaveBeenCalled()
    })
})
