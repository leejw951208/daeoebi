"use client"
// 카테고리 목록(LIST 모드) 한 행. 색상 점 + 이름, 사용자 생성 카테고리에만 수정/삭제 트리거.
// 고정 카테고리는 읽기 전용이라 편집 버튼을 노출하지 않는다.
// 실제 편집은 CategoryManager 가 FORM 모드로 전환해 처리한다(인라인 편집 없음).
import type { AssetCategory } from "@/lib/vault-client"
import { isFixedCategory } from "../_lib/asset-categories"

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
    const fixed = isFixedCategory(category)
    return (
        <div
            data-testid="category-row"
            style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                border: "1px solid #f1f1f1",
                borderRadius: 14,
                background: "#fafafa",
                padding: "12px 14px",
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
            <div
                style={{
                    flex: 1,
                    minWidth: 0,
                    fontSize: 14,
                    fontWeight: 700,
                    color: "#222",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                }}
            >
                {category.name}
            </div>
            {fixed ? (
                <span
                    style={{
                        flex: "none",
                        fontSize: 11.5,
                        fontWeight: 700,
                        color: "#c0c0c0",
                    }}
                >
                    고정
                </span>
            ) : (
                <>
                    <button
                        type="button"
                        onClick={() => {
                            onActivity()
                            onEdit(category)
                        }}
                        style={{
                            flex: "none",
                            border: "1px solid #e8e8e8",
                            borderRadius: 9,
                            background: "#fff",
                            font: "inherit",
                            fontSize: 12.5,
                            fontWeight: 700,
                            color: "#555",
                            padding: "6px 12px",
                            cursor: "pointer",
                        }}
                    >
                        수정
                    </button>
                    <button
                        type="button"
                        className="press-dim6"
                        aria-label="삭제"
                        onClick={() => {
                            onActivity()
                            onDelete(category)
                        }}
                        style={{
                            flex: "none",
                            border: "none",
                            background: "none",
                            color: "#d0555a",
                            cursor: "pointer",
                            padding: 6,
                            display: "flex",
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
                </>
            )}
        </div>
    )
}
