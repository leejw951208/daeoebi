// asset-compute 집계 순수 함수 테스트.
import {
    byCategory,
    byDay,
    billedInMonth,
    remaining,
    spentPct,
    totalIncome,
    totalSpent,
    type ComputedExpense,
    type ComputedIncome,
} from "./asset-compute"

function exp(over: Partial<ComputedExpense>): ComputedExpense {
    const date = over.date ?? "2026-06-10"
    return {
        id: "e",
        date,
        billingDate: date, // 기본은 구매일과 동일(비카드)
        recurringId: null,
        item: "x",
        amount: 1000,
        category: "식비",
        method: "신용카드",
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

    it("byCategory 는 금액 내림차순 + 비율(%)", () => {
        const rows = byCategory([
            exp({ category: "식비", amount: 7000 }),
            exp({ category: "교통", amount: 3000 }),
            exp({ category: "식비", amount: 0 }), // 0 은 무시되지 않고 합산(여기선 7000 유지)
        ])
        expect(rows.map((r) => r.key)).toEqual(["식비", "교통"])
        expect(rows[0]).toMatchObject({ key: "식비", amount: 7000, pct: 70 })
        expect(rows[1]).toMatchObject({ key: "교통", amount: 3000, pct: 30 })
        expect(rows[0].color).toBe("#f2994a")
    })

    it("byCategory 는 지출 0 인 카테고리를 제외한다", () => {
        const rows = byCategory([exp({ category: "식비", amount: 5000 })])
        expect(rows).toHaveLength(1)
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

    it("billedInMonth 는 결제월 기준으로 추린다", () => {
        const items = [
            exp({ id: "a", billingDate: "2026-06-05" }), // 6월 결제 포함
            exp({ id: "b", billingDate: "2026-07-01" }), // 7월 결제 제외
            exp({ id: "c", billingDate: "2026-06-30" }), // 6월 결제 포함
        ]
        expect(billedInMonth(items, "2026-06").map((e) => e.id)).toEqual([
            "a",
            "c",
        ])
    })

    it("byDay 는 결제일(billingDate) 기준으로 합산한다", () => {
        const map = byDay([
            exp({
                date: "2026-05-17",
                billingDate: "2026-06-17",
                amount: 30000,
            }), // 카드 이월
            exp({
                date: "2026-06-17",
                billingDate: "2026-06-17",
                amount: 8000,
            }),
        ])
        expect(map.get("2026-06-17")).toBe(38000)
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
