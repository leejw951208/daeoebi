// materializeRecurring 의 시작월·현재월 경계 + propagateRecurringUpdate 의 이후 달 전파·정리 테스트.
const mockCreateExpense = jest.fn()
const mockUpdateExpense = jest.fn()
const mockDeleteExpense = jest.fn()
const mockListRecurringInstances = jest.fn()
jest.mock("@/lib/vault-client", () => ({
    __esModule: true,
    createExpense: (...a: unknown[]) => mockCreateExpense(...a),
    updateExpense: (...a: unknown[]) => mockUpdateExpense(...a),
    deleteExpense: (...a: unknown[]) => mockDeleteExpense(...a),
    listRecurringInstances: (...a: unknown[]) =>
        mockListRecurringInstances(...a),
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
    endMonthOf,
    formatDayOfMonth,
    formatTerm,
    materializeRecurring,
    parseTermMonths,
    propagateRecurringUpdate,
    propagationPivot,
    recurringInMonth,
    removeRecurringFuture,
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
        startMonth: "2026-01",
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

describe("endMonthOf", () => {
    it("무기한(null)은 종료월이 없다", () => {
        expect(endMonthOf("2026-06", null)).toBeNull()
    })

    it("N개월은 시작월을 포함해 센다", () => {
        expect(endMonthOf("2026-06", 3)).toBe("2026-08")
        expect(endMonthOf("2026-06", 1)).toBe("2026-06")
    })

    it("해를 넘겨도 정확하다", () => {
        expect(endMonthOf("2026-11", 4)).toBe("2027-02")
    })
})

describe("propagationPivot", () => {
    it("미래 달을 편집하면 그 달이 기준이다", () => {
        expect(propagationPivot("2026-09", "2026-07")).toBe("2026-09")
    })

    it("과거 달을 편집하면 현재 달이 기준이다(지나간 기록 보호)", () => {
        expect(propagationPivot("2026-03", "2026-07")).toBe("2026-07")
    })

    it("현재 달을 편집하면 현재 달이 기준이다", () => {
        expect(propagationPivot("2026-07", "2026-07")).toBe("2026-07")
    })
})

describe("recurringInMonth", () => {
    const rows = [
        row({ item: "월세", startMonth: "2026-01", termMonths: null }),
        row({ item: "할부", startMonth: "2026-01", termMonths: 3 }), // 1·2·3월
        row({ item: "예정", startMonth: "2026-09", termMonths: null }),
    ]

    it("무기한 템플릿은 시작월 이후 계속 나온다", () => {
        expect(recurringInMonth(rows, "2026-07").map((r) => r.item)).toEqual([
            "월세",
        ])
    })

    it("기간이 끝난 템플릿은 제외한다", () => {
        expect(recurringInMonth(rows, "2026-03").map((r) => r.item)).toEqual([
            "월세",
            "할부",
        ])
        expect(recurringInMonth(rows, "2026-04").map((r) => r.item)).toEqual([
            "월세",
        ])
    })

    it("아직 시작 전인 템플릿은 제외한다", () => {
        expect(recurringInMonth(rows, "2026-09").map((r) => r.item)).toEqual([
            "월세",
            "예정",
        ])
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
const NOW = "2030-12" // 대부분의 테스트는 현재월 상한에 걸리지 않게 충분히 미래로 둔다.

describe("materializeRecurring", () => {
    beforeEach(() => {
        mockCreateExpense.mockReset()
        mockCreateExpense.mockResolvedValue({ id: "i" })
    })

    it("startMonth 이전 달은 생성하지 않는다", async () => {
        await materializeRecurring(key, "2026-05", [tmpl], [], NOW)
        expect(mockCreateExpense).not.toHaveBeenCalled()
    })

    it("startMonth 이상 달은 생성한다", async () => {
        await materializeRecurring(key, "2026-06", [tmpl], [], NOW)
        expect(mockCreateExpense).toHaveBeenCalledTimes(1)
    })

    it("termMonths 무기한(null)이면 현재월까지 계속 생성한다", async () => {
        await materializeRecurring(key, "2030-01", [tmpl], [], NOW)
        expect(mockCreateExpense).toHaveBeenCalledTimes(1)
    })

    it("종료월(startMonth+termMonths-1)까지는 생성한다", async () => {
        await materializeRecurring(key, "2026-08", [termTmpl], [], NOW) // 6·7·8 → 8월=종료월
        expect(mockCreateExpense).toHaveBeenCalledTimes(1)
    })

    it("종료월 다음 달은 생성하지 않는다", async () => {
        await materializeRecurring(key, "2026-09", [termTmpl], [], NOW) // 9월 = 종료월+1
        expect(mockCreateExpense).not.toHaveBeenCalled()
    })

    // 미래 달을 열어보기만 해도 인스턴스가 박히면 저축·투자 누적이 부풀려진다.
    it("현재 달보다 미래인 달은 열어봐도 생성하지 않는다", async () => {
        await materializeRecurring(key, "2026-08", [tmpl], [], "2026-07")
        expect(mockCreateExpense).not.toHaveBeenCalled()
    })

    it("현재 달은 생성한다(경계 포함)", async () => {
        await materializeRecurring(key, "2026-07", [tmpl], [], "2026-07")
        expect(mockCreateExpense).toHaveBeenCalledTimes(1)
    })

    it("이미 인스턴스가 있는 달은 생성하지 않는다", async () => {
        await materializeRecurring(
            key,
            "2026-07",
            [tmpl],
            [{ recurringId: "r1", period: "2026-07" }],
            NOW,
        )
        expect(mockCreateExpense).not.toHaveBeenCalled()
    })

    // "이번 달만 삭제"한 슬롯은 목록엔 없지만 unique 키를 잡고 있다. 없는 줄 알고 만들면 409 다.
    it("소프트 삭제된 슬롯도 점유로 보고 재생성하지 않는다", async () => {
        await materializeRecurring(
            key,
            "2026-07",
            [tmpl],
            [{ recurringId: "r1", period: "2026-07" }], // removed=true 라 월 목록엔 없다
            NOW,
        )
        expect(mockCreateExpense).not.toHaveBeenCalled()
    })
})

// 사용자 재현 경로: 9월을 미리 열어 인스턴스가 생성된 뒤, 8월에서 카테고리를 바꾼다.
describe("propagateRecurringUpdate", () => {
    const ref = {
        id: "r1",
        dayOfMonth: 10,
        categoryId: "cat-new" as string | null,
        startMonth: "2026-06",
        termMonths: null as number | null,
    }

    beforeEach(() => {
        mockUpdateExpense.mockReset()
        mockDeleteExpense.mockReset()
        mockListRecurringInstances.mockReset()
        mockUpdateExpense.mockResolvedValue({ id: "e" })
        mockDeleteExpense.mockResolvedValue(undefined)
    })

    it("이미 만들어진 이후 달 인스턴스를 새 내용·카테고리로 갱신한다", async () => {
        mockListRecurringInstances.mockResolvedValue([
            { id: "e9", period: "2026-09" },
            { id: "e10", period: "2026-10" },
        ])

        await propagateRecurringUpdate(
            key,
            ref,
            "2026-08",
            { item: "넷플릭스", amount: 17_000 },
            "2026-08",
        )

        expect(mockListRecurringInstances).toHaveBeenCalledWith("r1", "2026-08")
        expect(mockUpdateExpense).toHaveBeenCalledTimes(2)
        expect(mockUpdateExpense).toHaveBeenCalledWith("e9", {
            date: "2026-09-10",
            categoryId: "cat-new",
            iv: "AA",
            ciphertext: "BB",
            authTag: "CC",
        })
        expect(mockUpdateExpense).toHaveBeenCalledWith("e10", {
            date: "2026-10-10",
            categoryId: "cat-new",
            iv: "AA",
            ciphertext: "BB",
            authTag: "CC",
        })
    })

    // 과거 달을 고칠 때 그 사이 달들의 확정 기록까지 덮어쓰면 안 된다.
    it("과거 달을 편집하면 현재 달 기준으로만 전파한다", async () => {
        mockListRecurringInstances.mockResolvedValue([])

        await propagateRecurringUpdate(
            key,
            ref,
            "2026-06", // 과거 달 편집
            { item: "월세", amount: 550_000 },
            "2026-09", // 오늘은 9월
        )

        expect(mockListRecurringInstances).toHaveBeenCalledWith("r1", "2026-09")
    })

    it("결제일이 그 달 말일을 넘으면 말일로 클램프한다", async () => {
        mockListRecurringInstances.mockResolvedValue([
            { id: "e2", period: "2027-02" },
        ])

        await propagateRecurringUpdate(
            key,
            { ...ref, dayOfMonth: 31, categoryId: null },
            "2027-01",
            { item: "월세", amount: 500_000 },
            "2027-01",
        )

        expect(mockUpdateExpense).toHaveBeenCalledWith(
            "e2",
            expect.objectContaining({ date: "2027-02-28" }),
        )
    })

    // 개월 수를 줄이면 기간 밖으로 밀려난 미래 인스턴스는 되살리지 말고 지워야 한다.
    it("개월 수를 줄이면 종료월 이후 인스턴스를 삭제한다", async () => {
        mockListRecurringInstances.mockResolvedValue([
            { id: "e7", period: "2026-07" },
            { id: "e8", period: "2026-08" },
            { id: "e9", period: "2026-09" },
        ])

        await propagateRecurringUpdate(
            key,
            { ...ref, startMonth: "2026-06", termMonths: 2 }, // 6·7월까지
            "2026-06",
            { item: "헬스장", amount: 50_000 },
            "2026-06",
        )

        expect(mockUpdateExpense).toHaveBeenCalledTimes(1)
        expect(mockUpdateExpense).toHaveBeenCalledWith(
            "e7",
            expect.objectContaining({ date: "2026-07-10" }),
        )
        expect(mockDeleteExpense).toHaveBeenCalledTimes(2)
        expect(mockDeleteExpense).toHaveBeenCalledWith("e8")
        expect(mockDeleteExpense).toHaveBeenCalledWith("e9")
    })

    it("이후 달 인스턴스가 없으면 아무 요청도 보내지 않는다", async () => {
        mockListRecurringInstances.mockResolvedValue([])

        await propagateRecurringUpdate(
            key,
            ref,
            "2026-08",
            { item: "넷플릭스", amount: 17_000 },
            "2026-08",
        )

        expect(mockUpdateExpense).not.toHaveBeenCalled()
        expect(mockDeleteExpense).not.toHaveBeenCalled()
    })
})

describe("removeRecurringFuture", () => {
    beforeEach(() => {
        mockDeleteExpense.mockReset()
        mockListRecurringInstances.mockReset()
        mockDeleteExpense.mockResolvedValue(undefined)
    })

    // 고정 해제: 미리 열어봐서 만들어진 미래 달 인스턴스가 남으면 해지한 지출이 계속 잡힌다.
    it("현재 달 이후 인스턴스를 모두 삭제한다", async () => {
        mockListRecurringInstances.mockResolvedValue([
            { id: "e8", period: "2026-08" },
            { id: "e9", period: "2026-09" },
        ])

        await removeRecurringFuture("r1", "2026-07")

        expect(mockListRecurringInstances).toHaveBeenCalledWith("r1", "2026-07")
        expect(mockDeleteExpense).toHaveBeenCalledTimes(2)
        expect(mockDeleteExpense).toHaveBeenCalledWith("e8")
        expect(mockDeleteExpense).toHaveBeenCalledWith("e9")
    })

    it("미래 인스턴스가 없으면 아무것도 지우지 않는다", async () => {
        mockListRecurringInstances.mockResolvedValue([])

        await removeRecurringFuture("r1", "2026-07")

        expect(mockDeleteExpense).not.toHaveBeenCalled()
    })
})
