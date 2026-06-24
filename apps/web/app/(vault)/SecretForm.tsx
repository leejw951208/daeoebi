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
            className="card"
            style={{ display: "grid", gap: 16 }}
        >
            <h3 style={{ margin: 0 }}>{initial ? "항목 수정" : "항목 추가"}</h3>

            <div className="form-row">
                <label htmlFor="secret-label">제목 *</label>
                <input
                    id="secret-label"
                    type="text"
                    className="field-control"
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

            <div className="form-row">
                <label htmlFor="secret-category">카테고리 (선택)</label>
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
                <legend style={{ fontWeight: 700, marginBottom: 8 }}>
                    필드 ({usedNames.size}/{MAX_FIELDS})
                </legend>

                {rows.map((row, idx) => (
                    <div
                        key={row.key}
                        className="form-row"
                        style={{
                            gridTemplateColumns: "1fr 1fr auto",
                            gap: 8,
                            marginTop: 8,
                            alignItems: "end",
                        }}
                    >
                        <input
                            className="field-control"
                            aria-label={`필드 ${idx + 1} 이름`}
                            placeholder="필드 이름"
                            value={row.name}
                            onChange={(e) =>
                                updateRow(idx, { name: e.target.value })
                            }
                            maxLength={128}
                        />
                        <input
                            className="field-control"
                            aria-label={`필드 ${idx + 1} 값`}
                            placeholder="값"
                            value={row.value}
                            onChange={(e) =>
                                updateRow(idx, { value: e.target.value })
                            }
                            maxLength={4096}
                            autoComplete="off"
                        />
                        <div style={{ display: "flex", gap: 4 }}>
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
                                onClick={() => removeRow(idx)}
                                aria-label={`필드 ${idx + 1} 삭제`}
                            >
                                ✕
                            </button>
                        </div>
                    </div>
                ))}

                <div style={{ marginTop: 12 }}>
                    <button
                        type="button"
                        className="btn secondary"
                        onClick={() => addRow()}
                        disabled={rows.length >= MAX_FIELDS}
                    >
                        + 빈 필드 추가
                    </button>
                </div>

                <div style={{ marginTop: 12 }}>
                    <span className="muted">추천 필드</span>
                    <div
                        style={{
                            display: "flex",
                            gap: 6,
                            flexWrap: "wrap",
                            marginTop: 6,
                        }}
                    >
                        {FIELD_SUGGESTIONS.map((s) => (
                            <button
                                key={s.name}
                                type="button"
                                className="btn secondary"
                                style={{ minHeight: 44 }}
                                onClick={() => addRow(s.name)}
                                disabled={
                                    usedNames.has(s.name) ||
                                    rows.length >= MAX_FIELDS
                                }
                            >
                                {s.name}
                            </button>
                        ))}
                    </div>
                </div>
            </fieldset>

            <div className="form-row">
                <label htmlFor="secret-memo">메모 (선택)</label>
                <textarea
                    id="secret-memo"
                    className="field-control"
                    value={memo}
                    onChange={(e) => {
                        resetIdle()
                        setMemo(e.target.value)
                    }}
                    rows={3}
                    maxLength={4096}
                />
            </div>

            {error && (
                <div role="alert" className="error-box">
                    {error}
                </div>
            )}

            <div style={{ display: "flex", gap: 8 }}>
                <button type="submit" className="btn" disabled={submitting}>
                    {submitting ? "저장 중..." : initial ? "저장" : "추가"}
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
