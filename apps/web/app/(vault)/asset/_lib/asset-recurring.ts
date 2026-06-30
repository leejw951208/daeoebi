// 고정 지출 매월 자동 생성(클라이언트 머티리얼라이즈). 서버는 블롭을 못 읽으므로 클라가 수행한다.
// 활성 템플릿 중 해당 월 인스턴스가 없는 것을 복호화→재봉인→생성한다. 서버 @@unique 로 멱등(409 무시).
import {
    createExpense,
    type ExpenseView,
    type RecurringView,
} from "@/lib/vault-client"
import { isApiError } from "@/lib/api-error"
import { openExpense, sealExpense } from "./asset-payload"
import { addMonth, clampedDate } from "./asset-dates"

// month 의 미생성 고정 지출을 만들어 생성된 인스턴스 배열을 반환한다(없으면 빈 배열).
// 생성 대상을 먼저 필터링한 뒤 Promise.all 로 병렬 실행해 K 직렬 요청을 제거한다.
export async function materializeRecurring(
    vaultKey: CryptoKey,
    month: string,
    templates: RecurringView[],
    monthExpenses: ExpenseView[],
): Promise<ExpenseView[]> {
    const present = new Set(
        monthExpenses
            .filter((e) => e.recurringId)
            .map((e) => `${e.recurringId}|${e.period}`),
    )
    const targets = templates.filter((t) => {
        if (month < t.startMonth) return false // 시작월 이전 달엔 생성하지 않는다.
        if (
            t.termMonths != null &&
            month > addMonth(t.startMonth, t.termMonths - 1)
        )
            return false // 기간(개월 수) 종료 후엔 생성하지 않는다.
        return !present.has(`${t.id}|${month}`)
    })
    const results = await Promise.all(
        targets.map(async (t): Promise<ExpenseView | null> => {
            const payload = await openExpense(vaultKey, t)
            const blob = await sealExpense(vaultKey, payload)
            try {
                return await createExpense({
                    date: clampedDate(month, t.dayOfMonth),
                    recurringId: t.id,
                    period: month,
                    categoryId: t.categoryId ?? undefined,
                    ...blob,
                })
            } catch (e) {
                // 동시 로드 등으로 이미 생성됐으면(409 중복) 무시한다.
                if (isApiError(e) && e.status === 409) return null
                throw e
            }
        }),
    )
    return results.filter((r): r is ExpenseView => r !== null)
}
