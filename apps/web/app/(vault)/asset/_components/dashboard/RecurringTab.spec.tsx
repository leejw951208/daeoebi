// RecurringTab 테스트(RTL). 요약 카드(합계·건수)·행 표기(매월 N일 · 개월 수)·빈 상태를 검증한다.
import { render, screen } from "@testing-library/react"
import { RecurringTab } from "./RecurringTab"
import type { ComputedRecurring } from "../../_lib/asset-compute"
import type { AssetCategory } from "@/lib/vault-client"

const categories: AssetCategory[] = [
    {
        id: "c1",
        name: "구독",
        color: "#7b61ff",
        code: "SUBSCRIPTION",
        createdAt: "2026-07-01T00:00:00.000Z",
        updatedAt: "2026-07-01T00:00:00.000Z",
    },
]

function makeRecurring(
    over: Partial<ComputedRecurring> = {},
): ComputedRecurring {
    return {
        id: "r1",
        item: "넷플릭스",
        amount: 17_000,
        dayOfMonth: 15,
        termMonths: 6,
        categoryId: "c1",
        ...over,
    }
}

describe("RecurringTab", () => {
    it("고정 지출이 없으면 안내 문구를 보여준다", () => {
        render(<RecurringTab recurrings={[]} categories={categories} />)
        expect(screen.getByText("아직 고정 지출이 없어요")).not.toBeNull()
    })

    it("요약 카드에 매달 나가는 합계와 건수를 표시한다", () => {
        render(
            <RecurringTab
                recurrings={[
                    makeRecurring(),
                    makeRecurring({
                        id: "r2",
                        item: "월세",
                        amount: 500_000,
                        dayOfMonth: 25,
                    }),
                ]}
                categories={categories}
            />,
        )
        expect(screen.getByText("매달 나가는 고정 지출")).not.toBeNull()
        expect(screen.getByText("₩517,000")).not.toBeNull()
        expect(screen.getByText("2건")).not.toBeNull()
    })

    it("행에 지출명·결제일·개월 수·금액을 표시한다", () => {
        render(
            <RecurringTab
                recurrings={[makeRecurring()]}
                categories={categories}
            />,
        )
        expect(screen.getByText("넷플릭스")).not.toBeNull()
        expect(screen.getByText("매월 15일 · 6개월")).not.toBeNull()
        expect(screen.getByText("-₩17,000")).not.toBeNull()
    })

    it("개월 수가 없으면 무기한으로 표시한다", () => {
        render(
            <RecurringTab
                recurrings={[makeRecurring({ termMonths: null })]}
                categories={categories}
            />,
        )
        expect(screen.getByText("매월 15일 · 무기한")).not.toBeNull()
    })

    it("결제일 오름차순으로 정렬해 보여준다", () => {
        render(
            <RecurringTab
                recurrings={[
                    makeRecurring({ id: "r1", item: "월세", dayOfMonth: 25 }),
                    makeRecurring({
                        id: "r2",
                        item: "넷플릭스",
                        dayOfMonth: 15,
                    }),
                ]}
                categories={categories}
            />,
        )
        const items = screen
            .getAllByText(/월세|넷플릭스/)
            .map((el) => el.textContent)
        expect(items).toEqual(["넷플릭스", "월세"])
    })
})
