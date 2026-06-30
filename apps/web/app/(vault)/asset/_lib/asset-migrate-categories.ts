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

// 대상 지출 목록에서 categoryId 없는 건을 이름 매칭으로 PATCH. 처리 건수 반환.
// 항목별 try/catch 로 개별 실패를 격리하고, 전체를 병렬 실행한다.
export async function migrateExpenseCategories(
    vaultKey: CryptoKey,
    categories: AssetCategory[],
    expenses: ExpenseView[],
): Promise<number> {
    const targets = expenses.filter((e) => e.categoryId === null)
    const counts = await Promise.all(
        targets.map(async (e): Promise<number> => {
            try {
                const legacyName = await readLegacyCategory(vaultKey, e)
                const id = matchCategoryId(legacyName, categories)
                if (id !== null) {
                    await updateExpense(e.id, { categoryId: id })
                    return 1
                }
                return 0
            } catch {
                // 개별 실패(복호화/네트워크)는 스킵하고 다음 항목으로 진행한다.
                return 0
            }
        }),
    )
    return counts.reduce((acc, n) => acc + n, 0)
}
