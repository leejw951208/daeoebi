"use client"
// 시크릿 신규/수정 폼. 사용자가 필드를 직접 구성한다(추가·삭제·이름변경·재정렬, 최대 20개).
// 제목만 평문이고 필드 이름·값·메모는 VK 로 seal 후 base64url 로 전송한다. 선택적 카테고리 태그 지원.
import { FormEvent, useEffect, useState } from "react"
import {
    createCategory,
    createSecret,
    listCategories,
    updateSecret,
    type Category,
} from "@/lib/vault-client"
import { isApiError } from "@/lib/api-error"
import { useVault, type SecretField } from "./vault-context"
import { sealPayload } from "./secret-payload"
import { FIELD_SUGGESTIONS } from "./field-suggestions"

const MAX_FIELDS = 20
// 새 카테고리 생성을 나타내는 select 센티넬 값.
const NEW_CATEGORY = "__new__"

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
    const [label, setLabel] = useState(initial?.label ?? "")
    const [categoryId, setCategoryId] = useState<string>(
        initial?.categoryId ?? "",
    )
    const [newCategoryLabel, setNewCategoryLabel] = useState("")
    const [memo, setMemo] = useState(initial?.memo ?? "")
    const [rows, setRows] = useState<FieldRow[]>(
        initial && initial.fields.length > 0
            ? initial.fields.map((f) => makeRow(f))
            : [makeRow()],
    )
    const [categories, setCategories] = useState<Category[]>([])
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        let cancelled = false
        void listCategories(siteId)
            .then((cats) => {
                if (!cancelled) setCategories(cats)
            })
            .catch(() => {
                // 카테고리 조회 실패는 폼 진행을 막지 않는다(선택 항목).
            })
        return () => {
            cancelled = true
        }
    }, [siteId])

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

    async function handleSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault()
        if (submitting) return
        if (!label.trim()) {
            setError("제목을 입력하세요.")
            return
        }
        const fields = rows
            .map((r) => ({ name: r.name.trim(), value: r.value }))
            .filter((f) => f.name)
        const names = fields.map((f) => f.name)
        if (new Set(names).size !== names.length) {
            setError("필드 이름이 중복되었습니다.")
            return
        }

        setSubmitting(true)
        setError(null)
        try {
            // 새 카테고리 선택 시 먼저 생성한다.
            let resolvedCategoryId: string | null = categoryId || null
            if (categoryId === NEW_CATEGORY) {
                if (!newCategoryLabel.trim()) {
                    setError("새 카테고리 이름을 입력하세요.")
                    setSubmitting(false)
                    return
                }
                const created = await createCategory(
                    siteId,
                    newCategoryLabel.trim(),
                )
                resolvedCategoryId = created.id
            }

            const blob = await sealPayload(vaultKey, { fields, memo })

            if (initial) {
                await updateSecret(initial.id, {
                    label: label.trim(),
                    categoryId: resolvedCategoryId,
                    iv: blob.iv,
                    ciphertext: blob.ciphertext,
                    authTag: blob.authTag,
                })
            } else {
                await createSecret({
                    siteId,
                    categoryId: resolvedCategoryId,
                    label: label.trim(),
                    iv: blob.iv,
                    ciphertext: blob.ciphertext,
                    authTag: blob.authTag,
                })
            }
            await onSuccess()
        } catch (err) {
            setError(isApiError(err) ? err.message : (err as Error).message)
        } finally {
            setSubmitting(false)
        }
    }

    const usedNames = new Set(
        rows.map((r) => r.name.trim()).filter(Boolean),
    )

    return (
        <form
            onSubmit={handleSubmit}
            style={{ display: "grid", gap: 22 }}
        >
            <div className="form-row" style={{ margin: 0 }}>
                <label htmlFor="secret-label">
                    제목 <span style={{ color: "#cbcbcb", fontWeight: 600 }}>· 평문 저장</span>
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
                    }}
                    maxLength={200}
                    required
                    autoComplete="off"
                />
            </div>

            <div className="form-row" style={{ margin: 0 }}>
                <label htmlFor="secret-category">
                    카테고리 <span style={{ color: "#cbcbcb", fontWeight: 600 }}>· 선택</span>
                </label>
                <select
                    id="secret-category"
                    className="field-control"
                    value={categoryId}
                    onChange={(e) => {
                        resetIdle()
                        setCategoryId(e.target.value)
                    }}
                >
                    <option value="">없음</option>
                    {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                            {c.label}
                        </option>
                    ))}
                    <option value={NEW_CATEGORY}>+ 새 카테고리</option>
                </select>
                {categoryId === NEW_CATEGORY && (
                    <input
                        type="text"
                        className="field-control"
                        style={{ marginTop: 8 }}
                        placeholder="새 카테고리 이름"
                        value={newCategoryLabel}
                        onChange={(e) => setNewCategoryLabel(e.target.value)}
                        maxLength={100}
                        aria-label="새 카테고리 이름"
                    />
                )}
            </div>

            <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
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
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--color-text-muted)" }}>
                        필드 <span style={{ color: "#cbcbcb", fontWeight: 600 }}>· 암호화</span>
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
                    메모 <span style={{ color: "#cbcbcb", fontWeight: 600 }}>· 암호화 · 선택</span>
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
                <span style={{ fontSize: 12.5, lineHeight: 1.5, color: "#666", fontWeight: 500 }}>
                    제목·카테고리만 평문으로 저장되고, 필드 이름·값·메모는 통째로
                    암호화됩니다.
                </span>
            </div>

            {error && (
                <div role="alert" className="error-box">
                    {error}
                </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
                <button
                    type="submit"
                    className="btn"
                    style={{ flex: 1 }}
                    disabled={submitting}
                >
                    {submitting
                        ? "암호화하여 저장 중…"
                        : "암호화하여 저장"}
                </button>
                <button
                    type="button"
                    className="btn secondary"
                    onClick={onCancel}
                    disabled={submitting}
                >
                    취소
                </button>
            </div>
        </form>
    )
}
