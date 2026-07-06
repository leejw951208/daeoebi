"use client"
// 새 카테고리 추가 폼. 이름 입력 + 색상 선택 + 추가 버튼.
import { useState } from "react"
import { Button } from "@/components/Button"
import { CATEGORY_PALETTE, isValidHexColor } from "../_lib/asset-categories"
import { CategoryColorInput } from "./CategoryColorInput"

interface CategoryAddSectionProps {
    onAdd: (name: string, color: string, code: string) => Promise<void>
    onActivity: () => void
}

export function CategoryAddSection({
    onAdd,
    onActivity,
}: CategoryAddSectionProps) {
    const [name, setName] = useState("")
    const [color, setColor] = useState(CATEGORY_PALETTE[0] ?? "#f2994a")
    const [code, setCode] = useState("")
    const [saving, setSaving] = useState(false)

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!name.trim() || saving) return
        onActivity()
        setSaving(true)
        try {
            await onAdd(name.trim(), color, code.trim())
            // 성공 시에만 폼 초기화
            setName("")
            setColor(CATEGORY_PALETTE[0] ?? "#f2994a")
            setCode("")
        } catch {
            // 오류는 부모(CategoryManager)가 setError로 표시. 입력 상태 유지.
        } finally {
            setSaving(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} style={{ marginBottom: 20 }}>
            <div className="field-label" style={{ marginBottom: 8 }}>
                이름
            </div>
            <input
                type="text"
                className="field-control"
                placeholder="예: 식비"
                value={name}
                maxLength={20}
                aria-label="카테고리 이름"
                onChange={(e) => {
                    onActivity()
                    setName(e.target.value)
                }}
                style={{ marginBottom: 12 }}
            />
            <CategoryColorInput
                value={color}
                onChange={(c) => {
                    onActivity()
                    setColor(c)
                }}
            />
            <div className="field-label" style={{ margin: "12px 0 8px" }}>
                코드 · 선택
            </div>
            <input
                type="text"
                className="field-control"
                placeholder="예: FOOD (카테고리 간 고유)"
                value={code}
                maxLength={32}
                aria-label="카테고리 코드"
                onChange={(e) => {
                    onActivity()
                    setCode(e.target.value)
                }}
            />
            <Button
                type="submit"
                variant="primary"
                loading={saving}
                disabled={!name.trim() || !isValidHexColor(color)}
                style={{ width: "100%", marginTop: 12 }}
            >
                + 추가
            </Button>
        </form>
    )
}
