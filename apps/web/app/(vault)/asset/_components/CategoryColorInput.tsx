"use client"
// 카테고리 색상 HEX 입력. 미리보기 스와치 + #rrggbb 텍스트 입력(팔레트 대체).
import { isValidHexColor, normalizeHexInput } from "../_lib/asset-categories"

interface CategoryColorInputProps {
    value: string
    onChange: (v: string) => void
}

export function CategoryColorInput({
    value,
    onChange,
}: CategoryColorInputProps) {
    const valid = isValidHexColor(value)
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
                aria-hidden="true"
                style={{
                    width: 30,
                    height: 30,
                    borderRadius: "50%",
                    background: valid ? value : "var(--soft)",
                    border: "1px solid var(--color-border)",
                    flexShrink: 0,
                }}
            />
            <input
                type="text"
                className="field-control"
                aria-label="색상 HEX 코드"
                placeholder="#f2994a"
                value={value}
                maxLength={7}
                spellCheck={false}
                autoCapitalize="none"
                onChange={(e) => onChange(normalizeHexInput(e.target.value))}
                style={{ fontFamily: "var(--font-mono)" }}
            />
        </div>
    )
}
