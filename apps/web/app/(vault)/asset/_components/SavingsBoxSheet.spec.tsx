// SavingsBoxSheet 테스트(RTL). 저축 잔액을 넘는 이체를 막는지 검증한다.
// 넘겨서 이체하면 저축이 음수가 되고, 옮긴 돈은 쌈짓돈 잔액으로 그대로 잡혀 순자산이 부풀려진다.
const mockCreateSavingsBoxTxn = jest.fn()
jest.mock("@/lib/vault-client", () => ({
    __esModule: true,
    createSavingsBoxTxn: (...a: unknown[]) => mockCreateSavingsBoxTxn(...a),
}))
jest.mock("../_lib/asset-payload", () => ({
    __esModule: true,
    sealBoxTxn: jest
        .fn()
        .mockResolvedValue({ iv: "AA", ciphertext: "BB", authTag: "CC" }),
}))
jest.mock("../../_lib/vault-context", () => ({
    __esModule: true,
    useVault: () => ({ vaultKey: {} as CryptoKey, resetIdle: () => {} }),
}))

import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { SavingsBoxSheet } from "./SavingsBoxSheet"

function open(savedAvailable: number) {
    const onSaved = jest.fn()
    render(
        <SavingsBoxSheet
            mode="in"
            savedAvailable={savedAvailable}
            date="2026-07-14"
            onSaved={onSaved}
            onClose={() => {}}
        />,
    )
    fireEvent.click(screen.getByText("저축에서 이체"))
    return { onSaved }
}

function typeAmount(value: string) {
    fireEvent.change(screen.getByLabelText("금액"), { target: { value } })
}

function saveButton(): HTMLButtonElement {
    return screen.getByRole("button", {
        name: "입금 기록",
    }) as HTMLButtonElement
}

beforeEach(() => mockCreateSavingsBoxTxn.mockReset())

describe("SavingsBoxSheet — 저축에서 이체", () => {
    it("저축 잔액을 넘으면 경고를 띄우고 저장 버튼을 막는다", () => {
        open(300_000)
        typeAmount("500000")

        expect(screen.getByRole("alert").textContent).toContain(
            "넘을 수 없어요",
        )
        expect(saveButton().disabled).toBe(true)
    })

    it("저축 잔액을 넘지 않으면 저장한다", async () => {
        mockCreateSavingsBoxTxn.mockResolvedValue({ id: "b1" })
        const { onSaved } = open(300_000)
        typeAmount("300000")

        fireEvent.click(saveButton())

        await waitFor(() => expect(onSaved).toHaveBeenCalled())
        expect(mockCreateSavingsBoxTxn).toHaveBeenCalledWith(
            "in",
            "savings",
            "2026-07-14",
            { iv: "AA", ciphertext: "BB", authTag: "CC" },
        )
    })

    it("직접 입금(현금)은 저축 잔액 상한을 받지 않는다", async () => {
        mockCreateSavingsBoxTxn.mockResolvedValue({ id: "b2" })
        render(
            <SavingsBoxSheet
                mode="in"
                savedAvailable={0}
                date="2026-07-14"
                onSaved={jest.fn()}
                onClose={() => {}}
            />,
        )
        typeAmount("500000") // 출처 = 직접 입금(기본값)

        expect(saveButton().disabled).toBe(false)
        fireEvent.click(saveButton())

        await waitFor(() =>
            expect(mockCreateSavingsBoxTxn).toHaveBeenCalledWith(
                "in",
                "cash",
                "2026-07-14",
                expect.anything(),
            ),
        )
    })
})
