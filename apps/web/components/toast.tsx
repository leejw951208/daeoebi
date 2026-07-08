// 앱 전역 토스트. 저장 실패 등 인라인 에러 박스를 대체하는 하단 중앙 pill.
// 디자인(claude.ai/design): bg #171717, 흰 글자, 13.5px, radius 999, animation toastUp .3s.
"use client"

import { useSyncExternalStore } from "react"

interface ToastItem {
    id: number
    message: string
}

/** 자동 소멸까지의 시간(ms). */
const TOAST_DURATION_MS = 2400
/** 여러 토스트가 쌓일 때 위로 밀어 올리는 간격(px). */
const TOAST_STACK_GAP = 52

let toasts: ToastItem[] = []
let nextId = 0
const listeners = new Set<() => void>()

function emit(): void {
    for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => {
        listeners.delete(listener)
    }
}

function getSnapshot(): ToastItem[] {
    return toasts
}

function removeToast(id: number): void {
    toasts = toasts.filter((item) => item.id !== id)
    emit()
}

/**
 * 하단 중앙 토스트를 띄운다. 어디서든 호출 가능(모듈 레벨 이벤트 이미터).
 * `<ToastHost/>` 가 layout 에 마운트돼 있어야 렌더된다.
 */
export function toast(message: string): void {
    const id = nextId++
    toasts = [...toasts, { id, message }]
    emit()
    if (typeof window !== "undefined") {
        window.setTimeout(() => removeToast(id), TOAST_DURATION_MS)
    }
}

/** 활성 토스트를 구독·렌더하는 호스트. layout 에서 한 번만 마운트한다. */
export function ToastHost() {
    const items = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

    if (items.length === 0) return null

    return (
        <>
            {items.map((item, index) => (
                <div
                    key={item.id}
                    role="status"
                    aria-live="polite"
                    style={{
                        position: "fixed",
                        left: "50%",
                        bottom: `calc(88px + ${index * TOAST_STACK_GAP}px)`,
                        transform: "translateX(-50%)",
                        zIndex: 200,
                        maxWidth: "calc(100% - 32px)",
                        padding: "12px 20px",
                        borderRadius: 999,
                        background: "#171717",
                        color: "#fff",
                        fontSize: 13.5,
                        fontWeight: 600,
                        lineHeight: 1.4,
                        textAlign: "center",
                        boxShadow: "0 10px 30px -8px rgba(0, 0, 0, 0.4)",
                        animation:
                            "toastUp 0.3s cubic-bezier(0.22, 1, 0.36, 1) both",
                        pointerEvents: "none",
                    }}
                >
                    {item.message}
                </div>
            ))}
        </>
    )
}
