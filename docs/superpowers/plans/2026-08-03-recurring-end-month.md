# 고정 지출 종료월 선택 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 고정 지출 폼에서 개월 수 대신 종료월을 직접 고르게 하고, 종료월 이후에 이미 만들어진 지출을 확인 후 정리한다.

**Architecture:** 저장 형식(`termMonths`)과 스키마는 그대로 두고, 종료월은 폼 안에서만 존재하다가 저장 직전 개월 수로 환산된다. 환산 기준인 `startMonth`를 고정 해제된 템플릿에서도 읽을 수 있도록 `GET /recurring/:id`를 추가한다. 범위 계산과 환산은 전부 순수 함수로 빼서 컴포넌트는 렌더만 한다.

**Tech Stack:** Next.js(App Router)·React·TypeScript / NestJS·Prisma / Jest·React Testing Library·Playwright

## Global Constraints

- 스키마·마이그레이션 변경 없음. `RecurringExpense.termMonths`가 계속 저장 형식이다.
- 월 키는 `"YYYY-MM"`, 일자는 `"YYYY-MM-DD"` 문자열. 문자열 사전순 비교가 곧 시간순 비교다.
- 불변 패턴 유지. 기존 객체·배열을 제자리에서 고치지 않는다.
- 커밋 메시지는 `<type>: <설명>` 형식(type: feat, fix, refactor, docs, test, chore, perf, ci).
- 작업 브랜치는 `feat/recurring-end-month`(main 기반, 이미 생성됨). main으로 병합하지 않는다.
- 웹 단위 테스트: `pnpm --filter @daeoebi/web test`, API 단위 테스트: `pnpm --filter @daeoebi/api test:unit`.

---

### Task 1: 월 계산 헬퍼

두 달 사이의 개월 차와 월 목록을 만드는 순수 함수다. 종료월 드롭다운과 환산 함수가 둘 다 이걸 쓴다.

**Files:**
- Modify: `apps/web/app/(vault)/asset/_lib/asset-dates.ts`
- Test: `apps/web/app/(vault)/asset/_lib/asset-dates.spec.ts`

**Interfaces:**
- Consumes: 기존 `addMonth(month, delta)`
- Produces: `monthsBetween(from: string, to: string): number`, `monthRange(from: string, to: string): string[]`

- [ ] **Step 1: 실패하는 테스트 작성**

`asset-dates.spec.ts` 상단 import 목록에 `monthsBetween`, `monthRange`를 추가하고, 파일 끝에 아래를 붙인다.

```ts
describe("monthsBetween", () => {
    it("같은 달이면 0 이다", () => {
        expect(monthsBetween("2026-06", "2026-06")).toBe(0)
    })

    it("해를 넘겨도 개월 수를 센다", () => {
        expect(monthsBetween("2026-11", "2027-02")).toBe(3)
    })

    it("to 가 from 보다 앞이면 음수다", () => {
        expect(monthsBetween("2026-06", "2026-03")).toBe(-3)
    })
})

describe("monthRange", () => {
    it("양끝을 포함한 월 목록을 만든다", () => {
        expect(monthRange("2026-11", "2027-01")).toEqual([
            "2026-11",
            "2026-12",
            "2027-01",
        ])
    })

    it("같은 달이면 한 개다", () => {
        expect(monthRange("2026-06", "2026-06")).toEqual(["2026-06"])
    })

    it("to 가 from 보다 앞이면 빈 배열이다", () => {
        expect(monthRange("2026-06", "2026-03")).toEqual([])
    })
})
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter @daeoebi/web test -- asset-dates`
Expected: FAIL — `monthsBetween is not a function` (또는 TS 컴파일 에러: 모듈에 해당 export 없음)

- [ ] **Step 3: 구현**

`asset-dates.ts`의 `addMonth` 바로 아래에 추가한다.

```ts
// "YYYY-MM" 사이의 개월 차. to 가 from 보다 앞이면 음수다.
export function monthsBetween(from: string, to: string): number {
    const [y1, m1] = from.split("-").map(Number)
    const [y2, m2] = to.split("-").map(Number)
    return (y2 - y1) * 12 + (m2 - m1)
}

// from~to(양끝 포함) 월 목록. to 가 from 보다 앞이면 빈 배열이다.
export function monthRange(from: string, to: string): string[] {
    const span = monthsBetween(from, to)
    if (span < 0) return []
    return Array.from({ length: span + 1 }, (_, i) => addMonth(from, i))
}
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm --filter @daeoebi/web test -- asset-dates`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add "apps/web/app/(vault)/asset/_lib/asset-dates.ts" "apps/web/app/(vault)/asset/_lib/asset-dates.spec.ts"
git commit -m "feat: 월 차이·월 목록 헬퍼 추가"
```

---

### Task 2: 종료월 ↔ 개월 수 환산과 옵션 목록

폼이 다루는 종료월을 저장 형식인 개월 수로 바꾸는 함수와, 드롭다운에 올릴 월 목록을 만드는 함수다.

**Files:**
- Modify: `apps/web/app/(vault)/asset/_lib/asset-recurring.ts`
- Test: `apps/web/app/(vault)/asset/_lib/asset-recurring.spec.ts`

**Interfaces:**
- Consumes: Task 1의 `monthsBetween`, `monthRange` / 기존 `addMonth`, `endMonthOf`
- Produces: `termMonthsFromEnd(startMonth: string, endMonth: string | null): number | null`, `endMonthOptions(startMonth: string, nowMonth: string, currentEnd: string | null): string[]`, `END_MONTH_LOOKAHEAD: number`

- [ ] **Step 1: 실패하는 테스트 작성**

`asset-recurring.spec.ts`의 import 목록에 `termMonthsFromEnd`, `endMonthOptions`를 추가하고, 기존 `describe("formatExpiry", ...)` 블록 아래에 붙인다.

```ts
describe("termMonthsFromEnd", () => {
    it("무기한(null)은 null 이다", () => {
        expect(termMonthsFromEnd("2026-06", null)).toBeNull()
    })

    it("시작월과 같은 달이면 1개월이다", () => {
        expect(termMonthsFromEnd("2026-06", "2026-06")).toBe(1)
    })

    it("해를 넘겨도 개월 수를 센다", () => {
        expect(termMonthsFromEnd("2026-11", "2027-02")).toBe(4)
    })

    it("endMonthOf 의 역함수다", () => {
        const term = termMonthsFromEnd("2026-06", "2027-03")
        expect(endMonthOf("2026-06", term)).toBe("2027-03")
    })

    it("종료월이 시작월보다 앞서면 1개월로 클램프한다", () => {
        expect(termMonthsFromEnd("2026-06", "2026-03")).toBe(1)
    })
})

describe("endMonthOptions", () => {
    it("시작월부터 현재 달 + 24개월까지 만든다", () => {
        const out = endMonthOptions("2026-01", "2026-07", null)
        expect(out[0]).toBe("2026-01")
        expect(out[out.length - 1]).toBe("2028-07")
    })

    it("시작월이 현재 달보다 미래면 시작월 기준으로 24개월을 확보한다", () => {
        const out = endMonthOptions("2027-03", "2026-07", null)
        expect(out[0]).toBe("2027-03")
        expect(out[out.length - 1]).toBe("2029-03")
    })

    // 목록에 없는 값이 select 에 선택돼 있으면 손대지 않아도 첫 옵션으로 튄다.
    it("기존 종료월이 상한보다 뒤면 그 달까지 늘린다", () => {
        const out = endMonthOptions("2026-01", "2026-07", "2030-05")
        expect(out[out.length - 1]).toBe("2030-05")
    })
})
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter @daeoebi/web test -- asset-recurring`
Expected: FAIL — `termMonthsFromEnd is not a function`

- [ ] **Step 3: 구현**

`asset-recurring.ts`의 import에서 `addMonth, clampedDate, monthLabel`을 `addMonth, clampedDate, monthLabel, monthRange`로 바꾸고, `endMonthOf` 바로 아래에 추가한다.

```ts
// 종료월(포함) → termMonths. endMonthOf 의 역방향이다.
// 종료월이 시작월보다 앞서면 1개월로 클램프한다 — 0·음수는 저장되면 무기한과 구분이 안 된다.
export function termMonthsFromEnd(
    startMonth: string,
    endMonth: string | null,
): number | null {
    if (endMonth === null) return null
    return Math.max(1, monthsBetween(startMonth, endMonth) + 1)
}

// 종료월 드롭다운에 올릴 월 목록의 상한 여유(개월).
export const END_MONTH_LOOKAHEAD = 24

// 종료월 후보. 하한은 시작월이라 시작월보다 앞선 종료월은 고를 수 없다.
// currentEnd 가 상한보다 뒤면 거기까지 늘린다 — 선택된 값이 목록에 없으면
// 사용자가 손대지 않아도 select 가 첫 옵션으로 튀어 종료월이 조용히 바뀐다.
export function endMonthOptions(
    startMonth: string,
    nowMonth: string,
    currentEnd: string | null,
): string[] {
    const base = startMonth > nowMonth ? startMonth : nowMonth
    const horizon = addMonth(base, END_MONTH_LOOKAHEAD)
    const last = currentEnd !== null && currentEnd > horizon ? currentEnd : horizon
    return monthRange(startMonth, last)
}
```

`monthsBetween`도 import에 추가해야 한다. `asset-dates` import 줄이 다음과 같이 된다.

```ts
import {
    addMonth,
    clampedDate,
    monthLabel,
    monthRange,
    monthsBetween,
} from "./asset-dates"
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm --filter @daeoebi/web test -- asset-recurring`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add "apps/web/app/(vault)/asset/_lib/asset-recurring.ts" "apps/web/app/(vault)/asset/_lib/asset-recurring.spec.ts"
git commit -m "feat: 종료월 환산·후보 목록 함수 추가"
```

---

### Task 3: 종료월 이후 인스턴스 삭제 범위 확장

지금은 삭제 대상 조회가 `pivot`(편집한 달과 현재 달 중 나중 것) 이후로 묶여 있어, 8월에 종료월을 7월로 지정해도 이미 만들어진 8월 인스턴스가 남는다. 조회 기준을 `pivot`과 종료월 중 **앞선 쪽**으로 낮춘다.

갱신 동작은 바뀌지 않는다. 종료월이 `pivot` 이후면 조회 기준이 `pivot` 그대로이고, 종료월이 `pivot`보다 앞서면 조회된 인스턴스가 전부 종료월 이후라 모두 삭제 분기로 간다.

**Files:**
- Modify: `apps/web/app/(vault)/asset/_lib/asset-recurring.ts:192-217` (`propagateRecurringUpdate`)
- Test: `apps/web/app/(vault)/asset/_lib/asset-recurring.spec.ts` (`describe("propagateRecurringUpdate", ...)`)

**Interfaces:**
- Consumes: 기존 `propagationPivot`, `endMonthOf`, `listRecurringInstances`
- Produces: 시그니처 변경 없음. `propagateRecurringUpdate(vaultKey, template, editedMonth, payload, nowMonth): Promise<void>`

- [ ] **Step 1: 실패하는 테스트 작성**

`describe("propagateRecurringUpdate", ...)` 블록 안, 기존 `it("개월 수를 줄이면 종료월 이후 인스턴스를 삭제한다", ...)` 아래에 추가한다.

```ts
    // 8월에 "7월까지"로 끊는 경로. 8월 인스턴스는 이미 만들어져 있지만 나가지 않은 돈이다.
    it("종료월이 현재 달보다 앞서면 현재 달 인스턴스도 삭제한다", async () => {
        mockListRecurringInstances.mockResolvedValue([
            { id: "e8", period: "2026-08" },
            { id: "e9", period: "2026-09" },
        ])

        await propagateRecurringUpdate(
            key,
            { ...ref, startMonth: "2026-06", termMonths: 2 }, // 6·7월까지
            "2026-08",
            { item: "헬스장", amount: 50_000 },
            "2026-08", // 오늘이 8월
        )

        expect(mockListRecurringInstances).toHaveBeenCalledWith("r1", "2026-07")
        expect(mockDeleteExpense).toHaveBeenCalledTimes(2)
        expect(mockDeleteExpense).toHaveBeenCalledWith("e8")
        expect(mockDeleteExpense).toHaveBeenCalledWith("e9")
        expect(mockUpdateExpense).not.toHaveBeenCalled()
    })

    // 몇 달 밀린 뒤 정리하는 경로: 11월에 들어와 7월까지로 끊는다.
    it("밀린 달을 한꺼번에 정리한다", async () => {
        mockListRecurringInstances.mockResolvedValue([
            { id: "e8", period: "2026-08" },
            { id: "e9", period: "2026-09" },
            { id: "e10", period: "2026-10" },
            { id: "e11", period: "2026-11" },
        ])

        await propagateRecurringUpdate(
            key,
            { ...ref, startMonth: "2026-06", termMonths: 2 }, // 6·7월까지
            "2026-11",
            { item: "헬스장", amount: 50_000 },
            "2026-11",
        )

        expect(mockListRecurringInstances).toHaveBeenCalledWith("r1", "2026-07")
        expect(mockDeleteExpense).toHaveBeenCalledTimes(4)
    })
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter @daeoebi/web test -- asset-recurring`
Expected: FAIL — `listRecurringInstances`가 `"2026-08"`(그리고 `"2026-11"`)로 호출돼 기대값 `"2026-07"`과 어긋난다

- [ ] **Step 3: 구현**

`propagateRecurringUpdate` 앞부분 세 줄을 바꾼다. 기존:

```ts
    const pivot = propagationPivot(editedMonth, nowMonth)
    const endMonth = endMonthOf(template.startMonth, template.termMonths)
    const future = await listRecurringInstances(template.id, pivot)
```

새 코드:

```ts
    const pivot = propagationPivot(editedMonth, nowMonth)
    const endMonth = endMonthOf(template.startMonth, template.termMonths)
    // 갱신은 pivot 이후만(앞으로만 반영), 삭제는 종료월 이후 전부다. 종료월을 앞당기면
    // 현재 달 인스턴스도 지워야 하므로 둘 중 앞선 달을 조회 기준으로 삼는다.
    const from = endMonth !== null && endMonth < pivot ? endMonth : pivot
    const future = await listRecurringInstances(template.id, from)
```

함수 위 주석의 마지막 문단도 실제 동작에 맞춰 고친다.

```ts
// 개월 수를 줄여 기간이 끝난 뒤로 밀려난 인스턴스는 갱신이 아니라 삭제한다(되살리면 안 된다).
// 이 삭제는 현재 달도 포함한다 — 종료월을 지난 달로 잡았으면 이번 달 건은 나가지 않은 돈이다.
```

루프 본문은 그대로 둔다.

- [ ] **Step 4: 통과 확인**

Run: `pnpm --filter @daeoebi/web test -- asset-recurring`
Expected: PASS (기존 5개 케이스 포함 전부)

- [ ] **Step 5: 커밋**

```bash
git add "apps/web/app/(vault)/asset/_lib/asset-recurring.ts" "apps/web/app/(vault)/asset/_lib/asset-recurring.spec.ts"
git commit -m "fix: 종료월 이후 인스턴스를 현재 달까지 포함해 삭제"
```

---

### Task 4: `GET /recurring/:id`

고정 해제된 템플릿의 `startMonth`를 읽기 위한 단건 조회다. `listActive()`가 `active: true`만 주기 때문에 필요하다.

**Files:**
- Modify: `apps/api/src/asset/recurring.service.ts`
- Modify: `apps/api/src/asset/recurring.controller.ts`
- Test: `apps/api/src/asset/recurring.service.spec.ts`

**Interfaces:**
- Consumes: 기존 `toView(row)`, `this.notFound()`
- Produces: `RecurringService.detail(id: string)` → `toView` 결과. `GET /recurring/:id`

- [ ] **Step 1: 실패하는 테스트 작성**

`recurring.service.spec.ts`의 `describe("RecurringService", ...)` 안, `listActive` 테스트 아래에 추가한다.

```ts
    // 고정 해제된 템플릿의 startMonth 를 폼이 읽어야 하므로 active 로 거르지 않는다.
    it("detail 은 비활성 템플릿도 반환한다", async () => {
        const prisma = makePrisma()
        prisma.recurringExpense.findUnique.mockResolvedValue({
            ...row,
            active: false,
        })
        const out = await makeService(prisma).detail("r1")
        expect(prisma.recurringExpense.findUnique).toHaveBeenCalledWith({
            where: { id: "r1" },
        })
        expect(out).toMatchObject({ id: "r1", active: false })
    })

    it("detail 은 없으면 RECURRING_NOT_FOUND", async () => {
        const prisma = makePrisma()
        prisma.recurringExpense.findUnique.mockResolvedValue(null)
        await expect(makeService(prisma).detail("nope")).rejects.toThrow(
            NotFoundException,
        )
    })
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter @daeoebi/api test:unit -- recurring.service`
Expected: FAIL — `service.detail is not a function`

- [ ] **Step 3: 구현**

`recurring.service.ts`의 `listActive()` 아래에 추가한다.

```ts
    // 단건 조회. active 여부와 무관하다 — 고정 해제된 템플릿의 startMonth 를 폼이 읽어야
    // 종료월을 개월 수로 환산할 수 있다(시작월은 템플릿에만 있다).
    async detail(id: string) {
        const row = await this.prisma.recurringExpense.findUnique({
            where: { id },
        })
        if (!row) throw this.notFound()
        return toView(row)
    }
```

`recurring.controller.ts`의 `list()` 아래에 추가한다.

```ts
    @Get(":id")
    detail(@Param("id") id: string) {
        return this.service.detail(id)
    }
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm --filter @daeoebi/api test:unit -- recurring.service`
Expected: PASS

Run: `pnpm --filter @daeoebi/api typecheck`
Expected: 에러 없음

- [ ] **Step 5: 커밋**

```bash
git add apps/api/src/asset/recurring.service.ts apps/api/src/asset/recurring.controller.ts apps/api/src/asset/recurring.service.spec.ts
git commit -m "feat: 고정 지출 템플릿 단건 조회 API 추가"
```

---

### Task 5: 연결된 템플릿을 활성 여부와 무관하게 싣기

`ExpenseFormInitial.template`의 의미를 "활성 템플릿"에서 "연결된 템플릿"으로 바꾼다. 활성 여부는 `active` 필드로 판단한다.

이 작업 전에는 고정 해제된 지출에서 `template`이 `null`이라 옛 템플릿의 시작월을 알 수 없었고, 종료월을 개월 수로 환산할 수 없었다.

**Files:**
- Modify: `apps/web/lib/vault-client.ts` (`listRecurring` 아래)
- Modify: `apps/web/app/(vault)/asset/[id]/page.tsx:41-77`
- Modify: `apps/web/app/(vault)/asset/_components/ExpenseForm.tsx` (`ExpenseFormInitial`, `wasRecurring`, 분기 세 곳)

**Interfaces:**
- Consumes: Task 4의 `GET /recurring/:id`
- Produces: `getRecurring(id: string): Promise<RecurringView>` / `ExpenseFormInitial.template`에 `active: boolean` 추가

- [ ] **Step 1: `getRecurring` 추가**

`apps/web/lib/vault-client.ts`의 `listRecurring` 바로 아래에 넣는다.

```ts
// 단건 조회. listRecurring() 과 달리 고정 해제된(active=false) 템플릿도 반환한다.
export async function getRecurring(id: string): Promise<RecurringView> {
    const { data } = await vaultClient.get<RecurringView>(`/recurring/${id}`)
    return data
}
```

- [ ] **Step 2: 상세 페이지가 비활성 템플릿도 싣게 한다**

`apps/web/app/(vault)/asset/[id]/page.tsx`의 vault-client import에 `getRecurring`을 추가한 뒤, `.then(...)` 본문 앞부분을 바꾼다. 기존:

```ts
            .then(async ([view, categories, templates, accounts]) => {
                const payload = await openExpense(vaultKey, view)
                if (cancelled) return
                // 연결된 활성 템플릿(개월 수 표시·앞으로만 반영에 필요). 해제됐으면 목록에 없다.
                const linked =
                    templates.find((t) => t.id === view.recurringId) ?? null
```

새 코드:

```ts
            .then(async ([view, categories, templates, accounts]) => {
                const payload = await openExpense(vaultKey, view)
                // 연결된 템플릿. 고정 해제된 템플릿은 listRecurring() 에 없어 단건으로 더 읽는다 —
                // 종료월 ↔ 개월 수 환산에 startMonth 가 필요한데 그 값은 템플릿에만 있다.
                const linked =
                    view.recurringId === null
                        ? null
                        : (templates.find((t) => t.id === view.recurringId) ??
                          (await getRecurring(view.recurringId)))
                if (cancelled) return
```

`template:` 객체에 `active`를 더한다.

```ts
                        template:
                            linked === null
                                ? null
                                : {
                                      id: linked.id,
                                      startMonth: linked.startMonth,
                                      termMonths: linked.termMonths,
                                      active: linked.active,
                                  },
```

- [ ] **Step 3: 폼의 활성 판정을 `active` 로 옮긴다**

`ExpenseForm.tsx`의 `ExpenseFormInitial`:

```ts
    // 이 지출에 연결된 템플릿. 고정 해제된 템플릿도 담기므로 활성 여부는 active 로 판단한다.
    template: {
        id: string
        startMonth: string
        termMonths: number | null
        active: boolean
    } | null
```

`wasRecurring`:

```ts
    // 이 지출이 현재 고정(활성 템플릿 연결)인지. 해제된 템플릿도 template 에 담기므로 active 를 본다.
    const template = initial?.template ?? null
    const wasRecurring = template?.active === true
```

`handleSave` 안의 고정 해제·고정 수정 분기(현재 `if (template !== null && !recurring)` / `else if (template !== null)`)를 바꾼다. 해제된 템플릿이 붙은 단건 지출을 그냥 수정할 때 해제 분기를 다시 타면 안 된다.

```ts
                    if (wasRecurring && template !== null && !recurring) {
```

```ts
                    } else if (wasRecurring && template !== null) {
```

삭제 메뉴 분기(현재 `template !== null ? () => setDeleteMenu(true) : handleDeleteThisMonth`)도 바꾼다.

```ts
                                wasRecurring
                                    ? () => setDeleteMenu(true)
                                    : handleDeleteThisMonth
```

- [ ] **Step 4: 타입 검사**

Run: `pnpm --filter @daeoebi/web typecheck`
Expected: 에러 없음

Run: `pnpm --filter @daeoebi/web test -- ExpenseForm`
Expected: PASS (기존 케이스 유지)

- [ ] **Step 5: 커밋**

```bash
git add apps/web/lib/vault-client.ts "apps/web/app/(vault)/asset/[id]/page.tsx" "apps/web/app/(vault)/asset/_components/ExpenseForm.tsx"
git commit -m "refactor: 연결된 템플릿을 활성 여부와 무관하게 폼에 싣기"
```

---

### Task 6: 개월 수 입력을 종료월 select 로 교체

**Files:**
- Modify: `apps/web/app/(vault)/asset/_components/ExpenseForm.tsx`
- Test: `apps/web/app/(vault)/asset/_components/ExpenseForm.spec.tsx`

**Interfaces:**
- Consumes: Task 2의 `termMonthsFromEnd`, `endMonthOptions` / 기존 `endMonthOf`, `monthLabel`, `monthOf`, `currentMonth`
- Produces: `종료월` 이름의 select. 저장 시 기존과 같은 `termMonths: number | null`을 API로 보낸다.

- [ ] **Step 1: 실패하는 테스트 작성**

`ExpenseForm.spec.tsx`의 vault-client 모킹에 `updateRecurring`·`updateExpense`를 실제 mock 함수로 바꾸고, `listRecurringInstances`를 더한다.

```ts
const mockCreateExpense = jest.fn()
const mockCreateRecurring = jest.fn()
const mockUpdateRecurring = jest.fn()
const mockUpdateExpense = jest.fn()
const mockListRecurringInstances = jest.fn()
jest.mock("@/lib/vault-client", () => ({
    __esModule: true,
    createExpense: (...a: unknown[]) => mockCreateExpense(...a),
    createRecurring: (...a: unknown[]) => mockCreateRecurring(...a),
    deleteExpense: jest.fn(),
    deleteRecurring: jest.fn(),
    updateExpense: (...a: unknown[]) => mockUpdateExpense(...a),
    updateRecurring: (...a: unknown[]) => mockUpdateRecurring(...a),
    listRecurringInstances: (...a: unknown[]) =>
        mockListRecurringInstances(...a),
}))
```

`asset-recurring`의 전파 함수도 막는다(이 테스트는 폼이 무엇을 보내는지만 본다). import 블록 아래에 추가한다.

```ts
jest.mock("../_lib/asset-recurring", () => ({
    __esModule: true,
    ...jest.requireActual("../_lib/asset-recurring"),
    propagateRecurringUpdate: jest.fn().mockResolvedValue(undefined),
    removeRecurringFuture: jest.fn().mockResolvedValue(undefined),
}))
```

수정 모드 렌더 헬퍼와 테스트를 파일 끝에 붙인다.

```ts
function renderEdit(termMonths: number | null) {
    render(
        <ExpenseForm
            categories={categories}
            savingsAccounts={[]}
            initial={{
                id: "e1",
                date: "2026-07-10",
                recurringId: "r1",
                period: "2026-07",
                template: {
                    id: "r1",
                    startMonth: "2026-01",
                    termMonths,
                    active: true,
                },
                payload: { item: "월세", amount: 500_000 },
                categoryId: "c-food",
            }}
            onSaved={jest.fn()}
            onCancel={jest.fn()}
            onDeleted={jest.fn()}
        />,
    )
}

describe("종료월 선택", () => {
    beforeEach(() => {
        mockUpdateRecurring.mockReset()
        mockUpdateExpense.mockReset()
        mockListRecurringInstances.mockReset()
        mockUpdateRecurring.mockResolvedValue({ id: "r1" })
        mockUpdateExpense.mockResolvedValue({ id: "e1" })
        mockListRecurringInstances.mockResolvedValue([])
    })

    // startMonth 2026-01 + 7개월 = 2026-07 이 선택돼 보여야 한다.
    it("템플릿의 종료월이 선택된 상태로 보인다", () => {
        renderEdit(7)
        expect(screen.getByLabelText("종료월")).toHaveValue("2026-07")
    })

    it("무기한이면 아무것도 선택되지 않는다", () => {
        renderEdit(null)
        expect(screen.getByLabelText("종료월")).toHaveValue("")
    })

    it("종료월을 고르면 개월 수로 환산해 저장한다", async () => {
        renderEdit(null)
        fireEvent.change(screen.getByLabelText("종료월"), {
            target: { value: "2026-07" },
        })
        fireEvent.click(screen.getByRole("button", { name: "저장" }))

        await waitFor(() => {
            expect(mockUpdateRecurring).toHaveBeenCalledWith(
                "r1",
                expect.objectContaining({ termMonths: 7 }),
            )
        })
    })

    it("무기한으로 되돌리면 termMonths 가 null 로 나간다", async () => {
        renderEdit(7)
        fireEvent.change(screen.getByLabelText("종료월"), {
            target: { value: "" },
        })
        fireEvent.click(screen.getByRole("button", { name: "저장" }))

        await waitFor(() => {
            expect(mockUpdateRecurring).toHaveBeenCalledWith(
                "r1",
                expect.objectContaining({ termMonths: null }),
            )
        })
    })
})
```

저장 버튼의 접근성 이름이 `"저장"`이 아니면 실제 이름으로 맞춘다(`screen.getByRole("button", { name: /저장/ })`).

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter @daeoebi/web test -- ExpenseForm`
Expected: FAIL — `Unable to find a label with the text of: 종료월`

- [ ] **Step 3: 구현**

import를 고친다.

```ts
import {
    endMonthOf,
    endMonthOptions,
    propagateRecurringUpdate,
    removeRecurringFuture,
    termMonthsFromEnd,
} from "../_lib/asset-recurring"
import { currentMonth, monthLabel, monthOf, todayISO } from "../_lib/asset-dates"
```

상태를 바꾼다. 기존 `const [termMonths, setTermMonths] = useState(...)`를 지우고:

```ts
    const [endMonth, setEndMonth] = useState<string | null>(
        template === null
            ? null
            : endMonthOf(template.startMonth, template.termMonths),
    )
```

`amountNum` 계산 근처(파생값들이 모인 곳)에 추가한다.

```ts
    // 종료월 환산·목록의 기준. 기존 템플릿의 시작월은 서버가 바꾸지 않아 고정이고,
    // 신규·단건은 이 지출의 달이 곧 시작월이라 날짜를 바꾸면 따라 움직인다.
    const startMonth = template?.startMonth ?? monthOf(date)
    const endMonthChoices = endMonthOptions(startMonth, currentMonth(), endMonth)
```

날짜 변경으로 종료월이 시작월보다 앞서게 되는 경우를 처리한다. 기존 `useEffect` 아래에 추가한다.

```ts
    // 신규 폼에서 날짜를 앞당기면 시작월이 따라 움직인다. 고른 종료월이 시작월보다 앞서면
    // 그대로 저장할 수 없으므로 무기한으로 되돌리고 알린다(어긋난 값을 조용히 남기지 않는다).
    useEffect(() => {
        if (endMonth !== null && endMonth < startMonth) {
            setEndMonth(null)
            toast("시작월이 바뀌어 종료월을 무기한으로 되돌렸습니다.")
        }
    }, [endMonth, startMonth])
```

`handleSave` 안의 `const term = parseTermMonths(termMonths)`를 바꾼다.

```ts
            const term = termMonthsFromEnd(startMonth, endMonth)
```

JSX의 `{/* 개월 수(고정 ON 이면 표시, 선택) */}` 블록 전체를 아래로 교체한다.

```tsx
                {/* 종료월(고정 ON 이면 표시, 선택) */}
                {recurring && (
                    <div
                        className="form-row"
                        style={{ margin: 0, marginTop: -12, gap: 0 }}
                    >
                        <label
                            htmlFor="end-month"
                            style={{ color: "#a0a0a0", marginBottom: 7 }}
                        >
                            종료월{" "}
                            <span
                                style={{
                                    color: "#cbcbcb",
                                    fontWeight: 600,
                                }}
                            >
                                · 선택
                            </span>
                        </label>
                        <select
                            id="end-month"
                            className="field-control"
                            style={{
                                fontSize: 15,
                                fontWeight: 600,
                                color: "#333",
                            }}
                            value={endMonth ?? ""}
                            onChange={(e) => {
                                resetIdle()
                                setEndMonth(
                                    e.target.value === "" ? null : e.target.value,
                                )
                            }}
                            aria-label="종료월"
                        >
                            <option value="">설정 안 함(무기한)</option>
                            {endMonthChoices.map((m) => (
                                <option key={m} value={m}>
                                    {monthLabel(m)}
                                </option>
                            ))}
                        </select>
                        <div
                            style={{
                                fontSize: 12,
                                color: "#9a9a9a",
                                marginTop: 7,
                            }}
                        >
                            {endMonth === null
                                ? "종료월을 정하지 않으면 무기한 반복됩니다."
                                : `${monthLabel(endMonth)}까지만 나가고 끝나요.`}
                        </div>
                    </div>
                )}
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm --filter @daeoebi/web test -- ExpenseForm`
Expected: PASS

Run: `pnpm --filter @daeoebi/web typecheck`
Expected: 에러 없음

- [ ] **Step 5: 커밋**

```bash
git add "apps/web/app/(vault)/asset/_components/ExpenseForm.tsx" "apps/web/app/(vault)/asset/_components/ExpenseForm.spec.tsx"
git commit -m "feat: 고정 지출 개월 수 입력을 종료월 선택으로 교체"
```

---

### Task 7: 삭제 확인 다이얼로그

종료월을 앞당기면 그 뒤 인스턴스가 지워진다. 몇 건인지 먼저 세어 확인을 받는다.

**Files:**
- Modify: `apps/web/app/(vault)/asset/_components/ExpenseForm.tsx`
- Test: `apps/web/app/(vault)/asset/_components/ExpenseForm.spec.tsx`

**Interfaces:**
- Consumes: `ConfirmDialog`(`apps/web/components/ConfirmDialog.tsx`, props: `open`·`title`·`message`·`confirmLabel`·`destructive`·`confirmLoading`·`onConfirm`·`onCancel`) / `listRecurringInstances(recurringId, fromPeriod)` / Task 1의 `addMonth`
- Produces: 없음 (폼 내부 동작)

- [ ] **Step 1: 실패하는 테스트 작성**

Task 6에서 만든 `describe("종료월 선택", ...)` 안에 추가한다.

```ts
    it("종료월 이후 지출이 있으면 확인을 받고, 취소하면 아무것도 저장하지 않는다", async () => {
        mockListRecurringInstances.mockResolvedValue([
            { id: "e8", period: "2026-08" },
            { id: "e9", period: "2026-09" },
        ])
        renderEdit(null)
        fireEvent.change(screen.getByLabelText("종료월"), {
            target: { value: "2026-07" },
        })
        fireEvent.click(screen.getByRole("button", { name: "저장" }))

        expect(
            await screen.findByText(/2026년 8월부터의 지출 2건이 삭제됩니다/),
        ).toBeInTheDocument()
        expect(mockUpdateRecurring).not.toHaveBeenCalled()

        fireEvent.click(screen.getByRole("button", { name: "취소" }))

        await waitFor(() => {
            expect(
                screen.queryByText(/2건이 삭제됩니다/),
            ).not.toBeInTheDocument()
        })
        expect(mockUpdateRecurring).not.toHaveBeenCalled()
        expect(mockUpdateExpense).not.toHaveBeenCalled()
    })

    it("확인하면 저장이 진행된다", async () => {
        mockListRecurringInstances.mockResolvedValue([
            { id: "e8", period: "2026-08" },
        ])
        renderEdit(null)
        fireEvent.change(screen.getByLabelText("종료월"), {
            target: { value: "2026-07" },
        })
        fireEvent.click(screen.getByRole("button", { name: "저장" }))
        fireEvent.click(await screen.findByRole("button", { name: "계속" }))

        await waitFor(() => {
            expect(mockUpdateRecurring).toHaveBeenCalledWith(
                "r1",
                expect.objectContaining({ termMonths: 7 }),
            )
        })
    })

    it("삭제될 지출이 없으면 확인 없이 저장한다", async () => {
        mockListRecurringInstances.mockResolvedValue([])
        renderEdit(null)
        fireEvent.change(screen.getByLabelText("종료월"), {
            target: { value: "2026-07" },
        })
        fireEvent.click(screen.getByRole("button", { name: "저장" }))

        await waitFor(() => {
            expect(mockUpdateRecurring).toHaveBeenCalled()
        })
        expect(screen.queryByText(/삭제됩니다/)).not.toBeInTheDocument()
    })
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter @daeoebi/web test -- ExpenseForm`
Expected: FAIL — 확인 문구를 찾지 못하고 `updateRecurring`이 곧바로 호출된다

- [ ] **Step 3: 구현**

import를 더한다.

```ts
import { ConfirmDialog } from "@/components/ConfirmDialog"
```

`listRecurringInstances`를 vault-client import에 추가하고, `addMonth`를 asset-dates import에 추가한다.

```ts
import {
    addMonth,
    currentMonth,
    monthLabel,
    monthOf,
    todayISO,
} from "../_lib/asset-dates"
```

상태를 더한다.

```ts
    // 종료월 앞당김으로 지워질 인스턴스 수. null 이면 확인 다이얼로그를 닫아둔다.
    const [doomedCount, setDoomedCount] = useState<number | null>(null)
```

`handleSave`를 둘로 나눈다. 검증 구간(`if (amountNum <= 0)` ~ 달 이동 차단)은 `handleSave`에 남기고, `setBusy(true)`부터 `finally` 블록까지 전체를 `performSave`로 옮긴다.

```ts
    // 검증 → (필요하면) 삭제 확인 → 저장. 확인이 필요하면 여기서 멈추고 다이얼로그에 넘긴다.
    async function handleSave() {
        // ... 기존 검증 구간을 그대로 둔다 ...

        // 종료월을 앞당기면 그 뒤 인스턴스가 지워진다. 실제로 지워질 게 있을 때만 확인을 받는다.
        // 이 조회는 period > endMonth · removed=false 라 삭제 대상과 정확히 같다.
        if (template !== null && endMonth !== null) {
            setBusy(true)
            try {
                const doomed = await listRecurringInstances(
                    template.id,
                    endMonth,
                )
                if (doomed.length > 0) {
                    setDoomedCount(doomed.length)
                    return
                }
            } catch (e) {
                toast(
                    isApiError(e)
                        ? e.message
                        : "삭제될 지출을 확인하지 못했습니다.",
                )
                return
            } finally {
                setBusy(false)
            }
        }
        await performSave()
    }

    async function performSave() {
        setBusy(true)
        try {
            // ... 기존 저장 본문 그대로 ...
        } finally {
            setBusy(false)
        }
    }
```

`performSave` 본문에서 쓰던 `amountNum`·`categoryId`·`date` 등은 전부 컴포넌트 스코프 값이라 그대로 동작한다. 단 `categoryId === null` 검사는 `handleSave`에 남아 있으므로, `performSave` 안에서 `categoryId`를 `string`으로 좁혀 쓰던 부분이 타입 에러가 나면 본문 첫 줄에 다음을 넣는다.

```ts
        if (categoryId === null) return
```

JSX 끝, `{deleteMenu && (...)}` 블록 아래에 다이얼로그를 넣는다.

```tsx
            {doomedCount !== null && endMonth !== null && (
                <ConfirmDialog
                    open
                    title="기록 삭제"
                    message={`${monthLabel(addMonth(endMonth, 1))}부터의 지출 ${doomedCount}건이 삭제됩니다. 계속할까요?`}
                    confirmLabel="계속"
                    destructive
                    confirmLoading={busy}
                    onConfirm={() => {
                        setDoomedCount(null)
                        void performSave()
                    }}
                    onCancel={() => setDoomedCount(null)}
                />
            )}
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm --filter @daeoebi/web test -- ExpenseForm`
Expected: PASS

Run: `pnpm --filter @daeoebi/web typecheck`
Expected: 에러 없음

- [ ] **Step 5: 커밋**

```bash
git add "apps/web/app/(vault)/asset/_components/ExpenseForm.tsx" "apps/web/app/(vault)/asset/_components/ExpenseForm.spec.tsx"
git commit -m "feat: 종료월 앞당김 시 삭제될 지출을 확인받기"
```

---

### Task 8: 표시 라벨 정리와 죽은 함수 제거

고정 지출 탭 라벨에서 개월 수 꼬리를 뺀다. 종료월을 직접 고르게 된 이상 개월 수는 파생 정보이고, 한 줄에 기간 표현이 둘 있으면 읽는 데 방해가 된다.

`parseTermMonths`와 `formatTerm`은 Task 6·8 이후 호출부가 없어진다.

**Files:**
- Modify: `apps/web/app/(vault)/asset/_lib/asset-recurring.ts` (`formatTerm`, `formatExpiry`, `parseTermMonths`)
- Test: `apps/web/app/(vault)/asset/_lib/asset-recurring.spec.ts`
- Test: `apps/web/app/(vault)/asset/_components/dashboard/RecurringTab.spec.tsx`

**Interfaces:**
- Consumes: 기존 `endMonthOf`, `monthLabel`
- Produces: `formatExpiry(startMonth: string, termMonths: number | null): string` — `"2025년 7월까지"` 또는 `"무기한"`

- [ ] **Step 1: 테스트를 새 기대값으로 고친다**

`asset-recurring.spec.ts`에서 `describe("formatTerm", ...)` 블록 전체와 `describe("parseTermMonths", ...)` 블록 전체를 삭제하고, import 목록에서 `formatTerm`·`parseTermMonths`를 뺀다.

`describe("formatExpiry", ...)` 블록의 기대값을 고친다.

```ts
describe("formatExpiry", () => {
    it("기간이 있으면 종료월까지로 표기한다", () => {
        expect(formatExpiry("2026-09", 3)).toBe("2026년 11월까지")
        expect(formatExpiry("2026-06", 1)).toBe("2026년 6월까지")
    })

    it("해를 넘겨도 종료월을 맞게 계산한다", () => {
        expect(formatExpiry("2026-11", 4)).toBe("2027년 2월까지")
    })

    it("무기한이면 '무기한' 이다", () => {
        expect(formatExpiry("2026-06", null)).toBe("무기한")
    })
})
```

`RecurringTab.spec.tsx`에서 `· N개월`을 기대하는 단언이 있으면 `· 종료월까지` 형태로 고친다. 먼저 확인한다.

Run: `rg "개월" "apps/web/app/(vault)/asset/_components/dashboard/RecurringTab.spec.tsx"`

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter @daeoebi/web test -- asset-recurring RecurringTab`
Expected: FAIL — `formatExpiry`가 `"2026년 11월까지 · 3개월"`을 돌려줘 기대값과 어긋난다

- [ ] **Step 3: 구현**

`asset-recurring.ts`에서 `parseTermMonths`와 `formatTerm`을 삭제하고 `formatExpiry`를 고친다.

```ts
// 만료 표기. 기간이 있으면 "종료월까지", 무기한이면 "무기한".
export function formatExpiry(
    startMonth: string,
    termMonths: number | null,
): string {
    const end = endMonthOf(startMonth, termMonths)
    return end === null ? "무기한" : `${monthLabel(end)}까지`
}
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm --filter @daeoebi/web test`
Expected: PASS (전체)

Run: `pnpm --filter @daeoebi/web typecheck`
Expected: 에러 없음 — 남은 `parseTermMonths`/`formatTerm` 참조가 있으면 여기서 잡힌다

- [ ] **Step 5: 커밋**

```bash
git add "apps/web/app/(vault)/asset/_lib/asset-recurring.ts" "apps/web/app/(vault)/asset/_lib/asset-recurring.spec.ts" "apps/web/app/(vault)/asset/_components/dashboard/RecurringTab.spec.tsx"
git commit -m "refactor: 고정 지출 만료 표기를 종료월만으로 정리"
```

---

### Task 9: E2E 갱신

`tests/e2e/recurring.spec.ts`가 `getByLabel("개월 수")`로 값을 채우고 탭 라벨을 문자열로 검증한다. 종료월 선택으로 바꾼다.

**Files:**
- Modify: `apps/web/tests/e2e/recurring.spec.ts`

**Interfaces:**
- Consumes: Task 6의 `종료월` select (option value = `"YYYY-MM"`)
- Produces: 없음

- [ ] **Step 1: 헬퍼를 종료월 기준으로 바꾼다**

현재 상태를 먼저 읽는다.

Run: `rg -n "개월|term" apps/web/tests/e2e/recurring.spec.ts`

`makeRecurring`(약 90~110행) 헬퍼의 `term: string` 옵션을 `endMonth: string`(`"YYYY-MM"`)으로 바꾸고, 입력 부분을 교체한다. 기존:

```ts
    const termInput = page.getByLabel("개월 수")
    await expect(termInput).toBeVisible({ timeout: 10_000 })
    await termInput.fill(opts.term)
```

새 코드:

```ts
    const endMonthSelect = page.getByLabel("종료월")
    await expect(endMonthSelect).toBeVisible({ timeout: 10_000 })
    await endMonthSelect.selectOption(opts.endMonth)
```

- [ ] **Step 2: 호출부와 단언을 고친다**

`term: "6"`으로 넘기던 호출부를 시작월 기준 6개월째 달로 바꾼다. 이 테스트들은 이번 달에 지출을 만들므로 종료월은 "이번 달 + 5개월"이다. 파일 상단 상수 옆에 헬퍼를 둔다.

```ts
/** 이번 달 기준 N개월짜리 고정 지출의 종료월("YYYY-MM"). 시작월 포함이라 N-1 을 더한다. */
function endMonthFromNow(months: number): string {
    const now = new Date()
    const d = new Date(now.getFullYear(), now.getMonth() + months - 1, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}
```

`term: "6"` → `endMonth: endMonthFromNow(6)`.

"수정 화면에 템플릿의 개월 수가 채워져 보인다" 테스트의 이름과 단언을 바꾼다.

```ts
    test("수정 화면에 템플릿의 종료월이 채워져 보인다", async ({ page }) => {
```

```ts
        await expect(page.getByLabel("종료월")).toHaveValue(
            endMonthFromNow(6),
            { timeout: 10_000 },
        )
```

"개월 수를 고치면 템플릿에 저장된다" 테스트도 같은 방식으로 종료월 변경으로 바꾸고, 이름을 `"종료월을 고치면 템플릿에 저장된다"`로 고친다.

고정 지출 탭 라벨 단언을 Task 8의 표기에 맞춘다. 기존 `` `매월 ${DAY}일 · 6개월` `` → 종료월 표기로.

```ts
        const [endY, endM] = endMonthFromNow(6).split("-").map(Number)
        await expect(row).toContainText(`매월 ${DAY}일 · ${endY}년 ${endM}월까지`)
```

- [ ] **Step 3: 실행**

Run: `pnpm --filter @daeoebi/web test:e2e -- recurring`
Expected: PASS

E2E는 DB와 앱이 떠 있어야 한다. 실행 전 `make dev-up`으로 로컬 개발 스택을 올린다(운영 스택은 로컬에서 기동하지 않는다).

- [ ] **Step 4: 커밋**

```bash
git add apps/web/tests/e2e/recurring.spec.ts
git commit -m "test: 고정 지출 E2E 를 종료월 선택 기준으로 갱신"
```

---

### Task 10: 전체 검증

**Files:** 없음 (검증만)

- [ ] **Step 1: 타입 검사**

Run: `pnpm typecheck`
Expected: 에러 없음

- [ ] **Step 2: 단위 테스트 전체**

Run: `pnpm test`
Expected: PASS

- [ ] **Step 3: 손으로 확인**

`make dev-up` 후, 스펙의 검증 시나리오를 따라간다.

1. 과거 달(예: 6개월 전)에 무기한 고정 지출을 하나 만든다.
2. 이번 달로 와서 그 지출을 열고 종료월을 지난달로 고른다.
3. "…부터의 지출 N건이 삭제됩니다" 확인이 뜨는지 본다. 확인한다.
4. 이번 달 목록에서 그 지출이 사라지는지 본다.
5. 다음 달로 이동해 예정 행도 없는지 본다.
6. 지난달로 이동해 지출 기록이 남아 있고, 고정 지출 탭에도 `매월 N일 · YYYY년 M월까지`로 보이며, 지출 행의 "고정" 배지가 유지되는지 본다.

- [ ] **Step 4: develop 병합 요청**

작업 브랜치를 develop에 병합할지 사용자에게 확인받는다. main 병합은 사용자가 직접 수행한다.
