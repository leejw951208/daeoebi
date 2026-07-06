import { SavingsGoalService } from "./savings-goal.service"

function makePrisma() {
    return {
        savingsGoal: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn(),
            update: jest.fn(),
        },
    }
}
const dto = { name: "비상금", iv: "aa", ciphertext: "bb", authTag: "cc" }

describe("SavingsGoalService", () => {
    it("get 은 행이 없으면 null", async () => {
        const svc = new SavingsGoalService(makePrisma() as never)
        expect(await svc.get()).toBeNull()
    })

    it("get 은 행이 있으면 view 를 반환한다", async () => {
        const p = makePrisma()
        p.savingsGoal.findFirst.mockResolvedValue({
            id: "1",
            name: "비상금",
            iv: new Uint8Array([1]),
            ciphertext: new Uint8Array([2]),
            authTag: new Uint8Array([3]),
        })
        const svc = new SavingsGoalService(p as never)
        const v = await svc.get()
        expect(v).toMatchObject({ id: "1", name: "비상금" })
        expect(typeof v!.iv).toBe("string")
    })

    it("upsert 는 행이 없으면 create", async () => {
        const p = makePrisma()
        p.savingsGoal.create.mockResolvedValue({
            id: "9",
            name: "비상금",
            iv: new Uint8Array([1]),
            ciphertext: new Uint8Array([2]),
            authTag: new Uint8Array([3]),
        })
        const svc = new SavingsGoalService(p as never)
        await svc.upsert(dto)
        expect(p.savingsGoal.create).toHaveBeenCalledTimes(1)
        expect(p.savingsGoal.update).not.toHaveBeenCalled()
    })

    it("upsert 는 행이 있으면 update(싱글톤)", async () => {
        const p = makePrisma()
        p.savingsGoal.findFirst.mockResolvedValue({ id: "1" })
        p.savingsGoal.update.mockResolvedValue({
            id: "1",
            name: "비상금",
            iv: new Uint8Array([1]),
            ciphertext: new Uint8Array([2]),
            authTag: new Uint8Array([3]),
        })
        const svc = new SavingsGoalService(p as never)
        await svc.upsert(dto)
        expect(p.savingsGoal.update).toHaveBeenCalledWith(
            expect.objectContaining({ where: { id: "1" } }),
        )
        expect(p.savingsGoal.create).not.toHaveBeenCalled()
    })
})
