// 자산 관리 고정 상수(카테고리·결제방법)와 통화 포맷. 디자인 프로토타입 값과 일치한다.

export interface AssetCategory {
    key: string
    color: string
}

// 디자인 고정 6종. key 는 암호문 블롭에 저장되는 카테고리 식별자다.
export const CATEGORIES: AssetCategory[] = [
    { key: "식비", color: "#f2994a" },
    { key: "교통", color: "#4a90d9" },
    { key: "주거·공과금", color: "#9b6bd6" },
    { key: "쇼핑", color: "#e0689a" },
    { key: "문화", color: "#3bb273" },
    { key: "기타", color: "#98a0a8" },
]

export const METHODS = ["카드", "자동이체", "현금"] as const
export type Method = (typeof METHODS)[number]

const FALLBACK_COLOR = "#98a0a8"

export function categoryColor(key: string): string {
    return CATEGORIES.find((c) => c.key === key)?.color ?? FALLBACK_COLOR
}

// 천 단위 구분 숫자(예: 8500 → "8,500").
export function formatAmount(n: number): string {
    return Math.round(n).toLocaleString("ko-KR")
}

// ₩ 접두 통화 표기(예: 8500 → "₩8,500").
export function formatWon(n: number): string {
    return `₩${formatAmount(n)}`
}
