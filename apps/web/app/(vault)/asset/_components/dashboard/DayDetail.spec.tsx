// DayDetail 테스트(RTL). "고정" 배지가 활성 템플릿 기준으로만 붙는지 검증한다.
//
// 고정 해제는 템플릿의 active 만 끄고, 지출 행의 recurringId 는 그대로 남긴다(과거 기록 보존).
// 그래서 recurringId 만 보고 배지를 붙이면 해제한 지출에도 "고정"이 영원히 남는다.
import { render, screen } from "@testing-library/react"
import { DayDetail } from "./DayDetail"
import type { ComputedExpense } from "../../_lib/asset-compute"
import type { AssetCategory } from "@/lib/vault-client"

const categories: AssetCategory[] = [
    {
        id: "c1",
        name: "구독",
        color: "#7b61ff",
        code: null,
        createdAt: "2026-07-01T00:00:00.000Z",
        updatedAt: "2026-07-01T00:00:00.000Z",
    },
]

function expense(over: Partial<ComputedExpense> = {}): ComputedExpense {
    return {
        id: "e1",
        date: "2026-07-15",
        recurringId: null,
        item: "넷플릭스",
        amount: 17_000,
        categoryId: "c1",
        ...over,
    }
}

function renderDay(
    dayExpenses: ComputedExpense[],
    activeIds: ReadonlySet<string>,
) {
    render(
        <DayDetail
            selectedDay="2026-07-15"
            dayExpenses={dayExpenses}
            categories={categories}
            activeRecurringIds={activeIds}
        />,
    )
}

describe("DayDetail — 고정 배지", () => {
    it("활성 템플릿에 연결된 지출엔 고정 배지를 붙인다", () => {
        renderDay([expense({ recurringId: "r1" })], new Set(["r1"]))
        expect(screen.getByText("고정")).not.toBeNull()
    })

    // 고정 해제 후: recurringId 는 남아 있지만 템플릿이 비활성이라 활성 목록에 없다.
    it("고정 해제된 지출엔 배지를 붙이지 않는다", () => {
        renderDay([expense({ recurringId: "r-old" })], new Set())
        expect(screen.queryByText("고정")).toBeNull()
        // 지출 자체는 그대로 보인다(데이터는 지워지지 않는다).
        expect(screen.getByText("넷플릭스")).not.toBeNull()
        expect(screen.getByText("-₩17,000")).not.toBeNull()
    })

    it("단건 지출엔 배지를 붙이지 않는다", () => {
        renderDay([expense()], new Set(["r1"]))
        expect(screen.queryByText("고정")).toBeNull()
    })

    it("예정 항목엔 예정 배지를 붙이고 수정 링크를 만들지 않는다", () => {
        renderDay(
            [
                expense({
                    id: "projected:r1:2026-08",
                    recurringId: "r1",
                    projected: true,
                }),
            ],
            new Set(["r1"]),
        )
        expect(screen.getByText("예정")).not.toBeNull()
        expect(screen.queryByRole("link")).toBeNull()
    })
})
