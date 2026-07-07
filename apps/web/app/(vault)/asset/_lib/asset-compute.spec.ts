// asset-compute 집계 순수 함수 테스트.
import {
    byCategory,
    byDay,
    filterByMonth,
    goalProgress,
    investmentView,
    monthSavingsByItem,
    planBudgetSave,
    remaining,
    savingsAccountsView,
    savingsBoxBalance,
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
        kind: "NORMAL" as const,
        createdAt: "",
        updatedAt: "",
    },
    {
        id: "c2",
        name: "교통",
        color: "#4a90d9",
        code: null,
        kind: "NORMAL" as const,
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
        { id: "s", kind: "SAVINGS" },
        { id: "i", kind: "INVESTMENT" },
        { id: "f", kind: "NORMAL" },
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

describe("monthSavingsByItem", () => {
    const cats = [
        { id: "s", kind: "SAVINGS" },
        { id: "i", kind: "INVESTMENT" },
        { id: "f", kind: "NORMAL" },
    ]

    it("SAVINGS 카테고리 지출만 item 별로 합산한다", () => {
        const map = monthSavingsByItem(
            [
                exp({ categoryId: "s", item: "청년적금", amount: 100000 }),
                exp({ categoryId: "s", item: "청년적금", amount: 50000 }),
                exp({ categoryId: "s", item: "내집마련", amount: 30000 }),
                exp({ categoryId: "i", item: "청년적금", amount: 9999 }), // INVESTMENT 는 제외
                exp({ categoryId: "f", item: "청년적금", amount: 8888 }), // NORMAL 은 제외
                exp({ categoryId: null, item: "청년적금", amount: 7777 }), // 미분류는 제외
            ],
            cats,
        )
        expect(map.get("청년적금")).toBe(150000)
        expect(map.get("내집마련")).toBe(30000)
        expect(map.size).toBe(2)
    })

    it("SAVINGS 지출이 없으면 빈 Map", () => {
        const map = monthSavingsByItem(
            [exp({ categoryId: "f", item: "청년적금", amount: 1000 })],
            cats,
        )
        expect(map.size).toBe(0)
    })
})

describe("savingsAccountsView", () => {
    it("목표가 있으면 진행률·잔여를 계산하고 total 내림차순 정렬한다", () => {
        const monthByItem = new Map([
            ["청년적금", 100000],
            ["내집마련", 0],
        ])
        const { rows, savedTotal, savedMonth } = savingsAccountsView(
            [
                {
                    name: "청년적금",
                    color: "#20a4a4",
                    base: 500000,
                    goal: 1000000,
                },
                {
                    name: "내집마련",
                    color: "#7b61ff",
                    base: 2000000,
                    goal: 1000000,
                },
            ],
            monthByItem,
        )
        // 청년적금: total = 600000, 내집마련: total = 2000000 → 내집마련이 먼저
        expect(rows.map((r) => r.name)).toEqual(["내집마련", "청년적금"])
        expect(rows[0]).toMatchObject({
            name: "내집마련",
            base: 2000000,
            goal: 1000000,
            month: 0,
            total: 2000000,
            goalPct: 100, // 클램프
            remain: 0,
        })
        expect(rows[1]).toMatchObject({
            name: "청년적금",
            base: 500000,
            goal: 1000000,
            month: 100000,
            total: 600000,
            goalPct: 60,
            remain: 400000,
        })
        expect(savedTotal).toBe(2600000)
        expect(savedMonth).toBe(100000)
    })

    it("목표가 없으면(0) goalPct=0, remain=0 이고 month 매칭 없는 계좌는 month=0", () => {
        const monthByItem = new Map([["비상금", 20000]])
        const { rows } = savingsAccountsView(
            [{ name: "비상금", color: "#e9b949", base: 100000, goal: 0 }],
            monthByItem,
        )
        expect(rows[0]).toMatchObject({
            month: 20000,
            total: 120000,
            goalPct: 0,
            remain: 0,
        })
    })

    it("계좌가 없으면 빈 rows·합계 0", () => {
        const { rows, savedTotal, savedMonth } = savingsAccountsView(
            [],
            new Map(),
        )
        expect(rows).toEqual([])
        expect(savedTotal).toBe(0)
        expect(savedMonth).toBe(0)
    })
})

describe("filterByMonth", () => {
    const items = [
        { id: "a", date: "2026-06-01" },
        { id: "b", date: "2026-06-30" },
        { id: "c", date: "2026-07-01" },
        { id: "d", date: "2026-05-31" },
    ]

    it("해당 월(YYYY-MM)에 속하는 항목만 남긴다 (월 경계 포함)", () => {
        expect(filterByMonth(items, "2026-06")).toEqual([
            { id: "a", date: "2026-06-01" },
            { id: "b", date: "2026-06-30" },
        ])
    })

    it("해당 월 항목이 없으면 빈 배열", () => {
        expect(filterByMonth(items, "2026-08")).toEqual([])
    })
})

describe("savingsBoxBalance", () => {
    it("입출금이 섞이면 in/out 을 각각 합산하고 balance=in-out 을 낸다", () => {
        const r = savingsBoxBalance([
            { type: "in", source: "cash", amount: 100000 },
            { type: "in", source: "savings", amount: 30000 },
            { type: "out", source: "cash", amount: 20000 },
        ])
        expect(r).toEqual({
            balance: 110000,
            inTotal: 130000,
            outTotal: 20000,
            fromSavings: 30000,
        })
    })

    it("fromSavings 는 type=in && source=savings 인 건만 합산한다", () => {
        const r = savingsBoxBalance([
            { type: "in", source: "savings", amount: 10000 },
            { type: "out", source: "savings", amount: 5000 }, // out 은 제외
            { type: "in", source: "cash", amount: 7000 }, // cash 는 제외
        ])
        expect(r.fromSavings).toBe(10000)
    })

    it("빈 배열이면 전부 0", () => {
        expect(savingsBoxBalance([])).toEqual({
            balance: 0,
            inTotal: 0,
            outTotal: 0,
            fromSavings: 0,
        })
    })
})

describe("investmentView", () => {
    it("유효한 수익률이면 rate 를 채우고 원금에 반영한 평가액·손익을 계산한다", () => {
        const v = investmentView(6_300_000, "8.5", 0)
        expect(v).toEqual({
            principal: 6_300_000,
            rate: 8.5,
            value: 6_835_500,
            pnl: 535_500,
        })
    })

    it("수익률이 빈 문자열이면 rate=null 이고 평가액=원금, 손익=0", () => {
        const v = investmentView(500_000, "", 100_000)
        expect(v).toEqual({
            principal: 600_000,
            rate: null,
            value: 600_000,
            pnl: 0,
        })
    })

    it("공백만 있거나 숫자로 해석 불가한 수익률도 rate=null 로 처리한다", () => {
        expect(investmentView(100_000, "   ", 0).rate).toBeNull()
        expect(investmentView(100_000, "abc", 0).rate).toBeNull()
    })

    it("음수 수익률이면 손익이 음수가 된다", () => {
        const v = investmentView(1_000_000, "-10", 0)
        expect(v).toEqual({
            principal: 1_000_000,
            rate: -10,
            value: 900_000,
            pnl: -100_000,
        })
    })

    it("investMonth 는 원금에 더해진다", () => {
        const v = investmentView(1_000_000, "5", 200_000)
        expect(v).toEqual({
            principal: 1_200_000,
            rate: 5,
            value: 1_260_000,
            pnl: 60_000,
        })
    })
})
