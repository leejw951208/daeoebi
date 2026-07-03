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

// 색상 hex 검증(서버 DTO 규칙과 동일: #rrggbb).
export const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/
export function isValidHexColor(v: string): boolean {
    return HEX_COLOR_RE.test(v)
}

// 입력 정규화: 허용문자(#·hex)만 남기고, 선행 # 하나 보장, 소문자화, 최대 7자(#rrggbb).
export function normalizeHexInput(raw: string): string {
    const cleaned = raw
        .replace(/[^#0-9a-fA-F]/g, "")
        .replace(/#/g, "")
        .toLowerCase()
    if (cleaned === "") return ""
    return `#${cleaned}`.slice(0, 7)
}

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
