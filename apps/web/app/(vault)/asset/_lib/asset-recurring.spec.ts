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
    openExpense: jest.fn().mockResolvedValue({
        item: "x",
        amount: 1,
        category: "기타",
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
    termMonths: null,
    active: true,
    iv: "AA",
    ciphertext: "BB",
    authTag: "CC",
}
const termTmpl: RecurringView = {
    id: "r2",
    dayOfMonth: 10,
    startMonth: "2026-06",
    termMonths: 3,
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

it("startMonth 이상 달은 생성한다", async () => {
    mockCreateExpense.mockResolvedValue({ id: "i" })
    await materializeRecurring(key, "2026-06", [tmpl], [])
    expect(mockCreateExpense).toHaveBeenCalledTimes(1)
})

it("termMonths 무기한(null)이면 먼 미래도 생성한다", async () => {
    mockCreateExpense.mockResolvedValue({ id: "i" })
    await materializeRecurring(key, "2030-01", [tmpl], [])
    expect(mockCreateExpense).toHaveBeenCalledTimes(1)
})

it("종료월(startMonth+termMonths-1)까지는 생성한다", async () => {
    mockCreateExpense.mockResolvedValue({ id: "i" })
    await materializeRecurring(key, "2026-08", [termTmpl], []) // 6·7·8 → 8월=종료월
    expect(mockCreateExpense).toHaveBeenCalledTimes(1)
})

it("종료월 다음 달은 생성하지 않는다", async () => {
    mockCreateExpense.mockResolvedValue({ id: "i" })
    await materializeRecurring(key, "2026-09", [termTmpl], []) // 9월 = 종료월+1
    expect(mockCreateExpense).not.toHaveBeenCalled()
})
