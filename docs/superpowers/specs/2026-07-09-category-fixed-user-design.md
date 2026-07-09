# 카테고리 고정/사용자 생성 분리 설계

- 날짜: 2026-07-09
- 브랜치: `feat/category-fixed-user`
- 상태: 승인 대기

## 배경

현재 자산(지출) 카테고리(`AssetCategory`)는 모든 항목이 수정·삭제 가능하고, 사용자가
자유 텍스트 `code`를 입력할 수 있다. 저축/투자 대시보드는 `kind`(NORMAL/SAVINGS/INVESTMENT)
시스템 마커로 저축·투자 카테고리를 식별한다.

이를 **고정 카테고리**와 **사용자 생성 카테고리** 두 종류로 나눈다.

## 요구사항 (확정)

1. 카테고리를 고정 / 사용자 생성 두 종류로 구분한다.
2. 고정 카테고리 12종: 식비, 카페·간식, 편의점·마트, 쇼핑, 의료·건강, 주거·통신,
   보험·세금, 미용, 교통, **투자**, 저축, 기타.
3. 고정 카테고리는 **수정·삭제 불가**, **고유 코드**를 가지며, 색상은 자동 배정한다.
4. 사용자 생성 카테고리는 **처음에 비어 있고**, 사용자가 직접 생성한다. **이름·색상만**
   가지며 **코드는 없다**.
5. 기존 데이터 이행: 새 고정 이름과 **이름이 일치하는 기존 카테고리는 지출 연결을 보존**,
   그 외 사라지는 카테고리의 지출은 **기타로 재지정**한다. 사용자 생성 목록은 빈 상태로 시작한다.
6. 코드는 데이터 식별자일 뿐 **UI에는 노출하지 않는다**.
7. `kind` 필드는 제거한다. 투자·저축이 고정 + 고유 코드이므로 `code`를 대시보드 앵커로 쓴다.

## 데이터 모델

`AssetCategory`에서 **`kind` 컬럼을 제거**한다. 새 컬럼은 추가하지 않는다.

- 고정/사용자 구분은 **`code` 존재 여부**로 판별한다.
  - `code IS NOT NULL` ⟺ 고정 카테고리 (항상 코드 보유, 수정·삭제 불가)
  - `code IS NULL` ⟺ 사용자 생성 카테고리 (코드 없음, 수정·삭제 가능)
- 이 불변식은 API가 보장한다: `create()`는 항상 `code=null`, `update()`는 `code`를 건드리지
  않으므로 사용자 카테고리는 코드를 가질 수 없다. 고정 카테고리는 시드로만 코드를 부여한다.
- 저축·투자 대시보드 앵커는 `code === "SAVINGS"` / `code === "INVESTMENT"` (코드가 고정·불변이라
  안전한 앵커).

변경 후 스키마(요지):

```prisma
model AssetCategory {
  id        String   @id @default(cuid())
  name      String
  color     String
  code      String?  @unique // 고정 카테고리 안정 식별자. null = 사용자 생성.
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  expenses  Expense[]
  recurring RecurringExpense[]
  @@index([name])
}
```

## 고정 카테고리 12종

| 순서 | 이름 | code | 색상 |
|---|---|---|---|
| 1 | 식비 | `FOOD` | #f2994a |
| 2 | 카페·간식 | `CAFE` | #eb5757 |
| 3 | 편의점·마트 | `MART` | #e0689a |
| 4 | 쇼핑 | `SHOPPING` | #9b6bd6 |
| 5 | 의료·건강 | `HEALTH` | #7b61ff |
| 6 | 주거·통신 | `HOUSING` | #4a90d9 |
| 7 | 보험·세금 | `INSURANCE_TAX` | #2d9cdb |
| 8 | 미용 | `BEAUTY` | #20a4a4 |
| 9 | 교통 | `TRANSPORT` | #3bb273 |
| 10 | 투자 | `INVESTMENT` | #6fcf97 |
| 11 | 저축 | `SAVINGS` | #f2c94c |
| 12 | 기타 | `ETC` | #98a0a8 |

목록 정렬: **고정(위 순서) → 사용자 생성(생성순 asc)**.

## API (`asset-category.service.ts` / DTO)

- **`list()`**: 12종 고정을 `code` 기준으로 멱등 보장(없으면 생성). 고정을 위 순서로,
  이어서 사용자 생성을 생성순으로 정렬해 반환.
- **`create()`**: 사용자 생성만. `code=null` 강제. DTO에서 `code` 필드 제거. 이름 중복 검사 유지.
- **`update()`**: 대상이 고정(`code != null`)이면 거부. 사용자 카테고리의 이름·색만 수정.
  `code` 처리 로직 제거.
- **`remove()`**: 대상이 고정이면 거부. 사용자 카테고리만 삭제(하위 지출은 FK SetNull → 미분류).
- 신규 에러코드 `ASSET_CATEGORY_FIXED_READONLY`(403) 추가. 코드 중복 관련 에러/검사는
  사용자 입력 경로에서 제거(고정 시드 내부에서만 코드 사용).

## 데이터 이행 (신규 Prisma 마이그레이션)

단일 마이그레이션에서 순서대로:

1. 기존 카테고리 중 **이름이 고정 이름과 일치**하면 그 행을 고정으로 전환한다
   (id 유지 → 지출 연결 보존; `code`·`color` 설정). 동명이 여럿이면 가장 오래된
   (createdAt asc) 하나만 전환하고 나머지는 3~4단계 대상으로 둔다.
2. 존재하지 않는 고정 카테고리를 새로 생성한다.
3. **code가 없는(=고정이 아닌) 카테고리**를 참조하는 `Expense`·`RecurringExpense`의
   `categoryId`를 **기타(`ETC`) 카테고리 id로 재지정**한다. (FK가 SetNull이라 삭제를 먼저 하면
   미분류가 되므로 재지정을 반드시 먼저 한다.)
4. code가 없는 카테고리를 모두 삭제한다 → 사용자 생성 목록은 빈 상태로 시작.
5. `AssetCategory.kind` 컬럼을 제거한다.

> 기존 default 시드(식비·교통·쇼핑·저축·투자·기타)는 이름 일치로 보존된다.
> 문화·주거·공과금 등 이름이 바뀌거나 사라지는 항목의 지출은 기타로 이동한다.

## 웹 UI

- **`vault-client.ts`**: `AssetCategory` 타입에서 `kind` 제거(`code`는 유지).
  `createAssetCategory(name, color)` / `updateAssetCategory(id, {name?, color?})`에서 `code` 인자 제거.
- **`CategoryManager.tsx`**: 목록을 **고정 카테고리 섹션(읽기 전용)** +
  **사용자 생성 섹션(수정·삭제·+추가)** 두 그룹으로 표시. 고정 섹션에는 편집 트리거 미노출.
- **`CategoryRow.tsx`**: `code` 표시 제거. 고정이면 수정·삭제 버튼 미노출(사용자 카테고리만 노출).
- **`CategoryAddSection.tsx`**: 코드 입력 필드 제거 → 이름 + 색상만.
- **`asset-compute.ts`**: `savingsSummary`·`monthSavingsByItem`의 판별 기준을 `kind`에서
  `code`("SAVINGS"/"INVESTMENT")로 변경. 파라미터 타입 `{id, kind}` → `{id, code}`.
- **`page.tsx`**: `savingsCategoryIds` 필터를 `c.kind === ...`에서
  `c.code === "SAVINGS" || c.code === "INVESTMENT"`로 변경.
- **`asset-categories.ts`**: 저축·투자 앵커 코드 상수(`SAVINGS_CODE`, `INVESTMENT_CODE`) 추가로
  매직 문자열 제거.

## 데모 (`/demo`)

- **`demo-asset-data.ts`**: `DEMO_ASSET_CATEGORIES`를 고정 12종(코드 부여, `kind` 제거)으로 교체.
  데모 지출 `categoryId`를 새 고정 카테고리에 맞게 재매핑.
- **`DemoCategoryManager.tsx`**: 고정(읽기 전용) + 사용자 생성(추가·수정·삭제) 구조로 맞춤.
  추가 시 `code=null`, `kind` 참조 제거.

## 테스트

- **`asset-category.service.spec.ts`**: `kind`/사용자 `code` 관련 테스트 제거. 고정 시드(코드·순서),
  고정 수정·삭제 거부(`ASSET_CATEGORY_FIXED_READONLY`), 사용자 create/update/remove 테스트로 갱신.
- **`SavingsTab.spec.tsx`**: 카테고리 fixture를 `code` 기반으로 갱신(kind 제거).
- **e2e `category-crud.spec.ts`**: 고정 읽기전용·사용자 생성 흐름 반영.
- **e2e `savings.spec.ts`**: 저축·투자 카테고리 참조를 code 기반으로 확인.

## 범위 밖 (YAGNI)

- 사용자 카테고리의 코드·정렬 커스터마이즈.
- 고정 카테고리 색상 사용자 변경.
- 저축·투자 대시보드 UI/계산 로직 자체 변경(앵커 기준만 kind→code).
