# 고정 지출 지출 방식(method) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 고정 지출(RecurringExpense) 항목마다 "지출 방식"(자유 입력)을 고정 지출 탭에서 등록·수정·표시한다.

**Architecture:** 지출 방식은 템플릿만의 평문 컬럼(`RecurringExpense.method`, 카테고리와 동일 수준)으로 저장한다. 봉인 블롭·지출 인스턴스·전파 로직은 건드리지 않는다. 고정 지출 탭에서 방식만 단독 `PATCH`(`updateRecurring(id, { method })`)하고, 부모 상태를 불변 갱신해 전체 재조회 없이 즉시 반영한다.

**Tech Stack:** NestJS + Prisma(PostgreSQL) / Next.js(React) / Jest(단위) · Playwright(E2E) / pnpm 모노레포.

## Global Constraints

- 패키지 매니저는 **pnpm**만 사용한다. (`pnpm install`/`pnpm add`, npm·yarn 금지)
- 기존 마이그레이션(`apps/api/prisma/migrations/*`)은 수정·삭제 금지. 스키마 변경은 **새 마이그레이션**으로만.
- 봉인 계약 상수·블롭 포맷(`vault-crypto.ts`) 변경 금지. 본 작업은 블롭을 건드리지 않는다.
- 지출 등록/편집 폼(`ExpenseForm.tsx`)·지출 인스턴스(`Expense`)·전파 로직은 변경하지 않는다(명시적 비범위).
- 지출 방식 값: 자유 입력 텍스트, **최대 50자**. 저장은 **평문**(E2E 봉인 대상 아님).
- 커밋 메시지: `<type>: <설명>` (feat/fix/refactor/docs/test/chore).
- 작업 브랜치: `feat/recurring-method` (develop 기준). main 병합은 사용자가 직접 수행.

---

## File Structure

**API (apps/api)**
- `prisma/schema.prisma` — `RecurringExpense.method String?` 추가(+ stale 주석 정정).
- `prisma/migrations/<new>/migration.sql` — 컬럼 추가 마이그레이션(자동 생성).
- `src/asset/dto/recurring.dto.ts` — Create/Update DTO에 `method?: string` (+ stale 주석 정정).
- `src/asset/recurring.service.ts` — `RecurringRow`/`toView`/`create`/`update`에 method 반영.
- `src/asset/recurring.service.spec.ts` — method 저장·부분 갱신 테스트.

**Web (apps/web)**
- `lib/vault-client.ts` — `RecurringView.method`, `createRecurring`/`updateRecurring` 입력에 `method?`.
- `app/(vault)/asset/_lib/asset-compute.ts` — `ComputedRecurring.method` + 불변 헬퍼 `withRecurringMethod`.
- `app/(vault)/asset/page.tsx` — `resolveRecurrings` 매핑, `saveRecurringMethod` 콜백, prop 전달.
- `app/(vault)/asset/_components/dashboard/AssetDashboard.tsx` — `onSaveMethod` prop 스루.
- `app/(vault)/asset/_components/dashboard/RecurringTab.tsx` — 방식 표시 + 인라인 편집.
- 관련 spec: `asset-compute.spec.ts`, `asset-recurring.spec.ts`, `RecurringTab.spec.tsx` — 빌더/테스트 갱신.
- `tests/e2e/recurring.spec.ts` — 고정 지출 탭 방식 등록·유지 E2E.

---

## Task 1: API — `method` 평문 컬럼 (schema · migration · DTO · service)

**Files:**
- Modify: `apps/api/prisma/schema.prisma:135-154`
- Create: `apps/api/prisma/migrations/<timestamp>_recurring_method/migration.sql` (prisma가 생성)
- Modify: `apps/api/src/asset/dto/recurring.dto.ts`
- Modify: `apps/api/src/asset/recurring.service.ts:17-107`
- Test: `apps/api/src/asset/recurring.service.spec.ts`

**Interfaces:**
- Produces:
  - Prisma 모델 `RecurringExpense.method String?`
  - `CreateRecurringDto.method?: string`, `UpdateRecurringDto.method?: string` (`@IsOptional() @IsString() @MaxLength(50)`)
  - `RecurringService` 응답 뷰에 `method: string | null` 포함
  - `create`: `method: dto.method ?? null` 저장
  - `update`: `method`만 단독 `PATCH` 시 `data === { method }` (블롭·타 컬럼 무변경)

- [ ] **Step 1: 스키마에 컬럼 추가 + stale 주석 정정**

`apps/api/prisma/schema.prisma`의 `RecurringExpense` 모델을 아래처럼 수정한다. 주석(135-136행)은 현재 블롭에 category·method가 들어있다고 잘못 적혀 있으므로 실제(블롭은 `{item,amount}`, categoryId·method는 평문 컬럼)에 맞게 고친다.

```prisma
// 고정 지출 템플릿. 매월 자동 생성의 원본이다. dayOfMonth·active·categoryId·method 는 스케줄/표시용 평문,
// 금액·항목만 암호문 블롭({item,amount})이다.
model RecurringExpense {
  id         String    @id @default(cuid())
  dayOfMonth Int // 1-31. 말일 초과 시 클라가 해당 월 말일로 클램프한다.
  startMonth String // "YYYY-MM". 평문. 이 달부터 인스턴스 생성(이전 달엔 미생성).
  termMonths Int? // null = 무기한. N = startMonth 부터 N개월간만 생성.
  active     Boolean   @default(true)
  categoryId String?
  category   AssetCategory? @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  method     String? // 지출 방식(자유 입력, 평문). 고정 지출 탭 전용 — 인스턴스로 전파되지 않는다.
  iv         Bytes
  ciphertext Bytes
  authTag    Bytes
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt
  instances  Expense[]

  @@index([active, createdAt])
  @@index([categoryId])
}
```

- [ ] **Step 2: 마이그레이션 생성·적용 (Prisma client 재생성 포함)**

로컬 개발 DB가 떠 있어야 한다(필요 시 `make dev-up`으로 DB 기동). 아래로 마이그레이션을 만들고 적용한다.

Run:
```bash
pnpm --filter @daeoebi/api exec prisma migrate dev --name recurring_method
```
Expected: `apps/api/prisma/migrations/<timestamp>_recurring_method/migration.sql`가 생성되고(`ALTER TABLE "RecurringExpense" ADD COLUMN "method" TEXT;`), "Your database is now in sync"와 함께 client가 재생성된다(이후 `data.method` 타입 인식).

- [ ] **Step 3: 실패하는 서비스 테스트 작성**

`apps/api/src/asset/recurring.service.spec.ts`의 `describe("RecurringService", ...)` 안(예: `remove` 테스트 앞)에 아래 두 테스트를 추가한다.

```typescript
    it("create 는 method 를 저장하고(없으면 null) 뷰에 포함한다", async () => {
        const prisma = makePrisma()
        prisma.recurringExpense.create.mockResolvedValue({
            ...row,
            method: "삼성카드",
        })
        const out = await makeService(prisma).create({
            dayOfMonth: 25,
            startMonth: "2026-06",
            method: "삼성카드",
            ...blob,
        } as never)
        expect(
            prisma.recurringExpense.create.mock.calls[0][0].data.method,
        ).toBe("삼성카드")
        expect(out).toMatchObject({ method: "삼성카드" })

        const prisma2 = makePrisma()
        prisma2.recurringExpense.create.mockResolvedValue({
            ...row,
            method: null,
        })
        await makeService(prisma2).create({
            dayOfMonth: 1,
            startMonth: "2026-06",
            ...blob,
        } as never)
        expect(
            prisma2.recurringExpense.create.mock.calls[0][0].data.method,
        ).toBeNull()
    })

    it("update 는 method 만 부분 갱신한다(블롭·타 컬럼 무변경)", async () => {
        const prisma = makePrisma()
        prisma.recurringExpense.update.mockResolvedValue({
            ...row,
            method: "현금",
        })
        const out = await makeService(prisma).update("r1", {
            method: "현금",
        } as never)
        expect(prisma.recurringExpense.update.mock.calls[0][0].data).toEqual({
            method: "현금",
        })
        expect(out).toMatchObject({ method: "현금" })
    })
```

- [ ] **Step 4: 테스트 실행 → 실패 확인**

Run:
```bash
pnpm --filter @daeoebi/api exec jest recurring.service
```
Expected: FAIL — `data.method`가 `undefined`(create가 매핑 안 함), update `data`가 `{}`라 `toEqual({ method: "현금" })` 불일치, `out.method` 없음.

- [ ] **Step 5: DTO에 method 추가 (+ stale 주석 정정)**

`apps/api/src/asset/dto/recurring.dto.ts`:

1) 파일 상단 주석(1-2행)을 실제에 맞게 고친다:
```typescript
// 고정 지출 템플릿(RecurringExpense) DTO. dayOfMonth·active·method 는 평문 메타,
// 본문(금액·항목)은 클라이언트 E2E 암호문 블롭({item,amount}).
```

2) `class-validator` import에 `MaxLength`를 추가한다(기존 import 목록에 한 줄 추가):
```typescript
import {
    IsBoolean,
    IsInt,
    IsOptional,
    IsString,
    Matches,
    Max,
    MaxLength,
    Min,
    MinLength,
} from "class-validator"
```

3) `CreateRecurringDto`의 `categoryId` 필드 바로 뒤에 추가:
```typescript
    @IsOptional()
    @IsString()
    @MaxLength(50)
    method?: string
```

4) `UpdateRecurringDto`의 `categoryId` 필드 바로 뒤에 동일하게 추가:
```typescript
    @IsOptional()
    @IsString()
    @MaxLength(50)
    method?: string
```

- [ ] **Step 6: 서비스에 method 매핑**

`apps/api/src/asset/recurring.service.ts`:

1) `RecurringRow` 인터페이스(17-27행)에 `method` 추가:
```typescript
interface RecurringRow {
    id: string
    dayOfMonth: number
    startMonth: string
    termMonths: number | null
    categoryId: string | null
    method: string | null
    active: boolean
    iv: Uint8Array
    ciphertext: Uint8Array
    authTag: Uint8Array
}
```

2) `toView`(29-41행) 반환 객체에 `method: row.method` 추가(예: `categoryId` 다음 줄):
```typescript
        categoryId: row.categoryId,
        method: row.method,
```

3) `create`의 `data`(58-66행)에 `categoryId` 다음 줄로 추가:
```typescript
                categoryId: dto.categoryId ?? null,
                method: dto.method ?? null,
```

4) `update`의 부분 갱신 블록(73-76행)에 한 줄 추가:
```typescript
        if (dto.categoryId !== undefined) data.categoryId = dto.categoryId
        if (dto.method !== undefined) data.method = dto.method
```

- [ ] **Step 7: 테스트 실행 → 통과 확인**

Run:
```bash
pnpm --filter @daeoebi/api exec jest recurring.service
```
Expected: PASS (신규 2개 포함 전체 통과).

- [ ] **Step 8: API 타입체크**

Run:
```bash
pnpm --filter @daeoebi/api run typecheck
```
Expected: 에러 없음.

- [ ] **Step 9: 커밋**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations apps/api/src/asset/dto/recurring.dto.ts apps/api/src/asset/recurring.service.ts apps/api/src/asset/recurring.service.spec.ts
git commit -m "feat: 고정 지출 템플릿에 지출 방식(method) 평문 컬럼 추가"
```

---

## Task 2: Web 모델 — 타입 확장 + 불변 헬퍼 + 조립 매핑

**Files:**
- Modify: `apps/web/lib/vault-client.ts:400-407,518-545`
- Modify: `apps/web/app/(vault)/asset/_lib/asset-compute.ts:26-34`
- Modify: `apps/web/app/(vault)/asset/page.tsx:152-162`
- Test: `apps/web/app/(vault)/asset/_lib/asset-compute.spec.ts`
- Modify(빌더 정합): `apps/web/app/(vault)/asset/_lib/asset-recurring.spec.ts:47-59,272-293`, `apps/web/app/(vault)/asset/_components/dashboard/RecurringTab.spec.tsx:19-32`

**Interfaces:**
- Consumes: Task 1의 서버 응답 `method: string | null`.
- Produces:
  - `RecurringView.method: string | null`
  - `updateRecurring` 입력에 `method?: string`, `createRecurring` 입력에 `method?: string`
  - `ComputedRecurring.method: string | null`
  - `withRecurringMethod(rows: readonly ComputedRecurring[], id: string, method: string): ComputedRecurring[]` — 해당 id의 방식만 바꾼 새 배열(원본 불변).

- [ ] **Step 1: 실패하는 `withRecurringMethod` 테스트 작성**

`apps/web/app/(vault)/asset/_lib/asset-compute.spec.ts` 상단 import에 `withRecurringMethod`를 추가하고(기존 `from "./asset-compute"` 목록에 삽입), 파일 안에 아래 describe를 추가한다.

```typescript
describe("withRecurringMethod", () => {
    const base = {
        id: "r1",
        item: "월세",
        amount: 1,
        dayOfMonth: 1,
        startMonth: "2026-01",
        termMonths: null,
        categoryId: null,
        method: null,
    }

    it("해당 id 의 방식만 바꾼 새 배열을 반환한다(원본 불변)", () => {
        const rows = [base, { ...base, id: "r2", method: "현금" }]
        const out = withRecurringMethod(rows, "r1", "삼성카드")
        expect(out[0].method).toBe("삼성카드")
        expect(out[1].method).toBe("현금")
        expect(rows[0].method).toBeNull() // 원본 불변
        expect(out).not.toBe(rows)
    })

    it("일치하는 id 가 없으면 원소 값은 그대로다", () => {
        const rows = [base]
        const out = withRecurringMethod(rows, "none", "카카오페이")
        expect(out[0].method).toBeNull()
    })
})
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run:
```bash
pnpm --filter @daeoebi/web exec jest asset-compute
```
Expected: FAIL — `withRecurringMethod` is not a function / 타입 미존재.

- [ ] **Step 3: `ComputedRecurring`에 method + 헬퍼 구현**

`apps/web/app/(vault)/asset/_lib/asset-compute.ts`:

1) `ComputedRecurring`(26-34행)에 `method` 추가:
```typescript
export interface ComputedRecurring {
    id: string
    item: string
    amount: number
    dayOfMonth: number
    startMonth: string // "YYYY-MM". 시작 전 달에는 나가지 않는다.
    termMonths: number | null // null = 무기한
    categoryId: string | null
    method: string | null // 지출 방식(자유 입력, 평문). 고정 지출 탭에서만 쓴다.
}
```

2) `activeRecurringIds` 함수 아래에 헬퍼를 추가:
```typescript
// 고정 지출 목록에서 한 항목의 지출 방식만 바꿔 새 배열을 반환한다(원본 불변).
// 방식 저장 후 전체 재조회 없이 부모 상태를 부분 갱신할 때 쓴다.
export function withRecurringMethod(
    rows: readonly ComputedRecurring[],
    id: string,
    method: string,
): ComputedRecurring[] {
    return rows.map((r) => (r.id === id ? { ...r, method } : r))
}
```

- [ ] **Step 4: `vault-client` 타입 확장**

`apps/web/lib/vault-client.ts`:

1) `RecurringView`(400-407행)에 `method` 추가:
```typescript
export interface RecurringView extends SealedBlobDto {
    id: string
    dayOfMonth: number
    startMonth: string
    termMonths: number | null
    active: boolean
    categoryId: string | null
    method: string | null
}
```

2) `createRecurring` 입력 타입(519-524행)에 `method?` 추가:
```typescript
export async function createRecurring(
    input: SealedBlobDto & {
        dayOfMonth: number
        startMonth: string
        termMonths?: number
        categoryId?: string
        method?: string
    },
): Promise<RecurringView> {
```

3) `updateRecurring` 입력 타입(532-538행)에 `method?` 추가:
```typescript
export async function updateRecurring(
    id: string,
    input: Partial<SealedBlobDto> & {
        dayOfMonth?: number
        active?: boolean
        // null = 무기한으로 되돌림.
        termMonths?: number | null
        categoryId?: string
        method?: string
    },
): Promise<RecurringView> {
```

- [ ] **Step 5: `page.tsx` 조립 매핑**

`apps/web/app/(vault)/asset/page.tsx`의 `resolveRecurrings` 반환 객체(154-162행)에 `method` 추가:
```typescript
            return {
                id: v.id,
                item: p.item,
                amount: p.amount,
                dayOfMonth: v.dayOfMonth,
                startMonth: v.startMonth,
                termMonths: v.termMonths,
                categoryId: v.categoryId,
                method: v.method,
            }
```

- [ ] **Step 6: 테스트 빌더 정합 (typecheck 통과용)**

`method`가 필수 필드가 되었으므로 `ComputedRecurring`/`RecurringView` 리터럴을 만드는 테스트 빌더에 `method: null`을 채운다.

1) `apps/web/app/(vault)/asset/_lib/asset-recurring.spec.ts`의 `row` 헬퍼 기본값(51-59행)에 추가:
```typescript
    return {
        id: over.item,
        amount: 1000,
        dayOfMonth: 1,
        startMonth: "2026-01",
        termMonths: null,
        categoryId: null,
        method: null,
        ...over,
    }
```

2) 같은 파일의 `tmpl`(272-282행)·`termTmpl`(283-293행) `RecurringView` 리터럴에 각각 `method: null,` 추가(예: `categoryId: null,` 다음 줄).

3) `apps/web/app/(vault)/asset/_components/dashboard/RecurringTab.spec.tsx`의 `makeRecurring` 기본값(22-31행)에 `method: null,` 추가(예: `categoryId: "c1",` 다음 줄).

> `asset-compute.spec.ts`의 `activeRecurringIds` 테스트(91-99행 인라인 리터럴)에도 `method: null,`을 추가한다.

- [ ] **Step 7: 테스트 실행 → 통과 확인**

Run:
```bash
pnpm --filter @daeoebi/web exec jest asset-compute asset-recurring RecurringTab
```
Expected: PASS.

- [ ] **Step 8: 웹 타입체크**

Run:
```bash
pnpm --filter @daeoebi/web run typecheck
```
Expected: 에러 없음.

- [ ] **Step 9: 커밋**

```bash
git add apps/web/lib/vault-client.ts "apps/web/app/(vault)/asset/_lib/asset-compute.ts" "apps/web/app/(vault)/asset/page.tsx" "apps/web/app/(vault)/asset/_lib/asset-compute.spec.ts" "apps/web/app/(vault)/asset/_lib/asset-recurring.spec.ts" "apps/web/app/(vault)/asset/_components/dashboard/RecurringTab.spec.tsx"
git commit -m "feat: 고정 지출 method 웹 타입·모델 확장 및 불변 갱신 헬퍼"
```

---

## Task 3: RecurringTab — 방식 표시 + 인라인 편집

**Files:**
- Modify: `apps/web/app/(vault)/asset/_components/dashboard/RecurringTab.tsx`
- Modify: `apps/web/app/(vault)/asset/_components/dashboard/AssetDashboard.tsx:68-88,153-159`
- Modify: `apps/web/app/(vault)/asset/page.tsx` (import + `saveRecurringMethod` + prop 전달)
- Test: `apps/web/app/(vault)/asset/_components/dashboard/RecurringTab.spec.tsx`

**Interfaces:**
- Consumes: `ComputedRecurring.method`, `withRecurringMethod`(Task 2), `updateRecurring`(Task 2).
- Produces:
  - `RecurringTabProps.onSaveMethod: (id: string, method: string) => Promise<void>`
  - `AssetDashboard` Props에 `onSaveMethod` 스루
  - `page.tsx`의 `saveRecurringMethod`(updateRecurring 호출 → 부모 상태 부분 갱신, 실패 시 toast)

- [ ] **Step 1: 실패하는 RecurringTab 편집 테스트 작성**

`RecurringTab.spec.tsx` 상단 import에 사용자 이벤트를 추가한다:
```typescript
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
```
그리고 기존 각 `render(<RecurringTab .../>)` 호출에 `onSaveMethod={() => Promise.resolve()}` prop을 추가한다(모든 렌더 6곳). 이어서 아래 두 테스트를 `describe` 안에 추가한다.

```typescript
    it("방식이 없으면 '방식 추가' placeholder 를, 있으면 방식 텍스트를 보여준다", () => {
        render(
            <RecurringTab
                month={MONTH}
                recurrings={[
                    makeRecurring({ id: "r1", method: null }),
                    makeRecurring({ id: "r2", item: "월세", method: "삼성카드" }),
                ]}
                categories={categories}
                onSaveMethod={() => Promise.resolve()}
            />,
        )
        expect(screen.getByText("방식 추가")).not.toBeNull()
        expect(screen.getByText("삼성카드")).not.toBeNull()
    })

    it("방식을 입력해 저장하면 onSaveMethod 가 id·방식으로 호출된다", async () => {
        const onSaveMethod = jest.fn().mockResolvedValue(undefined)
        render(
            <RecurringTab
                month={MONTH}
                recurrings={[makeRecurring({ id: "r1", method: null })]}
                categories={categories}
                onSaveMethod={onSaveMethod}
            />,
        )
        fireEvent.click(screen.getByRole("button", { name: "지출 방식 편집" }))
        const input = screen.getByRole("textbox", { name: "지출 방식" })
        fireEvent.change(input, { target: { value: "카카오페이" } })
        fireEvent.keyDown(input, { key: "Enter" })
        await waitFor(() =>
            expect(onSaveMethod).toHaveBeenCalledWith("r1", "카카오페이"),
        )
    })
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run:
```bash
pnpm --filter @daeoebi/web exec jest RecurringTab
```
Expected: FAIL — `onSaveMethod` prop 타입 미존재, "방식 추가"/편집 버튼/textbox 없음.

- [ ] **Step 3: RecurringTab에 편집 UI 구현**

`apps/web/app/(vault)/asset/_components/dashboard/RecurringTab.tsx`를 아래와 같이 수정한다.

1) import·상단에 React·toast 추가, 주석(2-3행) 정정:
```typescript
"use client"
// 고정 지출 탭. 등록해 둔 활성 템플릿(RecurringExpense)을 결제일 순으로 모아 보여준다.
// 금액·항목·개월수는 읽기 전용(수정은 이번 달 지출 항목을 통해)이지만, "지출 방식"만 이 탭에서 직접 편집한다.
// 데이터(복호화된 템플릿)는 부모(asset/page)가 넘긴다.
import { useState } from "react"
import type { AssetCategory } from "@/lib/vault-client"
import type { ComputedRecurring } from "../../_lib/asset-compute"
import { formatWon, resolveCategory } from "../../_lib/asset-categories"
import { toast } from "@/components/toast"
import {
    formatDayOfMonth,
    formatExpiry,
    recurringInMonth,
    sortRecurring,
    totalRecurring,
} from "../../_lib/asset-recurring"

const MAX_METHOD_LEN = 50
```

2) Props에 `onSaveMethod` 추가:
```typescript
interface RecurringTabProps {
    month: string
    recurrings: ComputedRecurring[]
    categories: AssetCategory[]
    onSaveMethod: (id: string, method: string) => Promise<void>
}

export function RecurringTab({
    month,
    recurrings,
    categories,
    onSaveMethod,
}: RecurringTabProps) {
```

3) 편집 상태와 저장 핸들러를 `const active = ...` 앞에 추가:
```typescript
    const [editingId, setEditingId] = useState<string | null>(null)
    const [draft, setDraft] = useState("")
    const [saving, setSaving] = useState(false)

    function startEdit(r: ComputedRecurring) {
        setEditingId(r.id)
        setDraft(r.method ?? "")
    }

    async function commitEdit(id: string) {
        if (saving) return
        setSaving(true)
        try {
            await onSaveMethod(id, draft.trim())
            setEditingId(null)
        } catch {
            toast.error("지출 방식을 저장하지 못했어요.")
        } finally {
            setSaving(false)
        }
    }
```

4) 행 렌더(`rows.map`)의 가운데 `div`(150-173행: item + 결제일/만료 subline) 안, subline `div` 다음에 방식 영역을 추가한다. 편집 중이면 `<input>`, 아니면 편집 버튼을 보여준다.

```tsx
                                    <div
                                        style={{
                                            fontSize: 12,
                                            color: "#a3a3a3",
                                            fontWeight: 500,
                                        }}
                                    >
                                        {`${formatDayOfMonth(r.dayOfMonth)} · ${formatExpiry(r.startMonth, r.termMonths)}`}
                                    </div>
                                    {editingId === r.id ? (
                                        <input
                                            aria-label="지출 방식"
                                            autoFocus
                                            value={draft}
                                            maxLength={MAX_METHOD_LEN}
                                            disabled={saving}
                                            onChange={(e) =>
                                                setDraft(e.target.value)
                                            }
                                            onBlur={() => commitEdit(r.id)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") {
                                                    e.preventDefault()
                                                    void commitEdit(r.id)
                                                } else if (e.key === "Escape") {
                                                    setEditingId(null)
                                                }
                                            }}
                                            style={{
                                                marginTop: 4,
                                                fontSize: 12,
                                                fontWeight: 600,
                                                padding: "3px 8px",
                                                borderRadius: 8,
                                                border: "1px solid #d8d8d8",
                                                width: "100%",
                                                maxWidth: 160,
                                            }}
                                        />
                                    ) : (
                                        <button
                                            type="button"
                                            aria-label="지출 방식 편집"
                                            onClick={() => startEdit(r)}
                                            style={{
                                                marginTop: 4,
                                                fontSize: 12,
                                                fontWeight: 600,
                                                color: r.method
                                                    ? "#6b6b6b"
                                                    : "#b8b8b8",
                                                background: "none",
                                                border: "none",
                                                padding: 0,
                                                cursor: "pointer",
                                            }}
                                        >
                                            {r.method || "방식 추가"}
                                        </button>
                                    )}
```

> 카드 컨테이너의 `cursor: "default"`는 유지한다(카드 자체는 여전히 비링크). 편집은 방식 버튼에서만 시작한다.

- [ ] **Step 4: AssetDashboard에 prop 스루**

`apps/web/app/(vault)/asset/_components/dashboard/AssetDashboard.tsx`:

1) `Props`(68-77행)에 추가:
```typescript
    assetTab: AssetTab
    savings: SavingsView
    onSaveMethod: (id: string, method: string) => Promise<void>
```

2) 구조분해(79-88행)에 `onSaveMethod` 추가.

3) `RecurringTab` 렌더(153-159행)에 prop 전달:
```tsx
            {assetTab === "recurring" && (
                <RecurringTab
                    month={month}
                    recurrings={data.recurrings}
                    categories={data.categories}
                    onSaveMethod={onSaveMethod}
                />
            )}
```

- [ ] **Step 5: page.tsx에 저장 콜백 + import 추가**

`apps/web/app/(vault)/asset/page.tsx`:

1) vault-client import(14-30행)에 `updateRecurring`를 추가:
```typescript
    listRecurring,
    updateRecurring,
```

2) asset-compute import(43-57행)에 `withRecurringMethod`를 추가:
```typescript
    savingsBoxBalance,
    sortContributionsByDateDesc,
    withRecurringMethod,
```

3) `load` useCallback 정의 뒤(435행 이후, `useEffect` 앞)에 저장 콜백을 추가:
```typescript
    // 고정 지출 탭에서 방식만 단독 PATCH → 성공 시 전체 재조회 없이 상태를 부분 갱신한다.
    // 방식은 봉인 블롭·전파와 무관해 updateRecurring(method) 만으로 안전하다.
    const saveRecurringMethod = useCallback(
        async (id: string, method: string) => {
            try {
                await updateRecurring(id, { method })
                setState((prev) =>
                    prev.status === "ready"
                        ? {
                              ...prev,
                              data: {
                                  ...prev.data,
                                  recurrings: withRecurringMethod(
                                      prev.data.recurrings,
                                      id,
                                      method,
                                  ),
                              },
                          }
                        : prev,
                )
            } catch (e) {
                toast.error(
                    isApiError(e) ? e.message : "지출 방식을 저장하지 못했어요.",
                )
                throw e
            }
        },
        [],
    )
```

4) `AssetDashboard` 렌더(약 940행)에 prop을 전달:
```tsx
                    assetTab={assetTab}
                    savings={savingsView}
                    onSaveMethod={saveRecurringMethod}
```

- [ ] **Step 6: 테스트 실행 → 통과 확인**

Run:
```bash
pnpm --filter @daeoebi/web exec jest RecurringTab
```
Expected: PASS (신규 2개 포함 전체 통과).

- [ ] **Step 7: 웹 타입체크**

Run:
```bash
pnpm --filter @daeoebi/web run typecheck
```
Expected: 에러 없음.

- [ ] **Step 8: 커밋**

```bash
git add "apps/web/app/(vault)/asset/_components/dashboard/RecurringTab.tsx" "apps/web/app/(vault)/asset/_components/dashboard/AssetDashboard.tsx" "apps/web/app/(vault)/asset/page.tsx" "apps/web/app/(vault)/asset/_components/dashboard/RecurringTab.spec.tsx"
git commit -m "feat: 고정 지출 탭에서 지출 방식 인라인 등록·수정"
```

---

## Task 4: E2E — 고정 지출 탭에서 방식 등록·유지

**Files:**
- Modify: `apps/web/tests/e2e/recurring.spec.ts`

**Interfaces:**
- Consumes: Task 1–3 전체(탭 UI + PATCH 저장 + 서버 컬럼).

- [ ] **Step 1: E2E 테스트 추가**

`apps/web/tests/e2e/recurring.spec.ts`의 `test.describe("고정 지출 수정 — 앞으로만 반영", ...)` 안(마지막 test 뒤)에 아래를 추가한다. 기존 헬퍼(`createRecurringExpense`, `waitForAssetDashboard`, `enterVaultAt`)를 재사용한다.

```typescript
    // 지출 방식: 고정 지출 탭에서 직접 등록하고, 재진입 후에도 유지되는지(서버 저장) 검증한다.
    test("고정 지출 탭에서 지출 방식을 등록하면 유지된다", async ({ page }) => {
        test.setTimeout(120_000)
        await page.setViewportSize(TALL_VIEWPORT)

        const item = `QA방식-${Date.now()}`
        const method = "삼성카드"
        await createRecurringExpense(page, {
            item,
            category: CATEGORY_BEFORE,
            term: "6",
        })

        // 고정 지출 탭으로 이동해 방금 만든 행의 방식을 편집한다.
        await page.getByRole("button", { name: "고정 지출" }).click()
        const row = page.locator(".entry-card").filter({ hasText: item })
        await expect(row).toBeVisible({ timeout: 20_000 })
        await row.getByRole("button", { name: "지출 방식 편집" }).click()
        const input = row.getByRole("textbox", { name: "지출 방식" })
        await input.fill(method)
        await input.press("Enter")

        // 저장 후 방식 텍스트가 보인다.
        await expect(row.getByText(method)).toBeVisible({ timeout: 15_000 })

        // 대시보드를 다시 열어(재조회) 방식이 유지되는지 확인한다.
        await page.goto("/asset")
        await waitForAssetDashboard(page)
        await page.getByRole("button", { name: "고정 지출" }).click()
        const rowAgain = page.locator(".entry-card").filter({ hasText: item })
        await expect(rowAgain.getByText(method)).toBeVisible({
            timeout: 20_000,
        })
    })
```

- [ ] **Step 2: E2E 실행 (로컬 dev 스택 필요)**

먼저 로컬 개발 스택을 띄운다(`make dev-up` — DB 도커 + web·API 로컬). 그다음:

Run:
```bash
pnpm --filter @daeoebi/web exec playwright test tests/e2e/recurring.spec.ts --config=playwright.e2e.config.ts
```
Expected: 신규 테스트 포함 PASS. (환경 문제로 로컬 E2E 실행이 어려우면, 단위 테스트·타입체크 통과를 근거로 커밋하고 CI/사용자 검증에 위임한다 — 이 경우 그 사실을 명시한다.)

- [ ] **Step 3: 커밋**

```bash
git add apps/web/tests/e2e/recurring.spec.ts
git commit -m "test: 고정 지출 탭 지출 방식 등록·유지 E2E 추가"
```

---

## Task 5: 최종 검증

- [ ] **Step 1: 전체 타입체크·단위 테스트**

Run:
```bash
pnpm -r run typecheck
pnpm --filter @daeoebi/api exec jest
pnpm --filter @daeoebi/web exec jest
```
Expected: 모두 PASS. (특히 지출 폼 결제방법 부재 회귀 테스트 `asset.spec.ts` D 항목이 그대로 통과 — 본 작업은 지출 폼을 건드리지 않았다.)

- [ ] **Step 2: develop 병합 준비**

작업 브랜치(`feat/recurring-method`)를 develop로 병합하는 것은 사용자 동의 후 수행한다. main 병합은 사용자가 직접 수행한다.

---

## Self-Review 결과

- **Spec coverage:** 저장 위치(평문 컬럼, Task 1) · 편집 진입점(탭 인라인, Task 3) · 화면 부분 갱신(withRecurringMethod + saveRecurringMethod, Task 2·3) · 자유 입력 50자(DTO MaxLength + input maxLength) · 비범위(ExpenseForm/인스턴스/전파 무변경) · 회귀 테스트 영향(Task 5에서 확인) 모두 태스크로 커버.
- **Placeholder scan:** 모든 코드 스텝에 실제 코드 포함. TBD/TODO 없음.
- **Type consistency:** `method: string | null`(뷰·모델), `method?: string`(DTO·입력), `withRecurringMethod`/`onSaveMethod`/`saveRecurringMethod` 시그니처가 Task 간 일치.
