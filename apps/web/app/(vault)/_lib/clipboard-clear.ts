// 클립보드 자동 클리어 스케줄러. 만료 시점에 클립보드가 원래 값 그대로면 비운다.
export type ClearResult = "cleared" | "changed" | "denied"

export interface ClipboardLike {
    readText(): Promise<string>
    writeText(text: string): Promise<void>
}

export interface ScheduleOptions {
    value: string
    clipboard: ClipboardLike
    totalMs?: number
    intervalMs?: number
    onTick?: (remainingSeconds: number) => void
    onComplete?: (result: ClearResult) => void
}

const DEFAULT_TOTAL_MS = 30_000
const DEFAULT_INTERVAL_MS = 1_000

export function scheduleClipboardClear(opts: ScheduleOptions): () => void {
    const totalMs = opts.totalMs ?? DEFAULT_TOTAL_MS
    const intervalMs = opts.intervalMs ?? DEFAULT_INTERVAL_MS
    let remaining = Math.ceil(totalMs / intervalMs)
    let cancelled = false

    const handle = setInterval(() => {
        remaining -= 1
        opts.onTick?.(remaining)
        if (remaining <= 0) {
            clearInterval(handle)
            void complete()
        }
    }, intervalMs)

    async function complete(): Promise<void> {
        if (cancelled) return
        try {
            const current = await opts.clipboard.readText()
            if (current === opts.value) {
                await opts.clipboard.writeText("")
                opts.onComplete?.("cleared")
            } else {
                opts.onComplete?.("changed")
            }
        } catch {
            opts.onComplete?.("denied")
        }
    }

    return () => {
        cancelled = true
        clearInterval(handle)
    }
}
