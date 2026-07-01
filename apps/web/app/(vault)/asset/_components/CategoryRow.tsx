"use client"
// 카테고리 목록 한 행. 보기·인라인 편집·삭제 트리거 지원.
import { useState } from "react"
import type { AssetCategory } from "@/lib/vault-client"
import { Button } from "@/components/Button"
import { isValidHexColor } from "../_lib/asset-categories"
import { CategoryColorInput } from "./CategoryColorInput"

interface CategoryRowProps {
    category: AssetCategory
    onEdit: (
        id: string,
        patch: { name?: string; color?: string },
    ) => Promise<void>
    onDelete: (category: AssetCategory) => void
    onActivity: () => void
}

export function CategoryRow({
    category,
    onEdit,
    onDelete,
    onActivity,
}: CategoryRowProps) {
    const [editing, setEditing] = useState(false)
    const [name, setName] = useState(category.name)
    const [color, setColor] = useState(category.color)
    const [saving, setSaving] = useState(false)

    function cancelEdit() {
        onActivity()
        setEditing(false)
        setName(category.name)
        setColor(category.color)
    }

    async function handleSave() {
        if (saving) return
        onActivity()
        setSaving(true)
        try {
            await onEdit(category.id, {
                name: name.trim() || category.name,
                color,
            })
            // 성공 시에만 편집 모드 종료
            setEditing(false)
        } catch {
            // 오류는 부모(CategoryManager)가 setError로 표시. 편집 상태 유지.
        } finally {
            setSaving(false)
        }
    }

    if (editing) {
        return (
            <div
                style={{
                    padding: "12px 0",
                    borderBottom: "1px solid var(--color-border)",
                }}
            >
                <input
                    type="text"
                    className="input"
                    value={name}
                    maxLength={20}
                    onChange={(e) => {
                        onActivity()
                        setName(e.target.value)
                    }}
                    style={{ marginBottom: 10 }}
                />
                <CategoryColorInput
                    value={color}
                    onChange={(c) => {
                        onActivity()
                        setColor(c)
                    }}
                />
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    <button
                        type="button"
                        className="btn secondary"
                        onClick={cancelEdit}
                        style={{ flex: 1 }}
                    >
                        취소
                    </button>
                    <Button
                        variant="primary"
                        onClick={handleSave}
                        loading={saving}
                        disabled={!isValidHexColor(color)}
                        style={{ flex: 1 }}
                    >
                        저장
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 0",
                borderBottom: "1px solid var(--color-border)",
            }}
        >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span
                    aria-hidden="true"
                    style={{
                        width: 12,
                        height: 12,
                        borderRadius: "50%",
                        background: category.color,
                        flexShrink: 0,
                    }}
                />
                <span style={{ fontSize: 14, fontWeight: 600 }}>
                    {category.name}
                </span>
            </div>
            <div style={{ display: "flex", gap: 12 }}>
                <button
                    type="button"
                    className="btn-text"
                    onClick={() => {
                        onActivity()
                        setEditing(true)
                    }}
                >
                    수정
                </button>
                <button
                    type="button"
                    className="btn-text"
                    style={{ color: "var(--color-danger, #ef4444)" }}
                    onClick={() => {
                        onActivity()
                        onDelete(category)
                    }}
                >
                    삭제
                </button>
            </div>
        </div>
    )
}
