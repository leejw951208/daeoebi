# perf/data-query-optimizations — 작업 보고서

## Commit 1 — 683637e: 카테고리 마이그레이션 월별 1회 가드 + 병렬화

### 변경 파일
- `apps/web/app/(vault)/asset/_lib/asset-migrate-categories.ts`
- `apps/web/app/(vault)/asset/page.tsx`

### 변경 내용
**asset-migrate-categories.ts**: `for...of` + 직렬 `await` 루프를 제거하고,
`expenses.filter(categoryId === null)` 로 대상 항목을 먼저 추려낸 뒤
`Promise.all(targets.map(...))` 로 병렬 실행한다.
항목별 `try/catch` 를 유지해 개별 실패(복호화/네트워크)가 배치를 중단하지 않도록 한다.
각 항목이 0 또는 1을 반환하고 `reduce` 로 합산해 반환값 시그니처를 유지한다.

**page.tsx**: `getMigrationGuard` / `setMigrationGuard` 두 헬퍼를 모듈 수준에
추가한다. `typeof window === "undefined"` 가드로 SSR/서버 환경에서 안전하다.
`load()` 내 마이그레이션 블록을 `hasLegacy && !getMigrationGuard(month)` 조건으로
감싸, 이미 처리한 달은 건너뛴다. 마이그레이션 완료 후 `setMigrationGuard(month)`
를 호출해 이후 방문에서 재실행하지 않는다. `hasLegacy` 단락 조건도 유지해
null 이 없으면 가드 유무와 무관하게 즉시 스킵한다.

### 검증
- `pnpm --filter web test` → 48/48 PASS
- `pnpm --filter web exec tsc --noEmit` → 오류 없음
- `pnpm --filter web lint` → 경고 0

---

## Commit 2 — b54e6bf: 고정지출 머티리얼라이즈 생성 병렬화

### 변경 파일
- `apps/web/app/(vault)/asset/_lib/asset-recurring.ts`

### 변경 내용
기존 필터 조건(startMonth, termMonths, present Set)을 `templates.filter()` 로
먼저 분리해 `targets` 배열을 만든다.
`Promise.all(targets.map(async t => { openExpense → sealExpense → createExpense }))` 로
K개 템플릿을 병렬 실행한다.
각 항목 내에서 409(멱등 중복)는 `null` 반환, 그 외 오류는 `throw` 해 전파한다.
`results.filter(r => r !== null)` 로 null 을 제거해 반환 타입 `ExpenseView[]` 를 유지한다.

### 테스트 조정
`asset-recurring.spec.ts` 는 `toHaveBeenCalledTimes` 와 `not.toHaveBeenCalled` 만
검사하고 호출 순서를 단언하지 않으므로 조정 없이 전원 통과한다.

### 검증
- `pnpm --filter web test` → 48/48 PASS (asset-recurring.spec 포함)
- `pnpm --filter web exec tsc --noEmit` → 오류 없음
- `pnpm --filter web lint` → 경고 0

---

## Commit 3 — 8d2cb2a: 시트 변경 후 부모 reload 를 닫을 때 1회로 합침

### 변경 파일
- `apps/web/app/(vault)/asset/_components/CategoryManager.tsx`
- `apps/web/app/(vault)/asset/_components/income/IncomeSheet.tsx`

### 변경 내용
**CategoryManager.tsx**: `dirty` boolean 상태를 추가한다.
`handleAdd` / `handleEdit` / `confirmDelete` 성공 시 `onChanged?.()` 호출을 제거하고
`setDirty(true)` 로 교체한다. `loadCategories()` 는 유지해 시트가 열린 동안
목록이 즉시 갱신된다. `handleClose()` 헬퍼를 추가해 `dirty` 일 때만
`onChanged?.()` 를 호출하고 `onClose()` 를 실행한다. 백드롭 클릭·닫기 버튼 두
곳 모두 `handleClose()` 를 사용한다.

**IncomeSheet.tsx**: `props.incomes` 로 초기화되는 `localIncomes` 상태와 `dirty`
상태를 추가한다. `refreshLocalIncomes()` 함수를 추가해 `listIncomes(month)` →
`Promise.allSettled(openIncome(...))` 로 목록을 독립적으로 갱신한다.
`save()` 와 `confirmDelete()` 에서 `await onChanged()` 를 제거하고
`setDirty(true)` + `await refreshLocalIncomes()` 로 교체한다.
`handleClose()` 에서 `dirty` 일 때만 `void onChanged()` 를 호출한다.
JSX 에서 `incomes` → `localIncomes` 로 교체해 갱신된 목록을 표시한다.

닫지 않고 변경 없이 종료 시 → 부모 리로드 없음.
변경 후 닫으면 → 정확히 1회 리로드. 중간 쓰기 N회 → 부모 리로드 N→1 감소.

### 검증
- `pnpm --filter web test` → 48/48 PASS
- `pnpm --filter web exec tsc --noEmit` → 오류 없음
- `pnpm --filter web lint` → 경고 0

---

## 최종 빌드
`pnpm --filter web build` → 빌드 성공 (오류·경고 없음, 정적 8페이지 생성 완료)
