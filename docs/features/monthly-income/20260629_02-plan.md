# 월별·항목별 수입 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 수입을 싱글톤 단일값에서 월별·항목별·E2E 암호화 다건으로 바꾸고, 대시보드 바텀시트에서 추가·편집·삭제한다.

**Architecture:** `Income` 모델을 지출과 동일한 월 귀속(`month` 평문) + 암호문 블롭(`{item,amount,category}`) 다건으로 교체. API는 expense CRUD 패턴 미러. 웹은 그 달 수입을 복호화·합산해 `남은 돈`을 계산하고, 수입 카드 탭 시 시트에서 목록·폼으로 관리.

**Tech Stack:** NestJS 10 + Prisma + PostgreSQL(api), Next.js 15 App Router + React(web), WebCrypto(AES-256-GCM) E2E.

## Global Constraints

- 본문(금액·항목·카테고리)은 항상 클라이언트 E2E 암호문 — 서버는 복호화하지 않고 base64url 패스스루.
- 기존 마이그레이션 수정 금지, 신규 생성. `pnpm-lock.yaml` 수동 편집 금지. `.env.*` 읽기만.
- 커밋은 각 Task 끝에서. 커밋 메시지 끝: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- 모든 사용자 노출 문구는 한국어, 문장 종결은 마침표.
- `month` 평문 형식: `YYYY-MM` (`/^\d{4}-(0[1-9]|1[0-2])$/`).
- 수입 카테고리 고정 3종: 월급(`#2f9e6e`)·상여(`#3d7dd6`)·기타(`#98a0a8`). 미일치 폴백 `#98a0a8`.

---

### Task 1: Prisma 모델 — Income 싱글톤 → 월별 다건

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (model Income)
- Create: `apps/api/prisma/migrations/<timestamp>_income_monthly_entries/migration.sql` (prisma 생성 후 편집)

**Interfaces:**
- Produces: `Income { id(cuid), month(String), iv/ciphertext/authTag(Bytes), createdAt, updatedAt, @@index([month]) }`

- [ ] **Step 1: schema.prisma 의 model Income 교체**

기존:
```prisma
model Income {
  id         String   @id @default("singleton")
  iv         Bytes
  ciphertext Bytes
  authTag    Bytes
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}
```
변경:
```prisma
model Income {
  id         String   @id @default(cuid())
  month      String   // "YYYY-MM". 평문 — 월 범위 조회용.
  iv         Bytes
  ciphertext Bytes
  authTag    Bytes
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@index([month])
}
```

- [ ] **Step 2: 마이그레이션 생성(적용 보류)**

dev DB 가 떠 있어야 한다(`make dev-up` 또는 `docker compose -f docker-compose.dev.yml --env-file apps/api/.env.development up -d --wait`).
Run: `pnpm --filter @daeoebi/api exec prisma migrate dev --name income_monthly_entries --create-only`
Expected: `apps/api/prisma/migrations/<ts>_income_monthly_entries/migration.sql` 생성(아직 미적용).

- [ ] **Step 3: 생성된 migration.sql 맨 위에 기존 행 삭제 추가**

신규 `month` 컬럼은 NOT NULL 이라 기존 싱글톤 행이 있으면 적용이 실패한다. 구조 비호환 데이터이므로 폐기한다. migration.sql 최상단에 다음을 추가:
```sql
-- 싱글톤 수입은 구조(month 없음, 블롭 {amount})가 비호환이라 폐기한다.
DELETE FROM "Income";
```
(이어서 prisma 가 생성한 ALTER/CREATE INDEX 문이 온다. `id` 기본값 변경은 새 행에만 영향.)

- [ ] **Step 4: 마이그레이션 적용**

Run: `pnpm --filter @daeoebi/api exec prisma migrate dev`
Expected: `income_monthly_entries` 적용 완료, Prisma Client 재생성.

- [ ] **Step 5: 커밋**
```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations
git commit -m "feat(api): Income 모델을 월별 다건으로 변경 (싱글톤 폐기)"
```

---

### Task 2: API — income CRUD (DTO·서비스·컨트롤러·에러코드·테스트)

**Files:**
- Modify: `apps/api/src/asset/dto/income.dto.ts`
- Modify: `apps/api/src/asset/income.service.ts`
- Modify: `apps/api/src/asset/income.controller.ts`
- Modify: `apps/api/src/asset/asset.types.ts`
- Modify: `apps/api/src/asset/income.service.spec.ts`

**Interfaces:**
- Consumes: `ASSET_ERRORS`(asset.types), `fromBase64url`/`toBase64url`(common/base64url), `IsBase64url`(common/base64url).
- Produces: `GET /income?month=`, `POST /income {month,iv,ciphertext,authTag}`, `PATCH /income/:id {iv?,ciphertext?,authTag?}`, `DELETE /income/:id`. View: `{ id, month, iv, ciphertext, authTag }`.

- [ ] **Step 1: 에러코드 추가 — asset.types.ts**
```ts
// 자산(가계부) 도메인 에러 코드.
export const ASSET_ERRORS = {
    EXPENSE_NOT_FOUND: "EXPENSE_NOT_FOUND",
    EXPENSE_DUPLICATE: "EXPENSE_DUPLICATE",
    RECURRING_NOT_FOUND: "RECURRING_NOT_FOUND",
    CIPHERTEXT_INCOMPLETE_ASSET: "CIPHERTEXT_INCOMPLETE_ASSET",
    INVALID_MONTH: "INVALID_MONTH",
    INCOME_NOT_FOUND: "INCOME_NOT_FOUND",
} as const
```

- [ ] **Step 2: income.dto.ts 교체**
```ts
// 월 수입(Income) 생성·수정 DTO. 본문은 클라이언트 E2E 암호문 블롭({item,amount,category}).
// month 는 평문(월 범위 조회 귀속 키)이다.
import { IsBase64url } from "../../common/base64url"
import { IsOptional, Matches } from "class-validator"

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/

export class CreateIncomeDto {
    @Matches(MONTH_RE, { message: "month 는 YYYY-MM 형식이어야 합니다." })
    month!: string

    @IsBase64url() iv!: string
    @IsBase64url() ciphertext!: string
    @IsBase64url() authTag!: string
}

export class UpdateIncomeDto {
    // 본문 갱신 시 세 필드를 함께 보낸다(부분 암호문 불허).
    @IsOptional() @IsBase64url() iv?: string
    @IsOptional() @IsBase64url() ciphertext?: string
    @IsOptional() @IsBase64url() authTag?: string
}
```

- [ ] **Step 3: 실패하는 서비스 테스트 작성 — income.service.spec.ts 교체**
```ts
// IncomeService 단위 테스트(Prisma 모킹). 월 조회 필터·생성/수정/삭제·base64url 패스스루를 검증한다.
import { IncomeService } from "./income.service"
import { toBase64url } from "../common/base64url"

function makePrisma() {
    return {
        income: {
            findMany: jest.fn(),
            findUnique: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
        },
    }
}
function makeService(prisma: ReturnType<typeof makePrisma>) {
    return new IncomeService(prisma as unknown as never)
}

const IV = Buffer.alloc(12, 1)
const CT = Buffer.alloc(48, 2)
const TAG = Buffer.alloc(16, 3)
const B = {
    iv: IV.toString("base64url"),
    ciphertext: CT.toString("base64url"),
    authTag: TAG.toString("base64url"),
}

describe("IncomeService", () => {
    it("listByMonth 는 그 달만 조회해 블롭을 base64url 로 반환한다", async () => {
        const prisma = makePrisma()
        prisma.income.findMany.mockResolvedValue([
            { id: "i1", month: "2026-06", iv: IV, ciphertext: CT, authTag: TAG },
        ])
        const out = await makeService(prisma).listByMonth("2026-06")
        expect(prisma.income.findMany.mock.calls[0][0]).toMatchObject({
            where: { month: "2026-06" },
        })
        expect(out[0]).toMatchObject({
            id: "i1",
            month: "2026-06",
            iv: toBase64url(IV),
        })
    })

    it("listByMonth 는 잘못된 month 형식을 거부한다", async () => {
        const prisma = makePrisma()
        await expect(makeService(prisma).listByMonth("2026/6")).rejects.toThrow()
    })

    it("create 는 month 와 디코드한 바이트를 저장한다", async () => {
        const prisma = makePrisma()
        prisma.income.create.mockResolvedValue({
            id: "i9", month: "2026-06", iv: IV, ciphertext: CT, authTag: TAG,
        })
        await makeService(prisma).create({ month: "2026-06", ...B } as never)
        const arg = prisma.income.create.mock.calls[0][0]
        expect(arg.data.month).toBe("2026-06")
        expect(Buffer.from(arg.data.iv)).toEqual(IV)
    })

    it("remove 는 없는 id 면 NotFound 를 던진다", async () => {
        const prisma = makePrisma()
        prisma.income.findUnique.mockResolvedValue(null)
        await expect(makeService(prisma).remove("nope")).rejects.toThrow()
    })
})
```

- [ ] **Step 4: 테스트 실패 확인**

Run: `pnpm --filter @daeoebi/api test:unit -- income.service`
Expected: FAIL (서비스가 아직 listByMonth/create/remove 미구현).

- [ ] **Step 5: income.service.ts 교체**
```ts
// 월 수입(Income) CRUD. 본문은 클라이언트 E2E 암호문이라 서버는 복호화 없이 패스스루한다.
// month 만 평문 메타로 다룬다(월 범위 조회 귀속).
import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from "@nestjs/common"
import { PrismaService } from "../prisma/prisma.service"
import { fromBase64url, toBase64url } from "../common/base64url"
import { CreateIncomeDto, UpdateIncomeDto } from "./dto/income.dto"
import { ASSET_ERRORS } from "./asset.types"

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/

function prismaBytes(value: Uint8Array): Uint8Array<ArrayBuffer> {
    return new Uint8Array(value)
}

interface IncomeRow {
    id: string
    month: string
    iv: Uint8Array
    ciphertext: Uint8Array
    authTag: Uint8Array
}

function toView(row: IncomeRow) {
    return {
        id: row.id,
        month: row.month,
        iv: toBase64url(row.iv),
        ciphertext: toBase64url(row.ciphertext),
        authTag: toBase64url(row.authTag),
    }
}

@Injectable()
export class IncomeService {
    constructor(private readonly prisma: PrismaService) {}

    async listByMonth(month: string) {
        if (!MONTH_RE.test(month)) {
            throw new BadRequestException({
                code: ASSET_ERRORS.INVALID_MONTH,
                message: "month 는 YYYY-MM 형식이어야 합니다.",
            })
        }
        const rows = await this.prisma.income.findMany({
            where: { month },
            orderBy: { createdAt: "asc" },
        })
        return rows.map(toView)
    }

    async create(dto: CreateIncomeDto) {
        const row = await this.prisma.income.create({
            data: {
                month: dto.month,
                iv: prismaBytes(fromBase64url(dto.iv)),
                ciphertext: prismaBytes(fromBase64url(dto.ciphertext)),
                authTag: prismaBytes(fromBase64url(dto.authTag)),
            },
        })
        return toView(row)
    }

    async update(id: string, dto: UpdateIncomeDto) {
        const found = await this.prisma.income.findUnique({
            where: { id },
            select: { id: true },
        })
        if (!found) throw this.notFound()

        const hasIv = dto.iv !== undefined
        const hasCt = dto.ciphertext !== undefined
        const hasTag = dto.authTag !== undefined
        if (!hasIv || !hasCt || !hasTag) {
            throw new BadRequestException({
                code: ASSET_ERRORS.CIPHERTEXT_INCOMPLETE_ASSET,
                message: "암호문은 iv·ciphertext·authTag 를 모두 보내야 합니다.",
            })
        }
        const row = await this.prisma.income.update({
            where: { id },
            data: {
                iv: prismaBytes(fromBase64url(dto.iv as string)),
                ciphertext: prismaBytes(fromBase64url(dto.ciphertext as string)),
                authTag: prismaBytes(fromBase64url(dto.authTag as string)),
            },
        })
        return toView(row)
    }

    async remove(id: string): Promise<void> {
        const found = await this.prisma.income.findUnique({
            where: { id },
            select: { id: true },
        })
        if (!found) throw this.notFound()
        await this.prisma.income.delete({ where: { id } })
    }

    private notFound(): NotFoundException {
        return new NotFoundException({
            code: ASSET_ERRORS.INCOME_NOT_FOUND,
            message: "수입을 찾을 수 없습니다.",
        })
    }
}
```

- [ ] **Step 6: income.controller.ts 교체**
```ts
// 월 수입(Income) CRUD 엔드포인트. 전역 세션 가드로 보호된다. 본문은 클라이언트 E2E 암호문 패스스루.
import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    Param,
    Patch,
    Post,
    Query,
} from "@nestjs/common"
import { IncomeService } from "./income.service"
import { CreateIncomeDto, UpdateIncomeDto } from "./dto/income.dto"

@Controller("income")
export class IncomeController {
    constructor(private readonly service: IncomeService) {}

    @Get()
    list(@Query("month") month: string) {
        return this.service.listByMonth(month)
    }

    @Post()
    @HttpCode(201)
    create(@Body() dto: CreateIncomeDto) {
        return this.service.create(dto)
    }

    @Patch(":id")
    update(@Param("id") id: string, @Body() dto: UpdateIncomeDto) {
        return this.service.update(id, dto)
    }

    @Delete(":id")
    @HttpCode(204)
    async remove(@Param("id") id: string): Promise<void> {
        await this.service.remove(id)
    }
}
```
(`asset.module.ts` 의 `IncomeController` 등록·CSRF `forRoutes` 는 클래스명이 같아 변경 불필요.)

- [ ] **Step 7: 테스트 통과 확인**

Run: `pnpm --filter @daeoebi/api test:unit -- income.service`
Expected: PASS (4 케이스).

- [ ] **Step 8: 전체 api 단위 + typecheck**

Run: `pnpm --filter @daeoebi/api test:unit && pnpm --filter @daeoebi/api typecheck`
Expected: PASS. (실패 시 income 관련 import 잔재 확인.)

- [ ] **Step 9: 커밋**
```bash
git add apps/api/src/asset
git commit -m "feat(api): 월 수입 CRUD 엔드포인트 (싱글톤 GET/PUT 대체)"
```

---

### Task 3: 웹 공통 — client·payload·categories·compute + 단위 테스트

**Files:**
- Modify: `apps/web/lib/vault-client.ts` (income 섹션)
- Modify: `apps/web/app/(vault)/asset/_lib/asset-payload.ts`
- Modify: `apps/web/app/(vault)/asset/_lib/asset-categories.ts`
- Modify: `apps/web/app/(vault)/asset/_lib/asset-compute.ts`
- Modify: `apps/web/app/(vault)/asset/_lib/asset-payload.spec.ts`
- Modify: `apps/web/app/(vault)/asset/_lib/asset-compute.spec.ts`

**Interfaces:**
- Produces:
  - client: `IncomeView { id, month, iv, ciphertext, authTag }`, `listIncomes(month): Promise<IncomeView[]>`, `createIncome({month}&SealedBlobDto): Promise<IncomeView>`, `updateIncome(id, SealedBlobDto): Promise<IncomeView>`, `deleteIncome(id): Promise<void>`.
  - payload: `IncomePayload { item, amount, category }`, `sealIncome`, `openIncome`.
  - categories: `INCOME_CATEGORIES: AssetCategory[]`, `incomeCategoryColor(key): string`.
  - compute: `ComputedIncome { id, month, item, amount, category }`, `totalIncome(items): number`.

- [ ] **Step 1: vault-client.ts — income 섹션 교체**

`IncomeView` 인터페이스를 교체하고, `getIncome`/`putIncome` 두 함수를 아래 4개로 대체한다.
```ts
export interface IncomeView extends SealedBlobDto {
    id: string
    month: string
}

export async function listIncomes(month: string): Promise<IncomeView[]> {
    const { data } = await vaultClient.get<IncomeView[]>("/income", {
        params: { month },
    })
    return data
}

export interface CreateIncomeInput extends SealedBlobDto {
    month: string
}

export async function createIncome(
    input: CreateIncomeInput,
): Promise<IncomeView> {
    const { data } = await vaultClient.post<IncomeView>("/income", input)
    return data
}

export async function updateIncome(
    id: string,
    blob: SealedBlobDto,
): Promise<IncomeView> {
    const { data } = await vaultClient.patch<IncomeView>(`/income/${id}`, blob)
    return data
}

export async function deleteIncome(id: string): Promise<void> {
    await vaultClient.delete(`/income/${id}`)
}
```

- [ ] **Step 2: asset-payload.ts — IncomePayload 확장**

`IncomePayload`·`sealIncome`·`openIncome` 을 교체(나머지 expense 부분은 그대로):
```ts
export interface IncomePayload {
    item: string
    amount: number
    category: string
}

export async function sealIncome(
    vaultKey: CryptoKey,
    payload: IncomePayload,
): Promise<SealedBlob> {
    return seal(vaultKey, JSON.stringify({ v: PAYLOAD_VERSION, ...payload }))
}

export async function openIncome(
    vaultKey: CryptoKey,
    blob: SealedBlob,
): Promise<IncomePayload> {
    const parsed = JSON.parse(
        await open(vaultKey, blob),
    ) as Partial<IncomePayload>
    return {
        item: String(parsed.item ?? ""),
        amount: typeof parsed.amount === "number" ? parsed.amount : 0,
        category: String(parsed.category ?? "기타"),
    }
}
```

- [ ] **Step 3: asset-categories.ts — 수입 카테고리 추가**

파일 끝(또는 `categoryColor` 아래)에 추가:
```ts
// 수입 고정 카테고리 3종. key 는 암호문 블롭에 저장된다.
export const INCOME_CATEGORIES: AssetCategory[] = [
    { key: "월급", color: "#2f9e6e" },
    { key: "상여", color: "#3d7dd6" },
    { key: "기타", color: "#98a0a8" },
]

export function incomeCategoryColor(key: string): string {
    return INCOME_CATEGORIES.find((c) => c.key === key)?.color ?? FALLBACK_COLOR
}
```

- [ ] **Step 4: asset-compute.ts — ComputedIncome·totalIncome 추가**

파일 끝에 추가:
```ts
// 복호화된 수입 1건(메타 + 본문).
export interface ComputedIncome {
    id: string
    month: string // "YYYY-MM"
    item: string
    amount: number
    category: string
}

export function totalIncome(items: ComputedIncome[]): number {
    return items.reduce((sum, e) => sum + e.amount, 0)
}
```

- [ ] **Step 5: 실패하는 단위 테스트 작성 — asset-payload.spec.ts 에 수입 라운드트립 추가**

`asset-payload.spec.ts` 에 케이스 추가(기존 expense 케이스 옆):
```ts
import { sealIncome, openIncome } from "./asset-payload"
// ... 기존 vaultKey 픽스처 재사용 ...

it("수입 블롭을 seal→open 라운드트립한다", async () => {
    const key = await testKey() // 기존 스펙의 키 생성 헬퍼 사용
    const blob = await sealIncome(key, { item: "6월 월급", amount: 3200000, category: "월급" })
    await expect(openIncome(key, blob)).resolves.toEqual({
        item: "6월 월급",
        amount: 3200000,
        category: "월급",
    })
})
```
(기존 스펙의 키 생성 방식이 다르면 그 헬퍼 이름으로 맞춘다.)

- [ ] **Step 6: 실패하는 단위 테스트 작성 — asset-compute.spec.ts 에 totalIncome 추가**
```ts
import { totalIncome, type ComputedIncome } from "./asset-compute"

it("totalIncome 은 수입 금액을 합산한다", () => {
    const items: ComputedIncome[] = [
        { id: "a", month: "2026-06", item: "월급", amount: 3000000, category: "월급" },
        { id: "b", month: "2026-06", item: "상여", amount: 500000, category: "상여" },
    ]
    expect(totalIncome(items)).toBe(3500000)
})
```

- [ ] **Step 7: 테스트 실패 확인**

Run: `pnpm --filter @daeoebi/web test -- asset-payload asset-compute`
Expected: FAIL (sealIncome 시그니처/totalIncome 미존재).

- [ ] **Step 8: Step 1~4 구현 적용 후 테스트 통과 확인**

Run: `pnpm --filter @daeoebi/web test -- asset-payload asset-compute`
Expected: PASS.

- [ ] **Step 9: vault-client 계약 테스트(선택) + typecheck**

기존 `vault-client-search.spec.ts` 패턴(axios 모킹)을 따라 `listIncomes`/`createIncome` 의 경로·params 를 검증하는 케이스를 `asset/_lib/` 또는 기존 스펙에 추가해도 좋다(필수 아님). 이후:
Run: `pnpm --filter @daeoebi/web typecheck`
Expected: PASS. (`getIncome`/`putIncome` 잔재 import 가 있으면 Task 4 에서 정리되므로, 이 단계 typecheck 는 Task 4 완료 후 최종 통과를 기대해도 된다 — 단독으로 깨지면 page.tsx 의 import 를 먼저 보라.)

- [ ] **Step 10: 커밋**
```bash
git add apps/web/lib/vault-client.ts "apps/web/app/(vault)/asset/_lib"
git commit -m "feat(web): 월 수입 client·payload·카테고리·집계 추가"
```

> 주의: Task 3 만으로는 `asset/page.tsx`·`IncomeSheet` 가 아직 옛 `getIncome`/`putIncome`/`{amount}` 를 참조해 web typecheck/build 가 깨질 수 있다. Task 4 와 함께 완성된다. 커밋 단위는 유지하되 **web typecheck/build 의 최종 통과는 Task 4 끝에서 확인**한다.

---

### Task 4: 대시보드 로드 + 수입 관리 시트 UI (A안)

**Files:**
- Modify: `apps/web/app/(vault)/asset/page.tsx` (load·Loaded·시트 연결)
- Modify: `apps/web/app/(vault)/asset/_components/dashboard/AssetDashboard.tsx` (`Loaded` 에 incomes)
- Modify: `apps/web/app/(vault)/asset/_components/dashboard/IncomeExpenseCards.tsx` (건수 표시)
- Create: `apps/web/app/(vault)/asset/_components/income/IncomeSheet.tsx`
- Create: `apps/web/app/(vault)/asset/_components/income/IncomeRow.tsx`
- Create: `apps/web/app/(vault)/asset/_components/income/IncomeEntryForm.tsx`
- Delete: `apps/web/app/(vault)/asset/_components/IncomeSheet.tsx` (구 단일 입력 시트)

**Interfaces:**
- Consumes: `listIncomes/createIncome/updateIncome/deleteIncome`(vault-client), `sealIncome/openIncome`(asset-payload), `INCOME_CATEGORIES/incomeCategoryColor/formatWon/formatAmount`(asset-categories), `ComputedIncome/totalIncome`(asset-compute), `useVault`(vault-context).
- Produces: `Loaded { incomeAmount, incomes: ComputedIncome[], expenses: ComputedExpense[] }`.

- [ ] **Step 1: AssetDashboard.tsx — Loaded 에 incomes 추가**

`Loaded` 인터페이스를 확장(기존 `incomeAmount`·`expenses` 유지):
```ts
export interface Loaded {
    incomeAmount: number
    incomes: ComputedIncome[]
    expenses: ComputedExpense[]
}
```
`import` 에 `type ComputedIncome` 추가(`./../../_lib/asset-compute` 경로는 기존 ComputedExpense import 와 동일 모듈).

- [ ] **Step 2: IncomeExpenseCards.tsx — 수입 건수 표시**

`Props` 에 `incomeCount: number` 추가하고, 수입 카드의 "수정 ›" 위/아래에 건수 표기를 추가한다. 핵심 변경:
```tsx
interface Props {
    income: number
    incomeCount: number
    spent: number
    count: number
    onOpenIncome: () => void
}
```
수입 카드 내부, 값 아래 부가표시를 지출 카드의 "{count}건" 과 동일 스타일로:
```tsx
<div style={{ fontSize: 11, color: "var(--ac)", fontWeight: 700, marginTop: 5 }}>
    {income ? `${incomeCount}건 · 수정 ›` : "수정 ›"}
</div>
```

- [ ] **Step 3: 구 IncomeSheet 제거 + 신규 income/ 컴포넌트 생성**

구 단일 입력 시트를 지운다:
```bash
git rm "apps/web/app/(vault)/asset/_components/IncomeSheet.tsx"
```

`IncomeRow.tsx`(목록 한 행, 표현 컴포넌트):
```tsx
"use client"
// 수입 관리 시트의 한 행. 카테고리 색 점·카테고리·항목명·금액 + 편집/삭제.
import { incomeCategoryColor, formatWon } from "../../_lib/asset-categories"
import type { ComputedIncome } from "../../_lib/asset-compute"

interface Props {
    income: ComputedIncome
    onEdit: () => void
    onDelete: () => void
}

export function IncomeRow({ income, onEdit, onDelete }: Props) {
    return (
        <div className="entry-card" style={{ display: "flex", alignItems: "center", gap: 13 }}>
            <button
                type="button"
                onClick={onEdit}
                aria-label={`${income.item || income.category} 편집`}
                style={{ display: "flex", alignItems: "center", gap: 13, flex: 1, minWidth: 0, background: "none", border: "none", font: "inherit", textAlign: "left", cursor: "pointer", padding: 0 }}
            >
                <span className="avatar" aria-hidden="true" style={{ background: incomeCategoryColor(income.category) }}>
                    {income.category.slice(0, 1)}
                </span>
                <span className="entry-main" style={{ minWidth: 0 }}>
                    <span className="entry-label">{income.item || income.category}</span>
                    <span style={{ fontSize: 12, color: "var(--color-text-muted)", fontWeight: 500 }}>
                        {income.category}
                    </span>
                </span>
                <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: "-0.02em" }}>
                    {formatWon(income.amount)}
                </span>
            </button>
            <button
                type="button"
                className="secret-btn"
                style={{ color: "#d99" }}
                onClick={onDelete}
                aria-label={`${income.item || income.category} 삭제`}
            >
                ✕
            </button>
        </div>
    )
}
```

`IncomeEntryForm.tsx`(추가·편집 폼, 표현 + 로컬 입력 상태):
```tsx
"use client"
// 수입 추가·편집 인라인 폼. 금액·항목명·카테고리 칩. 저장/암호화는 상위(IncomeSheet)가 처리한다.
import { useState } from "react"
import { INCOME_CATEGORIES, formatAmount } from "../../_lib/asset-categories"

export interface IncomeDraft {
    item: string
    amount: number
    category: string
}

interface Props {
    initial?: IncomeDraft
    saving: boolean
    onSubmit: (draft: IncomeDraft) => void
    onCancel: () => void
    onActivity: () => void // resetIdle
}

export function IncomeEntryForm({ initial, saving, onSubmit, onCancel, onActivity }: Props) {
    const [amount, setAmount] = useState(initial ? String(initial.amount) : "")
    const [item, setItem] = useState(initial?.item ?? "")
    const [category, setCategory] = useState(initial?.category ?? INCOME_CATEGORIES[0].key)

    function submit() {
        onActivity()
        onSubmit({
            item: item.trim(),
            amount: Number(amount.replace(/[^\d]/g, "") || "0"),
            category,
        })
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 4 }}>
            <div className="income-input">
                <span aria-hidden="true">₩</span>
                <input
                    inputMode="numeric"
                    value={amount ? formatAmount(Number(amount.replace(/[^\d]/g, "") || "0")) : ""}
                    onChange={(e) => { onActivity(); setAmount(e.target.value.replace(/[^\d]/g, "").slice(0, 12)) }}
                    placeholder="0"
                    aria-label="수입 금액"
                />
            </div>
            <input
                className="field-control"
                placeholder="항목명 (예: 6월 월급)"
                value={item}
                onChange={(e) => { onActivity(); setItem(e.target.value) }}
                maxLength={128}
                autoComplete="off"
            />
            <div className="scr" style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}>
                {INCOME_CATEGORIES.map((c) => (
                    <button
                        key={c.key}
                        type="button"
                        className="chip"
                        aria-pressed={category === c.key}
                        style={category === c.key ? { borderColor: c.color, color: c.color, fontWeight: 700 } : undefined}
                        onClick={() => { onActivity(); setCategory(c.key) }}
                    >
                        {c.key}
                    </button>
                ))}
            </div>
            <div style={{ display: "flex", gap: 9 }}>
                <button type="button" className="btn secondary" style={{ flex: 1 }} onClick={onCancel} disabled={saving}>
                    취소
                </button>
                <button type="button" className="btn" style={{ flex: 2 }} onClick={submit} disabled={saving}>
                    {saving ? "저장 중…" : "저장"}
                </button>
            </div>
        </div>
    )
}
```

`IncomeSheet.tsx`(조립: 목록 + 추가/편집 모드 토글, seal 후 API 호출):
```tsx
"use client"
// 월 수입 관리 바텀시트. 그 달 수입 목록 + 추가/편집/삭제. 금액·항목·카테고리는 VK 로 암호화 저장.
import { useState } from "react"
import { ConfirmDialog } from "@/components/ConfirmDialog"
import { useVault } from "../../_lib/vault-context"
import { createIncome, updateIncome, deleteIncome } from "@/lib/vault-client"
import { sealIncome } from "../../_lib/asset-payload"
import { formatWon } from "../../_lib/asset-categories"
import { totalIncome, type ComputedIncome } from "../../_lib/asset-compute"
import { IncomeRow } from "./IncomeRow"
import { IncomeEntryForm, type IncomeDraft } from "./IncomeEntryForm"

interface Props {
    month: string
    monthLabel: string
    incomes: ComputedIncome[]
    onChanged: () => void | Promise<void> // 대시보드 load 재호출
    onClose: () => void
}

type Mode = { kind: "list" } | { kind: "add" } | { kind: "edit"; target: ComputedIncome }

export function IncomeSheet({ month, monthLabel, incomes, onChanged, onClose }: Props) {
    const { vaultKey, resetIdle } = useVault()
    const [mode, setMode] = useState<Mode>({ kind: "list" })
    const [saving, setSaving] = useState(false)
    const [pendingDelete, setPendingDelete] = useState<ComputedIncome | null>(null)

    async function save(draft: IncomeDraft) {
        if (saving) return
        setSaving(true)
        try {
            const blob = await sealIncome(vaultKey, draft)
            if (mode.kind === "edit") {
                await updateIncome(mode.target.id, blob)
            } else {
                await createIncome({ month, ...blob })
            }
            setMode({ kind: "list" })
            await onChanged()
        } catch {
            // 실패 시 폼 유지(사용자 재시도).
        } finally {
            setSaving(false)
        }
    }

    async function confirmDelete() {
        if (!pendingDelete) return
        const target = pendingDelete
        setPendingDelete(null)
        try {
            await deleteIncome(target.id)
            await onChanged()
        } catch {
            // 무시(목록 그대로).
        }
    }

    return (
        <div
            className="dialog-backdrop"
            role="dialog"
            aria-modal="true"
            aria-label="월 수입 관리"
            onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
        >
            <div className="sheet">
                <div className="sheet-grip" aria-hidden="true" />
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4 }}>
                    <div style={{ fontSize: 18, fontWeight: 800 }}>월 수입</div>
                    <div style={{ fontSize: 12, color: "var(--color-text-muted)", fontWeight: 600 }}>{monthLabel}</div>
                </div>
                <p className="muted" style={{ fontSize: 13, marginBottom: 16 }}>
                    이 달 총수입 {formatWon(totalIncome(incomes))}
                </p>

                {mode.kind === "list" ? (
                    <>
                        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                            {incomes.length === 0 ? (
                                <div style={{ textAlign: "center", padding: "22px 0", fontSize: 13, color: "var(--color-text-muted)", fontWeight: 600 }}>
                                    이 달 수입이 없어요
                                </div>
                            ) : (
                                incomes.map((inc) => (
                                    <IncomeRow
                                        key={inc.id}
                                        income={inc}
                                        onEdit={() => { resetIdle(); setMode({ kind: "edit", target: inc }) }}
                                        onDelete={() => { resetIdle(); setPendingDelete(inc) }}
                                    />
                                ))
                            )}
                        </div>
                        <button
                            type="button"
                            className="btn"
                            style={{ width: "100%", marginTop: 16 }}
                            onClick={() => { resetIdle(); setMode({ kind: "add" }) }}
                        >
                            + 수입 추가
                        </button>
                    </>
                ) : (
                    <IncomeEntryForm
                        initial={mode.kind === "edit" ? { item: mode.target.item, amount: mode.target.amount, category: mode.target.category } : undefined}
                        saving={saving}
                        onSubmit={save}
                        onCancel={() => { resetIdle(); setMode({ kind: "list" }) }}
                        onActivity={resetIdle}
                    />
                )}
            </div>

            {pendingDelete && (
                <ConfirmDialog
                    open
                    title="수입 삭제"
                    message={`'${pendingDelete.item || pendingDelete.category}' 수입을 삭제할까요?`}
                    confirmLabel="삭제"
                    destructive
                    onConfirm={confirmDelete}
                    onCancel={() => setPendingDelete(null)}
                />
            )}
        </div>
    )
}
```
> `ConfirmDialog` props(`components/ConfirmDialog.tsx` 확인): `open: boolean`(필수), `title?`, `message`, `confirmLabel?`, `cancelLabel?`, `destructive?`, `onConfirm`, `onCancel`. 위처럼 `open`·`destructive` 를 명시한다.

- [ ] **Step 4: asset/page.tsx — 로드·시트 연결 교체**

import 교체: `getIncome, openIncome, sealIncome` 사용처를 정리하고 다음으로 바꾼다.
```tsx
import { listExpenses, listRecurring, listIncomes, type ExpenseView, type IncomeView } from "@/lib/vault-client"
import { openExpense, openIncome } from "./_lib/asset-payload"
import { byDay, totalIncome, type ComputedExpense, type ComputedIncome } from "./_lib/asset-compute"
import { monthLabel } from "./_lib/asset-dates" // 이미 import 중이면 유지
import { IncomeSheet } from "./_components/income/IncomeSheet"
```
(구 `IncomeSheet`·`getIncome`·`sealIncome` import 제거. `putIncome`/`getIncome` 더 이상 사용 안 함.)

`load()` 의 income 처리 교체(기존 `getIncome()` + `openIncome` 단건 부분 대체):
```tsx
const [incomeViews, expensesView, templates] = await Promise.all([
    listIncomes(month),
    listExpenses(month),
    listRecurring(),
])
// 고정 지출 머티리얼라이즈(기존 그대로)
const created = await materializeRecurring(vaultKey, month, templates, expensesView)
const allViews: ExpenseView[] = [...expensesView, ...created]

// 수입 복호화(실패분 스킵) → 합계
const incomeSettled = await Promise.allSettled(
    incomeViews.map(async (v: IncomeView): Promise<ComputedIncome> => {
        const p = await openIncome(vaultKey, v)
        return { id: v.id, month: v.month, item: p.item, amount: p.amount, category: p.category }
    }),
)
const incomes = incomeSettled
    .filter((r): r is PromiseFulfilledResult<ComputedIncome> => r.status === "fulfilled")
    .map((r) => r.value)
const incomeAmount = totalIncome(incomes)

// 지출 복호화(기존 그대로) → expenses
// ... 기존 expense Promise.allSettled 로직 유지 ...

setState({ status: "ready", data: { incomeAmount, incomes, expenses } })
```
(`saveIncome` 함수와 `incomeDraft`/`savingIncome` state, 기존 단일 입력 시트 렌더는 제거한다. 시트 열림 상태 `sheetOpen` 은 유지.)

시트 렌더 교체(기존 `<IncomeSheet draft .../>` 부분):
```tsx
{sheetOpen && state.status === "ready" && (
    <IncomeSheet
        month={month}
        monthLabel={monthLabel(month)}
        incomes={state.data.incomes}
        onChanged={load}
        onClose={() => setSheetOpen(false)}
    />
)}
```
`onOpenIncome` 콜백은 단순히 `resetIdle(); setSheetOpen(true)` 로(기존 incomeDraft 세팅 제거).

`AssetDashboard` 에 넘기는 `IncomeExpenseCards` 용으로, `AssetDashboard` 내부에서 `incomeCount={data.incomes.length}` 를 전달하도록 Step 5 에서 연결.

- [ ] **Step 5: AssetDashboard.tsx — IncomeExpenseCards 에 건수 전달**

`<IncomeExpenseCards .../>` 호출에 `incomeCount={data.incomes.length}` 추가:
```tsx
<IncomeExpenseCards
    income={data.incomeAmount}
    incomeCount={data.incomes.length}
    spent={spent}
    count={data.expenses.length}
    onOpenIncome={onOpenIncome}
/>
```

- [ ] **Step 6: web typecheck·lint·test·build 통과 확인**

Run:
```
pnpm --filter @daeoebi/web typecheck \
  && pnpm --filter @daeoebi/web lint \
  && pnpm --filter @daeoebi/web test \
  && pnpm --filter @daeoebi/web build
```
Expected: 모두 통과. (실패 시 `getIncome`/`putIncome`/구 `IncomeSheet` 잔재 import 확인: `grep -rn "getIncome\|putIncome" apps/web`.)

- [ ] **Step 7: 커밋**
```bash
git add apps/web
git commit -m "feat(web): 수입 월별 관리 시트 (목록·추가·편집·삭제)"
```

---

### Task 5: API e2e — 수입 월 흐름

**Files:**
- Modify: `apps/api/test/auth-store.e2e-spec.ts` (기존 자산 e2e 스펙 — 인증·CSRF·base64url 더미 셋업 재사용)

- [ ] **Step 1: e2e 케이스 추가 — 수입 생성→조회→수정→삭제**

기존 자산 e2e 의 인증·CSRF 헤더 셋업을 재사용해 다음 흐름을 추가한다(블롭은 임의 base64url 더미):
```ts
const blob = { iv: "AAAA", ciphertext: "BBBB", authTag: "CCCC" } // 기존 스펙의 base64url 더미 규칙에 맞춤
// POST /income
const created = await request(server).post("/api/income").set(headers).send({ month: "2026-06", ...blob }).expect(201)
const id = created.body.id
// GET /income?month=2026-06 → 1건
const list = await request(server).get("/api/income?month=2026-06").set(headers).expect(200)
expect(list.body).toHaveLength(1)
// GET 다른 달 → 0건
await request(server).get("/api/income?month=2026-07").set(headers).expect(200).expect((r) => expect(r.body).toHaveLength(0))
// PATCH
await request(server).patch(`/api/income/${id}`).set(headers).send(blob).expect(200)
// DELETE
await request(server).delete(`/api/income/${id}`).set(headers).expect(204)
// month 형식 오류 → 400
await request(server).get("/api/income?month=2026/6").set(headers).expect(400)
```
(경로 프리픽스 `/api`·헤더·base64url 더미 규칙은 기존 스펙 관례에 맞춘다.)

- [ ] **Step 2: e2e 실행**

Run: `pnpm --filter @daeoebi/api test:e2e`
Expected: PASS(추가 케이스 포함).

- [ ] **Step 3: 커밋**
```bash
git add apps/api/test
git commit -m "test(api): 수입 월 CRUD e2e 추가"
```

---

## 최종 검증 (전체)

- [ ] `make typecheck` · `make lint` · `make test` 통과.
- [ ] `make dev-up` 후 dev 우회 진입(localhost:3010):
  - 수입 카드 탭 → 시트에서 월급·상여·기타 추가 → 총수입·남은 돈 갱신.
  - 항목 편집·삭제 반영.
  - 다른 달 이동 시 그 달 수입만 표시(월 귀속).
  - 새로고침 후 결정적 dev VK 로 복호화 정상.

## 빌드 순서

DB 모델(Task 1) → API CRUD(Task 2) → 웹 공통(Task 3) → 대시보드·시트 UI(Task 4) → e2e(Task 5). Task 3·4 는 web 빌드가 함께 통과하므로 연속 진행하고, web 최종 typecheck/build 는 Task 4 끝에서 확인한다.
