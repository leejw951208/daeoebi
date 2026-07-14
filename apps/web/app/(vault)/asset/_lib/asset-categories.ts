// 자산 관리 고정 상수(카테고리·결제방법)와 통화 포맷. 디자인 프로토타입 값과 일치한다.
import type { AssetCategory } from "@/lib/vault-client"

// 저축·투자 대시보드 앵커 코드(고정 카테고리 code). 이름은 바뀌지 않는 고정값이다.
export const SAVINGS_CODE = "SAVINGS"
export const INVESTMENT_CODE = "INVESTMENT"

// 고정 카테고리 여부. code 가 있으면 고정(수정·삭제 불가), 없으면 사용자 생성.
export function isFixedCategory(category: { code: string | null }): boolean {
    return category.code !== null
}

// 카테고리 색 선택용 고정 팔레트(임의 hex 입력 대신 선택).
export const CATEGORY_PALETTE: string[] = [
    "#f2994a",
    "#eb5757",
    "#e0689a",
    "#9b6bd6",
    "#7b61ff",
    "#4a90d9",
    "#2d9cdb",
    "#20a4a4",
    "#3bb273",
    "#6fcf97",
    "#f2c94c",
    "#98a0a8",
]

// 색상 hex 검증(서버 DTO 규칙과 동일: #rrggbb).
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/
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

// ₩ 접두 통화 표기(예: 8500 → "₩8,500"). 음수는 부호를 통화 기호 앞에 둔다(-₩8,500).
export function formatWon(n: number): string {
    const rounded = Math.round(n)
    return rounded < 0
        ? `-₩${formatAmount(Math.abs(rounded))}`
        : `₩${formatAmount(rounded)}`
}

// 적금 목표 금액 프리셋(설계 v5 goalPresets/addGoalPresets 와 동일한 값·라벨).
export interface AmountPreset {
    value: number
    label: string
}

const HUNDRED_MILLION = 100_000_000
const TEN_MILLION = 10_000_000

export const SAVINGS_GOAL_PRESETS: AmountPreset[] = [
    10_000_000, 30_000_000, 50_000_000, 100_000_000,
].map((value) => ({
    value,
    label:
        value >= HUNDRED_MILLION
            ? `${value / HUNDRED_MILLION}억`
            : `${value / TEN_MILLION}천만`,
}))

// 투자 수익률 프리셋(설계 v5 returnPresets 와 동일한 값).
export const RETURN_RATE_PRESETS: AmountPreset[] = [3, 5, 8, 10].map(
    (value) => ({ value, label: `${value}%` }),
)
