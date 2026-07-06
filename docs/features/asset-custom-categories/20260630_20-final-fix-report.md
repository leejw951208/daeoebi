# Final Fix Report — feat/asset-custom-categories

## Fix A — updateRecurring client type omits categoryId
**File:** `apps/web/lib/vault-client.ts`
**Change:** Added `categoryId?: string` to the `input` parameter type of `updateRecurring()`. The type was asymmetric with `updateExpense` and `createRecurring`, both of which already included `categoryId`. No runtime behavior changed.

## Fix B — edit page state race between two useEffects
**File:** `apps/web/app/(vault)/asset/[id]/page.tsx`
**Change:** Eliminated the two independent `useEffect` calls that wrote to the same `State`. Replaced with a single effect using `Promise.all([getExpense(id), listAssetCategories()])`. The page is only set to `status: "ready"` when both fetches succeed. Either failure sets `status: "error"`. Moved `categories` out of separate state and into `State.ready` (`{ status: "ready"; initial: ExpenseFormInitial; categories: AssetCategory[] }`). `ExpenseForm` now receives `state.categories` instead of the orphan `categories` state variable.

## Fix C — re-add amount=0 exclusion test
**File:** `apps/web/app/(vault)/asset/_lib/asset-compute.spec.ts`
**Change:** Added test `"byCategory 는 지출 0인 항목을 제외한다"` using the existing `exp` fixture and `CATS`. Asserts `byCategory([exp({ categoryId: "c1", amount: 0 })], CATS)` returns an empty array (length 0).

## Fix D — stale file header comment
**File:** `apps/web/app/(vault)/asset/_lib/asset-payload.ts`
**Change:** Updated line 1 comment from the inaccurate "금액·항목·카테고리·결제방법을 VK 로 암호화한다" to "지출 블롭은 항목·금액만, 수입 블롭은 항목·금액·카테고리를 VK 로 암호화한다", reflecting that category is now a server-side FK column, not in the expense blob.

## Verification

| Check | Result |
|-------|--------|
| `pnpm --filter web test` | PASS — 48 tests, 10 suites |
| `pnpm --filter web exec tsc --noEmit` | PASS — no output (clean) |
| `pnpm --filter web lint` | PASS — no warnings |
| `pnpm --filter web build` | PASS — compiled successfully |
| `pnpm --filter @daeoebi/api typecheck` | PASS — no output (clean) |

## Commit
`c4f61df fix(web): 고정 지출 카테고리 수정 타입·수정 페이지 로드 경쟁·테스트·주석 보강`

## Files Changed
- `apps/web/lib/vault-client.ts`
- `apps/web/app/(vault)/asset/[id]/page.tsx`
- `apps/web/app/(vault)/asset/_lib/asset-compute.spec.ts`
- `apps/web/app/(vault)/asset/_lib/asset-payload.ts`
