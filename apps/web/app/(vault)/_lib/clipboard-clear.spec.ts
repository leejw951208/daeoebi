// 클립보드 자동 클리어 스케줄러의 단위 테스트. 권한 분기와 값 비교 동작을 회귀 방지.
import { scheduleClipboardClear } from "./clipboard-clear"

function makeClipboard(initial: string) {
    let current = initial
    return {
        readText: jest.fn(async () => current),
        writeText: jest.fn(async (text: string) => {
            current = text
        }),
        setExternal(text: string) {
            current = text
        },
        get(): string {
            return current
        },
    }
}

describe("scheduleClipboardClear", () => {
    beforeEach(() => {
        jest.useFakeTimers()
    })

    afterEach(() => {
        jest.useRealTimers()
    })

    it("totalMs 경과 후 클립보드가 우리 값과 같으면 비우고 cleared 를 통지한다", async () => {
        const clipboard = makeClipboard("secret-pw")
        const onComplete = jest.fn()

        scheduleClipboardClear({
            value: "secret-pw",
            clipboard,
            totalMs: 30_000,
            intervalMs: 1_000,
            onComplete,
        })

        await jest.advanceTimersByTimeAsync(30_000)

        expect(clipboard.writeText).toHaveBeenCalledWith("")
        expect(clipboard.get()).toBe("")
        expect(onComplete).toHaveBeenCalledWith("cleared")
    })

    it("만료 시점에 클립보드 값이 바뀌었으면 비우지 않고 changed 를 통지한다", async () => {
        const clipboard = makeClipboard("secret-pw")
        const onComplete = jest.fn()

        scheduleClipboardClear({
            value: "secret-pw",
            clipboard,
            totalMs: 30_000,
            intervalMs: 1_000,
            onComplete,
        })

        clipboard.setExternal("user-typed-something-else")

        await jest.advanceTimersByTimeAsync(30_000)

        expect(clipboard.writeText).not.toHaveBeenCalled()
        expect(clipboard.get()).toBe("user-typed-something-else")
        expect(onComplete).toHaveBeenCalledWith("changed")
    })

    it("clipboard 접근이 거부되면 denied 를 통지한다", async () => {
        const denied = {
            readText: jest.fn(async () => {
                throw new Error("permission denied")
            }),
            writeText: jest.fn(async () => {
                throw new Error("permission denied")
            }),
        }
        const onComplete = jest.fn()

        scheduleClipboardClear({
            value: "secret-pw",
            clipboard: denied,
            totalMs: 30_000,
            intervalMs: 1_000,
            onComplete,
        })

        await jest.advanceTimersByTimeAsync(30_000)

        expect(onComplete).toHaveBeenCalledWith("denied")
    })

    it("cancel 함수를 호출하면 만료가 발생하지 않는다", async () => {
        const clipboard = makeClipboard("secret-pw")
        const onComplete = jest.fn()

        const cancel = scheduleClipboardClear({
            value: "secret-pw",
            clipboard,
            totalMs: 30_000,
            intervalMs: 1_000,
            onComplete,
        })

        await jest.advanceTimersByTimeAsync(10_000)
        cancel()
        await jest.advanceTimersByTimeAsync(30_000)

        expect(clipboard.writeText).not.toHaveBeenCalled()
        expect(onComplete).not.toHaveBeenCalled()
    })

    it("intervalMs 마다 남은 초를 onTick 으로 알린다", async () => {
        const clipboard = makeClipboard("secret-pw")
        const onTick = jest.fn()

        scheduleClipboardClear({
            value: "secret-pw",
            clipboard,
            totalMs: 3_000,
            intervalMs: 1_000,
            onTick,
        })

        await jest.advanceTimersByTimeAsync(3_000)

        expect(onTick.mock.calls.map((c) => c[0])).toEqual([2, 1, 0])
    })
})
