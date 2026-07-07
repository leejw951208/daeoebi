// SavingsTab 테스트(RTL). 세이빙 박스 카드 렌더링·콜백과 저축 표시 계산을 검증한다.
import { render, screen, fireEvent } from "@testing-library/react"
import { SavingsTab } from "./SavingsTab"

const baseProps = {
    netWorth: 0,
    savedTotal: 0,
    savedMonth: 0,
    investMonth: 0,
    contributions: [],
    investment: { principal: 0, rate: null, value: 0, pnl: 0 },
    onEditReturn: () => {},
    box: { balance: 0, fromSavings: 0, count: 0 },
    onBoxIn: () => {},
    onBoxOut: () => {},
    onBoxDetail: () => {},
}

describe("SavingsTab", () => {
    it("세이빙 박스 카드에 잔액·건수를 표시하고 버튼이 콜백을 호출한다", () => {
        const onBoxIn = jest.fn()
        const onBoxOut = jest.fn()
        const onBoxDetail = jest.fn()
        render(
            <SavingsTab
                {...baseProps}
                box={{ balance: 50_000, fromSavings: 0, count: 3 }}
                onBoxIn={onBoxIn}
                onBoxOut={onBoxOut}
                onBoxDetail={onBoxDetail}
            />,
        )
        expect(screen.getByText("세이빙 박스")).not.toBeNull()
        expect(screen.getByText("₩50,000")).not.toBeNull()
        expect(screen.getByText("3건 기록")).not.toBeNull()

        fireEvent.click(screen.getByText("입금"))
        expect(onBoxIn).toHaveBeenCalledTimes(1)
        fireEvent.click(screen.getByText("출금"))
        expect(onBoxOut).toHaveBeenCalledTimes(1)
        fireEvent.click(screen.getByText("입출금 내역 보기"))
        expect(onBoxDetail).toHaveBeenCalledTimes(1)
    })

    it("박스로 이체된 저축분(fromSavings)을 저축 표시에서 뺀다", () => {
        render(
            <SavingsTab
                {...baseProps}
                savedTotal={100_000}
                box={{ balance: 30_000, fromSavings: 30_000, count: 1 }}
            />,
        )
        // 저축 카드 = 계좌 기반 저축 합계 100,000 - 박스로 이체분 30,000 = 70,000
        expect(screen.getByText("₩70,000")).not.toBeNull()
    })
})
