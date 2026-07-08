"use client"
// 시크릿 편집 1단계의 필드 한 행. 이름·값 입력과 마스킹 토글·재정렬·삭제 버튼을 묶는다.
// 상태는 보유하지 않고 상위(SecretForm)가 내려준 콜백만 호출하는 표현 컴포넌트다.
import type { PointerEvent } from "react"
import type { SecretField } from "../../_lib/vault-context"

// 디자인의 style-active="opacity:.4" 프레스 효과. 인라인 스타일은 :active 를
// 표현할 수 없어 포인터 이벤트로 opacity 를 토글한다.
function pressOpacity(opacity: number, rest?: number) {
    const set = (e: PointerEvent<HTMLElement>) => {
        e.currentTarget.style.opacity = String(opacity)
    }
    const reset = (e: PointerEvent<HTMLElement>) => {
        e.currentTarget.style.opacity = rest === undefined ? "" : String(rest)
    }
    return {
        onPointerDown: set,
        onPointerUp: reset,
        onPointerLeave: reset,
        onPointerCancel: reset,
    }
}

// 이동/삭제 버튼 공통 기반 스타일(디자인 28×28 플레이트). :disabled dim 없음.
const rowBtnBase = {
    width: 28,
    height: 28,
    border: "none",
    background: "none",
    cursor: "pointer",
    padding: 0,
    lineHeight: 1,
} as const

interface Props {
    index: number
    name: string
    value: string
    sensitive: boolean
    isFirst: boolean
    isLast: boolean
    onUpdate: (patch: Partial<SecretField>) => void
    onMove: (dir: -1 | 1) => void
    onRemove: () => void
}

export function SecretFieldRow({
    index,
    name,
    value,
    sensitive,
    isFirst,
    isLast,
    onUpdate,
    onMove,
    onRemove,
}: Props) {
    return (
        <div
            style={{
                border: "1.5px solid #ececec",
                borderRadius: 14,
                background: "var(--tint)",
                padding: "11px 12px",
                display: "flex",
                flexDirection: "column",
                gap: 8,
                animation: "fadeUp 0.3s both",
            }}
        >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                    aria-hidden="true"
                    style={{
                        color: "#cdcdcd",
                        fontSize: 16,
                        lineHeight: 1,
                        cursor: "grab",
                    }}
                >
                    ⋮⋮
                </span>
                <input
                    aria-label={`필드 ${index + 1} 이름`}
                    placeholder="필드 이름"
                    value={name}
                    onChange={(e) => onUpdate({ name: e.target.value })}
                    maxLength={128}
                    style={{
                        flex: 1,
                        minHeight: 40,
                        border: "none",
                        background: "none",
                        font: "inherit",
                        fontSize: 14.5,
                        fontWeight: 700,
                        color: "#222",
                        outline: "none",
                        padding: 0,
                    }}
                />
                <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <button
                        type="button"
                        onClick={() => onUpdate({ sensitive: !sensitive })}
                        {...pressOpacity(0.4, sensitive ? 1 : 0.5)}
                        aria-pressed={sensitive}
                        aria-label={`필드 ${index + 1} 값 ${sensitive ? "표시로 전환" : "가림으로 전환"}`}
                        title={
                            sensitive
                                ? "상세에서 가림(마스킹)"
                                : "상세에서 표시"
                        }
                        style={{
                            ...rowBtnBase,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 13,
                            opacity: sensitive ? 1 : 0.5,
                        }}
                    >
                        {sensitive ? "🔒" : "👁"}
                    </button>
                    <button
                        type="button"
                        onClick={() => onMove(-1)}
                        disabled={isFirst}
                        {...pressOpacity(0.4)}
                        aria-label={`필드 ${index + 1} 위로`}
                        style={{ ...rowBtnBase, color: "#bbb", fontSize: 13 }}
                    >
                        ↑
                    </button>
                    <button
                        type="button"
                        onClick={() => onMove(1)}
                        disabled={isLast}
                        {...pressOpacity(0.4)}
                        aria-label={`필드 ${index + 1} 아래로`}
                        style={{ ...rowBtnBase, color: "#bbb", fontSize: 13 }}
                    >
                        ↓
                    </button>
                    <button
                        type="button"
                        onClick={onRemove}
                        {...pressOpacity(0.4)}
                        aria-label={`필드 ${index + 1} 삭제`}
                        style={{ ...rowBtnBase, color: "#d99", fontSize: 15 }}
                    >
                        ✕
                    </button>
                </div>
            </div>
            <input
                className="field-control"
                aria-label={`필드 ${index + 1} 값`}
                placeholder="값 입력"
                value={value}
                onChange={(e) => onUpdate({ value: e.target.value })}
                maxLength={4096}
                autoComplete="off"
                style={{
                    minHeight: 44,
                    border: "1px solid #e9e9e9",
                    borderRadius: 10,
                    background: "#fff",
                    padding: "0 13px",
                    fontSize: 14.5,
                    fontWeight: 400,
                    color: "#333",
                }}
            />
        </div>
    )
}
