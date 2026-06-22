# Progress. UI/UX 개선 — CRUD 라우트 분리와 IA 정리

## 현재 단계

구현

## 기능별 진행 현황

| Phase | 태스크 | 상태 |
|-------|--------|------|
| P1 | T101 vault layout 신규(잠금/idle 공유) | ✅ 완료 |
| P1 | T102 expenses layout 신규(공통 헤더) | ⏭️ 건너뜀 |
| P1 | T103 디렉터리 골격 + placeholder | ✅ 완료 |
| P2 | T201 /expenses 목록 전용 축소 | ✅ 완료 |
| P2 | T202 /expenses/new 신규 폼 라우트 | ✅ 완료 |
| P2 | T203 /expenses/[id] 4섹션 detail + edit | ✅ 완료 |
| P2 | T204 /expenses 필터 URL state | ✅ 완료 |
| P3 | T301 /vault entries 목록 전용 축소 | ✅ 완료 |
| P3 | T302 /vault/new 신규 entry 라우트 | ✅ 완료 |
| P3 | T303 /vault/[id] 3섹션 detail + edit | ✅ 완료 |
| P3 | T304 /vault 필터·검색 URL state | ✅ 완료 |
| P4 | T401 /vault/categories 라우트 | ✅ 완료 |
| P4 | T402 /vault/backup 라우트 | ✅ 완료 |
| P4 | T403 vault entries 헤더 보조 액션 링크 | ✅ 완료 |
| P5 | T501 Playwright visual baseline 갱신 | 🟡 spec 작성 완료 / baseline 캡처 대기 |
| P5 | T502 axe-playwright 신규 페이지 추가 | ✅ 완료 |
| P5 | T503 Jest 단위 테스트 보강 | ✅ 완료 |
| P5 | T504 README 라우트 맵 갱신 | ✅ 완료 |

## 검증 결과

- `pnpm --filter @secrets-manager/web run typecheck` ✅ 통과
- `pnpm --filter @secrets-manager/web run build` ✅ 통과. 라우트 11개(이전 5개 + 신규 6개) 등록 확인.
- `pnpm --filter @secrets-manager/web test` ✅ 32/32 단위 테스트 통과(신규 23건 포함).
- `pnpm --filter @secrets-manager/web run test:visual` 🟡 baseline 미캡처 상태. verify 단계에서 백엔드 서버 띄우고 `pnpm --filter @secrets-manager/web run test:visual:update` 실행 필요.

## 스코프 결정 메모

- **T102 expenses layout 건너뜀.** BottomTabBar 가 root layout 에 이미 존재하고 각 페이지가 자체 h1 을 가져 추가 layout 이 가치를 더하지 않음. plan.md 에서도 "본 회차는 미적용 가능" 으로 명시.
- **T401 카테고리 메타는 read-only.** spec 의 "API 변경 금지" 제약과 함께 현재 카테고리 정의가 코드 상수(`CATEGORY_LABELS`, `CATEGORY_FIELDS`) 이므로 사용자 CRUD UI 는 백엔드 변경 없이는 불가. 본 회차는 카테고리 reference view 로 구현하고 카테고리 메타 CRUD 는 향후 작업으로 이관(아래 참조).
- **T503 vault layout 잠금 fallback unit test 제외.** jest 가 jsdom 미도입(현 설정은 순수 ts 헬퍼만 대상). 잠금 fallback 회귀는 Playwright accessibility/visual spec 의 vault 서브라우트 진입 시나리오로 커버.
- **/expenses status 필터 값.** spec 예시(`status=SCHEDULED`) 는 RecurringExpense 의 데이터 모델과 직접 매핑되지 않아 `active`/`inactive`/`all` 로 구현. 알 수 없는 값은 `all` 로 fallback (테스트 매트릭스 #2 의 동작 보존).

## 산출물

**신규 파일**
- `apps/web/app/vault/layout.tsx` — 세그먼트 layout. 잠금/idle 공유 + UnlockScreen fallback.
- `apps/web/app/vault/vault-context.tsx` — VaultProvider + useVault.
- `apps/web/app/vault/vault-filter.ts` + `.spec.ts`
- `apps/web/app/vault/new/page.tsx`
- `apps/web/app/vault/[id]/page.tsx`
- `apps/web/app/vault/categories/page.tsx`
- `apps/web/app/vault/backup/page.tsx`
- `apps/web/app/expenses/expense-form-state.ts` + `.spec.ts` — 폼 ↔ payload 변환 helper.
- `apps/web/app/expenses/expense-filter.ts` + `.spec.ts` — URL filter helper.
- `apps/web/app/expenses/ExpenseForm.tsx` — 신규/수정 공용 폼 컴포넌트.
- `apps/web/app/expenses/new/page.tsx` + `NewExpenseView.tsx`
- `apps/web/app/expenses/[id]/page.tsx` + `ExpenseDetailView.tsx`
- `apps/web/tests/visual/expenses-new.spec.ts`
- `apps/web/tests/visual/expenses-detail.spec.ts`
- `apps/web/tests/visual/vault-new.spec.ts`
- `apps/web/tests/visual/vault-detail.spec.ts`
- `apps/web/tests/visual/vault-categories.spec.ts`
- `apps/web/tests/visual/vault-backup.spec.ts`

**수정 파일**
- `apps/web/app/expenses/page.tsx` — 기존 그대로 유지.
- `apps/web/app/expenses/ExpensesView.tsx` — 목록 + URL 기반 status/category 필터 전용으로 축소(363→124줄).
- `apps/web/app/vault/page.tsx` — 잠금 분기 layout 으로 이양. InstallBanner + EntriesScreen 만 mount.
- `apps/web/app/vault/EntriesScreen.tsx` — 목록 + URL 필터·검색 + 헤더 보조 액션 링크로 축소(225→168줄). 인라인 폼·BackupPanel 호출 제거.
- `apps/web/app/page.tsx` — 대시보드의 "정기 지출 추가" 링크를 `/expenses/new` 로 변경.
- `apps/web/jest.config.js` — `@/` alias moduleNameMapper 추가.
- `apps/web/tests/visual/accessibility.spec.ts` — 신규 6개 라우트 axe 검사 추가(5→11페이지).
- `apps/web/tests/visual/expenses-flow.spec.ts` — 인라인 폼 흐름 → 라우트 분리 흐름.
- `README.md` — 라우트 맵 + 시각 회귀 페이지 수 갱신.

**삭제 파일**
- `apps/web/app/vault/VaultView.tsx` — 잠금 분기 책임이 layout 으로 이양되어 obsolete.

## 블로커 / 이슈 / 특이사항

- visual baseline 캡처는 백엔드 서버가 실행 중이어야 의미 있는 상태가 캡처되므로 verify 단계에서 사용자가 직접 실행. 신규 spec 6개 + 기존 spec 5개 = 11개 baseline 갱신 필요.

## 최근 업데이트

2026-05-17 — patch 회차. review.md OPEN 2건(S3/S7 view↔edit UNTESTED) 보강. jest 멀티 프로젝트(node + jsdom)로 전환하고 RTL 기반 회귀 테스트 2개 추가. 36/36 통과.

## 다음 액션 아이템

| 담당 | 내용 | 기한 |
|------|------|------|
| 사용자 | `/project-verify ui-ux-improve` 재실행 | verify 단계 |

## 향후 작업 (TODOS 이관)

- 카테고리 메타 CRUD UI(스키마 변경·API 추가 포함). 다음 회차로 이관.
- expense detail edit 중 변경사항 보존(localStorage 또는 unsaved-change 시각 표시). 본 회차 스코프 외.
- vault entries 페이지네이션 또는 가상 스크롤. 항목 수가 100건 넘으면 검토.
- parallel/intercepting routes 도입(Approach C). PWA 경험 강화 후보.
- expense duplicate 같은 보조 액션. 신규 기능 후보.
