# 카드 결제월(익월) 반영 설계

## 1. 배경·목표

지금 대시보드는 지출을 **구매일(date)이 속한 달**로 집계한다. 그러나 카드 지출은 실제로 **익월에 결제(출금)**된다. 사용자는 "이번 달 남은 돈"이 **이번 달에 실제 빠져나가는 돈** 기준이길 원한다.

목표: 월 화면을 **결제월(billing month)** 기준으로 전환한다. 결제월 M 화면 = M에 결제되는 지출(= M에 구매한 비카드 + M-1에 구매한 카드)을 남은 돈·카테고리·달력·목록 모두에 일관되게 반영한다.

확정 결정(브레인스토밍):
- **정밀도 A**: `method === "카드"`면 결제월 = 구매월+1(말일 클램프). 자동이체·현금은 당월.
- **결제월 전체 전환**: 월 네비게이션이 결제월을 의미. 지출 합계 == 남은 돈 차감으로 일관.
- **달력은 같은 일자로 이월**: 카드는 결제월의 같은 일(말일 클램프)에 표시, 비카드는 실제 구매일. 상세에 "M/D 구매" 부제.

`method`는 암호문 블롭 안에 있으므로 **서버는 결제월을 계산할 수 없다 → 전부 클라이언트 집계에서 처리**한다. 모델·API·마이그레이션 변경 없음(웹 전용).

## 2. 핵심 개념: 결제일(billingDate)

복호화된 지출 1건은 평문 `date`("YYYY-MM-DD")와 `method`를 갖는다. 결제일을 다음과 같이 정의한다.

- 카드(이연): 구매일의 **다음 달 같은 일**, 그 달 말일로 클램프.
- 그 외: 구매일 그대로.

순수 함수(`asset-dates.ts`)로 분리한다(기존 `monthOf`/`addMonth`/`clampedDate` 재사용):

```ts
// deferred=true(카드)면 구매일의 다음 달 같은 일(말일 클램프)을 결제일로.
export function billingDate(dateISO: string, deferred: boolean): string {
    if (!deferred) return dateISO
    const day = Number(dateISO.slice(8, 10))
    return clampedDate(addMonth(monthOf(dateISO), 1), day)
}
```

카드 여부 판별 상수는 `asset-categories.ts`에 둔다(매직 문자열 제거):
```ts
export const CARD_METHOD: Method = "카드"
```

엣지: 1/31 카드 → `clampedDate("2026-02", 31)` = `2026-02-28`. 12월 카드 → 다음 해 1월(addMonth 가 연 롤오버 처리).

## 3. 집계 (asset-compute.ts)

`ComputedExpense`에 결제일을 추가한다. 달력·일별 집계는 결제일 기준으로 바꾼다.

```ts
export interface ComputedExpense {
    id: string
    date: string            // 구매일 "YYYY-MM-DD" (평문, 상세 부제용)
    billingDate: string     // 결제일 "YYYY-MM-DD"
    recurringId: string | null
    item: string
    amount: number
    category: string
    method: string
}

// 일자(결제일) → 그 날 결제 합계. (기존 byDay 가 e.date → e.billingDate 로 변경)
export function byDay(items: ComputedExpense[]): Map<string, number> {
    const map = new Map<string, number>()
    for (const e of items) {
        map.set(e.billingDate, (map.get(e.billingDate) ?? 0) + e.amount)
    }
    return map
}

// 결제월이 month 인 지출만. (구매 두 달치에서 그 달 결제분만 추림)
export function billedInMonth(items: ComputedExpense[], month: string): ComputedExpense[] {
    return items.filter((e) => monthOf(e.billingDate) === month)
}
```

`totalSpent`·`byCategory`·`remaining`·`spentPct`는 시그니처 변경 없이 **billedInMonth 로 추려진 집합** 위에서 그대로 동작한다(따라서 지출 합계 == 남은 돈 차감). `byCategory`는 `ComputedExpense` 추가 필드와 무관하게 기존대로.

## 4. 대시보드 로드 (asset/page.tsx)

결제월 M 화면을 그리려면 M·M-1 두 달치 구매를 가져와 결제일을 매겨 M 결제분만 남긴다.

```ts
const prev = addMonth(month, -1)
const [expM, expPrev, templates] = await Promise.all([
    listExpenses(month),
    listExpenses(prev),
    listRecurring(),
])
// 고정 지출 머티리얼라이즈를 M·M-1 둘 다 수행(M-1 카드 고정분이 M 에 청구되므로). 멱등.
const createdM = await materializeRecurring(vaultKey, month, templates, expM)
const createdPrev = await materializeRecurring(vaultKey, prev, templates, expPrev)
const allViews: ExpenseView[] = [...expM, ...createdM, ...expPrev, ...createdPrev]

// 복호화(실패분 스킵) → 결제일 부여
const settled = await Promise.allSettled(
    allViews.map(async (v): Promise<ComputedExpense> => {
        const p = await openExpense(vaultKey, v)
        return {
            id: v.id,
            date: v.date,
            billingDate: billingDate(v.date, p.method === CARD_METHOD),
            recurringId: v.recurringId,
            item: p.item,
            amount: p.amount,
            category: p.category,
            method: p.method,
        }
    }),
)
const decrypted = settled
    .filter((r): r is PromiseFulfilledResult<ComputedExpense> => r.status === "fulfilled")
    .map((r) => r.value)
const expenses = billedInMonth(decrypted, month) // M 결제분만
```

이후 `dayTotals = byDay(expenses)`(결제일 키), 수입·`incomeAmount`(현행 그대로) → `남은 돈 = incomeAmount − totalSpent(expenses)`.

> 주의: `allViews` 에 M·M-1 두 달치가 섞여 같은 id 중복은 없다(서로 다른 달의 다른 행). `billedInMonth` 가 비카드 M-1·카드 M 을 자연히 제외한다.

## 5. UI 변경 (최소)

- **`ExpenseCalendar`**: 변경 없음. `dayTotals`(결제일 키)와 `buildCalendar(month)` 셀이 결제월 안에서 맞물린다.
- **`AssetDashboard`**: 선택일 상세용 `dayExpenses` 필터를 `e.date === selectedDay` → `e.billingDate === selectedDay` 로 변경.
- **`DayDetail`**: 카드 건(결제일 ≠ 구매일)일 때 항목 부제에 "M/D 구매"를 덧붙인다. 표시 헬퍼(예: `purchaseLabel(e)` = `billingDate !== date ? \`${date.slice(5).replace("-","/")} 구매\` : null`). 기존 "카테고리 · 결제수단" 라인에 자연스럽게 병기.
- **월 네비 의미 변경 안내(선택, 과하지 않게)**: 헤더 월 라벨 옆 또는 수입/지출 카드 근처에 "결제월 기준" 정도의 작은 표기. YAGNI — 1차엔 생략 가능, 리뷰 때 판단.
- **지출 폼·상세([id])**: 변경 없음(구매일 기준 그대로).

## 6. 테스트

- **asset-dates** (`asset-dates.spec.ts` 신설 또는 기존에 추가): `billingDate`
  - 비카드(deferred=false) → 입력 그대로.
  - 카드 → 다음 달 같은 일(예: `2026-06-17`,true → `2026-07-17`).
  - 말일 클램프(`2026-01-31`,true → `2026-02-28`).
  - 연말 롤오버(`2026-12-10`,true → `2027-01-10`).
- **asset-compute** (`asset-compute.spec.ts` 에 추가): `billedInMonth` 가 결제월 기준으로 추리는지(M 비카드 포함, M 카드 제외, M-1 카드 포함); `byDay` 가 `billingDate` 로 합산하는지.

## 7. 범위 밖 (YAGNI, 후속 가능)

- 카드별 결제일·마감일 기반 정확한 청구월(정밀도 B).
- 실제 결제일 기준 정확 날짜.
- 결제월/구매월 토글 보기, 결제월 안내 배너 정교화.

## 8. 검증

1. `make typecheck`·`make lint`·`make test` 통과.
2. `make dev-up` 후 dev 우회 진입(localhost:3010):
   - 카드 지출을 6월에 입력 → 6월 화면 남은 돈/달력에서 빠지지 않고 **7월 화면**에 반영되는지.
   - 현금·자동이체는 당월 그대로인지.
   - 달력에서 카드 건이 결제월의 같은 일자(클램프)에 찍히고 상세에 "구매일" 부제가 보이는지.
   - 지출 합계와 남은 돈 차감이 일치하는지.
