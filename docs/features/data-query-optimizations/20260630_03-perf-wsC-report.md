# perf-wsC: update/delete 존재확인 SELECT 제거(P2025 변환) — 작업 보고서

## 1. 개요

`update`/`remove`/`delete` 뮤테이션에서 `await ensureExists(id)` (또는 동등한 `findUnique` + 수동 notFound 패턴)를 제거하고, Prisma가 레코드 없을 때 던지는 `P2025` 에러를 catch하여 기존과 동일한 `NotFoundException`으로 변환했다. 결과적으로 뮤테이션당 DB 쿼리 수가 2→1로 줄었다.

## 2. 서비스별 변경 내용

### vault/secret.service.ts
- **update**: 최상단 `findUnique` + notFound 제거. 단, `dto.categoryId`가 truthy일 때는 `ensureCategoryInSite` 검증에 `siteId`가 필요하므로, 그 분기 내에서만 `findUnique` 수행. `prisma.secret.update` → try/catch P2025.
- **remove**: `findUnique` 사전 확인 제거. `prisma.secret.delete` → try/catch P2025.
- **ensureExists 제거 여부**: `ensureExists` 메서드 없음(notFound() 헬퍼 패턴 사용). `notFound()`는 `detail()`에서도 사용하므로 유지.
- **추가**: `isRecordNotFound(e)` private 헬퍼 추가.

### vault/category.service.ts
- **update**: `ensureExists` 호출 제거. `prisma.category.update` → try/catch P2025.
- **remove**: `ensureExists` 호출 제거. `prisma.category.delete` → try/catch P2025.
- **ensureExists 제거**: update/remove 외에서 미사용 → 메서드 삭제.
- **ensureSite 유지**: `listBySite`, `create`에서 사용 중.
- **추가**: `isRecordNotFound(e)`, `notFound()` private 헬퍼 추가.

### vault/site.service.ts
- **update**: `ensureExists` 호출 제거. `prisma.site.update` → try/catch P2025.
- **remove**: `ensureExists` 호출 제거. `prisma.site.delete` → try/catch P2025.
- **ensureExists 제거**: update/remove 외에서 미사용 → 메서드 삭제.
- **notFound() 유지**: `get()`에서 사용 중.
- **추가**: `isRecordNotFound(e)` private 헬퍼 추가.

### asset/asset-category.service.ts
- **update**: `ensureExists` 호출 제거. `prisma.assetCategory.update` → try/catch P2025.
- **remove**: `ensureExists` 호출 제거. `prisma.assetCategory.delete` → try/catch P2025.
- **ensureExists 제거**: update/remove 외에서 미사용 → 메서드 삭제.
- **추가**: `isRecordNotFound(e)`, `notFound()` private 헬퍼 추가.

### asset/expense.service.ts
- **update**: 최상단 `findUnique` + notFound 제거. `prisma.expense.update` → try/catch P2025. 기존 P2002 핸들러(`create`의 ConflictException)는 무수정.
- **remove**: `findUnique` 사전 확인 제거. `prisma.expense.delete` → try/catch P2025.
- **notFound() 유지**: `detail()` 및 catch 블록에서 사용.
- **추가**: `isRecordNotFound(e)` private 헬퍼 추가. `isUniqueViolation` 기존 유지.

### asset/income.service.ts
- **update**: 최상단 `findUnique` + notFound 제거. `prisma.income.update` → try/catch P2025. BadRequestException(암호문 불완전) 체크는 update 호출 전에 수행하므로 순서 유지.
- **remove**: `findUnique` 사전 확인 제거. `prisma.income.delete` → try/catch P2025.
- **notFound() 유지**: catch 블록에서 사용.
- **추가**: `isRecordNotFound(e)` private 헬퍼 추가.

### asset/recurring.service.ts
- **update**: `ensureExists` 호출 제거. `prisma.recurringExpense.update` → try/catch P2025.
- **remove**: `ensureExists` 호출 제거. `prisma.recurringExpense.delete` → try/catch P2025.
- **ensureExists 제거**: update/remove 외에서 미사용 → 메서드 삭제.
- **추가**: `isRecordNotFound(e)`, `notFound()` private 헬퍼 추가.

## 3. 스펙(spec) 변경 내용

각 서비스의 not-found 테스트를 `findUnique → null` 모킹에서 `update`/`delete` 가 `{ code: "P2025" }` 로 reject 하는 방식으로 전환했다. 불필요해진 `findUnique` 목은 제거했다.

### 추가된 테스트 (2개)
- `asset-category.service.spec.ts`: `remove` not-found (P2025) 테스트 추가 — 기존에 존재하지 않았던 검증.
- `income.service.spec.ts`: `update` not-found (P2025) 테스트 추가 — 기존에 존재하지 않았던 검증.

### 변경된 테스트 패턴 (서비스당)
- not-found 케이스: `prisma.X.findUnique.mockResolvedValue(null)` → `prisma.X.update/delete.mockRejectedValue({ code: "P2025" })`
- 정상 케이스: `prisma.X.findUnique.mockResolvedValue(...)` 목 제거

## 4. 검증 결과

```
pnpm --filter @daeoebi/api test:unit
  Test Suites: 14 passed, 14 total
  Tests:       91 passed, 91 total  (baseline 89 → +2 신규 테스트)

pnpm --filter @daeoebi/api typecheck
  → clean (오류 없음)

pnpm --filter @daeoebi/api lint
  → clean (--max-warnings 0, 오류 없음)
```

## 5. 커밋

```
995953d perf(api): update/delete 존재확인 SELECT 제거(P2025 변환)
```
Branch: `perf/data-query-optimizations`
