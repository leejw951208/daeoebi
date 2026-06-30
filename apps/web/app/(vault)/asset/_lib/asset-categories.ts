// 자산 관리 고정 상수(카테고리·결제방법)와 통화 포맷. 디자인 프로토타입 값과 일치한다.
import type { AssetCategory } from "@/lib/vault-client"

// 카테고리 색 선택용 고정 팔레트(임의 hex 입력 대신 선택).
export const CATEGORY_PALETTE: string[] = [
    "#f2994a",
    "#4a90d9",
    "#9b6bd6",
    "#e0689a",
    "#3bb273",
    "#14b8a6",
    "#eab308",
    "#ef4444",
    "#6366f1",
    "#98a0a8",
]

// categoryId 가 null 이거나 목록에 없을 때의 표시값.
export const UNCATEGORIZED = { name: "미분류", color: "#98a0a8" } as const

// categoryId → 표시용 이름·색. 목록에서 조인하고, 없으면 미분류.
export function resolveCategory(
    categoryId: string | null,
    categories: AssetCategory[],
): { name: string; color: string } {
    if (categoryId === null) return { ...UNCATEGORIZED }
    const found = categories.find((c) => c.id === categoryId)
    return found
        ? { name: found.name, color: found.color }
        : { ...UNCATEGORIZED }
}

// 천 단위 구분 숫자(예: 8500 → "8,500").
export function formatAmount(n: number): string {
    return Math.round(n).toLocaleString("ko-KR")
}

// ₩ 접두 통화 표기(예: 8500 → "₩8,500").
export function formatWon(n: number): string {
    return `₩${formatAmount(n)}`
}

const FALLBACK_COLOR = "#98a0a8"

// 수입 고정 카테고리 3종. key 는 암호문 블롭에 저장된다.
export const INCOME_CATEGORIES = [
    { key: "월급", color: "#2f9e6e" },
    { key: "상여", color: "#3d7dd6" },
    { key: "기타", color: "#98a0a8" },
]

export function incomeCategoryColor(key: string): string {
    return INCOME_CATEGORIES.find((c) => c.key === key)?.color ?? FALLBACK_COLOR
}
