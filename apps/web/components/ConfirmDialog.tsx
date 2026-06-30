"use client"
// 모바일 bottom-sheet · 데스크탑 modal 스타일의 확인 다이얼로그. native confirm() 대체.
import { useEffect, useRef } from "react"
import { Button } from "@/components/Button"
import { Spinner } from "@/components/Spinner"

interface Props {
    open: boolean
    title?: string
    message: string
    confirmLabel?: string
    cancelLabel?: string
    destructive?: boolean
    /** true 이면 확인 버튼에 스피너를 표시하고 양쪽 버튼을 비활성화한다. */
    confirmLoading?: boolean
    onConfirm: () => void
    onCancel: () => void
}

export function ConfirmDialog({
    open,
    title = "확인",
    message,
    confirmLabel = "확인",
    cancelLabel = "취소",
    destructive,
    confirmLoading = false,
    onConfirm,
    onCancel,
}: Props) {
    const confirmRef = useRef<HTMLButtonElement>(null)
    const dialogRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!open) return
        confirmRef.current?.focus()
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                // 진행 중(삭제 등)엔 Esc 로 닫지 않는다(스피너 숨김·취소 혼선 방지).
                if (!confirmLoading) onCancel()
                return
            }
            if (e.key !== "Tab") return
            const root = dialogRef.current
            if (!root) return
            const focusables = root.querySelectorAll<HTMLElement>(
                'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
            )
            if (focusables.length === 0) return
            const first = focusables[0]!
            const last = focusables[focusables.length - 1]!
            const active = document.activeElement as HTMLElement | null
            if (e.shiftKey && active === first) {
                e.preventDefault()
                last.focus()
            } else if (!e.shiftKey && active === last) {
                e.preventDefault()
                first.focus()
            }
        }
        document.addEventListener("keydown", onKey)
        return () => document.removeEventListener("keydown", onKey)
    }, [open, onCancel, confirmLoading])

    if (!open) return null

    return (
        <div
            className="dialog-backdrop"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dialog-title"
            onClick={(e) => {
                // 진행 중엔 배경 클릭으로 닫지 않는다.
                if (e.target === e.currentTarget && !confirmLoading) onCancel()
            }}
        >
            <div className="dialog" ref={dialogRef}>
                <h2 id="dialog-title" className="dialog-title">
                    {title}
                </h2>
                <p className="dialog-message">{message}</p>
                <div className="dialog-actions">
                    <Button
                        variant="secondary"
                        disabled={confirmLoading}
                        onClick={onCancel}
                    >
                        {cancelLabel}
                    </Button>
                    {/* ref 로 오토포커스가 필요하므로 raw <button> 유지.
                        Button 이 forwardRef 를 구현하지 않기 때문에 ref 를 전달할 수 없다.
                        대신 Spinner·disabled·aria-busy 를 직접 적용해 동일 효과를 낸다. */}
                    <button
                        ref={confirmRef}
                        type="button"
                        className={destructive ? "btn danger" : "btn"}
                        disabled={confirmLoading}
                        aria-busy={confirmLoading || undefined}
                        onClick={onConfirm}
                    >
                        {confirmLoading && (
                            <Spinner size={16} className="btn-spinner" />
                        )}
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    )
}
