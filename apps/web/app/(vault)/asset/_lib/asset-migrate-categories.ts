// 기존 지출(categoryId 없음)을 옛 블롭의 카테고리 이름으로 매칭해 categoryId 를 채운다.
// 서버는 블롭을 못 읽으므로 클라이언트가 로그인 후 1회 수행한다. 멱등.
import {
    updateExpense,
    type AssetCategory,
    type ExpenseView,
} from "@/lib/vault-client"
import { readLegacyCategory } from "./asset-payload"

export function matchCategoryId(
    name: string | null,
    categories: AssetCategory[],
): string | null {
    if (name === null) return null
    return categories.find((c) => c.name === name)?.id ?? null
}

// 마이그레이션 결과. migrated: 이번에 categoryId 를 채운 건수.
// pendingLegacy: 옛 블롭에 카테고리 "이름"은 있으나 매칭되는 카테고리가 아직 없어
// 다음 기회에 다시 시도해야 하는 건수(예: 사용자가 해당 카테고리를 아직 안 만듦).
export interface MigrationResult {
    migrated: number
    pendingLegacy: number
}

// categoryId 없는 지출을 이름 매칭으로 PATCH 한다(병렬, 항목별 실패 격리).
// 처리 건수와 "아직 매칭 못 한 legacy 이름" 잔여 수를 함께 반환한다.
// 잔여가 0 이어야 그 달을 영구 가드해도 안전하다(진짜 미분류만 남은 상태).
export async function migrateExpenseCategories(
    vaultKey: CryptoKey,
    categories: AssetCategory[],
    expenses: ExpenseView[],
): Promise<MigrationResult> {
    const targets = expenses.filter((e) => e.categoryId === null)
    const results = await Promise.all(
        targets.map(async (e): Promise<MigrationResult> => {
            try {
                const legacyName = await readLegacyCategory(vaultKey, e)
                const id = matchCategoryId(legacyName, categories)
                if (id !== null) {
                    await updateExpense(e.id, { categoryId: id })
                    return { migrated: 1, pendingLegacy: 0 }
                }
                // 이름은 있으나 매칭 카테고리가 없으면 나중에 재시도 대상이다.
                if (legacyName !== null) {
                    return { migrated: 0, pendingLegacy: 1 }
                }
                // 이름조차 없으면(신규 포맷=진짜 미분류) 영구히 처리할 게 없다.
                return { migrated: 0, pendingLegacy: 0 }
            } catch {
                // 개별 실패(복호화/네트워크)는 스킵. 손상 블롭의 무한 재시도를 막기 위해
                // pendingLegacy 로 세지 않는다.
                return { migrated: 0, pendingLegacy: 0 }
            }
        }),
    )
    return results.reduce(
        (acc, r) => ({
            migrated: acc.migrated + r.migrated,
            pendingLegacy: acc.pendingLegacy + r.pendingLegacy,
        }),
        { migrated: 0, pendingLegacy: 0 },
    )
}
