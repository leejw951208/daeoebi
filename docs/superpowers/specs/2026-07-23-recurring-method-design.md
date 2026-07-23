# 고정 지출 — 지출 방식(method) 추가 설계

작성일: 2026-07-23
브랜치: `feat/recurring-method` (develop 기준)

## 1. 목적

고정 지출(RecurringExpense) 항목마다 "지출 방식"(예: 삼성카드, 현금)을 붙여, **고정 지출 탭에서만** 표시·등록·수정한다.

## 2. 요구사항 (사용자 확정)

- 지출 방식은 **고정 지출 탭 안에서** 등록·수정한다. 지출 등록 폼(`ExpenseForm`)에는 넣지 않는다.
- 지출 목록/개별 지출 인스턴스에는 방식이 필요 없다. → **템플릿 전용 속성**.
- 값 형태: **자유 입력 텍스트**(고정 선택지 아님).
- 저장: **평문 컬럼**(카테고리 `categoryId`와 동일한 처리 수준. E2E 봉인 대상 아님).

## 3. 설계 결정 및 근거

### 3.1 저장 위치 — 템플릿 평문 컬럼

- 방식은 템플릿만의 속성이고 인스턴스로 흐르지 않으므로, 인스턴스와 공유되는 봉인 블롭(`ExpensePayload {item, amount}`)에 넣지 **않는다**.
- 평문 컬럼으로 두면 고정 지출 탭에서 방식만 단독 `PATCH` 할 수 있어, 기존 "앞으로만 반영"(블롭 재봉인 + `propagateRecurringUpdate` 전파) 파이프라인을 **건드리지 않는다**.
- `RecurringExpense.method String?` (nullable). 기존 데이터는 `null`로 시작.

### 3.2 편집 진입점 — 고정 지출 탭 인라인 편집

- 현재 `RecurringTab`은 읽기 전용(주석 명시)이나, 요구사항에 따라 **방식 필드만** 인라인 편집을 추가한다.
- 방식은 봉인 블롭·전파와 무관하므로, 탭에서 직접 `updateRecurring(id, { method })`를 호출해도 안전하다(블롭 재봉인/전파 우회 문제 없음).

### 3.3 화면 반영 — 부모 상태 부분 갱신

- 전체 재조회(`load()`)는 대시보드를 로딩 스켈레톤으로 되돌려 깜빡임이 크다.
- 대신 page가 `recurrings` 배열을 **불변 갱신**하는 콜백을 내려주고, 저장 성공 시 해당 항목의 `method`만 교체한다. (코딩 규칙: immutability)

## 4. 변경 범위

### 4.1 DB / Prisma

- `apps/api/prisma/schema.prisma` — `RecurringExpense`에 `method String?` 추가.
- 새 마이그레이션 추가(`apps/api/prisma/migrations/*`). 기존 마이그레이션은 수정 금지.
  - nullable 컬럼 추가라 기존 행에 안전.

### 4.2 API (NestJS)

- `apps/api/src/asset/dto/recurring.dto.ts`
  - `CreateRecurringDto`, `UpdateRecurringDto`에 `@IsOptional() @IsString() @MaxLength(50)` `method?: string` 추가(경계 검증).
- `apps/api/src/asset/recurring.service.ts`
  - `RecurringRow` / `toView`에 `method` 포함.
  - `create`: `method: dto.method ?? null` 매핑.
  - `update`: `if (dto.method !== undefined) data.method = dto.method` (부분 갱신 패턴 유지).

> `PATCH /recurring/:id`로 `method`만 보내는 요청이 통과해야 한다. 암호문 3필드는 그대로 "전부 아니면 전무" 규칙을 지키며, method 단독 요청 시 블롭 데이터는 손대지 않는다.

### 4.3 클라이언트 (vault-client)

- `apps/web/lib/vault-client.ts`
  - `RecurringView`에 `method: string | null` 추가.
  - `createRecurring` 입력 타입에 `method?: string`(사용은 안 하지만 타입 일관성 위해 선택).
  - `updateRecurring` 입력 타입(`Partial<SealedBlobDto> & {...}`)에 `method?: string` 추가.

### 4.4 계산 모델 / 조립

- `apps/web/app/(vault)/asset/_lib/asset-compute.ts`
  - `ComputedRecurring`에 `method: string | null` 추가.
- `apps/web/app/(vault)/asset/page.tsx`
  - `resolveRecurrings`의 매핑에 `method: v.method` 추가.
  - `recurrings` 부분 갱신 콜백 추가:
    ```ts
    const setRecurringMethod = useCallback((id: string, method: string) => {
      setState((prev) =>
        prev.status === "ready"
          ? { ...prev, data: { ...prev.data,
              recurrings: prev.data.recurrings.map((r) =>
                r.id === id ? { ...r, method } : r) } }
          : prev)
    }, [])
    ```
  - `AssetDashboard`에 콜백 prop으로 전달.

### 4.5 UI

- `apps/web/app/(vault)/asset/_components/dashboard/AssetDashboard.tsx`
  - `RecurringTab`에 `onMethodSaved`(부분 갱신 콜백) prop 전달.
- `apps/web/app/(vault)/asset/_components/dashboard/RecurringTab.tsx`
  - 각 카드에 방식 표시: 값이 있으면 텍스트, 없으면 "방식 추가" placeholder.
  - 방식 영역 탭 → 인라인 텍스트 입력으로 전환(현재 편집 중인 id를 로컬 state로 관리).
  - Enter/blur/저장 → `updateRecurring(id, { method })` 호출 → 성공 시 `onMethodSaved(id, method)` → 실패 시 `toast` 에러 + 원복.
  - 입력 길이 상한은 DTO와 동일(50자).
  - 읽기 전용 주석(L2-3) 갱신: "방식 필드만 이 탭에서 편집" 명시.

## 5. E2E 테스트 영향

- 결제방법 재도입 회귀 테스트(`apps/web/tests/e2e/asset.spec.ts` D. regression, L185-216)는 **지출 폼**의 결제방법 부재를 검증한다. 본 작업은 지출 폼을 건드리지 않으므로 이 테스트는 **그대로 통과**한다(수정 불필요).
- 신규 E2E: 고정 지출 탭에서 방식 입력 → 저장 → 재조회 후 유지되는 흐름을 추가한다.

## 6. 명시적 비범위 (하지 않는 것)

- 지출 등록/편집 폼(`ExpenseForm`)에 방식 입력 추가 — 하지 않음.
- 지출 인스턴스(`Expense`)·봉인 블롭(`ExpensePayload`)·전파 로직 변경 — 하지 않음.
- 방식 고정 선택지(칩) UI — 하지 않음(자유 입력).
- 방식 기반 필터/집계 — 하지 않음(표시만).

## 7. 데이터 흐름 요약

```
[고정 지출 탭] 방식 입력
      │  updateRecurring(id, { method })   ← 평문 컬럼만 PATCH
      ▼
[API] recurring.service.update → data.method 만 갱신 (블롭 무변경)
      │  RecurringView(method) 반환
      ▼
[클라] onMethodSaved(id, method) → page state.recurrings 불변 갱신
      ▼
[고정 지출 탭] 갱신된 방식 즉시 표시 (전체 재조회 없음)
```
