// ExpenseForm 테스트(RTL). 저축 지출의 항목이 적금 계좌 선택으로 바뀌는지,
// 계좌명과 어긋난 값으로 저장되지 않는지 검증한다.
//
// 저축 집계(savingsByItem)는 항목과 계좌명의 문자열 완전 일치로 붙는다. 자유 텍스트로 두면
// "청년적금" vs "청년 적금" 한 칸 차이로 금액이 저축 총액에서 조용히 증발한다.
const mockCreateExpense = jest.fn()
const mockCreateRecurring = jest.fn()
const mockUpdateRecurring = jest.fn()
const mockUpdateExpense = jest.fn()
const mockDeleteExpense = jest.fn()
const mockListRecurringInstances = jest.fn()
jest.mock("@/lib/vault-client", () => ({
    __esModule: true,
    createExpense: (...a: unknown[]) => mockCreateExpense(...a),
    createRecurring: (...a: unknown[]) => mockCreateRecurring(...a),
    deleteExpense: (...a: unknown[]) => mockDeleteExpense(...a),
    deleteRecurring: jest.fn(),
    updateExpense: (...a: unknown[]) => mockUpdateExpense(...a),
    updateRecurring: (...a: unknown[]) => mockUpdateRecurring(...a),
    listRecurringInstances: (...a: unknown[]) =>
        mockListRecurringInstances(...a),
}))
jest.mock("@/lib/api-error", () => ({
    __esModule: true,
    isApiError: () => false,
}))
jest.mock("../_lib/asset-payload", () => ({
    __esModule: true,
    sealExpense: jest
        .fn()
        .mockResolvedValue({ iv: "AA", ciphertext: "BB", authTag: "CC" }),
}))
jest.mock("../../_lib/vault-context", () => ({
    __esModule: true,
    useVault: () => ({ vaultKey: {} as CryptoKey, resetIdle: () => {} }),
}))
const mockToast = jest.fn()
jest.mock("@/components/toast", () => ({
    __esModule: true,
    toast: (...a: unknown[]) => mockToast(...a),
}))
// "지금"을 2026-07 로 고정한다. 미래 달 판정이 실제 시계에 걸리면 8월이 되는 순간 테스트가 뒤집힌다.
jest.mock("../_lib/asset-dates", () => ({
    __esModule: true,
    ...jest.requireActual("../_lib/asset-dates"),
    todayISO: () => "2026-07-15",
    currentMonth: () => "2026-07",
}))
// 이 파일 대부분의 테스트는 폼이 무엇을 보내는지만 본다. 전파 함수 자체의 동작은
// asset-recurring.spec.ts 에서 별도로 검증된다. 다만 아래 [I1]·[I2] 계약 테스트는 예외로,
// propagateRecurringUpdate 를 실제 구현으로 바꿔 "게이트가 알린 건수 = 전파가 지우는 건수"
// 일치까지 이 파일 안에서 함께 확인한다.
jest.mock("../_lib/asset-recurring", () => ({
    __esModule: true,
    ...jest.requireActual("../_lib/asset-recurring"),
    propagateRecurringUpdate: jest.fn().mockResolvedValue(undefined),
    removeRecurringFuture: jest.fn().mockResolvedValue(undefined),
}))

import {
    render,
    screen,
    fireEvent,
    waitFor,
    within,
} from "@testing-library/react"
import { ExpenseForm } from "./ExpenseForm"
import { propagateRecurringUpdate } from "../_lib/asset-recurring"
import type { AssetCategory } from "@/lib/vault-client"

// [I1] "게이트가 알린 건수 = 실제로 지워지는 건수" 계약 검증용. 이 파일의 다른 테스트는 위
// jest.mock 으로 propagateRecurringUpdate 를 무동작 목으로 바꿔 폼이 "무엇을 보내는지"만
// 본다. 그 목을 파일 전체에서 걷어내면 다른 테스트들이 깨지므로, 계약 테스트 한 건에서만
// mockImplementationOnce 로 실제 구현을 1회 주입한다. 이 큐는 "그 테스트가 실제로 저장
// 버튼→계속 클릭까지 도달해 호출을 소비하는 동안에만" 다시 무동작 목으로 돌아온다는 게
// 보장된다 — 해당 테스트가 그 경로에 닿기 전에 실패(assert 조기 실패 등)하면 큐에 남은
// 실제 구현이 다음 테스트로 새어나갈 수 있다.
const actualPropagateRecurringUpdate = jest.requireActual(
    "../_lib/asset-recurring",
).propagateRecurringUpdate

function category(
    over: Partial<AssetCategory> & { id: string },
): AssetCategory {
    return {
        name: "식비",
        color: "#f2994a",
        code: null,
        createdAt: "2026-07-01T00:00:00.000Z",
        updatedAt: "2026-07-01T00:00:00.000Z",
        ...over,
    } as AssetCategory
}

const categories: AssetCategory[] = [
    category({ id: "c-food", name: "식비", code: null }),
    category({ id: "c-save", name: "저축", code: "SAVINGS" }),
]

function renderForm(savingsAccounts: string[]) {
    render(
        <ExpenseForm
            categories={categories}
            savingsAccounts={savingsAccounts}
            initial={null}
            onSaved={jest.fn()}
            onCancel={jest.fn()}
            onDeleted={jest.fn()}
        />,
    )
}

function pickSavings() {
    fireEvent.click(screen.getByRole("button", { name: /저축/ }))
}

function typeAmount(v: string) {
    fireEvent.change(screen.getByLabelText("금액"), { target: { value: v } })
}

function typeItem(v: string) {
    fireEvent.change(screen.getByLabelText("항목"), { target: { value: v } })
}

function pickDate(v: string) {
    fireEvent.change(screen.getByLabelText("날짜"), { target: { value: v } })
}

function toggleRecurring() {
    fireEvent.click(screen.getByRole("switch", { name: "고정 지출" }))
}

function save() {
    fireEvent.click(screen.getByRole("button", { name: "저장" }))
}

beforeEach(() => {
    mockCreateExpense.mockReset()
    mockCreateExpense.mockResolvedValue({ id: "e1" })
    mockCreateRecurring.mockReset()
    mockCreateRecurring.mockResolvedValue({ id: "r1" })
    mockToast.mockReset()
})

describe("ExpenseForm — 저축 카테고리", () => {
    it("저축을 고르면 항목이 자유 입력 대신 적금 계좌 선택으로 바뀐다", () => {
        renderForm(["청년적금", "주택청약"])

        expect(screen.getByLabelText("항목")).not.toBeNull()
        pickSavings()

        expect(screen.queryByLabelText("항목")).toBeNull()
        expect(screen.getByLabelText("적금 계좌")).not.toBeNull()
    })

    it("고른 계좌명이 그대로 항목으로 저장된다", async () => {
        renderForm(["청년적금", "주택청약"])
        pickSavings()
        typeAmount("500000")
        fireEvent.change(screen.getByLabelText("적금 계좌"), {
            target: { value: "청년적금" },
        })

        fireEvent.click(screen.getByRole("button", { name: "저장" }))

        await waitFor(() => expect(mockCreateExpense).toHaveBeenCalled())
        expect(mockCreateExpense.mock.calls[0][0]).toMatchObject({
            categoryId: "c-save",
        })
    })

    it("계좌를 고르지 않으면 저장하지 않는다", async () => {
        renderForm(["청년적금"])
        pickSavings()
        typeAmount("500000")

        fireEvent.click(screen.getByRole("button", { name: "저장" }))

        await waitFor(() =>
            expect(mockToast).toHaveBeenCalledWith("적금 계좌를 선택하세요."),
        )
        expect(mockCreateExpense).not.toHaveBeenCalled()
    })

    it("적금 계좌가 하나도 없으면 안내하고 저장을 막는다", async () => {
        renderForm([])
        pickSavings()
        typeAmount("500000")

        expect(screen.getByRole("alert").textContent).toContain(
            "적금 계좌가 없어요",
        )
        fireEvent.click(screen.getByRole("button", { name: "저장" }))

        await waitFor(() =>
            expect(mockToast).toHaveBeenCalledWith(
                "저축 지출을 기록하려면 적금 계좌를 먼저 추가하세요.",
            ),
        )
        expect(mockCreateExpense).not.toHaveBeenCalled()
    })

    it("저축이 아닌 카테고리는 항목을 자유롭게 입력한다", async () => {
        renderForm(["청년적금"])
        typeAmount("9000")
        fireEvent.change(screen.getByLabelText("항목"), {
            target: { value: "점심 김밥천국" },
        })

        fireEvent.click(screen.getByRole("button", { name: "저장" }))

        await waitFor(() => expect(mockCreateExpense).toHaveBeenCalled())
        expect(mockCreateExpense.mock.calls[0][0]).toMatchObject({
            categoryId: "c-food",
        })
    })
})

// 미래 달엔 실제 인스턴스가 없다는 전제로 projectRecurring 이 "예정" 행을 합성한다.
// 여기서 인스턴스를 만들어버리면 그 달에 실제 행과 예정 행이 겹쳐 두 건으로 보이고,
// 전 기간 누적(저축·투자)도 미리 부풀려진다. 미래 달은 템플릿만 만들고 넘긴다.
describe("ExpenseForm — 미래 달 고정 지출", () => {
    it("미래 달로 저장하면 템플릿만 만들고 인스턴스는 만들지 않는다", async () => {
        // Arrange
        renderForm([])
        typeAmount("500000")
        typeItem("월세")
        pickDate("2026-08-15")
        toggleRecurring()

        // Act
        save()

        // Assert
        await waitFor(() => expect(mockCreateRecurring).toHaveBeenCalled())
        expect(mockCreateRecurring.mock.calls[0][0]).toMatchObject({
            dayOfMonth: 15,
            startMonth: "2026-08",
        })
        expect(mockCreateExpense).not.toHaveBeenCalled()
    })

    it("이번 달로 저장하면 템플릿과 인스턴스를 함께 만든다", async () => {
        // Arrange
        renderForm([])
        typeAmount("500000")
        typeItem("월세")
        pickDate("2026-07-25")
        toggleRecurring()

        // Act
        save()

        // Assert
        await waitFor(() => expect(mockCreateExpense).toHaveBeenCalled())
        expect(mockCreateExpense.mock.calls[0][0]).toMatchObject({
            date: "2026-07-25",
            recurringId: "r1",
            period: "2026-07",
        })
    })
})

function renderEdit(termMonths: number | null) {
    render(
        <ExpenseForm
            categories={categories}
            savingsAccounts={[]}
            initial={{
                id: "e1",
                date: "2026-07-10",
                recurringId: "r1",
                period: "2026-07",
                template: {
                    id: "r1",
                    startMonth: "2026-01",
                    termMonths,
                    active: true,
                },
                payload: { item: "월세", amount: 500_000 },
                categoryId: "c-food",
            }}
            onSaved={jest.fn()}
            onCancel={jest.fn()}
            onDeleted={jest.fn()}
        />,
    )
}

describe("종료월 선택", () => {
    beforeEach(() => {
        mockUpdateRecurring.mockReset()
        mockUpdateExpense.mockReset()
        mockDeleteExpense.mockReset()
        mockListRecurringInstances.mockReset()
        mockUpdateRecurring.mockResolvedValue({ id: "r1" })
        mockUpdateExpense.mockResolvedValue({ id: "e1" })
        mockDeleteExpense.mockResolvedValue(undefined)
        mockListRecurringInstances.mockResolvedValue([])
        // propagateRecurringUpdate 는 파일 상단 jest.mock 에서 무동작 목으로 한 번만 만들어져
        // 파일 전체에서 재사용된다(jest.config.js 에 clearMocks/resetMocks 가 없다). mockReset
        // 은 그 무동작 목의 mockResolvedValue(undefined) 를 날려버리므로 mockClear 만 써서
        // 호출 기록만 비운다 — 안 그러면 이 describe 의 앞선 테스트가 남긴 호출 기록으로
        // "재고정 시 전파를 호출한다" 단언이 그 테스트를 실행하지 않아도 통과해버린다.
        ;(propagateRecurringUpdate as jest.Mock).mockClear()
    })

    // startMonth 2026-01 + 7개월 = 2026-07 이 선택돼 보여야 한다.
    it("템플릿의 종료월이 선택된 상태로 보인다", () => {
        renderEdit(7)
        const select = screen.getByLabelText("종료월") as HTMLSelectElement
        expect(select.value).toBe("2026-07")
    })

    it("무기한이면 아무것도 선택되지 않는다", () => {
        renderEdit(null)
        const select = screen.getByLabelText("종료월") as HTMLSelectElement
        expect(select.value).toBe("")
    })

    it("종료월을 고르면 개월 수로 환산해 저장한다", async () => {
        renderEdit(null)
        fireEvent.change(screen.getByLabelText("종료월"), {
            target: { value: "2026-07" },
        })
        fireEvent.click(screen.getByRole("button", { name: "저장" }))

        await waitFor(() => {
            expect(mockUpdateRecurring).toHaveBeenCalledWith(
                "r1",
                expect.objectContaining({ termMonths: 7 }),
            )
        })
    })

    it("무기한으로 되돌리면 termMonths 가 null 로 나간다", async () => {
        renderEdit(7)
        fireEvent.change(screen.getByLabelText("종료월"), {
            target: { value: "" },
        })
        fireEvent.click(screen.getByRole("button", { name: "저장" }))

        await waitFor(() => {
            expect(mockUpdateRecurring).toHaveBeenCalledWith(
                "r1",
                expect.objectContaining({ termMonths: null }),
            )
        })
    })

    it("종료월 이후 지출이 있으면 확인을 받고, 취소하면 아무것도 저장하지 않는다", async () => {
        mockListRecurringInstances.mockResolvedValue([
            { id: "e8", period: "2026-08" },
            { id: "e9", period: "2026-09" },
        ])
        renderEdit(null)
        fireEvent.change(screen.getByLabelText("종료월"), {
            target: { value: "2026-07" },
        })
        fireEvent.click(screen.getByRole("button", { name: "저장" }))

        expect(
            await screen.findByText(/2026년 8월부터의 지출 2건이 삭제됩니다/),
        ).not.toBeNull()
        expect(mockListRecurringInstances).toHaveBeenCalledWith("r1", "2026-07")
        expect(mockUpdateRecurring).not.toHaveBeenCalled()

        // 헤더에도 "취소" 버튼이 있어 이름만으로는 구분되지 않는다. 확인 다이얼로그로 범위를 좁힌다.
        const confirmDialog = screen.getByRole("dialog", { name: "기록 삭제" })
        fireEvent.click(
            within(confirmDialog).getByRole("button", { name: "취소" }),
        )

        await waitFor(() => {
            expect(screen.queryByText(/2건이 삭제됩니다/)).toBeNull()
        })
        expect(mockUpdateRecurring).not.toHaveBeenCalled()
        expect(mockUpdateExpense).not.toHaveBeenCalled()
    })

    it("확인하면 저장이 진행된다", async () => {
        mockListRecurringInstances.mockResolvedValue([
            { id: "e8", period: "2026-08" },
        ])
        renderEdit(null)
        fireEvent.change(screen.getByLabelText("종료월"), {
            target: { value: "2026-07" },
        })
        fireEvent.click(screen.getByRole("button", { name: "저장" }))
        fireEvent.click(await screen.findByRole("button", { name: "계속" }))

        await waitFor(() => {
            expect(mockUpdateRecurring).toHaveBeenCalledWith(
                "r1",
                expect.objectContaining({ termMonths: 7 }),
            )
        })
    })

    // [I1] 계약 테스트: 다이얼로그가 센 건수와 실제로 삭제되는 건수가 같은 집합인지 검증한다.
    // 이 브랜치에서 그 계약이 두 번 흔들렸다(삭제 범위 수정, 게이트 조건 수정) — 컴포넌트
    // 목·라이브러리 목이 각자 자기 쪽만 보증해서 아무도 둘의 일치를 보지 않았기 때문이다.
    // 그래서 여기서는 propagateRecurringUpdate 를 실제 구현으로 돌려 deleteExpense 호출까지 본다.
    // mockListRecurringInstances 도 인자(from)에 반응하게 해서, 게이트 조회와 전파 조회가
    // 정말 같은 창(window)을 보는지까지 검증한다 — 고정값을 돌려주면 둘이 다른 from 으로
    // 불려도 우연히 같은 결과를 받아 이 계약이 깨진 걸 놓친다.
    it("확인창이 알린 건수만큼만 정확히 삭제한다(게이트=전파 집합 일치)", async () => {
        const rows = [
            { id: "e8", period: "2026-08" },
            { id: "e9", period: "2026-09" },
        ]
        mockListRecurringInstances.mockImplementation(
            (_id: string, from: string) =>
                Promise.resolve(rows.filter((r) => r.period > from)),
        )
        ;(propagateRecurringUpdate as jest.Mock).mockImplementationOnce(
            actualPropagateRecurringUpdate,
        )
        renderEdit(null)
        fireEvent.change(screen.getByLabelText("종료월"), {
            target: { value: "2026-07" },
        })
        fireEvent.click(screen.getByRole("button", { name: "저장" }))

        expect(
            await screen.findByText(/2026년 8월부터의 지출 2건이 삭제됩니다/),
        ).not.toBeNull()

        fireEvent.click(await screen.findByRole("button", { name: "계속" }))

        await waitFor(() => {
            expect(mockDeleteExpense).toHaveBeenCalledTimes(2)
        })
        expect(mockDeleteExpense).toHaveBeenCalledWith("e8")
        expect(mockDeleteExpense).toHaveBeenCalledWith("e9")
    })

    // [I1] 클램프 회귀 검증: propagateRecurringUpdate 는 종료월이 현재 달보다 앞서면
    // pivot(현재 달) 대신 endMonth 부터 조회해야 이번 달에 이미 만들어진 인스턴스까지
    // 지운다. 이 클램프가 사라지면(from 이 무조건 pivot) 종료월 직후~현재 달 사이의
    // 인스턴스는 조회조차 되지 않아 조용히 안 지워진다 — mockListRecurringInstances 가
    // 인자에 반응해야만 이 회귀를 잡을 수 있다.
    it("종료월이 이번 달보다 앞서면 종료월 다음 달부터(이번 달 포함) 지운다(클램프)", async () => {
        const rows = [
            { id: "e3", period: "2026-03" },
            { id: "e4", period: "2026-04" },
            { id: "e7", period: "2026-07" },
        ]
        mockListRecurringInstances.mockImplementation(
            (_id: string, from: string) =>
                Promise.resolve(rows.filter((r) => r.period > from)),
        )
        ;(propagateRecurringUpdate as jest.Mock).mockImplementationOnce(
            actualPropagateRecurringUpdate,
        )
        renderEdit(7)
        fireEvent.change(screen.getByLabelText("종료월"), {
            target: { value: "2026-03" },
        })
        fireEvent.click(screen.getByRole("button", { name: "저장" }))

        expect(
            await screen.findByText(/2026년 4월부터의 지출 2건이 삭제됩니다/),
        ).not.toBeNull()

        fireEvent.click(await screen.findByRole("button", { name: "계속" }))

        await waitFor(() => {
            expect(mockDeleteExpense).toHaveBeenCalledTimes(2)
        })
        expect(mockDeleteExpense).toHaveBeenCalledWith("e4")
        expect(mockDeleteExpense).toHaveBeenCalledWith("e7")
        expect(mockDeleteExpense).not.toHaveBeenCalledWith("e3")
    })

    it("삭제될 지출이 없으면 확인 없이 저장한다", async () => {
        mockListRecurringInstances.mockResolvedValue([])
        renderEdit(null)
        fireEvent.change(screen.getByLabelText("종료월"), {
            target: { value: "2026-07" },
        })
        fireEvent.click(screen.getByRole("button", { name: "저장" }))

        await waitFor(() => {
            expect(mockUpdateRecurring).toHaveBeenCalled()
        })
        expect(screen.queryByText(/삭제됩니다/)).toBeNull()
    })

    // 실제로 인스턴스를 지우는 건 propagateRecurringUpdate 를 부르는 두 분기뿐이다
    // ("고정 수정"과 재고정). 고정 해제는 nowMonth 기준 removeRecurringFuture 를 쓰지,
    // endMonth 로 세지 않는다. template·endMonth 만 보고 게이트를 걸면 고정 해제 저장에서도
    // 엉뚱하게 확인창이 뜬다(그리고 확인해도 다이얼로그가 알린 건수만큼 지워지지 않는다).
    it("종료월을 고른 뒤 고정 해제하고 저장하면 확인 없이 바로 저장된다", async () => {
        mockListRecurringInstances.mockResolvedValue([
            { id: "e8", period: "2026-08" },
        ])
        renderEdit(null)
        fireEvent.change(screen.getByLabelText("종료월"), {
            target: { value: "2026-04" },
        })
        fireEvent.click(screen.getByRole("button", { name: "고정 해제" }))
        fireEvent.click(screen.getByRole("button", { name: "저장" }))

        await waitFor(() => {
            expect(mockUpdateRecurring).toHaveBeenCalledWith("r1", {
                active: false,
            })
        })
        expect(mockListRecurringInstances).not.toHaveBeenCalled()
        expect(screen.queryByText(/삭제됩니다/)).toBeNull()
    })

    // [I2] 재고정(고정 해제됐던 지출을 다시 고정으로 켜는 경우)도 "고정 수정"과 같은 게이트를
    // 타야 한다. 옛 템플릿엔 해제 당시 남은 인스턴스가 있을 수 있고, 종료월을 앞당기면 그
    // 인스턴스들이 삭제 대상이 된다 — wasRecurring 만 보던 옛 게이트는 이 경로를 놓쳤다.
    it("재고정하며 종료월을 앞당기면 확인을 받고, 확인 후 전파를 호출한다", async () => {
        mockListRecurringInstances.mockResolvedValue([
            { id: "e8", period: "2026-08" },
        ])
        render(
            <ExpenseForm
                categories={categories}
                savingsAccounts={[]}
                initial={{
                    id: "e1",
                    date: "2026-07-10",
                    recurringId: "r1",
                    period: "2026-07",
                    template: {
                        id: "r1",
                        startMonth: "2026-01",
                        termMonths: null,
                        active: false,
                    },
                    payload: { item: "월세", amount: 500_000 },
                    categoryId: "c-food",
                }}
                onSaved={jest.fn()}
                onCancel={jest.fn()}
                onDeleted={jest.fn()}
            />,
        )

        toggleRecurring()
        fireEvent.change(screen.getByLabelText("종료월"), {
            target: { value: "2026-07" },
        })
        fireEvent.click(screen.getByRole("button", { name: "저장" }))

        expect(
            await screen.findByText(/2026년 8월부터의 지출 1건이 삭제됩니다/),
        ).not.toBeNull()

        fireEvent.click(await screen.findByRole("button", { name: "계속" }))

        await waitFor(() => {
            expect(mockUpdateRecurring).toHaveBeenCalledWith(
                "r1",
                expect.objectContaining({ active: true, termMonths: 7 }),
            )
        })
        // 단순히 "불렸다"만 보면, propagateRecurringUpdate 호출 블록을 통째로 지워도 이
        // describe 의 앞선 테스트가 남긴 호출 기록(위 beforeEach 의 mockClear 가 없다면)이나
        // 같은 테스트 내 다른 경로 호출로 통과해버릴 수 있다. startMonth 는 특히 중요하다 —
        // 여기서 template.startMonth("2026-01") 대신 monthOf(date) 로 잘못 폴백하면 그 값이
        // "2026-07"이 되어 termMonthsFromEnd 계산이 어긋난 termMonths 를 저장한다.
        expect(propagateRecurringUpdate as jest.Mock).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                id: "r1",
                dayOfMonth: 10,
                categoryId: "c-food",
                startMonth: "2026-01",
                termMonths: 7,
            }),
            "2026-07",
            expect.objectContaining({ item: "월세", amount: 500_000 }),
            "2026-07",
        )
    })
})
