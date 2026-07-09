"use client"
// 카테고리 추가/수정 공용 폼(FORM 모드). initial 이 null 이면 추가, 아니면 수정.
// 사용자 생성 카테고리 전용 — 이름 + 색상만 입력한다(코드 없음).
// 수정 시에만 "카테고리 삭제" 트리거를 노출한다(삭제 확인은 부모가 담당).
import { useState } from "react"
import { Button } from "@/components/Button"
import { CATEGORY_PALETTE, isValidHexColor } from "../_lib/asset-categories"
import type { AssetCategory } from "@/lib/vault-client"

interface CategoryFormData {
    name: string
    color: string
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
            await onSave({ name: name.trim(), color })
            // 성공 시 부모(CategoryManager)가 목록 모드로 되돌린다.
        } catch {
            // 오류는 부모가 setError로 표시. 입력 상태 유지.
        } finally {
            setSaving(false)
        }
    }

    return (
        <form onSubmit={handleSubmit}>
            <div
                className="field-label"
                style={{ marginBottom: 7, color: "#a0a0a0" }}
            >
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

            <div
                className="field-label"
                style={{ marginBottom: 10, color: "#a0a0a0" }}
            >
                색상
            </div>
            <div
                role="group"
                aria-label="색상 선택"
                style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 11,
                    marginBottom: 12,
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
                            width: 34,
                            height: 34,
                            borderRadius: "50%",
                            background: swatch,
                            border:
                                swatch === color
                                    ? "3px solid #171717"
                                    : "3px solid transparent",
                            boxShadow: "0 0 0 1px #e6e6e6",
                            padding: 0,
                            cursor: "pointer",
                        }}
                    />
                ))}
            </div>
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    marginBottom: 24,
                }}
            >
                <span
                    aria-hidden="true"
                    style={{
                        flexShrink: 0,
                        width: 38,
                        height: 38,
                        borderRadius: 10,
                        background: isValidHexColor(color)
                            ? color
                            : "var(--soft)",
                        boxShadow: "0 0 0 1px #e6e6e6",
                    }}
                />
                <div
                    style={{
                        flex: 1,
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        border: "1.5px solid #ececec",
                        borderRadius: 12,
                        background: "var(--tint)",
                        padding: "0 14px",
                        height: 48,
                    }}
                >
                    <span
                        aria-hidden="true"
                        style={{
                            fontSize: 16,
                            fontWeight: 800,
                            color: "#cfcfcf",
                        }}
                    >
                        #
                    </span>
                    <input
                        type="text"
                        value={color.replace(/^#/, "")}
                        placeholder="F2994A"
                        maxLength={6}
                        spellCheck={false}
                        autoCapitalize="characters"
                        aria-label="색상 HEX 코드"
                        onChange={(e) => {
                            onActivity()
                            const hex = e.target.value
                                .replace(/[^0-9a-fA-F]/g, "")
                                .slice(0, 6)
                            setColor(`#${hex}`)
                        }}
                        style={{
                            flex: 1,
                            minWidth: 0,
                            border: "none",
                            background: "none",
                            font: "inherit",
                            fontSize: 15,
                            fontWeight: 700,
                            letterSpacing: "0.06em",
                            textTransform: "uppercase",
                            outline: "none",
                            color: "#333",
                        }}
                    />
                </div>
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
                        height: 46,
                        justifyContent: "center",
                        marginTop: 2,
                        fontWeight: 700,
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
