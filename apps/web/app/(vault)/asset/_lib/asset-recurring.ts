// 고정 지출 매월 자동 생성(클라이언트 머티리얼라이즈). 서버는 블롭을 못 읽으므로 클라가 수행한다.
// 활성 템플릿 중 해당 월 인스턴스가 없는 것을 복호화→재봉인→생성한다. 서버 @@unique 로 멱등(409 무시).
import {
    createExpense,
    deleteExpense,
    listRecurringInstances,
    updateExpense,
    type ExpenseView,
    type RecurringSlot,
    type RecurringView,
} from "@/lib/vault-client"
import { isApiError } from "@/lib/api-error"
import { openExpense, sealExpense, type ExpensePayload } from "./asset-payload"
import { addMonth, clampedDate } from "./asset-dates"
import type { ComputedExpense, ComputedRecurring } from "./asset-compute"

// 템플릿에서 인스턴스를 만들거나 되돌릴 때 필요한 최소 정보.
export interface RecurringTemplateRef {
    id: string
    dayOfMonth: number
    categoryId: string | null
    startMonth: string
    termMonths: number | null
}

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

// 종료월(포함). 무기한이면 null. 3개월 = 시작월 포함 3개라 startMonth+2 가 종료월이다.
export function endMonthOf(
    startMonth: string,
    termMonths: number | null,
): string | null {
    return termMonths === null ? null : addMonth(startMonth, termMonths - 1)
}

// 그 달에 실제로 나가는 고정 지출만 남긴다. 시작 전·기간 종료 후 템플릿을 제외한다.
// 템플릿은 만료돼도 active 로 남으므로(서버가 끄지 않는다) 표시 시점에 걸러야 한다.
export function recurringInMonth(
    rows: readonly ComputedRecurring[],
    month: string,
): ComputedRecurring[] {
    return rows.filter((r) => {
        if (month < r.startMonth) return false
        const end = endMonthOf(r.startMonth, r.termMonths)
        return end === null || month <= end
    })
}

// 미래 달의 "예정" 고정 지출을 템플릿에서 합성한다. DB 에는 쓰지 않는다.
//
// 미래 달을 열었다고 인스턴스를 만들면 전 기간 누적 집계(저축·투자)가 그만큼 부풀려진다.
// 그렇다고 안 보여주면 다음 달에 뭐가 나갈지 알 수가 없다. 그래서 화면에서만 합성해 보여주고,
// 그 달이 실제로 오면 materializeRecurring 이 진짜 인스턴스를 만든다.
export function projectRecurring(
    rows: readonly ComputedRecurring[],
    month: string,
    nowMonth: string,
): ComputedExpense[] {
    if (month <= nowMonth) return [] // 현재·과거 달은 진짜 인스턴스가 있다.
    return recurringInMonth(rows, month).map((r) => ({
        id: `projected:${r.id}:${month}`,
        date: clampedDate(month, r.dayOfMonth),
        recurringId: r.id,
        item: r.item,
        amount: r.amount,
        categoryId: r.categoryId,
        projected: true,
    }))
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

// 템플릿 수정을 이후 달에 전파할 기준월. 편집한 달과 현재 달 중 나중 것이다.
// 과거 달을 고칠 때 그 사이 달들의 확정된 기록까지 덮어쓰지 않게 막는다(앞으로만 반영).
export function propagationPivot(
    editedMonth: string,
    nowMonth: string,
): string {
    return editedMonth > nowMonth ? editedMonth : nowMonth
}

// month 의 미생성 고정 지출을 만들어 생성된 인스턴스 배열을 반환한다(없으면 빈 배열).
// 생성 대상을 먼저 필터링한 뒤 Promise.all 로 병렬 실행해 K 직렬 요청을 제거한다.
//
// occupiedSlots 는 그 달에 이미 점유된 (recurringId, period) 다. 소프트 삭제된 슬롯까지 포함해야
// 한다 — 월 목록에는 안 나오지만 unique 키는 잡고 있어서, 없는 줄 알고 만들면 매 로드마다 409 다.
export async function materializeRecurring(
    vaultKey: CryptoKey,
    month: string,
    templates: RecurringView[],
    occupiedSlots: readonly RecurringSlot[],
    nowMonth: string,
): Promise<ExpenseView[]> {
    // 미래 달은 들여다보기만 해도 인스턴스가 박혀 누적 집계(저축·투자)를 부풀린다. 현재 달까지만 만든다.
    if (month > nowMonth) return []
    const present = new Set(
        occupiedSlots
            .filter((s) => s.recurringId)
            .map((s) => `${s.recurringId}|${s.period}`),
    )
    const targets = templates.filter((t) => {
        if (month < t.startMonth) return false // 시작월 이전 달엔 생성하지 않는다.
        const end = endMonthOf(t.startMonth, t.termMonths)
        if (end !== null && month > end) return false // 기간(개월 수) 종료 후엔 생성하지 않는다.
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

// 템플릿을 고칠 때, 이미 만들어져 있는 이후 달 인스턴스를 새 내용으로 재봉인해 갱신한다.
// 미리 열어본 달은 인스턴스가 이미 존재해 materializeRecurring 이 건너뛰므로, 여기서 따로 밀어줘야 한다.
//
// 기준월은 propagationPivot 이 정한다 — 과거 달을 고쳐도 지나간 달의 확정 기록은 건드리지 않는다.
// 개월 수를 줄여 기간이 끝난 뒤로 밀려난 인스턴스는 갱신이 아니라 삭제한다(되살리면 안 된다).
export async function propagateRecurringUpdate(
    vaultKey: CryptoKey,
    template: RecurringTemplateRef,
    editedMonth: string,
    payload: ExpensePayload,
    nowMonth: string,
): Promise<void> {
    const pivot = propagationPivot(editedMonth, nowMonth)
    const endMonth = endMonthOf(template.startMonth, template.termMonths)
    const future = await listRecurringInstances(template.id, pivot)
    await Promise.all(
        future.map(async (e) => {
            const period = e.period ?? pivot
            if (endMonth !== null && period > endMonth) {
                await deleteExpense(e.id)
                return
            }
            const blob = await sealExpense(vaultKey, payload)
            await updateExpense(e.id, {
                date: clampedDate(period, template.dayOfMonth),
                categoryId: template.categoryId ?? undefined,
                ...blob,
            })
        }),
    )
}

// 고정 해제·전체 삭제 시, 미리 열어봐서 이미 만들어져 있는 미래 달 인스턴스를 지운다.
// 현재 달과 과거 달의 기록은 실제로 나간 돈이므로 그대로 둔다.
export async function removeRecurringFuture(
    templateId: string,
    nowMonth: string,
): Promise<void> {
    const future = await listRecurringInstances(templateId, nowMonth)
    await Promise.all(future.map((e) => deleteExpense(e.id)))
}
