// ExpenseForm 테스트(RTL). 저축 지출의 항목이 적금 계좌 선택으로 바뀌는지,
// 계좌명과 어긋난 값으로 저장되지 않는지 검증한다.
//
// 저축 집계(savingsByItem)는 항목과 계좌명의 문자열 완전 일치로 붙는다. 자유 텍스트로 두면
// "청년적금" vs "청년 적금" 한 칸 차이로 금액이 저축 총액에서 조용히 증발한다.
const mockCreateExpense = jest.fn()
jest.mock("@/lib/vault-client", () => ({
    __esModule: true,
    createExpense: (...a: unknown[]) => mockCreateExpense(...a),
    createRecurring: jest.fn(),
    deleteExpense: jest.fn(),
    deleteRecurring: jest.fn(),
    updateExpense: jest.fn(),
    updateRecurring: jest.fn(),
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

import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { ExpenseForm } from "./ExpenseForm"
import type { AssetCategory } from "@/lib/vault-client"

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

beforeEach(() => {
    mockCreateExpense.mockReset()
    mockCreateExpense.mockResolvedValue({ id: "e1" })
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
