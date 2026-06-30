# 사용자 정의 지출 카테고리 설계

작성일: 2026-06-30
대상: 자산(지출) 도메인
선행 작업: `feat/remove-expense-method`(지출 결제수단 제거)를 base 로 함

## 1. 목적과 범위

가계부의 목적은 "한 달에 얼마를, 어디에 썼는지"를 보는 것이다. 현재 지출 카테고리는 코드에 박힌 고정 8종 상수다. 사용자가 자신의 소비 패턴에 맞게 **카테고리를 직접 추가·수정·삭제**할 수 있게 한다.

- **적용 범위: 지출 카테고리만.** 수입 카테고리(월급·상여·기타)는 고정 상수로 유지한다.
- **저장 모델: 평문 테이블 + `categoryId` FK.** 비밀번호 금고의 `Category` 패턴을 따른다. 카테고리 이름은 서버에 평문으로 저장된다(수용된 트레이드오프). 금액·항목은 여전히 암호화 블롭 안에 있어 서버가 못 본다.

### 비목표 (YAGNI)
- 수입 카테고리 사용자 정의
- 카테고리 순서 드래그 정렬(생성 순서로 표시)
- 임의 hex 색상 입력(고정 팔레트에서 선택)
- 카테고리별 예산·목표 설정

## 2. 배경: 현재 구조

- **단일 금고(single-vault)**: `User`/`userId` 없음. 자산 모델(`Expense`/`RecurringExpense`/`Income`)은 전역 스코프이며 평문 메타로 `date`/`month`만 갖는다. 나머지는 AEAD 암호화 블롭.
- 지출 본문 블롭 = `{ item, amount, category }` (결제수단 `method`는 선행 작업에서 제거됨). `category`는 이름 문자열.
- 비밀번호 금고에는 `Category` 모델(siteId 스코프) + CRUD 컨트롤러/서비스/DTO + `vault-client` 함수가 이미 있다. 단, 관리 UI 는 미구현이다.
- 자산 카테고리 상수·사용처: `apps/web/app/(vault)/asset/_lib/asset-categories.ts`의 `CATEGORIES`, `categoryColor`. 사용처는 `ExpenseForm`(칩 선택), `asset-compute.byCategory`(집계), `DayDetail`/`CategoryBreakdown`(색상·표시).

## 3. 데이터 모델

새 전역 모델(비밀번호 `Category`에서 `siteId` 제거, `color` 추가):

```prisma
model AssetCategory {
  id        String   @id @default(cuid())
  name      String   // 평문. 사용자가 정함
  color     String   // 평문 hex (예: "#f2994a"). 고정 팔레트 값
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  expenses  Expense[]
  recurring RecurringExpense[]

  @@index([name])
}
```

`Expense`·`RecurringExpense`에 추가:

```prisma
  categoryId String?
  category   AssetCategory? @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  @@index([categoryId])
```

- 카테고리는 **더 이상 암호화 블롭에 저장하지 않는다.** 지출 블롭 = `{ item, amount }`.
- 카테고리 삭제 시 `onDelete: SetNull` → 해당 지출은 `categoryId=null`("미분류")로 남는다(비밀번호 `Secret` 패턴과 동일).
- 마이그레이션은 새 디렉토리로 생성한다(`pnpm --filter ... prisma:migrate`). 기존 migration 파일은 수정 금지.

## 4. 백엔드 (NestJS)

비밀번호 `Category` CRUD 를 복제하되 `siteId`/`ensureSite` 를 제거한 전역 버전.

신규 파일:
- `apps/api/src/asset/category.controller.ts` — `@Controller("asset-categories")`
  - `GET /asset-categories` → list (비어 있으면 기본값 시드 후 반환)
  - `POST /asset-categories` (201) → create
  - `PATCH /asset-categories/:id` → update(name?, color?)
  - `DELETE /asset-categories/:id` (204) → remove
- `apps/api/src/asset/category.service.ts`
  - `list()`: `findMany({ orderBy: { createdAt: "asc" } })`. 결과가 비어 있으면 **기본 8종 시드**(식비·교통·주거·공과금·쇼핑·문화·저축·투자·기타와 기존 색) 후 재조회.
  - `create({ name, color })`, `update(id, dto)`, `remove(id)` — `ensureExists`로 404 처리(`ASSET_CATEGORY_NOT_FOUND`).
- `apps/api/src/asset/dto/category.dto.ts` — `CreateAssetCategoryDto { name(1–100), color(hex 패턴) }`, `UpdateAssetCategoryDto { name?, color? }`. class-validator.

수정:
- `asset.module.ts` — 컨트롤러/서비스 등록 + `CsrfMiddleware` 적용.
- `asset.types.ts` — `ASSET_CATEGORY_NOT_FOUND` 에러코드 추가.
- `dto/expense.dto.ts` — `CreateExpenseDto`/`UpdateExpenseDto`에 `categoryId?`(Optional String) 추가.
- `expense.service.ts` — `create`/`update`의 data 에 `categoryId`, `ExpenseRow`/`toView`에 `categoryId` 추가.
- `recurring.dto.ts`/`recurring.service.ts` — 동일하게 `categoryId` 반영(고정 지출 템플릿이 카테고리를 가짐). `materializeRecurring`이 인스턴스 생성 시 템플릿의 `categoryId`를 복사.

### 시드 동시성
단일 사용자라 충돌 가능성은 낮다. `list()`가 빈 목록을 만났을 때만 시드하며, 안전을 위해 시드 생성은 `createMany`로 한 번에 처리한다.

## 5. 프론트엔드 (Next.js)

### API 클라이언트 — `apps/web/lib/vault-client.ts`
```
interface AssetCategory { id, name, color, createdAt, updatedAt }
listAssetCategories(): Promise<AssetCategory[]>
createAssetCategory(name, color): Promise<AssetCategory>
updateAssetCategory(id, patch): Promise<AssetCategory>
deleteAssetCategory(id): Promise<void>
```

### 카테고리 ↔ 색/이름 매핑 재설계
현재 `categoryColor(key)`는 상수 기반이다. 이를 **카테고리 목록(런타임 로드) 기반 조회**로 바꾼다.
- `ComputedExpense`: `category: string`(이름) → `categoryId: string | null` 로 교체.
- `byCategory(expenses, categories)`: `categoryId`로 합산하고, 이름·색은 `categories`에서 조인. 목록에 없는 id 나 null 은 "미분류"(회색)로 묶는다.

### 카테고리 관리 UI (신규)
- 진입점: 자산 화면 또는 지출 폼에서 "카테고리 관리".
- 목록(이름·색점) + 추가(이름 입력 + **고정 팔레트 색 선택**) + 항목별 이름/색 수정 + 삭제(확인).
- 삭제 시 "이 카테고리의 지출은 미분류가 됩니다" 안내.
- 팔레트: 미리 정한 10색 상수.

### 지출 폼 — `ExpenseForm`
- 카테고리 칩을 상수 대신 **로드된 목록**으로 렌더. 저장 값은 `categoryId`.
- 신규 저장 시 블롭에서 `category` 제거, `createExpense`에 `categoryId` 전달.

### 표시 — `DayDetail` / `CategoryBreakdown` / `AssetDashboard`
- 색·이름을 카테고리 목록에서 조회. `categoryId=null`은 "미분류".
- `page.tsx` 로드 시 `listAssetCategories()`를 함께 가져와 상태로 보유하고 하위에 전달.

## 6. 기존 지출 데이터 마이그레이션 (자동, 이름 매칭)

기존 지출은 블롭에 카테고리 이름만 있고 `categoryId`가 없다. 이름은 암호문 안이라 서버가 못 보므로 **클라이언트에서 일회성 수행**한다.

절차(로그인/금고 해제 후, 자산 화면 진입 시 1회):
1. `listAssetCategories()`로 카테고리(기본 시드 포함)를 확보하고 `name → id` 맵을 만든다.
2. 해당 월 로드와 별개로, `categoryId`가 null 인 기존 지출을 대상으로 블롭을 열어 옛 `category` 이름을 읽는다.
3. 이름이 맵에 있으면 `updateExpense(id, { categoryId })`로 연결. 없으면 미분류로 둔다.
4. 멱등: 이미 `categoryId`가 있으면 건너뛴다.

- 기본 시드 이름이 옛 상수 이름과 같으므로 기본 카테고리 지출은 무손실로 연결된다.
- 구현 단순화를 위해, 마이그레이션 대상 조회는 "표시 중인 월"의 지출에 한정하지 않고 별도 경량 패스로 처리할지 여부는 구현 계획에서 확정한다(데이터가 적어 전체 패스도 부담 적음).
- `RecurringExpense` 템플릿도 동일하게 이름 매칭으로 `categoryId`를 채운다.

## 7. 에러 처리·검증

- 이름: 공백 트림 후 1–100자. 빈 이름 거부.
- 색상: 팔레트 값(허용 목록)만 통과. 서버는 hex 패턴 검증.
- 카테고리 목록 로드 실패 시 화면은 에러 박스 표시, 지출 폼은 저장 비활성.
- 마이그레이션 중 개별 지출 복호화 실패는 스킵(기존 `Promise.allSettled` 패턴과 동일).

## 8. 테스트

- 백엔드 단위: `category.service.spec`(빈 목록 시드, create/update/remove, 미존재 404, 삭제 시 `SetNull`). `expense.service.spec`에 `categoryId` 왕복.
- 프론트 단위: `byCategory`의 categoryId 집계·미분류 처리, 이름→id 매칭 마이그레이션 로직.
- 회귀: 기존 지출 표시·집계가 마이그레이션 후 동일 금액으로 유지.

## 9. 영향 파일 요약

신규: `asset/category.controller.ts`, `asset/category.service.ts`, `asset/dto/category.dto.ts`, `asset/category.service.spec.ts`, 카테고리 관리 UI 컴포넌트, 마이그레이션 SQL.
수정: `schema.prisma`, `asset.module.ts`, `asset.types.ts`, `expense.dto.ts`, `expense.service.ts`, `recurring.dto.ts`, `recurring.service.ts`, `vault-client.ts`, `asset-categories.ts`, `asset-compute.ts`, `asset-payload.ts`, `ExpenseForm.tsx`, `DayDetail.tsx`, `CategoryBreakdown.tsx`, `AssetDashboard.tsx`, `page.tsx`, 및 관련 spec.
