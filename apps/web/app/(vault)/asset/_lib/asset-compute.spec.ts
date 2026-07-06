// asset-compute 집계 순수 함수 테스트.
import {
    byCategory,
    byDay,
    goalProgress,
    planBudgetSave,
    remaining,
    savingsSummary,
    spentPct,
    totalIncome,
    totalSpent,
    type ComputedExpense,
    type ComputedIncome,
} from "./asset-compute"

const CATS = [
    {
        id: "c1",
        name: "식비",
        color: "#f2994a",
        code: null,
        createdAt: "",
        updatedAt: "",
    },
    {
        id: "c2",
        name: "교통",
        color: "#4a90d9",
        code: null,
        createdAt: "",
        updatedAt: "",
    },
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

    it("byCategory 는 목록에 없는 categoryId 를 미분류로 합쳐 하나의 행으로 만든다", () => {
        const rows = byCategory(
            [
                exp({ categoryId: "gone", amount: 4000 }),
                exp({ categoryId: null, amount: 1000 }),
            ],
            CATS,
        )
        const uncategorized = rows.filter((r) => r.name === "미분류")
        expect(uncategorized).toHaveLength(1)
        expect(uncategorized[0]).toMatchObject({ amount: 5000 })
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

    it("planBudgetSave 는 기존 행이 없으면 생성 계획을 만든다", () => {
        expect(planBudgetSave([])).toEqual({ kind: "create" })
    })

    it("planBudgetSave 는 행이 1건이면 그 행을 수정하고 삭제는 없다", () => {
        expect(planBudgetSave([{ id: "a" }])).toEqual({
            kind: "replace",
            updateId: "a",
            deleteIds: [],
        })
    })

    it("planBudgetSave 는 행이 여러 건이면 첫 행 수정 + 나머지 삭제로 단건 수렴한다", () => {
        expect(planBudgetSave([{ id: "a" }, { id: "b" }, { id: "c" }])).toEqual(
            {
                kind: "replace",
                updateId: "a",
                deleteIds: ["b", "c"],
            },
        )
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

describe("savingsSummary", () => {
    const cats = [
        { id: "s", name: "저축" },
        { id: "i", name: "투자" },
        { id: "f", name: "식비" },
    ]
    it("저축/투자를 분리 합산하고 순자산을 낸다", () => {
        const r = savingsSummary(
            [
                { categoryId: "s", amount: 100000 },
                { categoryId: "i", amount: 50000 },
                { categoryId: "s", amount: 30000 },
                { categoryId: "f", amount: 9000 },
                { categoryId: null, amount: 1000 },
            ],
            cats,
        )
        expect(r).toEqual({
            savedTotal: 130000,
            investTotal: 50000,
            netWorth: 180000,
        })
    })
})

describe("goalProgress", () => {
    it("진행률은 정수·0~100 클램프", () => {
        expect(goalProgress(50000, 100000)).toBe(50)
        expect(goalProgress(150000, 100000)).toBe(100)
        expect(goalProgress(1000, 0)).toBe(0)
    })
})
