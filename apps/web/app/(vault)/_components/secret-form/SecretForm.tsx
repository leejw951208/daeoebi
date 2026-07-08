"use client"
// 시크릿 신규/수정 폼 컨테이너. 상태와 핸들러를 보유하고 2단계 흐름을 조율한다.
// 1단계 편집(SecretEditStep) → 2단계 "저장 전 확인"(SecretReviewStep) → 암호화하여 저장.
// 제목만 평문이고 필드 이름·값·메모는 VK 로 seal 후 base64url 로 전송한다.
import { useState } from "react"
import { createSecret, updateSecret } from "@/lib/vault-client"
import { isApiError } from "@/lib/api-error"
import { toast } from "@/components/toast"
import { useVault, type SecretField } from "../../_lib/vault-context"
import { sealPayload } from "../../_lib/secret-payload"
import { isSensitiveFieldName } from "../../_lib/field-suggestions"
import { MAX_FIELDS, type FieldRow } from "./types"
import { SecretEditStep } from "./SecretEditStep"
import { SecretReviewStep } from "./SecretReviewStep"

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

let rowSeq = 0
function makeRow(field?: SecretField): FieldRow {
    rowSeq += 1
    // 저장된 sensitive 가 있으면 그대로, 없으면(추천칩·구버전) 이름 휴리스틱으로 기본값을 정한다.
    const sensitive =
        field?.sensitive ??
        (field?.name ? isSensitiveFieldName(field.name) : false)
    return {
        key: `f${rowSeq}`,
        name: field?.name ?? "",
        value: field?.value ?? "",
        sensitive,
    }
}

export function SecretForm({ siteId, initial, onSuccess, onCancel }: Props) {
    const { vaultKey, resetIdle } = useVault()
    const [step, setStep] = useState<"edit" | "review">("edit")
    const [label, setLabel] = useState(initial?.label ?? "")
    const [memo, setMemo] = useState(initial?.memo ?? "")
    const [rows, setRows] = useState<FieldRow[]>(
        initial && initial.fields.length > 0
            ? initial.fields.map((f) => makeRow(f))
            : [makeRow()],
    )
    const [submitting, setSubmitting] = useState(false)

    function changeLabel(value: string) {
        resetIdle()
        setLabel(value)
    }

    function changeMemo(value: string) {
        resetIdle()
        setMemo(value)
    }

    function updateRow(index: number, patch: Partial<SecretField>) {
        resetIdle()
        setRows((prev) =>
            prev.map((r, i) => (i === index ? { ...r, ...patch } : r)),
        )
    }

    function addRow(name = "") {
        resetIdle()
        setRows((prev) =>
            prev.length >= MAX_FIELDS
                ? prev
                : [...prev, makeRow({ name, value: "" })],
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
            toast("제목을 입력하세요.")
            return
        }
        const names = rows.map((r) => r.name.trim()).filter(Boolean)
        if (new Set(names).size !== names.length) {
            toast("필드 이름이 중복되었습니다.")
            return
        }
        setStep("review")
    }

    function backToEdit() {
        resetIdle()
        setStep("edit")
    }

    // 2단계 확정. 실제 암호화 후 생성/수정 API 호출.
    async function confirmSave() {
        if (submitting) return
        // 리뷰 단계 체류 후 저장 클릭도 활동으로 보고 자동잠금 타이머를 리셋한다.
        resetIdle()
        const fields = rows
            .map((r) => ({
                name: r.name.trim(),
                value: r.value,
                sensitive: r.sensitive ?? false,
            }))
            .filter((f) => f.name)

        setSubmitting(true)
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
            toast(isApiError(err) ? err.message : (err as Error).message)
            setStep("edit")
            setSubmitting(false)
        }
    }

    const reviewFields = rows.filter((r) => r.name.trim())

    if (step === "review") {
        return (
            <SecretReviewStep
                label={label}
                reviewFields={reviewFields}
                memo={memo}
                onBack={backToEdit}
                onConfirm={confirmSave}
            />
        )
    }

    return (
        <SecretEditStep
            isEditing={initial !== null}
            label={label}
            onLabelChange={changeLabel}
            memo={memo}
            onMemoChange={changeMemo}
            rows={rows}
            onCancel={onCancel}
            onNext={goReview}
            onAddRow={addRow}
            onUpdateRow={updateRow}
            onMoveRow={moveRow}
            onRemoveRow={removeRow}
        />
    )
}
