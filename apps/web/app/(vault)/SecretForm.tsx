"use client"
// 시크릿 신규/수정 폼. 사용자가 필드를 직접 구성한다(추가·삭제·이름변경·재정렬, 최대 20개).
// 2단계 흐름: 1단계 편집(제목·필드·메모) → 2단계 "저장 전 확인"(요약·마스킹) → 암호화하여 저장.
// 제목만 평문이고 필드 이름·값·메모는 VK 로 seal 후 base64url 로 전송한다.
import { useState } from "react"
import { createSecret, updateSecret } from "@/lib/vault-client"
import { isApiError } from "@/lib/api-error"
import { useVault, type SecretField } from "./vault-context"
import { sealPayload } from "./secret-payload"
import { FIELD_SUGGESTIONS } from "./field-suggestions"

const MAX_FIELDS = 20

export interface SecretFormInitial {
    id: string
    label: string
    categoryId: string | null
    fields: SecretField[]
    memo: string
}

interface Props {
    siteId: string
    initial: SecretFormInitial | null
    onSuccess: () => void | Promise<void>
    onCancel: () => void
}

interface FieldRow extends SecretField {
    // 재정렬·삭제 시 안정적 key 용 로컬 식별자.
    key: string
}

let rowSeq = 0
function makeRow(field?: SecretField): FieldRow {
    rowSeq += 1
    return { key: `f${rowSeq}`, name: field?.name ?? "", value: field?.value ?? "" }
}

export function SecretForm({ siteId, initial, onSuccess, onCancel }: Props) {
    const { vaultKey, resetIdle } = useVault()
    const [step, setStep] = useState<"edit" | "review">("edit")
    const [label, setLabel] = useState(initial?.label ?? "")
    const [memo, setMemo] = useState(initial?.memo ?? "")
    const [rows, setRows] = useState<FieldRow[]>(
        initial && initial.fields.length > 0
            ? initial.fields.map((f) => makeRow(f))
            : [makeRow({ name: "아이디", value: "" }), makeRow({ name: "비밀번호", value: "" })],
    )
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    // 1단계에서 "다음"을 누른 뒤 제목 미입력 등 인라인 안내(토스트 대체).
    const [hint, setHint] = useState<string | null>(null)

    function updateRow(index: number, patch: Partial<SecretField>) {
        resetIdle()
        setRows((prev) =>
            prev.map((r, i) => (i === index ? { ...r, ...patch } : r)),
        )
    }

    function addRow(name = "") {
        resetIdle()
        setRows((prev) =>
            prev.length >= MAX_FIELDS ? prev : [...prev, makeRow({ name, value: "" })],
        )
    }

    function removeRow(index: number) {
        resetIdle()
        setRows((prev) => prev.filter((_, i) => i !== index))
    }

    function moveRow(index: number, dir: -1 | 1) {
        resetIdle()
        setRows((prev) => {
            const next = [...prev]
            const target = index + dir
            if (target < 0 || target >= next.length) return prev
            ;[next[index], next[target]] = [next[target], next[index]]
            return next
        })
    }

    // 1단계 → 2단계. 제목·필드 이름 중복을 먼저 검증한다.
    function goReview() {
        resetIdle()
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
        setError(null)
        setStep("review")
    }

    function backToEdit() {
        resetIdle()
        setError(null)
        setStep("edit")
    }

    // 2단계 확정. 실제 암호화 후 생성/수정 API 호출.
    async function confirmSave() {
        if (submitting) return
        // 리뷰 단계 체류 후 저장 클릭도 활동으로 보고 자동잠금 타이머를 리셋한다.
        resetIdle()
        const fields = rows
            .map((r) => ({ name: r.name.trim(), value: r.value }))
            .filter((f) => f.name)

        setSubmitting(true)
        setError(null)
        try {
            const blob = await sealPayload(vaultKey, { fields, memo })

            if (initial) {
                await updateSecret(initial.id, {
                    label: label.trim(),
                    // 프로토타입 폼엔 카테고리가 없다. 항상 미분류로 저장한다.
                    categoryId: null,
                    iv: blob.iv,
                    ciphertext: blob.ciphertext,
                    authTag: blob.authTag,
                })
            } else {
                await createSecret({
                    siteId,
                    categoryId: null,
                    label: label.trim(),
                    iv: blob.iv,
                    ciphertext: blob.ciphertext,
                    authTag: blob.authTag,
                })
            }
            await onSuccess()
        } catch (err) {
            // 저장 실패 시 편집으로 돌려 보내 사용자가 값을 잃지 않게 한다.
            setError(isApiError(err) ? err.message : (err as Error).message)
            setStep("edit")
            setSubmitting(false)
        }
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
                        onClick={backToEdit}
                        disabled={submitting}
                    >
                        ← 수정
                    </button>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>저장 전 확인</div>
                    <span style={{ width: 36 }} aria-hidden="true" />
                </div>

                {error && (
                    <div role="alert" className="error-box">
                        {error}
                    </div>
                )}

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
                                        }}
                                    >
                                        {r.name.trim()}
                                    </span>
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
                        disabled={submitting}
                    >
                        {submitting ? "암호화하여 저장 중…" : "암호화하여 저장"}
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
                <button
                    type="button"
                    className="btn-text"
                    onClick={onCancel}
                    disabled={submitting}
                >
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
                // 프로토타입과 동일하게 flex 컬럼으로 배치한다. grid 암묵적 auto 컬럼은
                // 가장 넓은 자식(가로 스크롤 추천칩 묶음)에 맞춰 늘어나 입력들이 컨테이너를 벗어난다.
                style={{ display: "flex", flexDirection: "column", gap: 22, minWidth: 0 }}
            >
                {hint && (
                    <div role="alert" className="error-box" style={{ margin: 0 }}>
                        {hint}
                    </div>
                )}
                {error && (
                    <div role="alert" className="error-box" style={{ margin: 0 }}>
                        {error}
                    </div>
                )}

                <div className="form-row" style={{ margin: 0 }}>
                    <label htmlFor="secret-label">
                        제목{" "}
                        <span style={{ color: "#cbcbcb", fontWeight: 600 }}>
                            · 평문 저장
                        </span>
                    </label>
                    <input
                        id="secret-label"
                        type="text"
                        className="field-control"
                        placeholder="예: 국민은행 인터넷뱅킹"
                        value={label}
                        onChange={(e) => {
                            resetIdle()
                            setLabel(e.target.value)
                            if (hint) setHint(null)
                        }}
                        maxLength={200}
                        autoComplete="off"
                    />
                </div>

                <fieldset style={{ border: "none", padding: 0, margin: 0, minWidth: 0 }}>
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
                            <span style={{ color: "#cbcbcb", fontWeight: 600 }}>
                                · 암호화
                            </span>
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#bcbcbc" }}>
                            {usedNames.size}/{MAX_FIELDS}
                        </span>
                    </legend>

                    {/* 추천 칩 가로 스크롤 (quick-add) */}
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
                                color: "#bbb",
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
                                    usedNames.has(s.name) || rows.length >= MAX_FIELDS
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
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <span
                                        aria-hidden="true"
                                        style={{ color: "#cdcdcd", fontSize: 16, lineHeight: 1 }}
                                    >
                                        ⋮⋮
                                    </span>
                                    <input
                                        aria-label={`필드 ${idx + 1} 이름`}
                                        placeholder="필드 이름"
                                        value={row.name}
                                        onChange={(e) =>
                                            updateRow(idx, { name: e.target.value })
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
                                    <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
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
                                        updateRow(idx, { value: e.target.value })
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
                                cursor: rows.length >= MAX_FIELDS ? "not-allowed" : "pointer",
                                opacity: rows.length >= MAX_FIELDS ? 0.5 : 1,
                            }}
                        >
                            + 필드 추가
                        </button>
                    </div>
                </fieldset>

                <div className="form-row" style={{ margin: 0 }}>
                    <label htmlFor="secret-memo">
                        메모{" "}
                        <span style={{ color: "#cbcbcb", fontWeight: 600 }}>
                            · 암호화 · 선택
                        </span>
                    </label>
                    <textarea
                        id="secret-memo"
                        className="field-control"
                        placeholder="선택 입력"
                        value={memo}
                        onChange={(e) => {
                            resetIdle()
                            setMemo(e.target.value)
                        }}
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
                    <span aria-hidden="true" style={{ fontSize: 14, lineHeight: 1.4 }}>
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
                        제목만 평문으로 저장되고, 필드 이름·값·메모는 통째로 암호화됩니다.
                    </span>
                </div>
            </div>
        </div>
    )
}
