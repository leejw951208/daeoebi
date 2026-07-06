# 고정 지출 시작월·해제·삭제 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 고정 지출에 시작월(설정한 달부터, 카드는 결제 시프트로 익월 등장)·비파괴 해제(active=false)·삭제 선택(전체/이번 달만, 이번 달만은 재생성 안 됨)을 구현한다.

**Architecture:** `RecurringExpense.startMonth`(평문)로 머티리얼라이즈 시작을 제한하고, `Expense.removed`(소프트 삭제 툼스톤)로 "이번 달만 삭제"가 unique 슬롯을 점유해 재생성을 막는다. "전체 삭제"는 FK Cascade 로 `deleteRecurring` 한 번에 인스턴스까지 정리. 해제는 기존 `active` 플래그를 UI로 노출.

**Tech Stack:** NestJS + Prisma + PostgreSQL(api), Next.js 15 + React(web), WebCrypto E2E(서버는 method·금액을 못 읽음 → 시작월/removed/active 등 평문 메타로만 처리).

## Global Constraints

- 기존 마이그레이션 수정 금지, 신규 생성. `pnpm-lock.yaml` 수동 편집 금지. `.env.*` 읽기만. `rm` 금지(git rm).
- 본문은 클라이언트 E2E 암호문 — 서버 base64url 패스스루.
- 월 형식 `YYYY-MM`(`/^\d{4}-(0[1-9]|1[0-2])$/`). startMonth 비교는 문자열 사전식.
- 커밋은 각 Task 끝. 메시지 끝: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- 사용자 노출 문구 한국어, 문장 마침표 종결.
- 카드 익월 등장은 기존 `billingDate` 결제 시프트가 담당 — startMonth 는 카드·비카드 동일(설정한 달).

---

### Task 1: Prisma 모델 — startMonth·removed·FK Cascade

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (model RecurringExpense, model Expense)
- Create: `apps/api/prisma/migrations/<ts>_recurring_start_and_soft_delete/migration.sql` (생성 후 편집)

**Interfaces:**
- Produces: `RecurringExpense.startMonth String`(NOT NULL), `Expense.removed Boolean @default(false)`, `Expense.recurring` 관계 `onDelete: Cascade`.

- [ ] **Step 1: schema.prisma 수정**

`RecurringExpense`에 `startMonth` 추가(dayOfMonth 아래):
```prisma
  dayOfMonth Int
  startMonth String // "YYYY-MM". 평문. 이 달부터 인스턴스 생성(이전 달엔 미생성).
  active     Boolean   @default(true)
```
`Expense` 의 관계 onDelete 변경 + `removed` 추가:
```prisma
  recurringId String?
  recurring   RecurringExpense? @relation(fields: [recurringId], references: [id], onDelete: Cascade)
  period      String?
  removed     Boolean           @default(false) // 이번 달만 삭제(소프트 삭제). 목록·집계 제외, 슬롯 유지로 재생성 차단.
```

- [ ] **Step 2: 마이그레이션 생성(적용 보류)**

dev DB 가 떠 있어야 한다. Run: `pnpm --filter @daeoebi/api exec prisma migrate dev --name recurring_start_and_soft_delete --create-only`
Expected: `migration.sql` 생성(미적용).

- [ ] **Step 3: migration.sql 보정 — startMonth 백필 + NOT NULL 순서**

prisma 는 NOT NULL 컬럼을 기존 행이 있는 테이블에 바로 추가하면 실패한다. 생성된 SQL 에서 `startMonth` 추가를 **nullable 추가 → 백필 → NOT NULL** 순서로 바꾼다(아래 형태가 되도록 편집):
```sql
ALTER TABLE "RecurringExpense" ADD COLUMN "startMonth" TEXT;
UPDATE "RecurringExpense" SET "startMonth" = to_char("createdAt", 'YYYY-MM') WHERE "startMonth" IS NULL;
ALTER TABLE "RecurringExpense" ALTER COLUMN "startMonth" SET NOT NULL;
```
`removed` 는 DEFAULT false 라 그대로 둔다. FK 교체 문(DROP CONSTRAINT ... ADD CONSTRAINT ... ON DELETE CASCADE)이 포함됐는지 확인한다(없으면 prisma 가 SetNull→Cascade 차이를 ALTER 로 생성했을 것).

- [ ] **Step 4: 적용 + 클라이언트 재생성**

Run: `pnpm --filter @daeoebi/api exec prisma migrate dev`
이어서 Run: `pnpm --filter @daeoebi/api exec prisma generate`
Expected: 적용 완료, 클라이언트 재생성.

- [ ] **Step 5: 커밋**
```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations
git commit -m "feat(api): 고정 지출 startMonth·소프트삭제(removed)·FK Cascade 모델"
```

---

### Task 2: API — recurring startMonth (DTO·서비스·뷰)

**Files:**
- Modify: `apps/api/src/asset/dto/recurring.dto.ts`
- Modify: `apps/api/src/asset/recurring.service.ts`
- Modify: `apps/api/src/asset/recurring.service.spec.ts`

**Interfaces:**
- Consumes: Task 1 의 `startMonth` 컬럼.
- Produces: `POST /recurring {dayOfMonth, startMonth, iv, ciphertext, authTag}`; View `{ id, dayOfMonth, startMonth, active, iv, ciphertext, authTag }`.

- [ ] **Step 1: recurring.dto.ts — CreateRecurringDto 에 startMonth**

import 에 `Matches` 추가, `CreateRecurringDto` 에:
```ts
import { IsBase64url } from "../../common/base64url"
import { IsBoolean, IsInt, IsOptional, Matches, Max, Min } from "class-validator"

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/

export class CreateRecurringDto {
    @IsInt()
    @Min(1)
    @Max(31)
    dayOfMonth!: number

    @Matches(MONTH_RE, { message: "startMonth 는 YYYY-MM 형식이어야 합니다." })
    startMonth!: string

    @IsBase64url() iv!: string
    @IsBase64url() ciphertext!: string
    @IsBase64url() authTag!: string
}
```
(`UpdateRecurringDto` 는 변경 없음 — active 이미 존재.)

- [ ] **Step 2: 실패 테스트 추가 — recurring.service.spec.ts**

`create` 가 startMonth 를 저장하고 `listActive`/뷰가 startMonth 를 반환하는지 검증하는 케이스를 추가한다(기존 스펙 픽스처 스타일 따름). 예:
```ts
it("create 는 startMonth 를 저장하고 뷰에 포함한다", async () => {
    const prisma = makePrisma() // 기존 헬퍼
    prisma.recurringExpense.create.mockResolvedValue({
        id: "r1", dayOfMonth: 25, startMonth: "2026-06", active: true,
        iv: IV, ciphertext: CT, authTag: TAG,
    })
    const out = await makeService(prisma).create({
        dayOfMonth: 25, startMonth: "2026-06", ...B,
    } as never)
    expect(prisma.recurringExpense.create.mock.calls[0][0].data.startMonth).toBe("2026-06")
    expect(out).toMatchObject({ startMonth: "2026-06" })
})
```
(기존 스펙의 `makePrisma`/`makeService`/IV·CT·TAG·B 픽스처가 없으면 income.service.spec 패턴으로 맞춘다.)

- [ ] **Step 3: 테스트 실패 확인**

Run: `pnpm --filter @daeoebi/api test:unit -- recurring.service`
Expected: FAIL (startMonth 미저장/뷰 누락).

- [ ] **Step 4: recurring.service.ts — create·toView 에 startMonth**

`RecurringRow` 인터페이스에 `startMonth: string` 추가, `toView` 에 `startMonth: row.startMonth` 추가, `create` 의 data 에 `startMonth: dto.startMonth` 추가:
```ts
// create
data: {
    dayOfMonth: dto.dayOfMonth,
    startMonth: dto.startMonth,
    iv: prismaBytes(fromBase64url(dto.iv)),
    ciphertext: prismaBytes(fromBase64url(dto.ciphertext)),
    authTag: prismaBytes(fromBase64url(dto.authTag)),
},
```
```ts
// toView 반환에 추가
startMonth: row.startMonth,
```

- [ ] **Step 5: 테스트 통과 + 전체 단위 + typecheck**

Run: `pnpm --filter @daeoebi/api test:unit -- recurring.service`
Expected: PASS.
Run: `pnpm --filter @daeoebi/api test:unit && pnpm --filter @daeoebi/api typecheck`
Expected: PASS.

- [ ] **Step 6: 커밋**
```bash
git add apps/api/src/asset
git commit -m "feat(api): 고정 지출 생성에 startMonth 추가"
```

---

### Task 3: API — expense 소프트 삭제(removed) + 목록 필터

**Files:**
- Modify: `apps/api/src/asset/dto/expense.dto.ts` (UpdateExpenseDto)
- Modify: `apps/api/src/asset/expense.service.ts` (listByMonth, update)
- Modify: `apps/api/src/asset/expense.service.spec.ts`

**Interfaces:**
- Produces: `PATCH /expenses/:id { removed?: boolean }` 로 소프트 삭제; `GET /expenses?month=` 는 `removed=false` 만 반환.

- [ ] **Step 1: expense.dto.ts — UpdateExpenseDto 에 removed**

import 에 `IsBoolean` 추가, `UpdateExpenseDto` 에:
```ts
    @IsOptional()
    @IsBoolean()
    removed?: boolean
```

- [ ] **Step 2: 실패 테스트 추가 — expense.service.spec.ts**

기존 스펙 스타일로 두 케이스 추가:
```ts
it("listByMonth 는 removed=false 만 조회한다", async () => {
    const prisma = makePrisma()
    prisma.expense.findMany.mockResolvedValue([])
    await makeService(prisma).listByMonth("2026-06")
    expect(prisma.expense.findMany.mock.calls[0][0].where).toMatchObject({ removed: false })
})

it("update 는 removed 를 설정한다(소프트 삭제)", async () => {
    const prisma = makePrisma()
    prisma.expense.findUnique.mockResolvedValue({ id: "e1" })
    prisma.expense.update.mockResolvedValue({
        id: "e1", date: new Date("2026-06-10"), recurringId: null, period: null,
        iv: IV, ciphertext: CT, authTag: TAG,
    })
    await makeService(prisma).update("e1", { removed: true } as never)
    expect(prisma.expense.update.mock.calls[0][0].data).toMatchObject({ removed: true })
})
```
(기존 expense.service.spec 의 makePrisma/픽스처를 그대로 쓴다. 없으면 income.service.spec 패턴 참조.)

- [ ] **Step 3: 테스트 실패 확인**

Run: `pnpm --filter @daeoebi/api test:unit -- expense.service`
Expected: FAIL.

- [ ] **Step 4: expense.service.ts 구현**

`listByMonth` 의 `where` 에 `removed: false` 추가:
```ts
const rows = await this.prisma.expense.findMany({
    where: { date: { gte: start, lt: end }, removed: false },
    orderBy: { date: "desc" },
})
```
`update` 에 removed 반영(기존 date/blob 처리 뒤에 추가):
```ts
if (dto.removed !== undefined) data.removed = dto.removed
```
(`UpdateExpenseDto` 의 removed 가 `data` 에 반영되도록. data 는 `Record<string, unknown>`.)

- [ ] **Step 5: 테스트 통과 + 전체 단위 + typecheck**

Run: `pnpm --filter @daeoebi/api test:unit -- expense.service`
Expected: PASS.
Run: `pnpm --filter @daeoebi/api test:unit && pnpm --filter @daeoebi/api typecheck`
Expected: PASS.

- [ ] **Step 6: 커밋**
```bash
git add apps/api/src/asset
git commit -m "feat(api): 지출 소프트 삭제(removed) + 목록에서 제외"
```

---

### Task 4: 웹 — client 타입 + materialize 시작월 경계

**Files:**
- Modify: `apps/web/lib/vault-client.ts` (RecurringView, createRecurring, updateExpense 입력)
- Modify: `apps/web/app/(vault)/asset/_lib/asset-recurring.ts`
- Create: `apps/web/app/(vault)/asset/_lib/asset-recurring.spec.ts`

**Interfaces:**
- Consumes: API 의 startMonth(RecurringView), removed.
- Produces: `RecurringView.startMonth`; `createRecurring({dayOfMonth, startMonth, ...blob})`; `updateExpense(id, {removed?:boolean})`; materialize 가 `month < t.startMonth` 면 미생성.

- [ ] **Step 1: vault-client.ts 타입 보강**

`RecurringView` 에 startMonth 추가:
```ts
export interface RecurringView extends SealedBlobDto {
    id: string
    dayOfMonth: number
    startMonth: string
    active: boolean
}
```
`createRecurring` 입력에 startMonth:
```ts
export async function createRecurring(
    input: SealedBlobDto & { dayOfMonth: number; startMonth: string },
): Promise<RecurringView> {
    const { data } = await vaultClient.post<RecurringView>("/recurring", input)
    return data
}
```
`updateExpense` 입력에 removed 허용:
```ts
export async function updateExpense(
    id: string,
    input: Partial<SealedBlobDto> & { date?: string; removed?: boolean },
): Promise<ExpenseView> {
    const { data } = await vaultClient.patch<ExpenseView>(`/expenses/${id}`, input)
    return data
}
```

- [ ] **Step 2: 실패 테스트 작성 — asset-recurring.spec.ts**

`createExpense`(@/lib/vault-client)와 `openExpense`/`sealExpense`(./asset-payload)를 모킹해, startMonth 경계를 검증한다.
```ts
// materializeRecurring 의 시작월 경계 테스트.
const mockCreateExpense = jest.fn()
jest.mock("@/lib/vault-client", () => ({
    __esModule: true,
    createExpense: (...a: unknown[]) => mockCreateExpense(...a),
}))
jest.mock("@/lib/api-error", () => ({
    __esModule: true,
    isApiError: () => false,
}))
jest.mock("./asset-payload", () => ({
    __esModule: true,
    openExpense: jest.fn().mockResolvedValue({ item: "x", amount: 1, category: "기타", method: "현금" }),
    sealExpense: jest.fn().mockResolvedValue({ iv: "AA", ciphertext: "BB", authTag: "CC" }),
}))
import { materializeRecurring } from "./asset-recurring"
import type { RecurringView } from "@/lib/vault-client"

const tmpl: RecurringView = {
    id: "r1", dayOfMonth: 10, startMonth: "2026-06", active: true,
    iv: "AA", ciphertext: "BB", authTag: "CC",
}
const key = {} as CryptoKey

beforeEach(() => mockCreateExpense.mockReset())

it("startMonth 이전 달은 생성하지 않는다", async () => {
    mockCreateExpense.mockResolvedValue({ id: "i" })
    await materializeRecurring(key, "2026-05", [tmpl], [])
    expect(mockCreateExpense).not.toHaveBeenCalled()
})

it("startMonth 이후 달은 생성한다", async () => {
    mockCreateExpense.mockResolvedValue({ id: "i" })
    await materializeRecurring(key, "2026-06", [tmpl], [])
    expect(mockCreateExpense).toHaveBeenCalledTimes(1)
})
```
(이 스펙은 `.spec.ts`(node project)다. jest 가 `app/` 하위에서 픽업한다.)

- [ ] **Step 3: 테스트 실패 확인**

Run: `pnpm --filter @daeoebi/web test -- asset-recurring`
Expected: FAIL ("2026-05" 에서도 createExpense 호출됨 — 아직 경계 없음).

- [ ] **Step 4: asset-recurring.ts — 시작월 경계 추가**

템플릿 루프 시작에 가드 추가:
```ts
    for (const t of templates) {
        if (month < t.startMonth) continue // 시작월 이전 달엔 생성하지 않는다.
        if (present.has(`${t.id}|${month}`)) continue
        ...
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `pnpm --filter @daeoebi/web test -- asset-recurring`
Expected: PASS (2 케이스).

- [ ] **Step 6: 커밋**
```bash
git add apps/web/lib/vault-client.ts "apps/web/app/(vault)/asset/_lib/asset-recurring.ts" "apps/web/app/(vault)/asset/_lib/asset-recurring.spec.ts"
git commit -m "feat(web): 고정 client 타입(startMonth)·materialize 시작월 경계"
```

> 주의: Task 4 만으로는 `ExpenseForm` 이 아직 createRecurring 에 startMonth 를 안 보내 web typecheck 가 깨질 수 있다(필수 인자 누락). Task 5 와 함께 완성된다. web 최종 typecheck/build 통과는 Task 5 끝에서 확인.

---

### Task 5: 웹 — ExpenseForm 생성 startMonth + 해제/삭제 UI

**Files:**
- Modify: `apps/web/app/(vault)/asset/_components/ExpenseForm.tsx`

**Interfaces:**
- Consumes: `createRecurring({dayOfMonth, startMonth})`, `updateRecurring({active})`, `deleteRecurring(id)`, `deleteExpense(id)`, `updateExpense(id,{removed})`, `monthOf`(asset-dates).

- [ ] **Step 1: 생성 시 startMonth 전달**

`createRecurring` 호출(고정 ON 분기)에 startMonth 추가:
```ts
const tmpl = await createRecurring({
    dayOfMonth: Number(date.slice(8, 10)),
    startMonth: monthOf(date),
    ...tmplBlob,
})
```

- [ ] **Step 2: 삭제/해제 액션·핸들러 교체**

`updateRecurring`·`updateExpense` 를 import 에 추가:
```ts
import {
    createExpense,
    createRecurring,
    deleteExpense,
    deleteRecurring,
    updateExpense,
    updateRecurring,
} from "@/lib/vault-client"
```
삭제 상태를 두 모드로 + 해제 핸들러 추가. `pendingDelete` 를 다이얼로그 모드로 사용:
```ts
// 삭제 다이얼로그: null=닫힘, "menu"=선택, ...
const [deleteMenu, setDeleteMenu] = useState(false)
```
핸들러 3종(고정 해제 / 전체 삭제 / 이번 달만 삭제):
```ts
async function handleDeactivate() {
    if (!initial?.recurringId) return
    setBusy(true)
    try {
        await updateRecurring(initial.recurringId, { active: false })
        onDeleted()
    } catch (e) {
        setBusy(false)
        setError(isApiError(e) ? e.message : "해제에 실패했습니다.")
    }
}

async function handleDeleteAll() {
    if (!initial?.recurringId) return
    setBusy(true)
    try {
        await deleteRecurring(initial.recurringId) // FK Cascade 로 인스턴스까지 삭제
        onDeleted()
    } catch (e) {
        setBusy(false)
        setError(isApiError(e) ? e.message : "삭제에 실패했습니다.")
    }
}

async function handleDeleteThisMonth() {
    if (!initial) return
    setBusy(true)
    try {
        if (initial.recurringId) {
            await updateExpense(initial.id, { removed: true }) // 소프트 삭제(재생성 차단)
        } else {
            await deleteExpense(initial.id) // 일반 지출은 하드 삭제
        }
        onDeleted()
    } catch (e) {
        setBusy(false)
        setError(isApiError(e) ? e.message : "삭제에 실패했습니다.")
    }
}
```

- [ ] **Step 3: 액션 버튼·다이얼로그 렌더 교체**

기존 "삭제(수정만)" 블록과 기존 `ConfirmDialog`(pendingDelete) 를 다음으로 교체한다.
일반 지출: 단일 "삭제" 버튼(→ `deleteExpense`). 고정 지출: "고정 해제" + "삭제"(→ 선택 시트).
```tsx
{/* 액션(수정만) */}
{isEdit && (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {initial?.recurringId ? (
            <>
                <button type="button" className="btn secondary" onClick={handleDeactivate} disabled={busy}>
                    고정 해제(이후 자동 생성 중단)
                </button>
                <button type="button" className="btn danger" onClick={() => setDeleteMenu(true)} disabled={busy}>
                    삭제
                </button>
            </>
        ) : (
            <button type="button" className="btn danger" onClick={handleDeleteThisMonth} disabled={busy}>
                이 지출 삭제
            </button>
        )}
    </div>
)}
```
삭제 선택 다이얼로그(고정 지출용). 기존 `<ConfirmDialog .../>` 자리를 대체:
```tsx
{deleteMenu && (
    <div
        className="dialog-backdrop"
        role="dialog"
        aria-modal="true"
        aria-label="고정 지출 삭제"
        onClick={(e) => {
            if (e.target === e.currentTarget) setDeleteMenu(false)
        }}
    >
        <div className="sheet">
            <div className="sheet-grip" aria-hidden="true" />
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>고정 지출 삭제</div>
            <p className="muted" style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 16 }}>
                무엇을 삭제할지 선택하세요.
            </p>
            <button
                type="button"
                className="btn danger"
                style={{ width: "100%", marginBottom: 8 }}
                onClick={() => {
                    setDeleteMenu(false)
                    void handleDeleteAll()
                }}
                disabled={busy}
            >
                이 고정 전체 삭제(모든 달 기록 제거)
            </button>
            <button
                type="button"
                className="btn danger"
                style={{ width: "100%", marginBottom: 8 }}
                onClick={() => {
                    setDeleteMenu(false)
                    void handleDeleteThisMonth()
                }}
                disabled={busy}
            >
                이번 달만 삭제
            </button>
            <button
                type="button"
                className="btn secondary"
                style={{ width: "100%" }}
                onClick={() => setDeleteMenu(false)}
                disabled={busy}
            >
                취소
            </button>
        </div>
    </div>
)}
```
기존 `pendingDelete` state·`handleDelete` 함수·`ConfirmDialog` import 가 더 이상 안 쓰이면 제거한다(미사용 import/변수 = lint 실패). `ConfirmDialog` 가 이 파일에서 다른 데 안 쓰이면 import 삭제.

- [ ] **Step 4: web 전체 검증**

Run:
```
pnpm --filter @daeoebi/web typecheck \
  && pnpm --filter @daeoebi/web lint \
  && pnpm --filter @daeoebi/web test \
  && pnpm --filter @daeoebi/web build
```
Expected: 모두 통과. (미사용 `pendingDelete`/`handleDelete`/`ConfirmDialog` 잔재 없도록 정리.)

- [ ] **Step 5: 커밋**
```bash
git add "apps/web/app/(vault)/asset/_components/ExpenseForm.tsx"
git commit -m "feat(web): 고정 지출 생성 startMonth + 해제·삭제(전체/이번달) UI"
```

---

### Task 6: API e2e — 소프트 삭제 멱등 + Cascade

**Files:**
- Modify: `apps/api/test/auth-store.e2e-spec.ts`

- [ ] **Step 1: e2e 케이스 추가**

기존 harness(인증·CSRF·base64url 더미) 재사용. 두 흐름 추가:
```ts
// 소프트 삭제 멱등: removed 처리한 (recurringId, period) 로 재생성 POST → 409
const b64 = () => Buffer.from(Math.random().toString()).toString("base64url") // 기존 더미 규칙에 맞춤
const tmpl = await request(server).post("/api/recurring").set(headers)
    .send({ dayOfMonth: 10, startMonth: "2026-06", iv: b64(), ciphertext: b64(), authTag: b64() }).expect(201)
const inst = await request(server).post("/api/expenses").set(headers)
    .send({ date: "2026-06-10", recurringId: tmpl.body.id, period: "2026-06", iv: b64(), ciphertext: b64(), authTag: b64() }).expect(201)
// 이번 달만 삭제(소프트)
await request(server).patch(`/api/expenses/${inst.body.id}`).set(headers).send({ removed: true }).expect(200)
// 목록에서 제외
await request(server).get("/api/expenses?month=2026-06").set(headers).expect(200)
    .expect((r) => expect(r.body.find((e: { id: string }) => e.id === inst.body.id)).toBeUndefined())
// 재생성 POST → 409(슬롯 점유)
await request(server).post("/api/expenses").set(headers)
    .send({ date: "2026-06-10", recurringId: tmpl.body.id, period: "2026-06", iv: b64(), ciphertext: b64(), authTag: b64() }).expect(409)
// 전체 삭제(Cascade): 템플릿 삭제 시 인스턴스도 사라짐 — 다른 period 인스턴스로 확인
const inst2 = await request(server).post("/api/expenses").set(headers)
    .send({ date: "2026-07-10", recurringId: tmpl.body.id, period: "2026-07", iv: b64(), ciphertext: b64(), authTag: b64() }).expect(201)
await request(server).delete(`/api/recurring/${tmpl.body.id}`).set(headers).expect(204)
await request(server).get("/api/expenses?month=2026-07").set(headers).expect(200)
    .expect((r) => expect(r.body.find((e: { id: string }) => e.id === inst2.body.id)).toBeUndefined())
```
(경로 프리픽스 `/api`·헤더·base64url 더미는 기존 스펙 관례에 맞춘다.)

- [ ] **Step 2: e2e 실행**

Run: `pnpm --filter @daeoebi/api test:e2e`
Expected: PASS(추가 케이스 포함).

- [ ] **Step 3: 커밋**
```bash
git add apps/api/test
git commit -m "test(api): 고정 지출 소프트 삭제 멱등·Cascade e2e"
```

---

## 최종 검증 (전체)

- [ ] `make typecheck` · `make lint` · `make test` 통과.
- [ ] `make dev-up` 후 dev 우회 진입:
  - 6월 비카드 고정 생성 → 6월부터 보임, 5월엔 미생성.
  - 6월 카드 고정 생성 → 7월 화면 첫 등장(6월/이전 소급 없음).
  - 고정 해제 → 이후 자동 생성 중단, 기존 건 유지.
  - 삭제 → "이번 달만" → 새로고침·재진입에도 안 살아남.
  - 삭제 → "전체" → 모든 달 + 규칙 제거.

## 빌드 순서

모델(1) → API recurring(2)·expense(3) → 웹 client·materialize(4) → 웹 UI(5) → e2e(6). Task 4·5 는 web 빌드가 함께 통과하므로 web 최종 typecheck/build 는 Task 5 끝에서 확인.
