"use client"
// 새 카테고리 추가 폼. 이름 입력 + 색상 선택 + 추가 버튼.
import { useState } from "react"
import { Button } from "@/components/Button"
import { CATEGORY_PALETTE } from "../_lib/asset-categories"
import { CategoryColorPicker } from "./CategoryColorPicker"

interface CategoryAddSectionProps {
    onAdd: (name: string, color: string) => Promise<void>
    onActivity: () => void
}

export function CategoryAddSection({
    onAdd,
    onActivity,
}: CategoryAddSectionProps) {
    const [name, setName] = useState("")
    const [color, setColor] = useState(CATEGORY_PALETTE[0] ?? "#f2994a")
    const [saving, setSaving] = useState(false)

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!name.trim() || saving) return
        onActivity()
        setSaving(true)
        try {
            await onAdd(name.trim(), color)
            // 성공 시에만 폼 초기화
            setName("")
            setColor(CATEGORY_PALETTE[0] ?? "#f2994a")
        } catch {
            // 오류는 부모(CategoryManager)가 setError로 표시. 입력 상태 유지.
        } finally {
            setSaving(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} style={{ marginBottom: 20 }}>
            <div
                style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "var(--color-text-muted)",
                    marginBottom: 8,
                }}
            >
                새 카테고리
            </div>
            <input
                type="text"
                className="input"
                placeholder="이름 (최대 20자)"
                value={name}
                maxLength={20}
                onChange={(e) => {
                    onActivity()
                    setName(e.target.value)
                }}
                style={{ marginBottom: 10 }}
            />
            <CategoryColorPicker
                value={color}
                onChange={(c) => {
                    onActivity()
                    setColor(c)
                }}
            />
            <Button
                type="submit"
                variant="primary"
                loading={saving}
                disabled={!name.trim()}
                style={{ width: "100%", marginTop: 12 }}
            >
                + 추가
            </Button>
        </form>
    )
}
