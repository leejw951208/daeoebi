"use client"
// 시크릿 폼 2단계: 저장 전 확인. 제목·필드(마스킹 반영)·메모를 요약해 보여주고
// "암호화하여 저장"으로 확정한다. 상태 없이 상위가 내려준 값·콜백만 사용한다.
import type { FieldRow } from "./types"

interface Props {
    label: string
    reviewFields: FieldRow[]
    memo: string
    error: string | null
    submitting: boolean
    onBack: () => void
    onConfirm: () => void
}

export function SecretReviewStep({
    label,
    reviewFields,
    memo,
    error,
    submitting,
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
                className="sticky-header"
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                }}
            >
                <button
                    type="button"
                    className="btn-text"
                    onClick={onBack}
                    disabled={submitting}
                >
                    ← 수정
                </button>
                <div style={{ fontSize: 15, fontWeight: 700 }}>
                    저장 전 확인
                </div>
                <span style={{ width: 36 }} aria-hidden="true" />
            </div>

            {error && (
                <div role="alert" className="error-box">
                    {error}
                </div>
            )}

            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 14,
                    flex: 1,
                }}
            >
                <div>
                    <div
                        style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: "var(--color-text-muted)",
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

                {reviewFields.length > 0 && (
                    <div
                        style={{
                            border: "1px solid var(--color-border)",
                            borderRadius: 15,
                            overflow: "hidden",
                        }}
                    >
                        {reviewFields.map((r, idx) => (
                            <div
                                key={r.key}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    gap: 12,
                                    padding: "13px 15px",
                                    borderBottom:
                                        idx === reviewFields.length - 1
                                            ? "none"
                                            : "1px solid #f5f5f5",
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
                                {r.sensitive ? (
                                    <span
                                        aria-label="값 숨김"
                                        style={{
                                            fontFamily: "var(--font-mono)",
                                            fontSize: 14,
                                            letterSpacing: "0.04em",
                                            color: "var(--color-text-muted)",
                                        }}
                                    >
                                        ••••••••
                                    </span>
                                ) : (
                                    <span
                                        style={{
                                            fontSize: 14,
                                            color: "var(--color-text-secondary)",
                                            wordBreak: "break-all",
                                            textAlign: "right",
                                            minWidth: 0,
                                        }}
                                    >
                                        {r.value.trim() || "—"}
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                )}

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
                                color: "var(--color-text-muted)",
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
                    padding: "14px 0 22px",
                    marginTop: 14,
                    background:
                        "linear-gradient(180deg, rgba(255,255,255,0), #fff 30%)",
                }}
            >
                <button
                    type="button"
                    className="btn"
                    style={{ width: "100%" }}
                    onClick={onConfirm}
                    disabled={submitting}
                >
                    {submitting ? "암호화하여 저장 중…" : "암호화하여 저장"}
                </button>
            </div>
        </div>
    )
}
