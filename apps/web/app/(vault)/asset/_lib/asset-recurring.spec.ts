// materializeRecurring 의 시작월 경계 테스트.
const mockCreateExpense = jest.fn()
jest.mock("@/lib/vault-client", () => ({
    __esModule: true,
    createExpense: (...a: unknown[]) => mockCreateExpense(...a),
}))
jest.mock("@/lib/api-error", () => ({
    __esModule: true,
    isApiError: () => false,
}))
jest.mock("./asset-payload", () => ({
    __esModule: true,
    openExpense: jest
        .fn()
        .mockResolvedValue({
            item: "x",
            amount: 1,
            category: "기타",
            method: "현금",
        }),
    sealExpense: jest
        .fn()
        .mockResolvedValue({ iv: "AA", ciphertext: "BB", authTag: "CC" }),
}))
import { materializeRecurring } from "./asset-recurring"
import type { RecurringView } from "@/lib/vault-client"

const tmpl: RecurringView = {
    id: "r1",
    dayOfMonth: 10,
    startMonth: "2026-06",
    active: true,
    iv: "AA",
    ciphertext: "BB",
    authTag: "CC",
}
const key = {} as CryptoKey

beforeEach(() => mockCreateExpense.mockReset())

it("startMonth 이전 달은 생성하지 않는다", async () => {
    mockCreateExpense.mockResolvedValue({ id: "i" })
    await materializeRecurring(key, "2026-05", [tmpl], [])
    expect(mockCreateExpense).not.toHaveBeenCalled()
})

it("startMonth 이후 달은 생성한다", async () => {
    mockCreateExpense.mockResolvedValue({ id: "i" })
    await materializeRecurring(key, "2026-06", [tmpl], [])
    expect(mockCreateExpense).toHaveBeenCalledTimes(1)
})
