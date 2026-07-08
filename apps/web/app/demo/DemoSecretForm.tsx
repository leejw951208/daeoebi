"use client"
// 데모용 신규/수정 폼. 실제 SecretForm 의 2단계 흐름(편집 → 저장 전 확인)을 충실히 재현하되
// 암호화·서버 저장 없이 메모리 상태로만 동작한다. vault-client·VK 를 쓰지 않는다.
import { useState } from "react"
import { FIELD_SUGGESTIONS } from "../(vault)/_lib/field-suggestions"
import type { DemoField, DemoSecret } from "./demo-data"

const MAX_FIELDS = 20

interface FieldRow extends DemoField {
    key: string
}

let rowSeq = 0
function makeRow(field?: DemoField): FieldRow {
    rowSeq += 1
    return {
        key: `d${rowSeq}`,
        name: field?.name ?? "",
        value: field?.value ?? "",
    }
}

interface Props {
    initial: DemoSecret | null
    onSave: (input: {
        label: string
        fields: DemoField[]
        memo: string
    }) => void
    onCancel: () => void
}

export function DemoSecretForm({ initial, onSave, onCancel }: Props) {
    const [step, setStep] = useState<"edit" | "review">("edit")
    const [label, setLabel] = useState(initial?.label ?? "")
    const [memo, setMemo] = useState(initial?.memo ?? "")
    const [rows, setRows] = useState<FieldRow[]>(
        initial && initial.fields.length > 0
            ? initial.fields.map((f) => makeRow(f))
            : [makeRow()],
    )
    const [hint, setHint] = useState<string | null>(null)

    function updateRow(index: number, patch: Partial<DemoField>) {
        setRows((prev) =>
            prev.map((r, i) => (i === index ? { ...r, ...patch } : r)),
        )
    }
    function addRow(name = "") {
        setRows((prev) =>
            prev.length >= MAX_FIELDS
                ? prev
                : [...prev, makeRow({ name, value: "" })],
        )
    }
    function removeRow(index: number) {
        setRows((prev) => prev.filter((_, i) => i !== index))
    }
    function moveRow(index: number, dir: -1 | 1) {
        setRows((prev) => {
            const next = [...prev]
            const target = index + dir
            if (target < 0 || target >= next.length) return prev
            ;[next[index], next[target]] = [next[target], next[index]]
            return next
        })
    }

    function goReview() {
        if (!label.trim()) {
            setHint("제목을 입력하세요.")
            return
        }
        const names = rows.map((r) => r.name.trim()).filter(Boolean)
        if (new Set(names).size !== names.length) {
            setHint("필드 이름이 중복되었습니다.")
            return
        }
        setHint(null)
        setStep("review")
    }

    function confirmSave() {
        const fields = rows
            .map((r) => ({
                name: r.name.trim(),
                value: r.value,
            }))
            .filter((f) => f.name)
        onSave({ label: label.trim(), fields, memo })
    }

    const usedNames = new Set(rows.map((r) => r.name.trim()).filter(Boolean))
    const reviewFields = rows.filter((r) => r.name.trim())

    // ── 2단계: 저장 전 확인 ──
    if (step === "review") {
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
                        onClick={() => setStep("edit")}
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
                        onClick={confirmSave}
                    >
                        암호화하여 저장
                    </button>
                </div>
            </div>
        )
    }

    // ── 1단계: 편집 ──
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
                <button type="button" className="btn-text" onClick={onCancel}>
                    취소
                </button>
                <div style={{ fontSize: 15, fontWeight: 700 }}>
                    {initial ? "항목 수정" : "새 항목"}
                </div>
                <button
                    type="button"
                    className="btn-text"
                    style={{ color: "var(--ac)", fontWeight: 700 }}
                    onClick={goReview}
                >
                    다음
                </button>
            </div>

            <div
                className="stagger"
                style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 22,
                    minWidth: 0,
                }}
            >
                {hint && (
                    <div
                        role="alert"
                        className="error-box"
                        style={{ margin: 0 }}
                    >
                        {hint}
                    </div>
                )}

                <div className="form-row" style={{ margin: 0 }}>
                    <label htmlFor="demo-label">
                        제목{" "}
                        <span
                            style={{
                                color: "var(--color-text-muted)",
                                fontWeight: 600,
                            }}
                        >
                            · 평문 저장
                        </span>
                    </label>
                    <input
                        id="demo-label"
                        type="text"
                        className="field-control"
                        placeholder="예: 국민은행 인터넷뱅킹"
                        value={label}
                        onChange={(e) => {
                            setLabel(e.target.value)
                            if (hint) setHint(null)
                        }}
                        maxLength={200}
                        autoComplete="off"
                    />
                </div>

                <fieldset
                    style={{
                        border: "none",
                        padding: 0,
                        margin: 0,
                        minWidth: 0,
                    }}
                >
                    <legend
                        style={{
                            display: "flex",
                            width: "100%",
                            alignItems: "center",
                            justifyContent: "space-between",
                            marginBottom: 9,
                            padding: 0,
                        }}
                    >
                        <span
                            style={{
                                fontSize: 11.5,
                                fontWeight: 700,
                                color: "var(--color-text-muted)",
                            }}
                        >
                            필드{" "}
                            <span
                                style={{
                                    color: "var(--color-text-muted)",
                                    fontWeight: 600,
                                }}
                            >
                                · 암호화
                            </span>
                        </span>
                        <span
                            style={{
                                fontSize: 11,
                                fontWeight: 700,
                                color: "var(--color-text-muted)",
                            }}
                        >
                            {usedNames.size}/{MAX_FIELDS}
                        </span>
                    </legend>

                    <div
                        className="scr"
                        style={{
                            display: "flex",
                            gap: 6,
                            overflowX: "auto",
                            minWidth: 0,
                            paddingBottom: 8,
                            marginBottom: 9,
                        }}
                    >
                        <span
                            style={{
                                flexShrink: 0,
                                fontSize: 11,
                                color: "var(--color-text-muted)",
                                alignSelf: "center",
                                fontWeight: 600,
                            }}
                        >
                            추천
                        </span>
                        {FIELD_SUGGESTIONS.map((s) => (
                            <button
                                key={s.name}
                                type="button"
                                className="chip"
                                onClick={() => addRow(s.name)}
                                disabled={
                                    usedNames.has(s.name) ||
                                    rows.length >= MAX_FIELDS
                                }
                            >
                                + {s.name}
                            </button>
                        ))}
                    </div>

                    <div style={{ display: "grid", gap: 9 }}>
                        {rows.map((row, idx) => (
                            <div
                                key={row.key}
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
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 8,
                                    }}
                                >
                                    <span
                                        aria-hidden="true"
                                        style={{
                                            color: "#cdcdcd",
                                            fontSize: 16,
                                            lineHeight: 1,
                                        }}
                                    >
                                        ⋮⋮
                                    </span>
                                    <input
                                        aria-label={`필드 ${idx + 1} 이름`}
                                        placeholder="필드 이름"
                                        value={row.name}
                                        onChange={(e) =>
                                            updateRow(idx, {
                                                name: e.target.value,
                                            })
                                        }
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
                                    <div
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 2,
                                        }}
                                    >
                                        <button
                                            type="button"
                                            className="secret-btn"
                                            onClick={() => moveRow(idx, -1)}
                                            disabled={idx === 0}
                                            aria-label={`필드 ${idx + 1} 위로`}
                                        >
                                            ↑
                                        </button>
                                        <button
                                            type="button"
                                            className="secret-btn"
                                            onClick={() => moveRow(idx, 1)}
                                            disabled={idx === rows.length - 1}
                                            aria-label={`필드 ${idx + 1} 아래로`}
                                        >
                                            ↓
                                        </button>
                                        <button
                                            type="button"
                                            className="secret-btn"
                                            style={{ color: "#d99" }}
                                            onClick={() => removeRow(idx)}
                                            aria-label={`필드 ${idx + 1} 삭제`}
                                        >
                                            ✕
                                        </button>
                                    </div>
                                </div>
                                <input
                                    className="field-control"
                                    aria-label={`필드 ${idx + 1} 값`}
                                    placeholder="값 입력"
                                    value={row.value}
                                    onChange={(e) =>
                                        updateRow(idx, {
                                            value: e.target.value,
                                        })
                                    }
                                    maxLength={4096}
                                    autoComplete="off"
                                    style={{
                                        minHeight: 44,
                                        border: "1px solid #e9e9e9",
                                        borderRadius: 10,
                                        background: "#fff",
                                    }}
                                />
                            </div>
                        ))}

                        <button
                            type="button"
                            onClick={() => addRow()}
                            disabled={rows.length >= MAX_FIELDS}
                            style={{
                                minHeight: 46,
                                border: "1.5px dashed #d8d8d8",
                                borderRadius: 13,
                                background: "none",
                                font: "inherit",
                                fontSize: 14,
                                fontWeight: 700,
                                color: "var(--ac)",
                                cursor:
                                    rows.length >= MAX_FIELDS
                                        ? "not-allowed"
                                        : "pointer",
                                opacity: rows.length >= MAX_FIELDS ? 0.5 : 1,
                            }}
                        >
                            + 필드 추가
                        </button>
                    </div>
                </fieldset>

                <div className="form-row" style={{ margin: 0 }}>
                    <label htmlFor="demo-memo">
                        메모{" "}
                        <span
                            style={{
                                color: "var(--color-text-muted)",
                                fontWeight: 600,
                            }}
                        >
                            · 암호화 · 선택
                        </span>
                    </label>
                    <textarea
                        id="demo-memo"
                        className="field-control"
                        placeholder="선택 입력"
                        value={memo}
                        onChange={(e) => setMemo(e.target.value)}
                        rows={3}
                        maxLength={4096}
                    />
                </div>

                <div
                    style={{
                        display: "flex",
                        gap: 9,
                        alignItems: "flex-start",
                        padding: "13px 14px",
                        borderRadius: 13,
                        background: "var(--soft)",
                    }}
                >
                    <span
                        aria-hidden="true"
                        style={{ fontSize: 14, lineHeight: 1.4 }}
                    >
                        🔒
                    </span>
                    <span
                        style={{
                            fontSize: 12.5,
                            lineHeight: 1.5,
                            color: "#666",
                            fontWeight: 500,
                        }}
                    >
                        제목만 평문으로 저장되고, 필드 이름·값·메모는 통째로
                        암호화됩니다. (데모는 저장하지 않습니다.)
                    </span>
                </div>
            </div>
        </div>
    )
}
