// SavingsTab 테스트(RTL). 적금 계좌 목록 렌더링·목표 진행률 표기·탭 콜백을 검증한다.
import { render, screen, fireEvent } from "@testing-library/react"
import { SavingsTab } from "./SavingsTab"
import type { SavingsAccountView } from "../../_lib/asset-compute"

const baseProps = {
    summary: { savedTotal: 0, investTotal: 0, netWorth: 0 },
    savedMonth: 0,
    investMonth: 0,
    goalName: null,
    goalAmount: 0,
    contributions: [],
    onEditGoal: () => {},
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
        expect(screen.getByText("아직 등록한 적금이 없어요.")).not.toBeNull()
    })

    it("계좌 행에 이름·총액·목표 미설정을 표시한다", () => {
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
        expect(screen.getByText("+ 목표 설정")).not.toBeNull()
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
        fireEvent.click(screen.getByText("+ 적금 추가"))
        expect(onAddAccount).toHaveBeenCalledTimes(1)
    })
})
