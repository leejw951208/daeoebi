// asset-compute 집계 순수 함수 테스트.
import {
    byCategory,
    byDay,
    remaining,
    spentPct,
    totalIncome,
    totalSpent,
    type ComputedExpense,
    type ComputedIncome,
} from "./asset-compute"

const CATS = [
    { id: "c1", name: "식비", color: "#f2994a", createdAt: "", updatedAt: "" },
    { id: "c2", name: "교통", color: "#4a90d9", createdAt: "", updatedAt: "" },
]

function exp(over: Partial<ComputedExpense>): ComputedExpense {
    const date = over.date ?? "2026-06-10"
    return {
        id: "e",
        date,
        recurringId: null,
        item: "x",
        amount: 1000,
        categoryId: null,
        ...over,
    }
}

describe("asset-compute", () => {
    it("totalSpent 는 금액 합", () => {
        expect(totalSpent([exp({ amount: 8500 }), exp({ amount: 1500 })])).toBe(
            10000,
        )
        expect(totalSpent([])).toBe(0)
    })

    it("byCategory 는 categoryId 로 합산하고 이름·색을 조인한다", () => {
        const rows = byCategory(
            [
                exp({ categoryId: "c1", amount: 7000 }),
                exp({ categoryId: "c2", amount: 3000 }),
            ],
            CATS,
        )
        expect(rows.map((r) => r.name)).toEqual(["식비", "교통"])
        expect(rows[0]).toMatchObject({
            name: "식비",
            amount: 7000,
            pct: 70,
            color: "#f2994a",
        })
    })

    it("byCategory 는 categoryId=null 을 미분류로 묶는다", () => {
        const rows = byCategory([exp({ categoryId: null, amount: 5000 })], CATS)
        expect(rows[0]).toMatchObject({ name: "미분류", amount: 5000 })
    })

    it("byCategory 는 지출 0인 항목을 제외한다", () => {
        const rows = byCategory([exp({ categoryId: "c1", amount: 0 })], CATS)
        expect(rows).toHaveLength(0)
    })

    it("byDay 는 일자별 합계", () => {
        const map = byDay([
            exp({ date: "2026-06-10", amount: 1000 }),
            exp({ date: "2026-06-10", amount: 2000 }),
            exp({ date: "2026-06-11", amount: 500 }),
        ])
        expect(map.get("2026-06-10")).toBe(3000)
        expect(map.get("2026-06-11")).toBe(500)
    })

    it("remaining·spentPct", () => {
        expect(remaining(3_000_000, 1_200_000)).toBe(1_800_000)
        expect(spentPct(1000, 250)).toBe(25)
        expect(spentPct(0, 100)).toBe(100)
        expect(spentPct(1000, 5000)).toBe(100) // 클램프
    })

    it("totalIncome 은 수입 금액을 합산한다", () => {
        const items: ComputedIncome[] = [
            {
                id: "a",
                month: "2026-06",
                item: "월급",
                amount: 3_000_000,
                category: "월급",
            },
            {
                id: "b",
                month: "2026-06",
                item: "상여",
                amount: 500_000,
                category: "상여",
            },
        ]
        expect(totalIncome(items)).toBe(3_500_000)
    })
})
