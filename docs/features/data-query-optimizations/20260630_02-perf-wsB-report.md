# perf/data-query-optimizations — Migration Report

## Commit 1: `a5b1e1e` — 조회 필터·정렬 커버용 복합 인덱스 추가

### Schema diff
| Model | Before | After |
|---|---|---|
| Category | `@@index([siteId])`, `@@index([label])` | `@@index([siteId, label])` |
| RecurringExpense | `@@index([active])` | `@@index([active, createdAt])` |
| Expense | `@@index([date])` | `@@index([removed, date])` |
| Secret | `@@index([siteId])`, `@@index([label])` | `@@index([siteId, label])` |
| Site | `@@index([label])` | unchanged |

### Migration dir
`apps/api/prisma/migrations/20260630042844_optimize_query_indexes/`

Key SQL:
```sql
DROP INDEX "Category_label_idx";
DROP INDEX "Category_siteId_idx";
DROP INDEX "Expense_date_idx";
DROP INDEX "RecurringExpense_active_idx";
DROP INDEX "Secret_label_idx";
DROP INDEX "Secret_siteId_idx";
CREATE INDEX "Category_siteId_label_idx" ON "Category"("siteId", "label");
CREATE INDEX "Expense_removed_date_idx" ON "Expense"("removed", "date");
CREATE INDEX "RecurringExpense_active_createdAt_idx" ON "RecurringExpense"("active", "createdAt");
CREATE INDEX "Secret_siteId_label_idx" ON "Secret"("siteId", "label");
```

### Applied: YES — no pending migrations after apply.

---

## Commit 2: `55090ba` — 검색 ILIKE 가속용 pg_trgm GIN 인덱스

### Schema diff
- `generator client`: added `previewFeatures = ["postgresqlExtensions"]`
- `datasource db`: added `extensions = [pg_trgm]`
- Site: `@@index([label(ops: raw("gin_trgm_ops"))], type: Gin, map: "Site_label_trgm_idx")`
- Category: `@@index([label(ops: raw("gin_trgm_ops"))], type: Gin, map: "Category_label_trgm_idx")`
- Secret: `@@index([label(ops: raw("gin_trgm_ops"))], type: Gin, map: "Secret_label_trgm_idx")`

Note: explicit `map:` names required because each model already has a btree `@@index([label])` — without distinct map names Prisma reports a namespace collision.

### Migration dir
`apps/api/prisma/migrations/20260630042928_add_trgm_search_indexes/`

Key SQL:
```sql
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE INDEX "Category_label_trgm_idx" ON "Category" USING GIN ("label" gin_trgm_ops);
CREATE INDEX "Secret_label_trgm_idx" ON "Secret" USING GIN ("label" gin_trgm_ops);
CREATE INDEX "Site_label_trgm_idx" ON "Site" USING GIN ("label" gin_trgm_ops);
```

### Applied: YES — no pending migrations after apply.

### Drift check
`pnpm prisma migrate dev --name _noop_check` → output: `Changes:` (empty — no schema changes, nothing to migrate). No drift.

### Fallback used: NO — schema-managed approach (previewFeatures + extensions + Gin index) succeeded.

---

## Verification

| Check | Result |
|---|---|
| `prisma:generate` | OK — Generated Prisma Client 7.8.0 |
| `typecheck` | PASS — `tsc --noEmit` clean |
| `test:unit` | PASS — 89 tests, 14 suites, 0 failures |
