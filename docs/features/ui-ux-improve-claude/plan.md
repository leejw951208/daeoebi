# Plan. UI/UX 개선 — CRUD 라우트 분리와 IA 정리

## 단계 구성

| Phase | 이름 | 목표 |
|-------|------|------|
| P1 | 라우트 골격 + segment layout | `/expenses` 와 `/vault` 의 디렉터리·layout 가 정리되어 후속 페이지 추가가 단순해진다. |
| P2 | /expenses CRUD 분리 + 필터 URL state | 정기 지출 화면이 목록 전용으로 가벼워지고, 신규/수정은 별도 라우트에서 수행된다. |
| P3 | /vault entries CRUD 분리 + 필터·검색 URL state | 보관함 entries 가 목록 전용이 되고, 잠금 상태가 segment layout 으로 공유된다. |
| P4 | /vault categories·backup 라우트 분리 | 카테고리 관리와 백업/복원이 vault 인라인에서 빠져 독립 라우트로 동작한다. |
| P5 | 시각 회귀 baseline 갱신 + 회귀 테스트 | Playwright visual + axe baseline 이 새 라우트 구조로 모두 통과한다. |

## 구현 태스크

### P1. 라우트 골격 + segment layout

- [ ] **T101** `apps/web/app/vault/layout.tsx` 신규. 잠금 상태와 idle timer 를 lift 하고 모든 vault 서브라우트에서 공유. 잠금 시 `<UnlockScreen />` fallback.
  - 선행. 없음 · 예상. 1.5h
- [ ] **T102** `apps/web/app/expenses/layout.tsx` 신규(선택). 공통 헤더 타이틀만 가지는 얇은 layout. 본 회차는 미적용 가능.
  - 선행. 없음 · 예상. 0.5h
- [ ] **T103** 디렉터리 골격 생성. `expenses/new/`, `expenses/[id]/`, `vault/new/`, `vault/[id]/`, `vault/categories/`, `vault/backup/` 빈 페이지(placeholder) + Next.js 빌드 통과 확인.
  - 선행. T101 · 예상. 0.5h

### P2. /expenses CRUD 분리 + 필터 URL state

- [ ] **T201** `apps/web/app/expenses/page.tsx` 를 목록 전용으로 축소. ResponsiveTable row click → `router.push('/expenses/' + id)`. 기존 ExpensesView 안의 폼·삭제 핸들러 제거.
  - 선행. T103 · 예상. 1h
- [ ] **T202** `apps/web/app/expenses/new/page.tsx` 작성. 기존 폼을 빈 상태로 mount. 저장 후 `/expenses` 로 router.push + router.refresh.
  - 선행. T201 · 예상. 1.5h
- [ ] **T203** `apps/web/app/expenses/[id]/page.tsx` 작성. 4개 섹션 카드(기본/스케줄/결제/액션). view-mode ↔ edit-mode conditional. 삭제는 ConfirmDialog 유지.
  - 선행. T201 · 예상. 2.5h
- [ ] **T204** 필터 URL state 마이그레이션. `/expenses?status=...&category=...`. `useSearchParams()` + `router.replace`. 잘못된 값은 디폴트 fallback.
  - 선행. T201 · 예상. 1h

### P3. /vault entries CRUD 분리 + 필터·검색 URL state

- [ ] **T301** `apps/web/app/vault/page.tsx` 를 entries 목록 전용으로 축소. EntriesScreen 의 헤더·필터 toolbar 는 유지, 인라인 폼·CategoryForm 호출 제거. 목록 카드 클릭 → `router.push('/vault/' + id)`.
  - 선행. T101 · 예상. 1h
- [ ] **T302** `apps/web/app/vault/new/page.tsx` 작성. CategoryForm 을 빈 상태로 mount. 저장 후 `/vault` 로 router.push + router.refresh.
  - 선행. T301 · 예상. 1h
- [ ] **T303** `apps/web/app/vault/[id]/page.tsx` 작성. 라벨/메타·민감 필드(reveal/copy)·액션 3개 섹션. view-mode ↔ edit-mode conditional. 삭제는 ConfirmDialog 유지.
  - 선행. T301 · 예상. 2h
- [ ] **T304** 필터·검색 URL state 마이그레이션. `/vault?cat=LOGIN&q=...`. clipboard auto-clear 동작 변경 없음.
  - 선행. T301 · 예상. 1h

### P4. /vault categories·backup 라우트 분리

- [ ] **T401** `apps/web/app/vault/categories/page.tsx` 신규. 기존 카테고리 메타 관리 흐름을 vault 인라인에서 분리. 카테고리 추가/수정/삭제 UI.
  - 선행. T101 · 예상. 1.5h
- [ ] **T402** `apps/web/app/vault/backup/page.tsx` 신규. `BackupPanel` 컴포넌트를 그대로 mount. vault page 에서 호출 제거.
  - 선행. T101 · 예상. 0.5h
- [ ] **T403** vault entries 화면 헤더에 "카테고리" "백업·복원" 보조 액션 진입 링크 배치. 잠금/잠그기 버튼은 유지.
  - 선행. T401, T402 · 예상. 0.5h

### P5. 시각 회귀 baseline 갱신 + 회귀 테스트

- [ ] **T501** Playwright visual baseline 재캡처. `pnpm --filter @life-key/web run test:visual:update`. 5 페이지 → 라우트 추가로 7~9 페이지 spec 으로 확장(`expenses/new`, `expenses/[id]`, `vault/new`, `vault/[id]`, `vault/categories`, `vault/backup` 추가).
  - 선행. P2, P3, P4 완료 · 예상. 1.5h
- [ ] **T502** axe-playwright spec 신규 페이지 추가. WCAG 위반 0 유지.
  - 선행. T501 · 예상. 0.5h
- [ ] **T503** Jest 단위 테스트 보강. 라우트 redirect, URL state 파싱, vault layout 의 잠금 fallback 분기 단위 테스트.
  - 선행. P2, P3 완료 · 예상. 1.5h
- [ ] **T504** README 갱신. 라우트 맵 1단락 추가.
  - 선행. T501 · 예상. 0.25h

**총 추정.** 약 18.0h (실제 ±30%). 단계 단위로 끊어 검수 권장.

## 아키텍처 다이어그램

```
┌─────────────────────────────────────────────────────────────────────┐
│ apps/web/app/                                                        │
│                                                                      │
│  layout.tsx (phone-frame + BottomTabBar + UpdateToast + SW)         │
│    │                                                                 │
│    ├── page.tsx                                대시보드 (조회 전용)   │
│    │                                                                 │
│    ├── expenses/                                                     │
│    │     ├── page.tsx          목록 전용 + 필터(URL)                 │
│    │     ├── new/page.tsx      신규 폼 (저장 후 /expenses)            │
│    │     └── [id]/page.tsx     상세 4섹션 + view↔edit + delete       │
│    │                                                                 │
│    ├── calendar/page.tsx       AgendaView (조회 전용)                │
│    ├── summary/page.tsx        합계 (조회 전용)                       │
│    │                                                                 │
│    └── vault/                                                        │
│          layout.tsx            🔒 lock+idle SHARED (UnlockScreen      │
│            │                                fallback)                │
│            ├── page.tsx        entries 목록 + 필터(URL)              │
│            ├── new/page.tsx    entry 신규                            │
│            ├── [id]/page.tsx   entry 상세 3섹션 + view↔edit + delete │
│            ├── categories/page.tsx   카테고리 메타 관리              │
│            └── backup/page.tsx       export/import (BackupPanel)     │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘

URL state 예시:
  /expenses?status=SCHEDULED&category=구독
  /vault?cat=LOGIN&q=git

라우트 전환 흐름 (정기 지출 추가):
  /expenses (목록)
    → 상단 toolbar "추가" 클릭
    → /expenses/new (신규 폼)
    → POST 저장 → router.push('/expenses') + router.refresh()
    → /expenses (목록, 신규 항목 포함)

라우트 전환 흐름 (vault entry 수정):
  /vault (entries 목록)
    → 카드 클릭
    → /vault/[id] (3섹션 detail, view-mode)
    → "수정" 버튼 → edit-mode (같은 라우트)
    → "저장" → view-mode 로 복귀 (라우트 그대로)
    → 뒤로가기 → /vault
```

## 테스트 매트릭스

| # | 케이스 | 입력 | 기대 결과 |
|---|--------|------|----------|
| 1 | /expenses 진입 | 목록 URL | 폼이 보이지 않고 목록만 표시. 상단 "추가" 버튼 노출. |
| 2 | /expenses 필터 URL | `/expenses?status=SCHEDULED` | URL 그대로 진입 시 status 필터 적용된 목록 |
| 3 | /expenses/new 저장 | 폼 입력 → 저장 | 토스트/리다이렉트 후 /expenses 목록에 새 항목 |
| 4 | /expenses/[id] view | 목록 행 클릭 | 4개 섹션 카드 표시. 수정 버튼 노출. |
| 5 | /expenses/[id] edit | 수정 버튼 → 저장 | 같은 라우트에서 view-mode 로 복귀. 변경 반영. |
| 6 | /expenses/[id] delete | 삭제 → ConfirmDialog | 확인 시 /expenses 로 리다이렉트. |
| 7 | /expenses/잘못된id | 404 또는 redirect | 사용자에게 명확한 피드백 |
| 8 | /vault 잠금 상태 | URL 직접 진입 | layout 이 UnlockScreen fallback. 잠금 해제 후 원래 라우트. |
| 9 | /vault/[id] 잠금 상태 | URL 직접 진입 | layout 이 UnlockScreen fallback. 키·민감 필드 노출 없음. |
| 10 | /vault 필터·검색 URL | `/vault?cat=LOGIN&q=git` | 카테고리·검색 적용된 목록. |
| 11 | /vault/categories | 진입 | 카테고리 메타 관리 UI 단독. entries 목록은 없음. |
| 12 | /vault/backup | 진입 | export/import 패널 단독. entries 목록은 없음. |
| 13 | /vault back from /[id] | 뒤로가기 | entries 목록으로 복귀(잠금 유지). |
| 14 | idle timer | layout 에서 작동 | 모든 vault 서브라우트에서 동일하게 카운트. timeout 시 잠금. |
| 15 | clipboard auto-clear | reveal → 복사 → 30s | 본 회차 변경 없음. 회귀 없음. |
| 16 | 시각 회규 | `pnpm test:visual` | 신규 7~9 페이지 baseline 모두 통과. axe WCAG 위반 0. |
| 17 | typecheck/build | tsc + next build | 통과. |

## 검수 게이트 (각 Phase 종료 시)

- **P1 종료.** vault layout 잠금 fallback 이 모든 서브라우트에서 작동. 빈 라우트 페이지가 next build 통과.
- **P2 종료.** /expenses 3개 라우트(`page`, `new`, `[id]`)가 수동 통과. 필터 URL state 가 뒤로가기·새로고침에서 유지.
- **P3 종료.** /vault entries 3개 라우트가 수동 통과. 필터·검색 URL state 유지. 잠금 상태 fallback 정상.
- **P4 종료.** /vault/categories, /vault/backup 단독 라우트 진입 가능. vault entries 화면이 200줄 미만으로 축소.
- **P5 종료.** `pnpm test:visual` + axe + jest 모두 통과. baseline 신규 캡처 commit.

## 향후 작업 (TODOS 이관)

- expense detail edit 중 변경사항 보존(localStorage backup 또는 unsaved-change 표시). 본 회차 스코프 외.
- vault entries 페이지네이션 또는 가상 스크롤. 항목 수가 100건 넘으면 검토.
- parallel/intercepting routes 도입(Approach C). 본 회차 결정에서 기각, 추후 PWA 경험 강화 후보.
- expense duplicate 같은 보조 액션. 신규 기능 후보.
