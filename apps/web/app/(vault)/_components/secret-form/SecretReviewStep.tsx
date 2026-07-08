"use client"
// 시크릿 폼 2단계: 저장 전 확인. 제목·필드(값 원문 표시)·메모를 요약해 보여주고
// "암호화하여 저장"으로 확정한다. 상태 없이 상위가 내려준 값·콜백만 사용한다.
import type { PointerEvent } from "react"
import type { FieldRow } from "./types"

interface Props {
    label: string
    reviewFields: FieldRow[]
    memo: string
    onBack: () => void
    onConfirm: () => void
}

// 디자인의 style-active 프레스 효과. 인라인 스타일은 :active 를 표현할 수 없어
// 포인터 이벤트로 transform 을 토글한다.
function pressScale(scale: number) {
    const set = (e: PointerEvent<HTMLElement>) => {
        e.currentTarget.style.transform = `scale(${scale})`
    }
    const reset = (e: PointerEvent<HTMLElement>) => {
        e.currentTarget.style.transform = ""
    }
    return {
        onPointerDown: set,
        onPointerUp: reset,
        onPointerLeave: reset,
        onPointerCancel: reset,
    }
}

export function SecretReviewStep({
    label,
    reviewFields,
    memo,
    onBack,
    onConfirm,
}: Props) {
    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                minHeight: "100%",
            }}
        >
            <div
                className="sticky-header tight"
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                }}
            >
                <button
                    type="button"
                    className="btn-text"
                    style={{ color: "#888", fontWeight: 400 }}
                    onClick={onBack}
                >
                    ← 수정
                </button>
                <div style={{ fontSize: 15, fontWeight: 700 }}>
                    저장 전 확인
                </div>
                <span style={{ width: 36 }} aria-hidden="true" />
            </div>

            <div
                className="stagger"
                style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 14,
                    flex: 1,
                    marginInline: "calc(-1 * var(--container-padding))",
                    paddingInline: 18,
                    paddingTop: 22,
                    paddingBottom: 30,
                }}
            >
                <div>
                    <div
                        style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: "#bcbcbc",
                            marginBottom: 4,
                        }}
                    >
                        제목
                    </div>
                    <div
                        style={{
                            fontSize: 20,
                            fontWeight: 800,
                            letterSpacing: "-0.02em",
                        }}
                    >
                        {label.trim()}
                    </div>
                </div>

                <div
                    style={{
                        border: "1px solid var(--color-border)",
                        borderRadius: 15,
                        overflow: "hidden",
                    }}
                >
                    {reviewFields.map((r) => (
                        <div
                            key={r.key}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 12,
                                padding: "13px 15px",
                                borderBottom: "1px solid #f5f5f5",
                            }}
                        >
                            <span
                                style={{
                                    fontSize: 13.5,
                                    fontWeight: 700,
                                    color: "var(--color-text-secondary)",
                                    flexShrink: 0,
                                }}
                            >
                                {r.name.trim()}
                            </span>
                            <span
                                style={{
                                    fontSize: 14,
                                    fontWeight: 600,
                                    color: "#333",
                                    textAlign: "right",
                                    maxWidth: 150,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                }}
                            >
                                {r.value.trim() || "—"}
                            </span>
                        </div>
                    ))}
                </div>

                {memo.trim() && (
                    <div
                        style={{
                            padding: "14px 16px",
                            border: "1px solid var(--color-border)",
                            borderRadius: 15,
                        }}
                    >
                        <div
                            style={{
                                fontSize: 11,
                                fontWeight: 700,
                                color: "#bcbcbc",
                                marginBottom: 5,
                            }}
                        >
                            메모
                        </div>
                        <div
                            style={{
                                fontSize: 14,
                                lineHeight: 1.5,
                                color: "var(--color-text-secondary)",
                                whiteSpace: "pre-wrap",
                            }}
                        >
                            {memo}
                        </div>
                    </div>
                )}
            </div>

            <div
                style={{
                    position: "sticky",
                    bottom: 0,
                    padding: "14px 18px 22px",
                    marginInline: "calc(-1 * var(--container-padding))",
                    background:
                        "linear-gradient(180deg, rgba(255,255,255,0), #fff 30%)",
                }}
            >
                <button
                    type="button"
                    onClick={onConfirm}
                    {...pressScale(0.97)}
                    style={{
                        width: "100%",
                        height: 54,
                        border: "none",
                        borderRadius: 16,
                        background: "var(--ac)",
                        color: "#fff",
                        font: "inherit",
                        fontSize: 16,
                        fontWeight: 700,
                        cursor: "pointer",
                        boxShadow: "0 8px 22px -8px var(--ac)",
                    }}
                >
                    암호화하여 저장
                </button>
            </div>
        </div>
    )
}
