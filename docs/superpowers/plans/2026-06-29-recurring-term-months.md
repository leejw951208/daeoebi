# 고정 지출 개월 수(기간 제한) 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 고정 지출에 선택적 `termMonths`(개월 수)를 추가해 시작월부터 N개월간만 자동 생성하고 종료하게 한다(비우면 무기한).

**Architecture:** `RecurringExpense.termMonths Int?`(평문, null=무기한)를 추가하고, materialize 가 `[startMonth, addMonth(startMonth, termMonths-1)]` 범위에서만 인스턴스를 생성한다. 카드 "익월부터 N개월"은 기존 결제 시프트가 인스턴스별로 처리.

**Tech Stack:** NestJS + Prisma + PostgreSQL(api), Next.js + React(web).

## Global Constraints

- 기존 마이그레이션 수정 금지, 신규 생성. `.env.*` 읽기만. `rm` 금지(git rm). pnpm-lock 수동 편집 금지.
- termMonths: null=무기한, 1 이상 정수=그 개월 수. 월 비교는 "YYYY-MM" 사전식.
- 커밋은 각 Task 끝. 메시지 끝: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- 사용자 노출 문구 한국어, 문장 마침표 종결.

---

### Task 1: Prisma — RecurringExpense.termMonths

**Files:** Modify `apps/api/prisma/schema.prisma`; Create new migration.

- [ ] **Step 1: schema 수정** — `startMonth` 아래에 추가:
```prisma
  startMonth String
  termMonths Int? // null = 무기한. N = startMonth 부터 N개월간만 생성.
  active     Boolean   @default(true)
```
- [ ] **Step 2: 마이그레이션 생성·적용** (dev DB 기동 상태) — nullable 컬럼이라 백필 불필요, 바로 적용 가능:
Run: `pnpm --filter @daeoebi/api exec prisma migrate dev --name recurring_term_months`
이어서 Run: `pnpm --filter @daeoebi/api exec prisma generate`
Expected: `ALTER TABLE "RecurringExpense" ADD COLUMN "termMonths" INTEGER;` 적용.
- [ ] **Step 3: 커밋**
```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations
git commit -m "feat(api): 고정 지출 termMonths(개월 수) 모델"
```

---

### Task 2: API — recurring termMonths (DTO·서비스·뷰)

**Files:** Modify `apps/api/src/asset/dto/recurring.dto.ts`, `recurring.service.ts`, `recurring.service.spec.ts`.

- [ ] **Step 1: recurring.dto.ts — CreateRecurringDto 에 termMonths** (startMonth 아래):
```ts
    @IsOptional()
    @IsInt()
    @Min(1)
    termMonths?: number
```
(`IsOptional`·`IsInt`·`Min` 은 이미 import 됨.)

- [ ] **Step 2: 실패 테스트 추가 — recurring.service.spec.ts**
```ts
it("create 는 termMonths 를 저장하고(없으면 null) 뷰에 포함한다", async () => {
    const prisma = makePrisma()
    prisma.recurringExpense.create.mockResolvedValue({
        id: "r1", dayOfMonth: 25, startMonth: "2026-06", termMonths: 3,
        active: true, iv: IV, ciphertext: CT, authTag: TAG,
    })
    const out = await makeService(prisma).create({
        dayOfMonth: 25, startMonth: "2026-06", termMonths: 3, ...B,
    } as never)
    expect(prisma.recurringExpense.create.mock.calls[0][0].data.termMonths).toBe(3)
    expect(out).toMatchObject({ termMonths: 3 })

    const prisma2 = makePrisma()
    prisma2.recurringExpense.create.mockResolvedValue({
        id: "r2", dayOfMonth: 1, startMonth: "2026-06", termMonths: null,
        active: true, iv: IV, ciphertext: CT, authTag: TAG,
    })
    await makeService(prisma2).create({ dayOfMonth: 1, startMonth: "2026-06", ...B } as never)
    expect(prisma2.recurringExpense.create.mock.calls[0][0].data.termMonths).toBeNull()
})
```
(기존 spec 의 `makePrisma`/`makeService`/IV·CT·TAG·B 픽스처 사용.)

- [ ] **Step 3: 실패 확인** — Run: `pnpm --filter @daeoebi/api test:unit -- recurring.service` → FAIL.

- [ ] **Step 4: recurring.service.ts 구현** — `RecurringRow` 에 `termMonths: number | null` 추가; `toView` 에 `termMonths: row.termMonths` 추가; `create` data 에:
```ts
            startMonth: dto.startMonth,
            termMonths: dto.termMonths ?? null,
```

- [ ] **Step 5: 통과 + 전체 단위 + typecheck** — Run: `pnpm --filter @daeoebi/api test:unit && pnpm --filter @daeoebi/api typecheck` → PASS.

- [ ] **Step 6: 커밋**
```bash
git add apps/api/src/asset
git commit -m "feat(api): 고정 지출 생성에 termMonths 추가"
```

---

### Task 3: 웹 — client 타입 + materialize 종료월 경계

**Files:** Modify `apps/web/lib/vault-client.ts`, `apps/web/app/(vault)/asset/_lib/asset-recurring.ts`, `apps/web/app/(vault)/asset/_lib/asset-recurring.spec.ts`.

- [ ] **Step 1: vault-client.ts** — `RecurringView` 에 `termMonths: number | null` 추가; `createRecurring` 입력에 `termMonths?: number` 추가:
```ts
export interface RecurringView extends SealedBlobDto {
    id: string
    dayOfMonth: number
    startMonth: string
    termMonths: number | null
    active: boolean
}

export async function createRecurring(
    input: SealedBlobDto & {
        dayOfMonth: number
        startMonth: string
        termMonths?: number
    },
): Promise<RecurringView> {
    const { data } = await vaultClient.post<RecurringView>("/recurring", input)
    return data
}
```

- [ ] **Step 2: asset-recurring.spec.ts — 기존 tmpl 에 termMonths 추가 + 종료월 케이스**

기존 `tmpl` 픽스처에 `termMonths: null` 추가(타입 충족). 신규 케이스 추가:
```ts
const termTmpl: RecurringView = {
    id: "r2", dayOfMonth: 10, startMonth: "2026-06", termMonths: 3, active: true,
    iv: "AA", ciphertext: "BB", authTag: "CC",
}

it("종료월(startMonth+termMonths-1)까지는 생성한다", async () => {
    mockCreateExpense.mockResolvedValue({ id: "i" })
    await materializeRecurring(key, "2026-08", [termTmpl], []) // 6,7,8 → 8월=종료월
    expect(mockCreateExpense).toHaveBeenCalledTimes(1)
})

it("종료월 다음 달은 생성하지 않는다", async () => {
    mockCreateExpense.mockResolvedValue({ id: "i" })
    await materializeRecurring(key, "2026-09", [termTmpl], []) // 9월 = 종료월+1
    expect(mockCreateExpense).not.toHaveBeenCalled()
})
```

- [ ] **Step 3: 실패 확인** — Run: `pnpm --filter @daeoebi/web test -- asset-recurring` → FAIL ("2026-09" 에서도 생성됨).

- [ ] **Step 4: asset-recurring.ts — 종료월 경계 + addMonth import**

import 에 `addMonth` 추가:
```ts
import { addMonth, clampedDate } from "./asset-dates"
```
루프에 경계 추가(startMonth 가드 다음):
```ts
        if (month < t.startMonth) continue
        if (
            t.termMonths != null &&
            month > addMonth(t.startMonth, t.termMonths - 1)
        )
            continue // 기간 종료 후 미생성.
        if (present.has(`${t.id}|${month}`)) continue
```

- [ ] **Step 5: 통과 확인** — Run: `pnpm --filter @daeoebi/web test -- asset-recurring` → PASS.

- [ ] **Step 6: 커밋**
```bash
git add apps/web/lib/vault-client.ts "apps/web/app/(vault)/asset/_lib/asset-recurring.ts" "apps/web/app/(vault)/asset/_lib/asset-recurring.spec.ts"
git commit -m "feat(web): 고정 client termMonths·materialize 종료월 경계"
```

---

### Task 4: 웹 — ExpenseForm 개월 수 입력

**Files:** Modify `apps/web/app/(vault)/asset/_components/ExpenseForm.tsx`.

- [ ] **Step 1: 개월 수 state + 입력 UI**

고정 토글 state 부근에 추가:
```ts
const [termMonths, setTermMonths] = useState("")
```
고정 토글(`recurring` 체크박스) 바로 아래, `recurring` 이 true 일 때만 보이는 입력을 추가:
```tsx
{!isEdit && recurring && (
    <div className="form-row" style={{ margin: 0 }}>
        <label htmlFor="term-months">
            개월 수{" "}
            <span style={{ color: "var(--color-text-muted)", fontWeight: 600 }}>
                · 선택
            </span>
        </label>
        <input
            id="term-months"
            inputMode="numeric"
            className="field-control"
            placeholder="비우면 무기한"
            value={termMonths}
            onChange={(e) => {
                resetIdle()
                setTermMonths(e.target.value.replace(/[^\d]/g, "").slice(0, 3))
            }}
            aria-label="개월 수"
        />
    </div>
)}
```

- [ ] **Step 2: 생성 시 termMonths 전송**

`createRecurring` 호출에서 1 이상 정수면 termMonths 포함:
```ts
const term = Number(termMonths)
const tmpl = await createRecurring({
    dayOfMonth: Number(date.slice(8, 10)),
    startMonth: monthOf(date),
    ...(Number.isInteger(term) && term >= 1 ? { termMonths: term } : {}),
    ...tmplBlob,
})
```

- [ ] **Step 3: web 전체 검증**

Run:
```
pnpm --filter @daeoebi/web typecheck \
  && pnpm --filter @daeoebi/web lint \
  && pnpm --filter @daeoebi/web test \
  && pnpm --filter @daeoebi/web build
```
Expected: 모두 통과.

- [ ] **Step 4: 커밋**
```bash
git add "apps/web/app/(vault)/asset/_components/ExpenseForm.tsx"
git commit -m "feat(web): 고정 지출 개월 수 입력(선택)"
```

---

## 최종 검증

- [ ] `make typecheck`·`make lint`·`make test` 통과.
- [ ] `make dev-up` 후: 비카드 고정 개월 수 3, 6월 시작 → 6·7·8월 생성, 9월 미생성. 카드면 결제월 7·8·9월. 비우면 무기한.

## 빌드 순서

모델(1) → API(2) → 웹 client·materialize(3) → 웹 UI(4). 각 단계 통과 후 진행, web 최종 typecheck/build 는 Task 4 끝에서.
