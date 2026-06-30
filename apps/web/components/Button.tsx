import type { ButtonHTMLAttributes, ReactNode } from "react"
import { Spinner } from "./Spinner"

type Variant = "primary" | "secondary" | "danger" | "text"

const VARIANT_CLASS: Record<Variant, string> = {
    primary: "btn",
    secondary: "btn secondary",
    danger: "btn danger",
    text: "btn-text",
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    // 진행 중이면 스피너 표시 + 자동 비활성화 + aria-busy.
    loading?: boolean
    variant?: Variant
    children?: ReactNode
}

// 공용 버튼. 기존 .btn/.btn-text 마크업을 감싸 로딩 표현을 통일한다.
// 상태/핸들러는 호출처가 그대로 갖고, loading 만 내려준다.
export function Button({
    loading = false,
    variant = "primary",
    disabled,
    className,
    children,
    type = "button",
    ...rest
}: ButtonProps) {
    const base = VARIANT_CLASS[variant]
    const cls = className ? `${base} ${className}` : base
    return (
        <button
            type={type}
            className={cls}
            disabled={loading || disabled}
            aria-busy={loading || undefined}
            {...rest}
        >
            {loading && <Spinner size={16} className="btn-spinner" />}
            {children}
        </button>
    )
}
