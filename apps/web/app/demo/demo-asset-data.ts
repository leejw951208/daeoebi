// 공개 데모(/demo)용 가짜 자산 데이터. vault-client 를 절대 import 하지 않는다(타입만).
import type { AssetCategory } from "@/lib/vault-client"
import type {
    ComputedExpense,
    ComputedIncome,
} from "../(vault)/asset/_lib/asset-compute"
import {
    BUDGET_CATEGORY,
    BUDGET_ITEM,
} from "../(vault)/asset/_lib/asset-payload"

// 고정 표시 월(예시). 실제 오늘과 무관한 상수.
export const DEMO_MONTH = "2026-06"

// 고정 카테고리 11종(코드 보유). 데모는 서버 없이 이 목록을 그대로 쓴다.
function fixedCat(
    id: string,
    name: string,
    color: string,
    code: string,
    day: number,
): AssetCategory {
    const ts = `2026-01-${String(day).padStart(2, "0")}T00:00:00.000Z`
    return { id, name, color, code, createdAt: ts, updatedAt: ts }
}

export const DEMO_ASSET_CATEGORIES: AssetCategory[] = [
    fixedCat("c-food", "식비·카페", "#f2994a", "FOOD", 1),
    fixedCat("c-mart", "생활·잡화", "#e0689a", "MART", 2),
    fixedCat("c-shop", "쇼핑·문화", "#9b6bd6", "SHOPPING", 3),
    fixedCat("c-health", "건강·미용", "#7b61ff", "HEALTH", 4),
    fixedCat("c-housing", "주거·통신", "#4a90d9", "HOUSING", 5),
    fixedCat("c-insurance", "보험·세금", "#2d9cdb", "INSURANCE_TAX", 6),
    fixedCat("c-transport", "교통", "#3bb273", "TRANSPORT", 7),
    fixedCat("c-subscription", "구독", "#bb6bd9", "SUBSCRIPTION", 8),
    fixedCat("c-invest", "투자", "#6fcf97", "INVESTMENT", 9),
    fixedCat("c-savings", "저축", "#f2c94c", "SAVINGS", 10),
    fixedCat("c-etc", "기타", "#98a0a8", "ETC", 11),
]

// 현재월 여러 날짜에 분산된 예시 지출. categoryId 는 위 카테고리를 참조.
export const DEMO_EXPENSES: ComputedExpense[] = [
    {
        id: "e1",
        date: "2026-06-02",
        recurringId: null,
        item: "점심 김밥천국",
        amount: 8500,
        categoryId: "c-food",
    },
    {
        id: "e2",
        date: "2026-06-03",
        recurringId: null,
        item: "지하철 정기권",
        amount: 62000,
        categoryId: "c-transport",
    },
    {
        id: "e3",
        date: "2026-06-05",
        recurringId: null,
        item: "6월 전기요금",
        amount: 43000,
        categoryId: "c-housing",
    },
    {
        id: "e4",
        date: "2026-06-08",
        recurringId: null,
        item: "쿠팡 생필품",
        amount: 29310,
        categoryId: "c-shop",
    },
    {
        id: "e5",
        date: "2026-06-08",
        recurringId: null,
        item: "카카오페이 송금",
        amount: 16700,
        categoryId: "c-etc",
    },
    {
        id: "e6",
        date: "2026-06-12",
        recurringId: null,
        item: "영화관",
        amount: 15000,
        categoryId: "c-etc",
    },
    {
        id: "e7",
        date: "2026-06-15",
        recurringId: null,
        item: "마트 장보기",
        amount: 54200,
        categoryId: "c-mart",
    },
    {
        id: "e8",
        date: "2026-06-20",
        recurringId: null,
        item: "택시",
        amount: 11200,
        categoryId: "c-transport",
    },
    {
        id: "e9",
        date: "2026-06-24",
        recurringId: null,
        item: "옷 구매",
        amount: 68000,
        categoryId: "c-shop",
    },
    {
        id: "e10",
        date: "2026-06-27",
        recurringId: null,
        item: "커피 정기구독",
        amount: 12900,
        categoryId: "c-food",
    },
]

export const DEMO_BUDGET_AMOUNT = 3_200_000
export const DEMO_BUDGET_ROWS: ComputedIncome[] = [
    {
        id: "i1",
        month: DEMO_MONTH,
        item: BUDGET_ITEM,
        amount: DEMO_BUDGET_AMOUNT,
        category: BUDGET_CATEGORY,
    },
]
