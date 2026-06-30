// 인라인 로딩 스피너. 색은 currentColor 를 상속해 버튼 글자색에 맞춘다. 장식 요소(aria-hidden).
interface SpinnerProps {
    // 지름(px). 기본 16.
    size?: number
    className?: string
}

export function Spinner({ size = 16, className }: SpinnerProps) {
    return (
        <span
            className={className ? `spinner ${className}` : "spinner"}
            style={{ width: size, height: size }}
            aria-hidden="true"
        />
    )
}
