// SavingsTab 테스트(RTL). 적금 계좌 목록 렌더링·목표 진행률 표기·탭 콜백을 검증한다.
import { render, screen, fireEvent } from "@testing-library/react"
import { SavingsTab } from "./SavingsTab"
import type { SavingsAccountView } from "../../_lib/asset-compute"

const baseProps = {
    month: "2026-07",
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

function makeAccount(
    overrides: Partial<SavingsAccountView> = {},
): SavingsAccountView {
    return {
        name: "여행 자금",
        color: "#178a8a",
        base: 100_000,
        goal: 0,
        month: 0,
        total: 100_000,
        goalPct: 0,
        remain: 0,
        ...overrides,
    }
}

describe("SavingsTab", () => {
    it("계좌가 없으면 안내 문구를 보여준다", () => {
        render(
            <SavingsTab
                {...baseProps}
                accounts={[]}
                onAddAccount={() => {}}
                onEditAccountGoal={() => {}}
            />,
        )
        expect(screen.getByText("아직 적금이 없어요")).not.toBeNull()
    })

    it("계좌 행에 이름·총액·목표 설정 유도를 표시한다", () => {
        render(
            <SavingsTab
                {...baseProps}
                accounts={[makeAccount()]}
                onAddAccount={() => {}}
                onEditAccountGoal={() => {}}
            />,
        )
        expect(screen.getByText("여행 자금")).not.toBeNull()
        expect(screen.getByText("₩100,000")).not.toBeNull()
        expect(screen.getByText("목표 미설정")).not.toBeNull()
    })

    it("목표가 있으면 진행률과 남은 금액을 표시한다", () => {
        render(
            <SavingsTab
                {...baseProps}
                accounts={[
                    makeAccount({
                        goal: 1_000_000,
                        total: 300_000,
                        goalPct: 30,
                        remain: 700_000,
                    }),
                ]}
                onAddAccount={() => {}}
                onEditAccountGoal={() => {}}
            />,
        )
        expect(screen.getByText("30%")).not.toBeNull()
        expect(
            screen.getByText("목표 ₩1,000,000 · ₩700,000 남음"),
        ).not.toBeNull()
    })

    it("이번 달 적립이 있으면 +금액 배지를 보여준다", () => {
        render(
            <SavingsTab
                {...baseProps}
                accounts={[makeAccount({ month: 50_000, total: 150_000 })]}
                onAddAccount={() => {}}
                onEditAccountGoal={() => {}}
            />,
        )
        expect(screen.getByText("+₩50,000")).not.toBeNull()
    })

    it("계좌 행을 탭하면 onEditAccountGoal 을 이름과 함께 호출한다", () => {
        const onEditAccountGoal = jest.fn()
        render(
            <SavingsTab
                {...baseProps}
                accounts={[makeAccount()]}
                onAddAccount={() => {}}
                onEditAccountGoal={onEditAccountGoal}
            />,
        )
        fireEvent.click(screen.getByText("여행 자금"))
        expect(onEditAccountGoal).toHaveBeenCalledWith("여행 자금")
    })

    it("+ 적금 추가 버튼을 누르면 onAddAccount 를 호출한다", () => {
        const onAddAccount = jest.fn()
        render(
            <SavingsTab
                {...baseProps}
                accounts={[]}
                onAddAccount={onAddAccount}
                onEditAccountGoal={() => {}}
            />,
        )
        fireEvent.click(
            screen.getByText(
                (_, el) =>
                    el?.textContent?.replace(/\s+/g, " ").trim() ===
                    "+ 적금 추가",
                { selector: "button" },
            ),
        )
        expect(onAddAccount).toHaveBeenCalledTimes(1)
    })

    it("쌈짓돈 카드에 잔액·건수를 표시하고 버튼이 콜백을 호출한다", () => {
        const onBoxIn = jest.fn()
        const onBoxOut = jest.fn()
        const onBoxDetail = jest.fn()
        render(
            <SavingsTab
                {...baseProps}
                accounts={[]}
                onAddAccount={() => {}}
                onEditAccountGoal={() => {}}
                box={{ balance: 50_000, fromSavings: 0, count: 3 }}
                onBoxIn={onBoxIn}
                onBoxOut={onBoxOut}
                onBoxDetail={onBoxDetail}
            />,
        )
        expect(screen.getByText("쌈짓돈")).not.toBeNull()
        expect(screen.getByText("₩50,000")).not.toBeNull()
        expect(screen.getByText("3건 기록")).not.toBeNull()

        fireEvent.click(screen.getByText("입금"))
        expect(onBoxIn).toHaveBeenCalledTimes(1)
        fireEvent.click(screen.getByText("출금"))
        expect(onBoxOut).toHaveBeenCalledTimes(1)
        fireEvent.click(screen.getByText("입출금 내역 보기"))
        expect(onBoxDetail).toHaveBeenCalledTimes(1)
    })

    it("이번 달 적립 배지에 보고 있는 달을 함께 표시한다(누적 총액과 구분)", () => {
        render(
            <SavingsTab
                {...baseProps}
                month="2026-06"
                savedTotal={300_000}
                savedMonth={100_000}
                investMonth={0}
                accounts={[]}
                onAddAccount={() => {}}
                onEditAccountGoal={() => {}}
            />,
        )
        // 저축 카드 값은 누적 총액(300,000), 배지는 보고 있는 달(6월)의 적립분(100,000).
        expect(screen.getByText("₩300,000")).not.toBeNull()
        expect(screen.getAllByText("6월 +₩100,000").length).toBeGreaterThan(0)
        // "누적" 이라는 말로 이번 달 값을 가리키지 않는다.
        expect(screen.queryByText("누적 ₩100,000")).toBeNull()
    })

    it("박스로 이체된 저축분(fromSavings)을 저축 표시에서 뺀다", () => {
        render(
            <SavingsTab
                {...baseProps}
                savedTotal={100_000}
                accounts={[]}
                onAddAccount={() => {}}
                onEditAccountGoal={() => {}}
                box={{ balance: 30_000, fromSavings: 30_000, count: 1 }}
            />,
        )
        // 저축 카드 = 계좌 기반 저축 합계 100,000 - 박스로 이체분 30,000 = 70,000
        expect(screen.getByText("₩70,000")).not.toBeNull()
    })
})
