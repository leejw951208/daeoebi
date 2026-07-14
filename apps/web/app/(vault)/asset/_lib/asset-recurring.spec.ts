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
import {
    formatDayOfMonth,
    formatTerm,
    materializeRecurring,
    parseTermMonths,
    sortRecurring,
    totalRecurring,
} from "./asset-recurring"
import type { RecurringView } from "@/lib/vault-client"
import type { ComputedRecurring } from "./asset-compute"

// 고정 지출 탭 행. 정렬·합계 테스트에 쓸 최소 데이터.
function row(
    over: Partial<ComputedRecurring> & { item: string },
): ComputedRecurring {
    return {
        id: over.item,
        amount: 1000,
        dayOfMonth: 1,
        termMonths: null,
        categoryId: null,
        ...over,
    }
}

describe("formatDayOfMonth", () => {
    it("결제일을 '매월 N일' 로 표기한다", () => {
        expect(formatDayOfMonth(15)).toBe("매월 15일")
        expect(formatDayOfMonth(1)).toBe("매월 1일")
    })
})

describe("formatTerm", () => {
    it("개월 수가 있으면 'N개월' 로 표기한다", () => {
        expect(formatTerm(6)).toBe("6개월")
        expect(formatTerm(1)).toBe("1개월")
    })

    it("개월 수가 없으면(null) '무기한' 으로 표기한다", () => {
        expect(formatTerm(null)).toBe("무기한")
    })
})

describe("totalRecurring", () => {
    it("금액을 합산한다", () => {
        expect(
            totalRecurring([
                row({ item: "월세", amount: 500_000 }),
                row({ item: "넷플릭스", amount: 17_000 }),
            ]),
        ).toBe(517_000)
    })

    it("빈 목록은 0 이다", () => {
        expect(totalRecurring([])).toBe(0)
    })
})

describe("sortRecurring", () => {
    it("결제일 오름차순으로 정렬한다", () => {
        const sorted = sortRecurring([
            row({ item: "월세", dayOfMonth: 25 }),
            row({ item: "넷플릭스", dayOfMonth: 15 }),
            row({ item: "통신비", dayOfMonth: 20 }),
        ])
        expect(sorted.map((r) => r.item)).toEqual([
            "넷플릭스",
            "통신비",
            "월세",
        ])
    })

    it("결제일이 같으면 지출명 사전순으로 정렬한다", () => {
        const sorted = sortRecurring([
            row({ item: "헬스장", dayOfMonth: 10 }),
            row({ item: "가스비", dayOfMonth: 10 }),
        ])
        expect(sorted.map((r) => r.item)).toEqual(["가스비", "헬스장"])
    })

    it("입력 배열을 변형하지 않는다", () => {
        const input = [
            row({ item: "월세", dayOfMonth: 25 }),
            row({ item: "넷플릭스", dayOfMonth: 15 }),
        ]
        sortRecurring(input)
        expect(input.map((r) => r.item)).toEqual(["월세", "넷플릭스"])
    })
})

describe("parseTermMonths", () => {
    it("빈 문자열은 무기한(null)이다", () => {
        expect(parseTermMonths("")).toBeNull()
    })

    it("1 이상 정수는 그대로 개월 수가 된다", () => {
        expect(parseTermMonths("1")).toBe(1)
        expect(parseTermMonths("12")).toBe(12)
    })

    it("0 이하·정수가 아닌 값은 무기한(null)이다", () => {
        expect(parseTermMonths("0")).toBeNull()
        expect(parseTermMonths("-3")).toBeNull()
        expect(parseTermMonths("abc")).toBeNull()
    })
})

const tmpl: RecurringView = {
    id: "r1",
    dayOfMonth: 10,
    startMonth: "2026-06",
    termMonths: null,
    active: true,
    iv: "AA",
    ciphertext: "BB",
    authTag: "CC",
    categoryId: null,
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
    categoryId: null,
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
