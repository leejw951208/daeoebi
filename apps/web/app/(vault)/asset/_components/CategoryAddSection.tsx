"use client"
// 카테고리 추가/수정 공용 폼(FORM 모드). initial 이 null 이면 추가, 아니면 수정.
// 이름 + 코드(선택·고유) 입력, 색상은 CATEGORY_PALETTE 스와치에서 선택.
// 수정 시에만 "카테고리 삭제" 트리거를 노출한다(삭제 확인은 부모가 담당).
import { useState } from "react"
import { Button } from "@/components/Button"
import { CATEGORY_PALETTE, isValidHexColor } from "../_lib/asset-categories"
import type { AssetCategory } from "@/lib/vault-client"

interface CategoryFormData {
    name: string
    color: string
    code: string
}

interface CategoryAddSectionProps {
    // 수정 대상 카테고리. null 이면 새 카테고리 추가 모드.
    initial: AssetCategory | null
    onSave: (data: CategoryFormData) => Promise<void>
    onDelete?: () => void
    onActivity: () => void
}

export function CategoryAddSection({
    initial,
    onSave,
    onDelete,
    onActivity,
}: CategoryAddSectionProps) {
    const [name, setName] = useState(initial?.name ?? "")
    const [code, setCode] = useState(initial?.code ?? "")
    const [color, setColor] = useState(
        initial?.color ?? CATEGORY_PALETTE[0] ?? "#f2994a",
    )
    const [saving, setSaving] = useState(false)

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!name.trim() || saving) return
        onActivity()
        setSaving(true)
        try {
            await onSave({ name: name.trim(), color, code: code.trim() })
            // 성공 시 부모(CategoryManager)가 목록 모드로 되돌린다.
        } catch {
            // 오류는 부모가 setError로 표시. 입력 상태 유지.
        } finally {
            setSaving(false)
        }
    }

    return (
        <form onSubmit={handleSubmit}>
            <div className="field-label" style={{ marginBottom: 8 }}>
                카테고리명
            </div>
            <input
                type="text"
                className="field-control"
                placeholder="예: 의료·건강"
                value={name}
                maxLength={20}
                aria-label="카테고리 이름"
                onChange={(e) => {
                    onActivity()
                    setName(e.target.value)
                }}
                style={{ marginBottom: 18, fontWeight: 600 }}
            />

            <div className="field-label" style={{ marginBottom: 8 }}>
                코드{" "}
                <span style={{ color: "#cbcbcb", fontWeight: 600 }}>
                    · 영문·숫자
                </span>
            </div>
            <input
                type="text"
                className="field-control"
                placeholder="예: HEALTH"
                value={code}
                maxLength={32}
                aria-label="카테고리 코드"
                onChange={(e) => {
                    onActivity()
                    setCode(e.target.value)
                }}
                style={{
                    marginBottom: 18,
                    fontWeight: 700,
                    letterSpacing: "0.04em",
                }}
            />

            <div className="field-label" style={{ marginBottom: 10 }}>
                색상
            </div>
            <div
                role="group"
                aria-label="색상 선택"
                style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 11,
                    marginBottom: 24,
                }}
            >
                {CATEGORY_PALETTE.map((swatch) => (
                    <button
                        key={swatch}
                        type="button"
                        aria-label={swatch}
                        aria-pressed={swatch === color}
                        onClick={() => {
                            onActivity()
                            setColor(swatch)
                        }}
                        style={{
                            width: 32,
                            height: 32,
                            borderRadius: "50%",
                            background: swatch,
                            border:
                                swatch === color
                                    ? "3px solid var(--color-text-primary)"
                                    : "1px solid var(--color-border)",
                            padding: 0,
                            cursor: "pointer",
                        }}
                    />
                ))}
            </div>

            <Button
                type="submit"
                variant="primary"
                loading={saving}
                disabled={!name.trim() || !isValidHexColor(color)}
                style={{ width: "100%" }}
            >
                저장
            </Button>

            {onDelete && (
                <button
                    type="button"
                    className="btn-text"
                    style={{
                        width: "100%",
                        marginTop: 8,
                        color: "#e5484d",
                    }}
                    onClick={() => {
                        onActivity()
                        onDelete()
                    }}
                >
                    카테고리 삭제
                </button>
            )}
        </form>
    )
}
