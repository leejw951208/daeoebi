# 카드 결제월(익월) 반영 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 대시보드 월 화면을 결제월 기준으로 전환한다 — 카드 지출은 구매월+1(말일 클램프)에 결제되는 것으로 보고 남은 돈·카테고리·달력·목록에 일관 반영한다.

**Architecture:** 서버·모델·API 변경 없음(웹 전용). 각 지출에 클라이언트 집계 단계에서 "결제일(billingDate)"을 부여(카드=구매월+1, 그 외=구매일). 결제월 M 화면은 M·M-1 두 달치 구매를 가져와 결제월이 M 인 건만 집계한다.

**Tech Stack:** Next.js 15 App Router + React, WebCrypto E2E(서버는 method 를 못 읽음 → 결제월은 클라에서만 계산).

## Global Constraints

- 모델·API·마이그레이션 변경 없음. 웹 `app/(vault)/asset/` 하위만 수정.
- 카드 판별: `method === CARD_METHOD`(= `"카드"`). 자동이체·현금은 당월(이연 없음).
- 결제일 규칙: 카드면 구매일의 **다음 달 같은 일, 말일 클램프**; 그 외 구매일 그대로.
- 결제월 = `monthOf(billingDate)`. 월 키 `YYYY-MM`, 일자 `YYYY-MM-DD`.
- 순수 함수는 단위테스트 필수. 커밋은 각 Task 끝. 커밋 메시지 끝: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- 사용자 노출 문구 한국어, 문장 마침표 종결.

---

### Task 1: 결제일 순수 함수 (asset-dates.billingDate + CARD_METHOD)

**Files:**
- Modify: `apps/web/app/(vault)/asset/_lib/asset-categories.ts` (CARD_METHOD 상수)
- Modify: `apps/web/app/(vault)/asset/_lib/asset-dates.ts` (billingDate)
- Create: `apps/web/app/(vault)/asset/_lib/asset-dates.spec.ts`

**Interfaces:**
- Consumes: `monthOf`, `addMonth`, `clampedDate`(asset-dates 기존), `Method`(asset-categories 기존).
- Produces: `CARD_METHOD: Method`, `billingDate(dateISO: string, deferred: boolean): string`.

- [ ] **Step 1: CARD_METHOD 상수 추가 — asset-categories.ts**

`METHODS` 선언 아래에 추가:
```ts
// 결제월 이연(익월 결제) 대상 결제수단. 자동이체·현금은 당월.
export const CARD_METHOD: Method = "카드"
```

- [ ] **Step 2: 실패하는 테스트 작성 — asset-dates.spec.ts 신설**
```ts
// asset-dates 순수 함수 테스트.
import { billingDate } from "./asset-dates"

describe("billingDate", () => {
    it("비카드(deferred=false)는 구매일 그대로", () => {
        expect(billingDate("2026-06-17", false)).toBe("2026-06-17")
    })

    it("카드는 다음 달 같은 일", () => {
        expect(billingDate("2026-06-17", true)).toBe("2026-07-17")
    })

    it("카드 말일 구매는 다음 달 말일로 클램프", () => {
        expect(billingDate("2026-01-31", true)).toBe("2026-02-28")
    })

    it("카드 연말 구매는 다음 해 1월로 롤오버", () => {
        expect(billingDate("2026-12-10", true)).toBe("2027-01-10")
    })
})
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `pnpm --filter @daeoebi/web test -- asset-dates`
Expected: FAIL (`billingDate` is not a function / 미존재).

- [ ] **Step 4: billingDate 구현 — asset-dates.ts**

`clampedDate` 함수 아래에 추가:
```ts
// 결제일. deferred(카드)면 구매일의 다음 달 같은 일(말일 클램프), 그 외 구매일 그대로.
export function billingDate(dateISO: string, deferred: boolean): string {
    if (!deferred) return dateISO
    const day = Number(dateISO.slice(8, 10))
    return clampedDate(addMonth(monthOf(dateISO), 1), day)
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `pnpm --filter @daeoebi/web test -- asset-dates`
Expected: PASS (4 케이스).

- [ ] **Step 6: 커밋**
```bash
git add "apps/web/app/(vault)/asset/_lib/asset-dates.ts" "apps/web/app/(vault)/asset/_lib/asset-dates.spec.ts" "apps/web/app/(vault)/asset/_lib/asset-categories.ts"
git commit -m "feat(web): 결제일(billingDate) 순수 함수 — 카드 익월 클램프"
```

---

### Task 2: 집계 결제월 전환 (asset-compute)

**Files:**
- Modify: `apps/web/app/(vault)/asset/_lib/asset-compute.ts` (ComputedExpense.billingDate, byDay, billedInMonth)
- Modify: `apps/web/app/(vault)/asset/_lib/asset-compute.spec.ts` (exp() 헬퍼 갱신 + 신규 케이스)

**Interfaces:**
- Consumes: `monthOf`(asset-dates).
- Produces: `ComputedExpense` 에 `billingDate: string` 필드; `byDay` 가 `billingDate` 기준; `billedInMonth(items: ComputedExpense[], month: string): ComputedExpense[]`.

- [ ] **Step 1: 기존 테스트가 깨지지 않도록 exp() 헬퍼 갱신 + 실패 테스트 추가 — asset-compute.spec.ts**

`exp()` 헬퍼를 `billingDate` 기본값(구매일과 동일)으로 갱신하고, `billedInMonth` import + 신규 케이스를 추가한다.

헬퍼 교체:
```ts
function exp(over: Partial<ComputedExpense>): ComputedExpense {
    const date = over.date ?? "2026-06-10"
    return {
        id: "e",
        date,
        billingDate: date, // 기본은 구매일과 동일(비카드)
        recurringId: null,
        item: "x",
        amount: 1000,
        category: "식비",
        method: "카드",
        ...over,
    }
}
```
import 에 `billedInMonth` 추가. 신규 케이스 추가:
```ts
it("billedInMonth 는 결제월 기준으로 추린다", () => {
    const items = [
        exp({ id: "a", billingDate: "2026-06-05" }), // 6월 결제 포함
        exp({ id: "b", billingDate: "2026-07-01" }), // 7월 결제 제외
        exp({ id: "c", billingDate: "2026-06-30" }), // 6월 결제 포함
    ]
    expect(billedInMonth(items, "2026-06").map((e) => e.id)).toEqual(["a", "c"])
})

it("byDay 는 결제일(billingDate) 기준으로 합산한다", () => {
    const map = byDay([
        exp({ date: "2026-05-17", billingDate: "2026-06-17", amount: 30000 }), // 카드 이월
        exp({ date: "2026-06-17", billingDate: "2026-06-17", amount: 8000 }),
    ])
    expect(map.get("2026-06-17")).toBe(38000)
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm --filter @daeoebi/web test -- asset-compute`
Expected: FAIL (`billedInMonth` 미존재, 그리고 `ComputedExpense` 에 `billingDate` 가 없어 헬퍼 타입 에러).

- [ ] **Step 3: ComputedExpense·byDay·billedInMonth 구현 — asset-compute.ts**

파일 상단 import 에 `monthOf` 추가:
```ts
import { monthOf } from "./asset-dates"
```
`ComputedExpense` 인터페이스에 `billingDate` 추가(`date` 바로 아래):
```ts
export interface ComputedExpense {
    id: string
    date: string // 구매일 "YYYY-MM-DD"
    billingDate: string // 결제일 "YYYY-MM-DD"(카드=익월)
    recurringId: string | null
    item: string
    amount: number
    category: string
    method: string
}
```
`byDay` 를 `billingDate` 기준으로 변경:
```ts
// 일자(결제일) → 그 날 결제 합계.
export function byDay(items: ComputedExpense[]): Map<string, number> {
    const map = new Map<string, number>()
    for (const e of items) {
        map.set(e.billingDate, (map.get(e.billingDate) ?? 0) + e.amount)
    }
    return map
}
```
`billedInMonth` 추가(파일 끝, ComputedIncome 위/아래 어디든):
```ts
// 결제월이 month 인 지출만. (구매 두 달치에서 그 달 결제분 추림)
export function billedInMonth(
    items: ComputedExpense[],
    month: string,
): ComputedExpense[] {
    return items.filter((e) => monthOf(e.billingDate) === month)
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm --filter @daeoebi/web test -- asset-compute`
Expected: PASS (기존 byCategory·byDay·totalSpent 등 + 신규 2케이스).

- [ ] **Step 5: 커밋**
```bash
git add "apps/web/app/(vault)/asset/_lib/asset-compute.ts" "apps/web/app/(vault)/asset/_lib/asset-compute.spec.ts"
git commit -m "feat(web): 지출 집계를 결제월 기준으로 (billingDate·billedInMonth)"
```

> 주의: Task 2 만으로는 `page.tsx` 가 아직 `ComputedExpense` 를 `billingDate` 없이 만들어 web typecheck/build 가 깨질 수 있다. Task 3 와 함께 완성된다. web 최종 typecheck/build 통과는 Task 3 끝에서 확인.

---

### Task 3: 대시보드 로드·상세 결제월 적용

**Files:**
- Modify: `apps/web/app/(vault)/asset/page.tsx` (load: 2달치 조회·머티리얼라이즈·결제일·billedInMonth)
- Modify: `apps/web/app/(vault)/asset/_components/dashboard/AssetDashboard.tsx` (선택일 필터 billingDate)
- Modify: `apps/web/app/(vault)/asset/_components/dashboard/DayDetail.tsx` (카드 구매일 부제)

**Interfaces:**
- Consumes: `listExpenses`(client), `materializeRecurring`, `openExpense`, `billingDate`·`addMonth`(asset-dates), `CARD_METHOD`(asset-categories), `byDay`·`billedInMonth`·`totalIncome`·`type ComputedExpense`(asset-compute).

- [ ] **Step 1: page.tsx — import 보강**

import 에 추가/조정:
```tsx
import { billingDate, addMonth, currentMonth, monthLabel, todayISO } from "./_lib/asset-dates"
import { CARD_METHOD } from "./_lib/asset-categories"
import { byDay, billedInMonth, totalIncome, type ComputedExpense, type ComputedIncome } from "./_lib/asset-compute"
```
(`addMonth` 는 이미 import 중일 수 있다 — 중복 추가하지 말 것. `billingDate` 만 신규.)

- [ ] **Step 2: page.tsx — load() 의 지출 처리 교체**

기존 `listExpenses(month)` 단건 + `materializeRecurring(month)` + 지출 복호화 블록을, M·M-1 두 달치로 교체한다. 수입(incomeViews) 처리는 그대로 둔다.
```tsx
const prev = addMonth(month, -1)
const [incomeViews, expM, expPrev, templates] = await Promise.all([
    listIncomes(month),
    listExpenses(month),
    listExpenses(prev),
    listRecurring(),
])
// 고정 지출 머티리얼라이즈를 M·M-1 둘 다(M-1 카드 고정분이 M 에 청구). 멱등.
const createdM = await materializeRecurring(vaultKey, month, templates, expM)
const createdPrev = await materializeRecurring(vaultKey, prev, templates, expPrev)
const allViews: ExpenseView[] = [...expM, ...createdM, ...expPrev, ...createdPrev]

// 수입 복호화·합계 (기존 incomeSettled 로직 그대로 유지)
// ...

// 지출 복호화(실패분 스킵) → 결제일 부여 → 결제월 M 만
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
const expenses = billedInMonth(decrypted, month)

setState({ status: "ready", data: { incomeAmount, incomes, expenses } })
```
`dayTotals` useMemo 는 그대로(`byDay(state.data.expenses)` — 이제 billingDate 기준).

- [ ] **Step 3: AssetDashboard.tsx — 선택일 필터를 결제일로**

`dayExpenses` 계산의 필터를 변경:
```tsx
const dayExpenses = selectedDay
    ? data.expenses
          .filter((e) => e.billingDate === selectedDay)
          .sort((a, b) => b.amount - a.amount)
    : []
```

- [ ] **Step 4: DayDetail.tsx — 카드 구매일 부제**

각 지출 행의 "카테고리 · 결제수단" 부제에, 결제일과 구매일이 다른 카드 건이면 "M/D 구매"를 덧붙인다. 부제 라인을 다음으로 교체:
```tsx
<span style={{ fontSize: 12, color: "var(--color-text-muted)", fontWeight: 500 }}>
    {e.category} · {e.method}
    {e.billingDate !== e.date
        ? ` · ${e.date.slice(5).replace("-", "/")} 구매`
        : ""}
</span>
```

- [ ] **Step 5: web 전체 검증**

Run:
```
pnpm --filter @daeoebi/web typecheck \
  && pnpm --filter @daeoebi/web lint \
  && pnpm --filter @daeoebi/web test \
  && pnpm --filter @daeoebi/web build
```
Expected: 모두 통과.

- [ ] **Step 6: 커밋**
```bash
git add "apps/web/app/(vault)/asset"
git commit -m "feat(web): 대시보드를 결제월 기준으로 — 카드 익월 반영·구매일 부제"
```

---

## 최종 검증 (전체)

- [ ] `make typecheck` · `make lint` · `make test` 통과.
- [ ] `make dev-up` 후 dev 우회 진입(localhost:3010):
  - 6월에 카드 지출 입력 → 6월 화면 남은 돈·달력에서 빠지지 않고 7월 화면에 반영.
  - 현금·자동이체는 당월 그대로.
  - 달력에서 카드 건이 결제월 같은 일자(클램프)에 찍히고 상세에 "M/D 구매" 부제.
  - 지출 합계 == 남은 돈 차감.

## 빌드 순서

billingDate(Task 1) → 집계(Task 2) → 로드·UI(Task 3). Task 2·3 는 web 빌드가 함께 통과하므로 연속 진행, web 최종 typecheck/build 는 Task 3 끝에서 확인.
