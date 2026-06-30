"use client"
// 카테고리 색상 팔레트 선택 컴포넌트.
import { CATEGORY_PALETTE } from "../_lib/asset-categories"

interface CategoryColorPickerProps {
    value: string
    onChange: (color: string) => void
}

export function CategoryColorPicker({
    value,
    onChange,
}: CategoryColorPickerProps) {
    return (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {CATEGORY_PALETTE.map((color) => (
                <button
                    key={color}
                    type="button"
                    aria-label={color}
                    aria-pressed={value === color}
                    onClick={() => onChange(color)}
                    style={{
                        width: 26,
                        height: 26,
                        borderRadius: "50%",
                        background: color,
                        border:
                            value === color
                                ? "3px solid var(--color-text)"
                                : "3px solid transparent",
                        cursor: "pointer",
                        padding: 0,
                        outline: "none",
                    }}
                />
            ))}
        </div>
    )
}
