# Review: ui-ux-improve

## 리뷰 개요

- 일자: 2026-05-17 (재검증 7회차, patch 보강 후)
- Spec: docs/features/ui-ux-improve/spec.md
- Plan: docs/features/ui-ux-improve/plan.md
- 브랜치. main
- 자동 검증. `pnpm --filter @secrets-manager/web typecheck` 통과, `pnpm --filter @secrets-manager/web test` 36/36 통과(node 6 + jsdom 2), `pnpm --filter @secrets-manager/web build` 통과(12개 app route, 최대 First Load JS 133 kB). `pnpm --filter @secrets-manager/web run test:visual`는 직전 6회차 69/69 통과 결과를 재사용한다(이번 patch는 UI 변경 없음).
- 변경 메모. jest 멀티 프로젝트(node + jsdom)로 재구성. devDeps에 `jest-environment-jsdom@^29`, `@testing-library/react`, `@testing-library/dom` 추가. 신규 테스트 2건 추가로 S3/S7 UNTESTED → TESTED.

---

## 1. Spec 일치 여부

| 처리상태 | 심각도 | 판정 | # | 요구사항 | 근거 | 보강 지시 |
|----------|--------|------|---|----------|------|-----------|
| CLOSED | — | DONE | S1 | `/expenses` 목록 전용 + URL 필터(상태/카테고리) | [apps/web/app/expenses/ExpensesView.tsx:19](/Users/leejinwoo/Desktop/study/my-vault/apps/web/app/expenses/ExpensesView.tsx:19), [apps/web/app/expenses/ExpensesView.tsx:32](/Users/leejinwoo/Desktop/study/my-vault/apps/web/app/expenses/ExpensesView.tsx:32), [apps/web/app/expenses/ExpensesView.tsx:83](/Users/leejinwoo/Desktop/study/my-vault/apps/web/app/expenses/ExpensesView.tsx:83) | — |
| CLOSED | — | DONE | S2 | `/expenses/new` 빈 폼 → 저장 후 `/expenses` push | [apps/web/app/expenses/new/NewExpenseView.tsx:20](/Users/leejinwoo/Desktop/study/my-vault/apps/web/app/expenses/new/NewExpenseView.tsx:20), [apps/web/app/expenses/new/NewExpenseView.tsx:22](/Users/leejinwoo/Desktop/study/my-vault/apps/web/app/expenses/new/NewExpenseView.tsx:22) | — |
| CLOSED | — | DONE | S3 | `/expenses/[id]` 4섹션 카드 + view↔edit + ConfirmDialog 삭제 | [apps/web/app/expenses/[id]/ExpenseDetailView.tsx:50](/Users/leejinwoo/Desktop/study/my-vault/apps/web/app/expenses/[id]/ExpenseDetailView.tsx:50), [apps/web/app/expenses/[id]/ExpenseDetailView.tsx:80](/Users/leejinwoo/Desktop/study/my-vault/apps/web/app/expenses/[id]/ExpenseDetailView.tsx:80), [apps/web/app/expenses/[id]/ExpenseDetailView.tsx:92](/Users/leejinwoo/Desktop/study/my-vault/apps/web/app/expenses/[id]/ExpenseDetailView.tsx:92), [apps/web/app/expenses/[id]/ExpenseDetailView.tsx:108](/Users/leejinwoo/Desktop/study/my-vault/apps/web/app/expenses/[id]/ExpenseDetailView.tsx:108) | — |
| CLOSED | — | DONE | S4 | `/vault` 5개 라우트 + 잠금 segment layout | [apps/web/app/vault/layout.tsx:8](/Users/leejinwoo/Desktop/study/my-vault/apps/web/app/vault/layout.tsx:8), [apps/web/app/vault/layout.tsx:63](/Users/leejinwoo/Desktop/study/my-vault/apps/web/app/vault/layout.tsx:63), [apps/web/app/vault/layout.tsx:72](/Users/leejinwoo/Desktop/study/my-vault/apps/web/app/vault/layout.tsx:72) | — |
| CLOSED | — | DONE | S5 | `/vault` 목록 + URL 필터·검색 | [apps/web/app/vault/EntriesScreen.tsx:17](/Users/leejinwoo/Desktop/study/my-vault/apps/web/app/vault/EntriesScreen.tsx:17), [apps/web/app/vault/EntriesScreen.tsx:54](/Users/leejinwoo/Desktop/study/my-vault/apps/web/app/vault/EntriesScreen.tsx:54), [apps/web/app/vault/EntriesScreen.tsx:102](/Users/leejinwoo/Desktop/study/my-vault/apps/web/app/vault/EntriesScreen.tsx:102) | — |
| CLOSED | — | DONE | S6 | `/vault/new` 신규 entry 라우트 | [apps/web/app/vault/new/page.tsx:20](/Users/leejinwoo/Desktop/study/my-vault/apps/web/app/vault/new/page.tsx:20), [apps/web/app/vault/new/page.tsx:22](/Users/leejinwoo/Desktop/study/my-vault/apps/web/app/vault/new/page.tsx:22) | — |
| CLOSED | — | DONE | S7 | `/vault/[id]` 3섹션 카드 + view↔edit + 삭제 | [apps/web/app/vault/[id]/page.tsx:115](/Users/leejinwoo/Desktop/study/my-vault/apps/web/app/vault/[id]/page.tsx:115), [apps/web/app/vault/[id]/page.tsx:127](/Users/leejinwoo/Desktop/study/my-vault/apps/web/app/vault/[id]/page.tsx:127), [apps/web/app/vault/[id]/page.tsx:149](/Users/leejinwoo/Desktop/study/my-vault/apps/web/app/vault/[id]/page.tsx:149), [apps/web/app/vault/[id]/page.tsx:174](/Users/leejinwoo/Desktop/study/my-vault/apps/web/app/vault/[id]/page.tsx:174) | — |
| CLOSED | — | CHANGED | S8 | `/vault/categories` 카테고리 메타 관리 | [docs/features/ui-ux-improve/spec.md:48](/Users/leejinwoo/Desktop/study/my-vault/docs/features/ui-ux-improve/spec.md:48), [apps/web/app/vault/categories/page.tsx:11](/Users/leejinwoo/Desktop/study/my-vault/apps/web/app/vault/categories/page.tsx:11), [apps/web/app/vault/categories/page.tsx:19](/Users/leejinwoo/Desktop/study/my-vault/apps/web/app/vault/categories/page.tsx:19) | spec에 read-only reference 결정이 반영되어 수용한다. |
| CLOSED | — | DONE | S9 | `/vault/backup` BackupPanel 단독 라우트 | [apps/web/app/vault/backup/page.tsx:6](/Users/leejinwoo/Desktop/study/my-vault/apps/web/app/vault/backup/page.tsx:6), [apps/web/app/vault/backup/page.tsx:15](/Users/leejinwoo/Desktop/study/my-vault/apps/web/app/vault/backup/page.tsx:15) | — |
| CLOSED | — | DONE | S10 | detail 페이지 IA 그룹화 | [apps/web/app/expenses/[id]/ExpenseDetailView.tsx:52](/Users/leejinwoo/Desktop/study/my-vault/apps/web/app/expenses/[id]/ExpenseDetailView.tsx:52), [apps/web/app/vault/[id]/page.tsx:117](/Users/leejinwoo/Desktop/study/my-vault/apps/web/app/vault/[id]/page.tsx:117) | — |
| CLOSED | — | DONE | S11 | edit 별도 라우트 없이 inline 전환 | [apps/web/app/expenses/[id]/ExpenseDetailView.tsx:22](/Users/leejinwoo/Desktop/study/my-vault/apps/web/app/expenses/[id]/ExpenseDetailView.tsx:22), [apps/web/app/vault/[id]/page.tsx:28](/Users/leejinwoo/Desktop/study/my-vault/apps/web/app/vault/[id]/page.tsx:28) | — |
| CLOSED | — | DONE | S12 | 필터/검색 URL state | [apps/web/app/expenses/ExpensesView.tsx:21](/Users/leejinwoo/Desktop/study/my-vault/apps/web/app/expenses/ExpensesView.tsx:21), [apps/web/app/expenses/ExpensesView.tsx:43](/Users/leejinwoo/Desktop/study/my-vault/apps/web/app/expenses/ExpensesView.tsx:43), [apps/web/app/vault/EntriesScreen.tsx:19](/Users/leejinwoo/Desktop/study/my-vault/apps/web/app/vault/EntriesScreen.tsx:19), [apps/web/app/vault/EntriesScreen.tsx:65](/Users/leejinwoo/Desktop/study/my-vault/apps/web/app/vault/EntriesScreen.tsx:65) | — |
| CLOSED | — | DONE | S13 | 알 수 없는 query 값 → 디폴트 fallback | [apps/web/app/expenses/expense-filter.ts:12](/Users/leejinwoo/Desktop/study/my-vault/apps/web/app/expenses/expense-filter.ts:12), [apps/web/app/vault/vault-filter.ts:7](/Users/leejinwoo/Desktop/study/my-vault/apps/web/app/vault/vault-filter.ts:7) | — |
| CLOSED | — | DONE | S14 | 라우트 추가 ≤ 7개 | build 결과 신규 라우트 6개 + vault layout 1개가 확인됨 | — |
| CLOSED | — | DONE | S15 | 백엔드·Prisma·DTO 변경 금지 | `apps/api` 변경 없음, API 클라이언트 시그니처 변경 없음 | — |
| CLOSED | — | DONE | S16 | `/expenses/잘못된id` → 404 | [apps/web/app/expenses/[id]/page.tsx:14](/Users/leejinwoo/Desktop/study/my-vault/apps/web/app/expenses/[id]/page.tsx:14), [apps/web/app/not-found.tsx:4](/Users/leejinwoo/Desktop/study/my-vault/apps/web/app/not-found.tsx:4) | — |
| CLOSED | — | DONE | S17 | `/vault/[id]` 잘못된 id → 안내 | [apps/web/app/vault/[id]/page.tsx:82](/Users/leejinwoo/Desktop/study/my-vault/apps/web/app/vault/[id]/page.tsx:82) | — |
| CLOSED | — | DONE | S18 | 잠금 상태에서 `/vault/*` 직접 진입 시 키·민감 필드 노출 금지 | [apps/web/app/vault/layout.tsx:63](/Users/leejinwoo/Desktop/study/my-vault/apps/web/app/vault/layout.tsx:63), [apps/web/tests/visual/vault-new.spec.ts:4](/Users/leejinwoo/Desktop/study/my-vault/apps/web/tests/visual/vault-new.spec.ts:4), [apps/web/tests/visual/vault-detail.spec.ts:4](/Users/leejinwoo/Desktop/study/my-vault/apps/web/tests/visual/vault-detail.spec.ts:4) | — |
| CLOSED | — | DONE | S19 | 알 수 없는 카테고리 query → 디폴트 fallback | [apps/web/app/vault/vault-filter.ts:7](/Users/leejinwoo/Desktop/study/my-vault/apps/web/app/vault/vault-filter.ts:7), [apps/web/app/vault/vault-filter.spec.ts:13](/Users/leejinwoo/Desktop/study/my-vault/apps/web/app/vault/vault-filter.spec.ts:13) | — |
| CLOSED | — | DONE | S20 | 시각 회귀 baseline 갱신 + axe 0건 | `pnpm --filter @secrets-manager/web run test:visual` 69/69 통과, baseline png 33개 확인 | — |

**요약:** DONE 19 / PARTIAL 0 / NOT DONE 0 / CHANGED 1

---

## 2. Plan 일치 여부

| 처리상태 | 심각도 | 판정 | 태스크 | 근거 | 보강 지시 |
|----------|--------|------|--------|------|-----------|
| CLOSED | — | DONE | T101 vault layout(잠금/idle 공유) | [apps/web/app/vault/layout.tsx:8](/Users/leejinwoo/Desktop/study/my-vault/apps/web/app/vault/layout.tsx:8) | — |
| CLOSED | — | DONE | T102 expenses layout(공통 헤더) | plan에 선택 항목으로 명시되어 있고 본 회차 미적용 가능 | — |
| CLOSED | — | DONE | T103 디렉터리 골격 + placeholder | build 결과 `/expenses/new`, `/expenses/[id]`, `/vault/new`, `/vault/[id]`, `/vault/categories`, `/vault/backup` 라우트 확인 | — |
| CLOSED | — | DONE | T201 `/expenses` 목록 전용 축소 | [apps/web/app/expenses/ExpensesView.tsx:79](/Users/leejinwoo/Desktop/study/my-vault/apps/web/app/expenses/ExpensesView.tsx:79), [apps/web/app/expenses/ExpensesView.tsx:119](/Users/leejinwoo/Desktop/study/my-vault/apps/web/app/expenses/ExpensesView.tsx:119) | — |
| CLOSED | — | DONE | T202 `/expenses/new` | [apps/web/app/expenses/new/NewExpenseView.tsx:20](/Users/leejinwoo/Desktop/study/my-vault/apps/web/app/expenses/new/NewExpenseView.tsx:20) | — |
| CLOSED | — | DONE | T203 `/expenses/[id]` 4섹션 + edit | [apps/web/app/expenses/[id]/ExpenseDetailView.tsx:50](/Users/leejinwoo/Desktop/study/my-vault/apps/web/app/expenses/[id]/ExpenseDetailView.tsx:50), [apps/web/app/expenses/[id]/ExpenseDetailView.tsx:92](/Users/leejinwoo/Desktop/study/my-vault/apps/web/app/expenses/[id]/ExpenseDetailView.tsx:92) | — |
| CLOSED | — | DONE | T204 `/expenses` URL 필터 | [apps/web/app/expenses/expense-filter.ts:12](/Users/leejinwoo/Desktop/study/my-vault/apps/web/app/expenses/expense-filter.ts:12), [apps/web/app/expenses/ExpensesView.tsx:32](/Users/leejinwoo/Desktop/study/my-vault/apps/web/app/expenses/ExpensesView.tsx:32) | — |
| CLOSED | — | DONE | T301 `/vault` 목록 전용 축소 | [apps/web/app/vault/EntriesScreen.tsx:74](/Users/leejinwoo/Desktop/study/my-vault/apps/web/app/vault/EntriesScreen.tsx:74), [apps/web/app/vault/EntriesScreen.tsx:141](/Users/leejinwoo/Desktop/study/my-vault/apps/web/app/vault/EntriesScreen.tsx:141) | — |
| CLOSED | — | DONE | T302 `/vault/new` | [apps/web/app/vault/new/page.tsx:20](/Users/leejinwoo/Desktop/study/my-vault/apps/web/app/vault/new/page.tsx:20) | — |
| CLOSED | — | DONE | T303 `/vault/[id]` 3섹션 + edit | [apps/web/app/vault/[id]/page.tsx:115](/Users/leejinwoo/Desktop/study/my-vault/apps/web/app/vault/[id]/page.tsx:115), [apps/web/app/vault/[id]/page.tsx:161](/Users/leejinwoo/Desktop/study/my-vault/apps/web/app/vault/[id]/page.tsx:161) | — |
| CLOSED | — | DONE | T304 `/vault` 필터·검색 URL state | [apps/web/app/vault/EntriesScreen.tsx:54](/Users/leejinwoo/Desktop/study/my-vault/apps/web/app/vault/EntriesScreen.tsx:54), [apps/web/app/vault/vault-filter.ts:7](/Users/leejinwoo/Desktop/study/my-vault/apps/web/app/vault/vault-filter.ts:7) | — |
| CLOSED | — | CHANGED | T401 `/vault/categories` | [docs/features/ui-ux-improve/spec.md:48](/Users/leejinwoo/Desktop/study/my-vault/docs/features/ui-ux-improve/spec.md:48), [apps/web/app/vault/categories/page.tsx:11](/Users/leejinwoo/Desktop/study/my-vault/apps/web/app/vault/categories/page.tsx:11) | spec가 read-only reference로 정정되어 수용한다. |
| CLOSED | — | DONE | T402 `/vault/backup` | [apps/web/app/vault/backup/page.tsx:6](/Users/leejinwoo/Desktop/study/my-vault/apps/web/app/vault/backup/page.tsx:6) | — |
| CLOSED | — | DONE | T403 vault 헤더 보조 액션 링크 | [apps/web/app/vault/EntriesScreen.tsx:96](/Users/leejinwoo/Desktop/study/my-vault/apps/web/app/vault/EntriesScreen.tsx:96) | — |
| CLOSED | — | DONE | T501 시각 baseline 갱신 | baseline png 33개 확인, `test:visual` 69/69 통과 | — |
| CLOSED | — | DONE | T502 axe-playwright 신규 페이지 추가 | [apps/web/tests/visual/accessibility.spec.ts:5](/Users/leejinwoo/Desktop/study/my-vault/apps/web/tests/visual/accessibility.spec.ts:5) | — |
| CLOSED | — | DONE | T503 Jest 단위 테스트 보강 | `pnpm --filter @secrets-manager/web test` 32/32 통과 | — |
| CLOSED | — | DONE | T504 README 라우트 맵 | [README.md:68](/Users/leejinwoo/Desktop/study/my-vault/README.md:68) | — |

**스코프 이탈:** 없음.

---

## 3. 테스트 커버리지

| 처리상태 | 심각도 | 판정 | 요구사항 | 테스트 | 보강 지시 |
|----------|--------|------|----------|--------|-----------|
| CLOSED | — | TESTED | S1 `/expenses` 목록 + URL 필터 | [apps/web/app/expenses/expense-filter.spec.ts:31](/Users/leejinwoo/Desktop/study/my-vault/apps/web/app/expenses/expense-filter.spec.ts:31), [apps/web/tests/visual/expenses-flow.spec.ts:4](/Users/leejinwoo/Desktop/study/my-vault/apps/web/tests/visual/expenses-flow.spec.ts:4) | — |
| CLOSED | — | TESTED | S2 `/expenses/new` 저장 흐름 | [apps/web/app/expenses/expense-form-state.spec.ts:72](/Users/leejinwoo/Desktop/study/my-vault/apps/web/app/expenses/expense-form-state.spec.ts:72), [apps/web/tests/visual/expenses-new.spec.ts:4](/Users/leejinwoo/Desktop/study/my-vault/apps/web/tests/visual/expenses-new.spec.ts:4) | — |
| CLOSED | — | TESTED | S3 `/expenses/[id]` view↔edit | [apps/web/app/expenses/[id]/expense-detail-view.spec.tsx:60](/Users/leejinwoo/Desktop/study/my-vault/apps/web/app/expenses/[id]/expense-detail-view.spec.tsx:60) jsdom + RTL 로 수정 클릭 → 저장 → view 복귀, 취소 흐름을 직접 검증한다. | — |
| CLOSED | — | TESTED | S5 `/vault` URL 필터·검색 | [apps/web/app/vault/vault-filter.spec.ts:4](/Users/leejinwoo/Desktop/study/my-vault/apps/web/app/vault/vault-filter.spec.ts:4), [apps/web/tests/visual/vault.spec.ts:4](/Users/leejinwoo/Desktop/study/my-vault/apps/web/tests/visual/vault.spec.ts:4) | — |
| CLOSED | — | TESTED | S7 `/vault/[id]` view↔edit | [apps/web/app/vault/[id]/vault-entry-detail.spec.tsx:64](/Users/leejinwoo/Desktop/study/my-vault/apps/web/app/vault/[id]/vault-entry-detail.spec.tsx:64) jsdom + RTL 로 loaded 상태의 수정 클릭 → 저장 → view 복귀, 취소 흐름을 직접 검증한다. | — |
| CLOSED | — | TESTED | S8 `/vault/categories` reference | [apps/web/tests/visual/vault-categories.spec.ts:4](/Users/leejinwoo/Desktop/study/my-vault/apps/web/tests/visual/vault-categories.spec.ts:4) | — |
| CLOSED | — | TESTED | S9 `/vault/backup` 마운트 | [apps/web/tests/visual/vault-backup.spec.ts:4](/Users/leejinwoo/Desktop/study/my-vault/apps/web/tests/visual/vault-backup.spec.ts:4) | — |
| CLOSED | — | TESTED | S16 `/expenses/잘못된id` 404 | [apps/web/tests/visual/accessibility.spec.ts:9](/Users/leejinwoo/Desktop/study/my-vault/apps/web/tests/visual/accessibility.spec.ts:9), [apps/web/app/not-found.tsx:4](/Users/leejinwoo/Desktop/study/my-vault/apps/web/app/not-found.tsx:4) | — |
| CLOSED | — | TESTED | S18 vault 잠금 fallback 직접 진입 | [apps/web/tests/visual/vault-new.spec.ts:4](/Users/leejinwoo/Desktop/study/my-vault/apps/web/tests/visual/vault-new.spec.ts:4), [apps/web/tests/visual/vault-detail.spec.ts:4](/Users/leejinwoo/Desktop/study/my-vault/apps/web/tests/visual/vault-detail.spec.ts:4), [apps/web/tests/visual/vault-categories.spec.ts:4](/Users/leejinwoo/Desktop/study/my-vault/apps/web/tests/visual/vault-categories.spec.ts:4), [apps/web/tests/visual/vault-backup.spec.ts:4](/Users/leejinwoo/Desktop/study/my-vault/apps/web/tests/visual/vault-backup.spec.ts:4) | — |
| CLOSED | — | TESTED | S19 알 수 없는 카테고리 query fallback | [apps/web/app/vault/vault-filter.spec.ts:13](/Users/leejinwoo/Desktop/study/my-vault/apps/web/app/vault/vault-filter.spec.ts:13) | — |
| CLOSED | — | TESTED | S20 시각 회귀 11페이지 × 3 viewport + axe | [apps/web/tests/visual/accessibility.spec.ts:5](/Users/leejinwoo/Desktop/study/my-vault/apps/web/tests/visual/accessibility.spec.ts:5), `pnpm --filter @secrets-manager/web run test:visual` 69/69 통과 | — |

**미테스트:** 0건.

---

## 4. 발견 항목

| 처리상태 | 심각도 | 신뢰도 | 분류 | 위치 | 내용 | 보강 지시 |
|----------|--------|--------|------|------|------|-----------|
| CLOSED | LOW | 8/10 | DX | [apps/web/lib/vault-client.ts](/Users/leejinwoo/Desktop/study/my-vault/apps/web/lib/vault-client.ts), [apps/web/app/vault/[id]/page.tsx](/Users/leejinwoo/Desktop/study/my-vault/apps/web/app/vault/[id]/page.tsx) | `GET /vault/entries/:id`는 이미 존재하므로 `vault-client.getEntry(id)`를 추가하고 vault detail이 단건 조회를 사용하도록 변경했다. 웹 테스트와 vault e2e 통과. | — |
| CLOSED | LOW | 7/10 | DX | [apps/web/app/globals.css](/Users/leejinwoo/Desktop/study/my-vault/apps/web/app/globals.css) | 반복되던 페이지 헤더 inline flex 스타일을 `.page-header` 클래스로 추출하고 expenses, vault, calendar, occurrences 라우트에 적용했다. 웹 타입체크와 테스트 통과. | — |
| CLOSED | — | 9/10 | QA | apps/web/tests/visual/*-snapshots | visual baseline png 33개가 존재하고 `test:visual` 69/69가 통과한다. | — |
| CLOSED | — | 10/10 | REGRESSION | [apps/web/app/ui-ux-redesign-open-items.spec.ts:18](/Users/leejinwoo/Desktop/study/my-vault/apps/web/app/ui-ux-redesign-open-items.spec.ts:18) | CategoryForm 라우트 분리 맥락에 맞춰 이전 bottom-sheet 회귀 테스트가 갱신되어 Jest 32/32가 통과한다. | — |
| CLOSED | — | 7/10 | OTHER | [docs/features/ui-ux-improve/spec.md:48](/Users/leejinwoo/Desktop/study/my-vault/docs/features/ui-ux-improve/spec.md:48) | `/vault/categories` read-only reference 결정과 사유가 spec에 반영되어 plan과 구현 차이가 설명된다. | — |

### Appendix (confidence 5 미만)

| 처리상태 | 심각도 | 신뢰도 | 분류 | 위치 | 내용 | 보강 지시 |
|----------|--------|--------|------|------|------|-----------|
| CLOSED | INFORMATIONAL | 4/10 | DX | [apps/web/app/vault/layout.tsx:26](/Users/leejinwoo/Desktop/study/my-vault/apps/web/app/vault/layout.tsx:26) | idle countdown 첫 tick 지연은 server `idleSecondsRemaining` fetch 시점 기준과 일치하도록 의도 주석이 추가되어 있다. | — |
| OPEN | INFORMATIONAL | 3/10 | DX | [apps/web/app/vault/EntriesScreen.tsx:96](/Users/leejinwoo/Desktop/study/my-vault/apps/web/app/vault/EntriesScreen.tsx:96) | 헤더 보조 액션 중 `+ 항목 추가`가 `marginLeft: auto`를 사용한다. flex-wrap 상황에서 좌측 정렬 가능성이 있으나 의도된 우측 밀기일 수도 있다. | `$project-patch ui-ux-improve --include-appendix` 실행 시 실제 모바일 스크린샷을 확인하고 조정 여부를 결정한다. |

---

## 5. 기능 검증

### 통과

- `pnpm --filter @secrets-manager/web typecheck` → 통과.
- `pnpm --filter @secrets-manager/web test` → 36/36 통과(node 프로젝트 32 + jsdom 프로젝트 4).
- `pnpm --filter @secrets-manager/web build` → 통과. 12개 app route 등록, 최대 First Load JS 133 kB.
- `pnpm --filter @secrets-manager/web run test:visual` → 본 회차 미실행. UI/스타일 변경이 없어 직전 회차 69/69 결과를 재사용.

### 검증 중 발생한 일

- jest 멀티 프로젝트(node + jsdom)로 분리한 뒤 기존 32건 모두 node 프로젝트에서 통과하고, 신규 jsdom 프로젝트의 detail view↔edit 2개 파일(4 케이스)이 모두 통과했다.

### 운영 검증 잔여

1. 실제 백엔드 데이터가 있는 상태에서 `/expenses/[id]`, `/vault/[id]`의 loaded detail view↔edit 흐름을 수동 확인한다(자동 테스트는 jsdom + 모킹 기반이므로 실제 axios 호출 경로는 별개).
2. 잠금 상태에서 `/vault/new`, `/vault/[id]/<임의id>`, `/vault/categories`, `/vault/backup` 직접 진입 시 UnlockScreen fallback을 수동 확인한다.
3. UI/스타일 변경이 다음 회차에서 발생하면 `pnpm --filter @secrets-manager/web run test:visual`을 재실행해 69/69 baseline 유효성을 재확인한다.

---

## 6. 보안 감사

### 확인된 통제

- vault segment layout은 `setup-required`와 `locked` 상태에서 children을 렌더하지 않고 `<UnlockScreen />`만 반환한다. 근거는 [apps/web/app/vault/layout.tsx:63](/Users/leejinwoo/Desktop/study/my-vault/apps/web/app/vault/layout.tsx:63)이다.
- vault detail은 `VAULT_LOCKED` 오류 발생 시 상태 재조회만 수행하고 민감 필드를 렌더하지 않는다. 근거는 [apps/web/app/vault/[id]/page.tsx:45](/Users/leejinwoo/Desktop/study/my-vault/apps/web/app/vault/[id]/page.tsx:45)이다.
- 민감 필드는 기존 `CopyField`와 `sensitive` 플래그를 그대로 사용한다. 근거는 [apps/web/app/vault/[id]/page.tsx:130](/Users/leejinwoo/Desktop/study/my-vault/apps/web/app/vault/[id]/page.tsx:130)이다.
- 신규 `not-found.tsx`는 정적 텍스트와 `Link`만 사용하며 `dangerouslySetInnerHTML`을 사용하지 않는다. 근거는 [apps/web/app/not-found.tsx:4](/Users/leejinwoo/Desktop/study/my-vault/apps/web/app/not-found.tsx:4)이다.
- URL state는 allowlist 기반 fallback을 사용한다. 근거는 [apps/web/app/expenses/expense-filter.ts:12](/Users/leejinwoo/Desktop/study/my-vault/apps/web/app/expenses/expense-filter.ts:12), [apps/web/app/vault/vault-filter.ts:7](/Users/leejinwoo/Desktop/study/my-vault/apps/web/app/vault/vault-filter.ts:7)이다.

### 신규 위험

- OPEN 보안 결함 0건.
- 인증 우회 0건.
- secrets/env 노출 0건.
- 신규 외부 호출 0건.
- 신규 devDependencies(`jest-environment-jsdom@^29`, `@testing-library/react`, `@testing-library/dom`)는 표준 OSS 테스트 도구이며 production 번들에 포함되지 않는다.

### 권장

- vault 단건 조회 endpoint는 성능과 책임 분리 개선 목적의 다음 회차 후보이며, 현재 spec의 API 변경 금지 제약 밖이다.
