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
import type { ComputedRecurring } from "./asset-compute"

// 개월 수 입력값(문자열)을 템플릿의 termMonths 로 바꾼다. 비었거나 1 미만·정수 아님 = 무기한(null).
export function parseTermMonths(input: string): number | null {
    const n = Number(input)
    return Number.isInteger(n) && n >= 1 ? n : null
}

// 결제일 표기. 템플릿은 특정 날짜가 아니라 "매월 며칠"을 가진다.
export function formatDayOfMonth(dayOfMonth: number): string {
    return `매월 ${dayOfMonth}일`
}

// 기간 표기. termMonths 가 null 이면 끝나지 않는 고정 지출이다.
export function formatTerm(termMonths: number | null): string {
    return termMonths === null ? "무기한" : `${termMonths}개월`
}

// 매달 나가는 고정 지출 합계.
export function totalRecurring(rows: readonly ComputedRecurring[]): number {
    return rows.reduce((sum, r) => sum + r.amount, 0)
}

// 결제일 오름차순(동률이면 지출명 사전순). 새 배열을 반환한다.
export function sortRecurring(
    rows: readonly ComputedRecurring[],
): ComputedRecurring[] {
    return [...rows].sort(
        (a, b) =>
            a.dayOfMonth - b.dayOfMonth || a.item.localeCompare(b.item, "ko"),
    )
}

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
