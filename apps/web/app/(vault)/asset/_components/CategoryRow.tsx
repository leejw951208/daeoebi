"use client"
// 카테고리 목록(LIST 모드) 한 행. 색상 점 + 이름 + 코드, 수정/삭제 트리거.
// 실제 편집은 CategoryManager 가 FORM 모드로 전환해 처리한다(인라인 편집 없음).
import type { AssetCategory } from "@/lib/vault-client"

interface CategoryRowProps {
    category: AssetCategory
    onEdit: (category: AssetCategory) => void
    onDelete: (category: AssetCategory) => void
    onActivity: () => void
}

export function CategoryRow({
    category,
    onEdit,
    onDelete,
    onActivity,
}: CategoryRowProps) {
    return (
        <div
            data-testid="category-row"
            style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "12px 0",
                borderBottom: "1px solid var(--color-border)",
            }}
        >
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    minWidth: 0,
                }}
            >
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
                <div style={{ minWidth: 0 }}>
                    <div
                        style={{
                            fontSize: 14,
                            fontWeight: 600,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                        }}
                    >
                        {category.name}
                    </div>
                    {category.code && (
                        <div
                            style={{
                                fontSize: 11,
                                fontWeight: 700,
                                color: "var(--color-text-muted)",
                                letterSpacing: "0.02em",
                                marginTop: 1,
                            }}
                        >
                            {category.code}
                        </div>
                    )}
                </div>
            </div>
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    flexShrink: 0,
                }}
            >
                <button
                    type="button"
                    className="btn-text"
                    onClick={() => {
                        onActivity()
                        onEdit(category)
                    }}
                >
                    수정
                </button>
                <button
                    type="button"
                    className="btn-text"
                    aria-label="삭제"
                    style={{ color: "var(--color-danger-fg, #ef4444)" }}
                    onClick={() => {
                        onActivity()
                        onDelete(category)
                    }}
                >
                    <svg
                        width="17"
                        height="17"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                    >
                        <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                    </svg>
                </button>
            </div>
        </div>
    )
}
