# 사용자 정의 지출 카테고리 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사용자가 지출 카테고리를 직접 추가·수정·삭제하고, 기존 지출은 자동으로 새 카테고리에 연결되도록 한다.

**Architecture:** 비밀번호 금고의 `Category` CRUD 패턴을 본떠 전역 `AssetCategory` 평문 테이블을 만들고, `Expense`/`RecurringExpense`에 `categoryId` FK(onDelete: SetNull)를 추가한다. 카테고리는 더 이상 암호화 블롭에 저장하지 않고 평문 FK로만 참조한다. 프론트는 카테고리 목록을 런타임 로드해 색/이름을 조인하고, 로그인 후 일회성 클라이언트 마이그레이션으로 기존 블롭의 카테고리 이름을 categoryId로 변환한다.

**Tech Stack:** NestJS + Prisma(PostgreSQL) 백엔드, Next.js(App Router) + WebCrypto 프론트, Jest 단위 테스트.

## Global Constraints

- 기존 prisma migration 파일 수정 금지 — 새 migration만 생성(`pnpm --filter @daeoebi/api prisma:migrate`).
- `.env.*` 조회·수정 금지. `rm` 사용 금지. `*install` 금지(동의 필요).
- 단일 금고(single-vault): `userId`/소유권 개념 없음. 자산 카테고리는 전역 스코프(부모 FK 없음).
- 카테고리 이름은 평문 저장(수용된 트레이드오프). 금액·항목은 암호화 블롭 유지.
- 카테고리 삭제 시 `onDelete: SetNull` → 지출은 "미분류"(categoryId=null).
- 색상은 고정 팔레트 값만 허용.
- 커밋은 각 Task 끝에서. 타입은 string literal union 선호, `any` 금지, 불변 패턴 유지.
- 검증 명령: 백엔드 `pnpm --filter @daeoebi/api test:unit`, 프론트 `pnpm --filter web test`, 타입 `... typecheck`/`tsc --noEmit`, 린트 `... lint`(--max-warnings 0).

> 패키지 이름 확인: `apps/api/package.json`의 `name` 필드를 보고 `--filter` 인자를 맞춘다(예: `@daeoebi/api`). 아래 명령의 필터 이름이 다르면 실제 name으로 치환한다.

---

## Phase 1 — 백엔드 데이터 모델

### Task 1: AssetCategory 모델 + categoryId FK + migration

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/<timestamp>_add_asset_category/migration.sql` (prisma가 생성)

**Interfaces:**
- Produces: Prisma 모델 `AssetCategory { id, name, color, createdAt, updatedAt }`, `Expense.categoryId`/`RecurringExpense.categoryId` (nullable, SetNull).

- [ ] **Step 1: schema.prisma 에 AssetCategory 모델 추가**

`Category` 모델(53–65줄) 아래, `Income`(67줄) 위에 새 모델을 삽입한다:

```prisma
// 자산(지출) 카테고리. 전역 평문(이름·색). 비밀번호 Category 패턴이되 부모(Site) 없음.
model AssetCategory {
  id        String   @id @default(cuid())
  name      String
  color     String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  expenses  Expense[]
  recurring RecurringExpense[]

  @@index([name])
}
```

- [ ] **Step 2: Expense 모델에 categoryId FK 추가**

`model Expense` 본문(현재 `iv Bytes` 위)에 추가:

```prisma
  categoryId  String?
  category    AssetCategory? @relation(fields: [categoryId], references: [id], onDelete: SetNull)
```

그리고 인덱스 블록에 추가:

```prisma
  @@index([categoryId])
```

- [ ] **Step 3: RecurringExpense 모델에 categoryId FK 추가**

`model RecurringExpense` 본문(`iv Bytes` 위)에 추가:

```prisma
  categoryId String?
  category   AssetCategory? @relation(fields: [categoryId], references: [id], onDelete: SetNull)
```

인덱스 블록에 추가:

```prisma
  @@index([categoryId])
```

- [ ] **Step 4: 마이그레이션 생성 및 적용**

Run: `pnpm --filter @daeoebi/api prisma:migrate -- --name add_asset_category`
Expected: 새 디렉토리 `migrations/<timestamp>_add_asset_category/migration.sql` 생성, `AssetCategory` 테이블 + `Expense.categoryId`/`RecurringExpense.categoryId` 컬럼 + FK + 인덱스 SQL 포함. 적용 성공.

> 로컬 DB가 떠 있어야 한다(`make dev-up` 등). DB 미가동이면 사용자에게 기동을 요청한다. 운영 DB에는 적용하지 않는다.

- [ ] **Step 5: Prisma Client 재생성 확인**

Run: `pnpm --filter @daeoebi/api prisma:generate`
Expected: 성공. `prisma.assetCategory`, `expense.categoryId` 타입 사용 가능.

- [ ] **Step 6: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations
git commit -m "feat(asset): AssetCategory 모델과 지출 categoryId FK 추가"
```

---

## Phase 2 — 백엔드 카테고리 CRUD

### Task 2: 에러코드 + DTO

**Files:**
- Modify: `apps/api/src/asset/asset.types.ts`
- Create: `apps/api/src/asset/dto/asset-category.dto.ts`

**Interfaces:**
- Produces: `ASSET_ERRORS.ASSET_CATEGORY_NOT_FOUND`; `CreateAssetCategoryDto { name: string; color: string }`, `UpdateAssetCategoryDto { name?: string; color?: string }`.

- [ ] **Step 1: 에러코드 추가**

`apps/api/src/asset/asset.types.ts`의 객체에 한 줄 추가:

```typescript
    ASSET_CATEGORY_NOT_FOUND: "ASSET_CATEGORY_NOT_FOUND",
```

- [ ] **Step 2: DTO 작성**

Create `apps/api/src/asset/dto/asset-category.dto.ts`:

```typescript
// 자산(지출) 카테고리 생성·수정 DTO. 이름·색은 평문. 색은 #rrggbb 형식.
import { IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator"

const HEX_RE = /^#[0-9a-fA-F]{6}$/

export class CreateAssetCategoryDto {
    @IsString()
    @MinLength(1)
    @MaxLength(100)
    name!: string

    @Matches(HEX_RE, { message: "color 는 #rrggbb 형식이어야 합니다." })
    color!: string
}

export class UpdateAssetCategoryDto {
    @IsOptional()
    @IsString()
    @MinLength(1)
    @MaxLength(100)
    name?: string

    @IsOptional()
    @Matches(HEX_RE, { message: "color 는 #rrggbb 형식이어야 합니다." })
    color?: string
}
```

- [ ] **Step 3: 타입 체크**

Run: `pnpm --filter @daeoebi/api typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/asset/asset.types.ts apps/api/src/asset/dto/asset-category.dto.ts
git commit -m "feat(asset): 카테고리 에러코드와 DTO 추가"
```

### Task 3: AssetCategoryService (시드 포함) + 단위 테스트

**Files:**
- Create: `apps/api/src/asset/asset-category.service.ts`
- Create: `apps/api/src/asset/asset-category.service.spec.ts`

**Interfaces:**
- Consumes: `CreateAssetCategoryDto`, `UpdateAssetCategoryDto`, `ASSET_ERRORS`, `PrismaService`.
- Produces: `AssetCategoryService` with `list()`, `create(dto)`, `update(id, dto)`, `remove(id)`. `list()`는 비어 있으면 기본 8종을 시드하고 반환.

- [ ] **Step 1: 실패하는 테스트 작성**

Create `apps/api/src/asset/asset-category.service.spec.ts`. 기존 `category.service.spec.ts` 스타일(PrismaService 목)을 따른다:

```typescript
import { NotFoundException } from "@nestjs/common"
import { AssetCategoryService } from "./asset-category.service"
import { ASSET_ERRORS } from "./asset.types"

function makePrisma() {
    return {
        assetCategory: {
            findMany: jest.fn(),
            createMany: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            findUnique: jest.fn(),
        },
    }
}

describe("AssetCategoryService", () => {
    it("목록이 비어 있으면 기본 카테고리를 시드한 뒤 반환한다", async () => {
        const prisma = makePrisma()
        const seeded = [{ id: "1", name: "식비", color: "#f2994a" }]
        prisma.assetCategory.findMany
            .mockResolvedValueOnce([]) // 첫 조회: 비어 있음
            .mockResolvedValueOnce(seeded) // 시드 후 재조회
        const svc = new AssetCategoryService(prisma as never)

        const result = await svc.list()

        expect(prisma.assetCategory.createMany).toHaveBeenCalledTimes(1)
        expect(result).toEqual(seeded)
    })

    it("목록이 있으면 시드하지 않는다", async () => {
        const prisma = makePrisma()
        prisma.assetCategory.findMany.mockResolvedValue([
            { id: "1", name: "식비", color: "#f2994a" },
        ])
        const svc = new AssetCategoryService(prisma as never)

        await svc.list()

        expect(prisma.assetCategory.createMany).not.toHaveBeenCalled()
    })

    it("create 는 이름·색으로 생성한다", async () => {
        const prisma = makePrisma()
        prisma.assetCategory.create.mockResolvedValue({ id: "9" })
        const svc = new AssetCategoryService(prisma as never)

        await svc.create({ name: "여행", color: "#3bb273" })

        expect(prisma.assetCategory.create).toHaveBeenCalledWith({
            data: { name: "여행", color: "#3bb273" },
        })
    })

    it("update 는 존재하지 않으면 404", async () => {
        const prisma = makePrisma()
        prisma.assetCategory.findUnique.mockResolvedValue(null)
        const svc = new AssetCategoryService(prisma as never)

        await expect(svc.update("x", { name: "a" })).rejects.toMatchObject({
            response: { code: ASSET_ERRORS.ASSET_CATEGORY_NOT_FOUND },
        })
    })

    it("remove 는 존재 확인 후 삭제한다", async () => {
        const prisma = makePrisma()
        prisma.assetCategory.findUnique.mockResolvedValue({ id: "1" })
        const svc = new AssetCategoryService(prisma as never)

        await svc.remove("1")

        expect(prisma.assetCategory.delete).toHaveBeenCalledWith({
            where: { id: "1" },
        })
    })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm --filter @daeoebi/api test:unit -- asset-category.service`
Expected: FAIL — `AssetCategoryService` 모듈 없음.

- [ ] **Step 3: 서비스 구현**

Create `apps/api/src/asset/asset-category.service.ts`:

```typescript
// 자산(지출) 카테고리 CRUD. 전역 평문. 목록이 비면 기본 8종을 시드한다.
import { Injectable, NotFoundException } from "@nestjs/common"
import { PrismaService } from "../prisma/prisma.service"
import {
    CreateAssetCategoryDto,
    UpdateAssetCategoryDto,
} from "./dto/asset-category.dto"
import { ASSET_ERRORS } from "./asset.types"

// 기존 디자인 고정 카테고리(asset-categories.ts 의 CATEGORIES 와 동일). 첫 사용 시 시드한다.
const DEFAULT_CATEGORIES: { name: string; color: string }[] = [
    { name: "식비", color: "#f2994a" },
    { name: "교통", color: "#4a90d9" },
    { name: "주거·공과금", color: "#9b6bd6" },
    { name: "쇼핑", color: "#e0689a" },
    { name: "문화", color: "#3bb273" },
    { name: "저축", color: "#14b8a6" },
    { name: "투자", color: "#eab308" },
    { name: "기타", color: "#98a0a8" },
]

@Injectable()
export class AssetCategoryService {
    constructor(private readonly prisma: PrismaService) {}

    async list() {
        const rows = await this.prisma.assetCategory.findMany({
            orderBy: { createdAt: "asc" },
        })
        if (rows.length > 0) return rows
        await this.prisma.assetCategory.createMany({ data: DEFAULT_CATEGORIES })
        return this.prisma.assetCategory.findMany({
            orderBy: { createdAt: "asc" },
        })
    }

    async create(dto: CreateAssetCategoryDto) {
        return this.prisma.assetCategory.create({
            data: { name: dto.name, color: dto.color },
        })
    }

    async update(id: string, dto: UpdateAssetCategoryDto) {
        await this.ensureExists(id)
        const data: { name?: string; color?: string } = {}
        if (dto.name !== undefined) data.name = dto.name
        if (dto.color !== undefined) data.color = dto.color
        return this.prisma.assetCategory.update({ where: { id }, data })
    }

    async remove(id: string): Promise<void> {
        await this.ensureExists(id)
        // 하위 Expense·RecurringExpense 는 FK SetNull 로 미분류가 된다.
        await this.prisma.assetCategory.delete({ where: { id } })
    }

    private async ensureExists(id: string): Promise<void> {
        const found = await this.prisma.assetCategory.findUnique({
            where: { id },
            select: { id: true },
        })
        if (!found) {
            throw new NotFoundException({
                code: ASSET_ERRORS.ASSET_CATEGORY_NOT_FOUND,
                message: "카테고리를 찾을 수 없습니다.",
            })
        }
    }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm --filter @daeoebi/api test:unit -- asset-category.service`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/asset/asset-category.service.ts apps/api/src/asset/asset-category.service.spec.ts
git commit -m "feat(asset): 카테고리 서비스(시드 포함) 구현"
```

### Task 4: AssetCategoryController + 모듈 등록

**Files:**
- Create: `apps/api/src/asset/asset-category.controller.ts`
- Modify: `apps/api/src/asset/asset.module.ts`

**Interfaces:**
- Consumes: `AssetCategoryService`, DTO들.
- Produces: 라우트 `GET/POST /asset-categories`, `PATCH/DELETE /asset-categories/:id`.

- [ ] **Step 1: 컨트롤러 작성**

Create `apps/api/src/asset/asset-category.controller.ts`:

```typescript
// 자산(지출) 카테고리 CRUD 엔드포인트. 전역 세션 가드 + CsrfMiddleware 로 보호된다.
import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    Param,
    Patch,
    Post,
} from "@nestjs/common"
import { AssetCategoryService } from "./asset-category.service"
import {
    CreateAssetCategoryDto,
    UpdateAssetCategoryDto,
} from "./dto/asset-category.dto"

@Controller("asset-categories")
export class AssetCategoryController {
    constructor(private readonly service: AssetCategoryService) {}

    @Get()
    list() {
        return this.service.list()
    }

    @Post()
    @HttpCode(201)
    create(@Body() dto: CreateAssetCategoryDto) {
        return this.service.create(dto)
    }

    @Patch(":id")
    update(@Param("id") id: string, @Body() dto: UpdateAssetCategoryDto) {
        return this.service.update(id, dto)
    }

    @Delete(":id")
    @HttpCode(204)
    async remove(@Param("id") id: string): Promise<void> {
        await this.service.remove(id)
    }
}
```

- [ ] **Step 2: 모듈에 등록**

Modify `apps/api/src/asset/asset.module.ts` — import 추가, controllers/providers 배열과 CsrfMiddleware forRoutes 에 추가:

```typescript
import { AssetCategoryController } from "./asset-category.controller"
import { AssetCategoryService } from "./asset-category.service"
```

`controllers`: `[IncomeController, ExpenseController, RecurringController, AssetCategoryController]`
`providers`: `[IncomeService, ExpenseService, RecurringService, AssetCategoryService]`
`forRoutes(...)`: `IncomeController, ExpenseController, RecurringController, AssetCategoryController`

- [ ] **Step 3: 타입체크 + 단위테스트**

Run: `pnpm --filter @daeoebi/api typecheck && pnpm --filter @daeoebi/api test:unit`
Expected: PASS.

- [ ] **Step 4: 라우트 수동 확인(선택)**

Run: API 기동 후 `curl -s localhost:<port>/asset-categories`(세션 쿠키 필요) 또는 e2e. 비어 있으면 기본 8종이 반환되는지 확인.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/asset/asset-category.controller.ts apps/api/src/asset/asset.module.ts
git commit -m "feat(asset): 카테고리 컨트롤러와 모듈 등록"
```

---

## Phase 3 — 백엔드 지출/고정 categoryId

### Task 5: Expense categoryId (DTO·서비스·뷰) + 테스트

**Files:**
- Modify: `apps/api/src/asset/dto/expense.dto.ts`
- Modify: `apps/api/src/asset/expense.service.ts`
- Modify: `apps/api/src/asset/expense.service.spec.ts`

**Interfaces:**
- Produces: `CreateExpenseDto.categoryId?`, `UpdateExpenseDto.categoryId?`; `toView` 결과에 `categoryId`.

- [ ] **Step 1: 실패 테스트 추가**

`expense.service.spec.ts`에 케이스 추가(기존 목 스타일 따름). create 가 categoryId 를 data 에 넣는지, toView 가 categoryId 를 반환하는지 검증:

```typescript
it("create 는 categoryId 를 저장하고 뷰에 포함한다", async () => {
    // Arrange: prisma.expense.create 가 categoryId 포함 row 를 반환하도록 목 구성
    //   (기존 테스트의 makePrisma/row 픽스처에 categoryId: "c1" 추가)
    // Act: service.create({ ...validDto, categoryId: "c1" })
    // Assert: create 호출 data.categoryId === "c1", 반환 view.categoryId === "c1"
})
```

> 실제 코드: 기존 spec의 픽스처 객체에 `categoryId: "c1"`을 더하고, create 목 반환 row 에 `categoryId: "c1"`을 추가한 뒤 `expect(view.categoryId).toBe("c1")`로 단언한다.

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm --filter @daeoebi/api test:unit -- expense.service`
Expected: FAIL — `categoryId` undefined.

- [ ] **Step 3: DTO 수정**

`dto/expense.dto.ts` — `CreateExpenseDto`와 `UpdateExpenseDto` 각각에 추가:

```typescript
    @IsOptional()
    @IsString()
    @MinLength(1)
    categoryId?: string
```

`CreateExpenseDto`는 이미 `IsString`/`MinLength`/`IsOptional` import 됨. 확인 후 누락 시 추가.

- [ ] **Step 4: 서비스 수정**

`expense.service.ts`:
- `ExpenseRow` 인터페이스에 `categoryId: string | null` 추가.
- `toView` 반환에 `categoryId: row.categoryId` 추가.
- `create`의 `data` 에 `categoryId: dto.categoryId ?? null` 추가.
- `update`의 data 구성에 분기 추가: `if (dto.categoryId !== undefined) data.categoryId = dto.categoryId`.

- [ ] **Step 5: 테스트·타입 통과 확인**

Run: `pnpm --filter @daeoebi/api test:unit -- expense.service && pnpm --filter @daeoebi/api typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/asset/dto/expense.dto.ts apps/api/src/asset/expense.service.ts apps/api/src/asset/expense.service.spec.ts
git commit -m "feat(asset): 지출에 categoryId 추가"
```

### Task 6: RecurringExpense categoryId + 테스트

**Files:**
- Modify: `apps/api/src/asset/dto/recurring.dto.ts`
- Modify: `apps/api/src/asset/recurring.service.ts`
- Modify: `apps/api/src/asset/recurring.service.spec.ts`

**Interfaces:**
- Produces: `CreateRecurringDto.categoryId?`, `UpdateRecurringDto.categoryId?`; `toView`에 `categoryId`.

- [ ] **Step 1: 실패 테스트 추가**

`recurring.service.spec.ts`에 create 가 categoryId 저장·반환하는지 케이스 추가(Task 5와 동형). 기존 픽스처에 `categoryId: "c1"` 더하고 단언.

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm --filter @daeoebi/api test:unit -- recurring.service`
Expected: FAIL.

- [ ] **Step 3: DTO 수정**

`dto/recurring.dto.ts` — `CreateRecurringDto`/`UpdateRecurringDto`에 추가(상단 import에 `IsString`, `MinLength` 없으면 추가):

```typescript
    @IsOptional()
    @IsString()
    @MinLength(1)
    categoryId?: string
```

- [ ] **Step 4: 서비스 수정**

`recurring.service.ts`:
- `RecurringRow`에 `categoryId: string | null` 추가.
- `toView`에 `categoryId: row.categoryId` 추가.
- `create`의 `data`에 `categoryId: dto.categoryId ?? null` 추가.
- `update`의 data 분기에 `if (dto.categoryId !== undefined) data.categoryId = dto.categoryId` 추가.

- [ ] **Step 5: 통과 확인**

Run: `pnpm --filter @daeoebi/api test:unit -- recurring.service && pnpm --filter @daeoebi/api typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/asset/dto/recurring.dto.ts apps/api/src/asset/recurring.service.ts apps/api/src/asset/recurring.service.spec.ts
git commit -m "feat(asset): 고정 지출에 categoryId 추가"
```

---

## Phase 4 — 프론트엔드 클라이언트 & 라이브러리

### Task 7: vault-client 자산 카테고리 함수 + categoryId 필드

**Files:**
- Modify: `apps/web/lib/vault-client.ts`

**Interfaces:**
- Produces:
  - `interface AssetCategory { id: string; name: string; color: string; createdAt: string; updatedAt: string }`
  - `listAssetCategories(): Promise<AssetCategory[]>`
  - `createAssetCategory(name: string, color: string): Promise<AssetCategory>`
  - `updateAssetCategory(id: string, patch: { name?: string; color?: string }): Promise<AssetCategory>`
  - `deleteAssetCategory(id: string): Promise<void>`
  - `ExpenseView.categoryId: string | null`, `CreateExpenseInput.categoryId?: string`, `RecurringView.categoryId: string | null`, recurring create input의 `categoryId?: string`
  - `updateExpense` 입력에 `categoryId?: string` 추가

- [ ] **Step 1: 자산 카테고리 섹션 추가**

`vault-client.ts`의 자산 섹션(328줄 주석) 아래, `SealedBlobDto` 위 또는 인근에 추가:

```typescript
// ─── 자산 카테고리(/asset-categories) — 평문 이름·색 ─────────────
export interface AssetCategory {
    id: string
    name: string
    color: string
    createdAt: string
    updatedAt: string
}

export async function listAssetCategories(): Promise<AssetCategory[]> {
    const { data } = await vaultClient.get<AssetCategory[]>("/asset-categories")
    return data
}

export async function createAssetCategory(
    name: string,
    color: string,
): Promise<AssetCategory> {
    const { data } = await vaultClient.post<AssetCategory>("/asset-categories", {
        name,
        color,
    })
    return data
}

export async function updateAssetCategory(
    id: string,
    patch: { name?: string; color?: string },
): Promise<AssetCategory> {
    const { data } = await vaultClient.patch<AssetCategory>(
        `/asset-categories/${id}`,
        patch,
    )
    return data
}

export async function deleteAssetCategory(id: string): Promise<void> {
    await vaultClient.delete(`/asset-categories/${id}`)
}
```

- [ ] **Step 2: categoryId 필드 추가**

같은 파일에서:
- `ExpenseView`에 `categoryId: string | null` 추가.
- `CreateExpenseInput`에 `categoryId?: string` 추가.
- `updateExpense` 두 번째 인자 타입을 `Partial<SealedBlobDto> & { date?: string; removed?: boolean; categoryId?: string }`로 확장.
- `RecurringView`에 `categoryId: string | null` 추가.
- recurring create input 인터페이스(파일 하단 `CreateRecurringInput` 류)에 `categoryId?: string` 추가.

- [ ] **Step 3: 타입체크**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: 이 파일 자체는 통과(소비처는 다음 Task들에서 정리되며 일시적 오류 가능 — 오류가 ExpenseView.category 등 "다음 Task 대상"에 한정되는지 확인).

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/vault-client.ts
git commit -m "feat(web): 자산 카테고리 API 클라이언트와 categoryId 필드"
```

### Task 8: asset-categories.ts — 팔레트 상수 + 카테고리 조회 헬퍼

**Files:**
- Modify: `apps/web/app/(vault)/asset/_lib/asset-categories.ts`

**Interfaces:**
- Produces:
  - `CATEGORY_PALETTE: string[]` (고정 10색)
  - `UNCATEGORIZED = { name: "미분류", color: "#98a0a8" }`
  - `resolveCategory(categoryId: string | null, categories: AssetCategory[]): { name: string; color: string }`
- Keeps: `formatAmount`, `formatWon`, `INCOME_CATEGORIES`, `incomeCategoryColor`.
- Removes: `CATEGORIES`, `categoryColor`(상수 기반) — 단, 마이그레이션 이름 매칭용 기본 이름 목록은 백엔드 시드가 담당하므로 프론트 상수는 불필요.

- [ ] **Step 1: 팔레트·헬퍼 추가, 상수 제거**

`AssetCategory` 타입 import(`@/lib/vault-client`) 후:

```typescript
import type { AssetCategory } from "@/lib/vault-client"

// 카테고리 색 선택용 고정 팔레트(임의 hex 입력 대신 선택).
export const CATEGORY_PALETTE: string[] = [
    "#f2994a", "#4a90d9", "#9b6bd6", "#e0689a", "#3bb273",
    "#14b8a6", "#eab308", "#ef4444", "#6366f1", "#98a0a8",
]

// categoryId 가 null 이거나 목록에 없을 때의 표시값.
export const UNCATEGORIZED = { name: "미분류", color: "#98a0a8" } as const

// categoryId → 표시용 이름·색. 목록에서 조인하고, 없으면 미분류.
export function resolveCategory(
    categoryId: string | null,
    categories: AssetCategory[],
): { name: string; color: string } {
    if (categoryId === null) return { ...UNCATEGORIZED }
    const found = categories.find((c) => c.id === categoryId)
    return found ? { name: found.name, color: found.color } : { ...UNCATEGORIZED }
}
```

기존 `CATEGORIES`, `AssetCategory`(로컬 인터페이스), `categoryColor` 정의는 제거한다. `INCOME_CATEGORIES`/`incomeCategoryColor`/`formatAmount`/`formatWon`은 유지.

> 주의: 로컬에 이미 `AssetCategory` 인터페이스가 있었다면 이름 충돌. vault-client의 `AssetCategory`를 단일 출처로 쓰고 로컬 정의는 삭제한다.

- [ ] **Step 2: 타입체크(소비처 제외)**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: `CATEGORIES`/`categoryColor` 참조하던 곳(asset-compute, ExpenseForm, DayDetail)에서 오류 — 다음 Task들에서 정리.

- [ ] **Step 3: Commit**

```bash
git add "apps/web/app/(vault)/asset/_lib/asset-categories.ts"
git commit -m "feat(web): 카테고리 팔레트·조회 헬퍼 추가, 고정 상수 제거"
```

### Task 9: asset-payload — 블롭에서 category 제거

**Files:**
- Modify: `apps/web/app/(vault)/asset/_lib/asset-payload.ts`
- Modify: `apps/web/app/(vault)/asset/_lib/asset-payload.spec.ts`

**Interfaces:**
- Produces: `ExpensePayload { item: string; amount: number }` (category 제거).
- Keeps: 마이그레이션용으로 옛 블롭의 category 이름을 읽는 별도 함수 `readLegacyCategory(vaultKey, blob): Promise<string | null>` (Task 15에서 사용).

- [ ] **Step 1: 테스트 수정(실패 유도)**

`asset-payload.spec.ts`의 지출 라운드트립 payload에서 `category`를 제거하고, 새로 `readLegacyCategory`가 옛 블롭에서 이름을 읽는 테스트를 추가:

```typescript
it("옛 블롭에서 category 이름을 읽는다(마이그레이션용)", async () => {
    const vk = await generateVaultKey()
    // 옛 형식: category 포함 블롭을 직접 seal
    const blob = await sealExpense(vk, { item: "x", amount: 1 })
    // readLegacyCategory 는 category 없으면 null
    await expect(readLegacyCategory(vk, blob)).resolves.toBeNull()
})
```

> 옛 데이터(category 포함)는 `seal`로 직접 임의 JSON을 만들어 테스트할 수도 있으나, 최소 동작(없으면 null)만 검증한다.

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm --filter web test asset-payload`
Expected: FAIL — `readLegacyCategory` 없음, 또는 ExpensePayload 타입 불일치.

- [ ] **Step 3: 구현**

`asset-payload.ts`:
- `ExpensePayload`에서 `category: string` 제거 → `{ item: string; amount: number }`.
- `openExpense` 반환에서 `category` 제거.
- 마이그레이션용 함수 추가:

```typescript
// 옛 블롭에 남아 있을 수 있는 평문 category 이름을 읽는다(없으면 null). 마이그레이션 전용.
export async function readLegacyCategory(
    vaultKey: CryptoKey,
    blob: SealedBlob,
): Promise<string | null> {
    try {
        const parsed = JSON.parse(await open(vaultKey, blob)) as {
            category?: unknown
        }
        return typeof parsed.category === "string" ? parsed.category : null
    } catch {
        return null
    }
}
```

(이미 `open`/`SealedBlob` import 되어 있음.)

- [ ] **Step 4: 통과 확인**

Run: `pnpm --filter web test asset-payload`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "apps/web/app/(vault)/asset/_lib/asset-payload.ts" "apps/web/app/(vault)/asset/_lib/asset-payload.spec.ts"
git commit -m "feat(web): 지출 블롭에서 category 제거, 레거시 읽기 헬퍼 추가"
```

### Task 10: asset-compute — byCategory 를 categoryId 기준으로

**Files:**
- Modify: `apps/web/app/(vault)/asset/_lib/asset-compute.ts`
- Modify: `apps/web/app/(vault)/asset/_lib/asset-compute.spec.ts`

**Interfaces:**
- Consumes: `AssetCategory` from vault-client, `resolveCategory`/`UNCATEGORIZED`.
- Produces:
  - `ComputedExpense` 에서 `category: string` → `categoryId: string | null`.
  - `byCategory(items: ComputedExpense[], categories: AssetCategory[]): CategoryBreakdown[]` — categoryId 로 합산, 이름·색은 조인, 미분류 묶음.
  - `CategoryBreakdown { key, name, color, amount, pct }` (key = categoryId | "uncategorized").

- [ ] **Step 1: 테스트 수정(실패 유도)**

`asset-compute.spec.ts`: `exp` 픽스처의 `category` 제거, `categoryId` 추가. `byCategory` 호출에 categories 인자 추가. 새 단언:

```typescript
const CATS = [
    { id: "c1", name: "식비", color: "#f2994a", createdAt: "", updatedAt: "" },
    { id: "c2", name: "교통", color: "#4a90d9", createdAt: "", updatedAt: "" },
]

it("byCategory 는 categoryId 로 합산하고 이름·색을 조인한다", () => {
    const rows = byCategory(
        [
            exp({ categoryId: "c1", amount: 7000 }),
            exp({ categoryId: "c2", amount: 3000 }),
        ],
        CATS,
    )
    expect(rows.map((r) => r.name)).toEqual(["식비", "교통"])
    expect(rows[0]).toMatchObject({ name: "식비", amount: 7000, pct: 70, color: "#f2994a" })
})

it("byCategory 는 categoryId=null 을 미분류로 묶는다", () => {
    const rows = byCategory([exp({ categoryId: null, amount: 5000 })], CATS)
    expect(rows[0]).toMatchObject({ name: "미분류", amount: 5000 })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm --filter web test asset-compute`
Expected: FAIL.

- [ ] **Step 3: 구현**

`asset-compute.ts`:
- import: `import type { AssetCategory } from "@/lib/vault-client"` 및 `import { resolveCategory } from "./asset-categories"`. 기존 `CATEGORIES`/`categoryColor` import 제거.
- `ComputedExpense`의 `category: string` → `categoryId: string | null`.
- `CategoryBreakdown`에 `name: string` 추가.
- `byCategory` 재작성:

```typescript
const UNCATEGORIZED_KEY = "uncategorized"

export function byCategory(
    items: ComputedExpense[],
    categories: AssetCategory[],
): CategoryBreakdown[] {
    const total = totalSpent(items)
    const sums = new Map<string, number>()
    for (const e of items) {
        const key = e.categoryId ?? UNCATEGORIZED_KEY
        sums.set(key, (sums.get(key) ?? 0) + e.amount)
    }
    return [...sums.entries()]
        .filter(([, amount]) => amount > 0)
        .map(([key, amount]) => {
            const { name, color } = resolveCategory(
                key === UNCATEGORIZED_KEY ? null : key,
                categories,
            )
            return {
                key,
                name,
                color,
                amount,
                pct: total > 0 ? Math.round((amount / total) * 100) : 0,
            }
        })
        .sort((a, b) => b.amount - a.amount)
}
```

(`byDay`는 Task에서 이미 date 기준. 변경 없음.)

- [ ] **Step 4: 통과 확인**

Run: `pnpm --filter web test asset-compute`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "apps/web/app/(vault)/asset/_lib/asset-compute.ts" "apps/web/app/(vault)/asset/_lib/asset-compute.spec.ts"
git commit -m "feat(web): byCategory 를 categoryId 기준으로 재작성"
```

---

## Phase 5 — 프론트엔드 UI 통합

### Task 11: page.tsx — 카테고리 로드 + categoryId 빌드 + 머티리얼라이즈 전달

**Files:**
- Modify: `apps/web/app/(vault)/asset/page.tsx`
- Modify: `apps/web/app/(vault)/asset/_lib/asset-recurring.ts`
- Modify: `apps/web/app/(vault)/asset/_components/dashboard/AssetDashboard.tsx` (props 통과)

**Interfaces:**
- Consumes: `listAssetCategories`, `AssetCategory`.
- Produces: 로드 상태 `data`에 `categories: AssetCategory[]` 포함, `ComputedExpense.categoryId` 채움.

- [ ] **Step 1: 카테고리 로드 추가**

`page.tsx` `load()`의 `Promise.all`에 `listAssetCategories()` 추가하고 결과를 상태에 보관. `ComputedExpense` 빌드 시 `categoryId: v.categoryId` 사용(블롭 대신 평문 메타). `Loaded` 타입(`data`)에 `categories: AssetCategory[]` 추가. `byCategory(state.data.expenses, state.data.categories)`로 호출처 수정.

- [ ] **Step 2: 머티리얼라이즈가 categoryId 전달**

`asset-recurring.ts`의 `createExpense` 호출에 `categoryId: t.categoryId ?? undefined` 추가(템플릿의 categoryId를 인스턴스로 복사). `RecurringView`에 categoryId가 이미 있으므로 `t.categoryId` 접근 가능.

- [ ] **Step 3: 대시보드 props 통과**

`AssetDashboard`에 `categories` prop 추가, `byCategory(data.expenses, categories)` 및 하위 `CategoryBreakdown`/`DayDetail`에 전달(Task 13에서 소비).

- [ ] **Step 4: 타입체크**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: ExpenseForm/DayDetail/CategoryBreakdown 외 오류 없음(그 셋은 Task 12·13).

- [ ] **Step 5: Commit**

```bash
git add "apps/web/app/(vault)/asset/page.tsx" "apps/web/app/(vault)/asset/_lib/asset-recurring.ts" "apps/web/app/(vault)/asset/_components/dashboard/AssetDashboard.tsx"
git commit -m "feat(web): 자산 화면에서 카테고리 로드 및 categoryId 집계"
```

### Task 12: ExpenseForm — 카테고리 선택을 목록 기반 + categoryId 저장

**Files:**
- Modify: `apps/web/app/(vault)/asset/_components/ExpenseForm.tsx`
- Modify: 호출처(폼을 여는 컴포넌트)에서 `categories` prop 전달

**Interfaces:**
- Consumes: `AssetCategory[]` (prop), `ExpenseFormInitial.categoryId`.
- Produces: 저장 시 `createExpense`/`updateExpense`에 `categoryId` 전달, 블롭에는 category 없음.

- [ ] **Step 1: props·상태 변경**

- `Props`에 `categories: AssetCategory[]` 추가.
- `ExpenseFormInitial`의 `payload: ExpensePayload`는 이제 category 없음. 초기 선택은 `initial?.categoryId ?? categories[0]?.id ?? null` 형태의 `categoryId` 상태로 보유(`ExpenseFormInitial`에 `categoryId: string | null` 추가).
- `category` 문자열 상태 → `categoryId: string | null` 상태.

- [ ] **Step 2: 칩 렌더를 목록 기반으로**

카테고리 칩 `CATEGORIES.map` → `categories.map((c) => ...)`, `active = c.id === categoryId`, 색점 `background: c.color`, 라벨 `c.name`, 클릭 `setCategoryId(c.id)`.

- [ ] **Step 3: 저장 시 categoryId 전달**

`handleSave`의 payload에서 category 제거(`{ item, amount }`). `createExpense({ date, categoryId: categoryId ?? undefined, ...blob })`, 수정 시 `updateExpense(id, { date, categoryId: categoryId ?? undefined, ...blob })`. 고정 생성 시 `createRecurring`에도 `categoryId` 전달.

- [ ] **Step 4: 호출처에서 categories 전달**

폼을 렌더하는 상위(시트/페이지)에서 로드된 `categories`를 prop으로 넘긴다. 또한 수정 진입 시 `ExpenseFormInitial.categoryId`를 해당 지출의 `categoryId`로 채운다(목록 ExpenseView에 categoryId 존재).

- [ ] **Step 5: 타입체크 + 린트**

Run: `pnpm --filter web exec tsc --noEmit && pnpm --filter web lint`
Expected: PASS(또는 남은 건 Task 13의 DayDetail/CategoryBreakdown).

- [ ] **Step 6: Commit**

```bash
git add "apps/web/app/(vault)/asset/_components/ExpenseForm.tsx" <호출처 파일>
git commit -m "feat(web): 지출 폼 카테고리 선택을 동적 목록·categoryId 로 전환"
```

### Task 13: DayDetail / CategoryBreakdown 색·이름 조인

**Files:**
- Modify: `apps/web/app/(vault)/asset/_components/dashboard/DayDetail.tsx`
- Modify: `apps/web/app/(vault)/asset/_components/dashboard/CategoryBreakdown.tsx`

**Interfaces:**
- Consumes: `categories: AssetCategory[]` (prop), `resolveCategory`, `byCategory` 결과의 `name`/`color`.

- [ ] **Step 1: DayDetail**

`categories` prop 추가. `e.category` 대신 `resolveCategory(e.categoryId, categories)`로 이름·색 계산. 색점 `background: resolved.color`, 라벨 `resolved.name`.

- [ ] **Step 2: CategoryBreakdown**

`byCategory`가 이제 `name`/`color`를 직접 제공하므로 행 렌더에서 `row.name`/`row.color` 사용(추가 조회 불필요). props 시그니처 확인 후 정리.

- [ ] **Step 3: 타입체크 + 린트 + 빌드**

Run: `pnpm --filter web exec tsc --noEmit && pnpm --filter web lint && pnpm --filter web build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add "apps/web/app/(vault)/asset/_components/dashboard/DayDetail.tsx" "apps/web/app/(vault)/asset/_components/dashboard/CategoryBreakdown.tsx"
git commit -m "feat(web): 일자 상세·카테고리 분해를 categoryId 색·이름으로"
```

### Task 14: 카테고리 관리 UI

**Files:**
- Create: `apps/web/app/(vault)/asset/_components/CategoryManager.tsx`
- Modify: 진입점(자산 화면 또는 지출 폼에 "카테고리 관리" 버튼)

**Interfaces:**
- Consumes: `listAssetCategories`/`createAssetCategory`/`updateAssetCategory`/`deleteAssetCategory`, `CATEGORY_PALETTE`.
- Produces: 카테고리 목록·추가·수정·삭제 UI. 변경 후 `onChanged()` 콜백으로 상위 목록 재로딩.

- [ ] **Step 1: 컴포넌트 작성**

`CategoryManager.tsx` — 목록 표시(이름+색점), 추가 폼(이름 입력 + 팔레트 색 버튼 그룹), 각 항목 인라인 수정(이름·색)·삭제(확인 다이얼로그: "이 카테고리의 지출은 미분류가 됩니다"). 모든 쓰기 후 목록 재조회. 에러는 `isApiError`로 사용자 메시지 표시. `resetIdle()` 호출(금고 idle 타이머). 패턴은 기존 자산 폼 컴포넌트(ExpenseForm)의 상태·에러 처리 스타일을 따른다.

> 코드 분량이 크므로 구현 시: (1) 추가 영역, (2) 목록+항목 수정/삭제 영역으로 함수를 분리해 200–400줄 가이드 내 유지.

- [ ] **Step 2: 진입점 연결**

자산 화면 헤더 또는 지출 폼에 "카테고리 관리" 진입 버튼을 추가하고, 시트/모달로 `CategoryManager`를 연다. 닫힐 때 `load()`로 카테고리·지출 재조회.

- [ ] **Step 3: 타입체크 + 린트 + 빌드**

Run: `pnpm --filter web exec tsc --noEmit && pnpm --filter web lint && pnpm --filter web build`
Expected: PASS.

- [ ] **Step 4: 수동 확인**

Run: 앱 기동(`make dev-up` 등) 후 카테고리 추가/수정/삭제, 지출 폼에 반영, 삭제 시 해당 지출 "미분류" 표시 확인.

- [ ] **Step 5: Commit**

```bash
git add "apps/web/app/(vault)/asset/_components/CategoryManager.tsx" <진입점 파일>
git commit -m "feat(web): 카테고리 관리 UI 추가"
```

---

## Phase 6 — 기존 데이터 마이그레이션

### Task 15: 클라이언트 일회성 이름→categoryId 마이그레이션

**Files:**
- Create: `apps/web/app/(vault)/asset/_lib/asset-migrate-categories.ts`
- Create: `apps/web/app/(vault)/asset/_lib/asset-migrate-categories.spec.ts`
- Modify: `apps/web/app/(vault)/asset/page.tsx` (로드 시 1회 호출)

**Interfaces:**
- Consumes: `readLegacyCategory`, `listExpenses`/`updateExpense`, `AssetCategory`.
- Produces: `migrateExpenseCategories(vaultKey, categories, expenses): Promise<number>` — categoryId 없는 지출을 이름 매칭으로 PATCH, 처리 건수 반환. 순수 매칭 로직은 분리해 테스트.

- [ ] **Step 1: 매칭 로직 테스트 작성**

`asset-migrate-categories.spec.ts` — 이름→id 매핑을 만드는 순수 함수 `matchCategoryId(name, categories)` 테스트:

```typescript
import { matchCategoryId } from "./asset-migrate-categories"

const CATS = [
    { id: "c1", name: "식비", color: "#f2994a", createdAt: "", updatedAt: "" },
    { id: "c2", name: "교통", color: "#4a90d9", createdAt: "", updatedAt: "" },
]

describe("matchCategoryId", () => {
    it("이름이 일치하면 id 반환", () => {
        expect(matchCategoryId("식비", CATS)).toBe("c1")
    })
    it("일치 없으면 null", () => {
        expect(matchCategoryId("없는카테고리", CATS)).toBeNull()
    })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm --filter web test asset-migrate-categories`
Expected: FAIL — 모듈 없음.

- [ ] **Step 3: 구현**

`asset-migrate-categories.ts`:

```typescript
// 기존 지출(categoryId 없음)을 옛 블롭의 카테고리 이름으로 매칭해 categoryId 를 채운다.
// 서버는 블롭을 못 읽으므로 클라이언트가 로그인 후 1회 수행한다. 멱등.
import {
    listExpenses,
    updateExpense,
    type AssetCategory,
    type ExpenseView,
} from "@/lib/vault-client"
import { readLegacyCategory } from "./asset-payload"

export function matchCategoryId(
    name: string | null,
    categories: AssetCategory[],
): string | null {
    if (name === null) return null
    return categories.find((c) => c.name === name)?.id ?? null
}

// 대상 지출 목록에서 categoryId 없는 건을 이름 매칭으로 PATCH. 처리 건수 반환.
export async function migrateExpenseCategories(
    vaultKey: CryptoKey,
    categories: AssetCategory[],
    expenses: ExpenseView[],
): Promise<number> {
    let migrated = 0
    for (const e of expenses) {
        if (e.categoryId !== null) continue
        const legacyName = await readLegacyCategory(vaultKey, e)
        const id = matchCategoryId(legacyName, categories)
        if (id === null) continue
        try {
            await updateExpense(e.id, { categoryId: id })
            migrated += 1
        } catch {
            // 개별 실패는 스킵(다음 로드에서 재시도 가능, 멱등).
        }
    }
    return migrated
}
```

> 호출 범위: 표시 중인 월의 `expenses`를 넘긴다(단순·점진적 마이그레이션). 데이터가 적어 월별 점진 처리로 충분하며, 각 월 방문 시 그 달 분이 채워진다. 전체 일괄이 필요하면 후속 작업으로 분리.

- [ ] **Step 4: 통과 확인**

Run: `pnpm --filter web test asset-migrate-categories`
Expected: PASS.

- [ ] **Step 5: page 로드에 연결**

`page.tsx` `load()`에서 카테고리·지출 로드 후, `decrypted`(또는 expM 뷰) 중 categoryId 없는 게 있으면 `migrateExpenseCategories(vaultKey, categories, expM)`를 호출하고, 처리 건수>0이면 해당 월 지출을 재조회(또는 로컬 상태 갱신)한다. 무한 루프 방지: 마이그레이션 후 한 번만 재조회.

- [ ] **Step 6: 타입체크 + 린트 + 빌드**

Run: `pnpm --filter web exec tsc --noEmit && pnpm --filter web lint && pnpm --filter web build`
Expected: PASS.

- [ ] **Step 7: 수동 확인**

Run: 앱 기동 후 기존(옛) 지출이 있는 월로 이동 → 카테고리가 자동 연결되어 분해/색에 반영되는지 확인. 매칭 실패분은 "미분류".

- [ ] **Step 8: Commit**

```bash
git add "apps/web/app/(vault)/asset/_lib/asset-migrate-categories.ts" "apps/web/app/(vault)/asset/_lib/asset-migrate-categories.spec.ts" "apps/web/app/(vault)/asset/page.tsx"
git commit -m "feat(web): 기존 지출 카테고리 자동 마이그레이션(이름 매칭)"
```

---

## 최종 검증

- [ ] 백엔드: `pnpm --filter @daeoebi/api test:unit && pnpm --filter @daeoebi/api typecheck && pnpm --filter @daeoebi/api lint`
- [ ] 프론트: `pnpm --filter web test && pnpm --filter web exec tsc --noEmit && pnpm --filter web lint && pnpm --filter web build`
- [ ] 수동: 카테고리 CRUD → 지출 폼 반영 → 삭제 시 미분류 → 기존 지출 자동 연결 → 월 합계·분해 정상.

## Self-Review 메모(작성자 확인)

- 스펙 1–9절 각 항목이 Task 1–15에 매핑됨: 데이터 모델(T1), 백엔드 CRUD·시드(T2–4), categoryId(T5–6), 클라이언트(T7), 팔레트·헬퍼(T8), 블롭 변경(T9), 집계(T10), UI 통합(T11–14), 마이그레이션(T15).
- 타입 일관성: `categoryId: string | null`(뷰·ComputedExpense), `resolveCategory(id|null, cats)`, `byCategory(items, categories)`, `CategoryBreakdown { key, name, color, amount, pct }` — Task 간 동일 시그니처 사용.
- 미해결 선택(스펙 6절): 마이그레이션 범위는 "표시 월 점진"으로 확정(T15 Step 3 주석). 전체 일괄은 후속 분리.
