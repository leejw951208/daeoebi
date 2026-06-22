# Progress. UI/UX Redesign

## 현재 단계

구현

## 기능별 진행 현황

| Phase | 태스크 | 내용 | 상태 |
|-------|--------|------|------|
| P1 | T101 | `globals.css` :root 토큰 60종 확장 | ✅ 완료 |
| P1 | T102 | 컬러 팔레트 zinc/slate 재구성 + hex 치환 | ✅ 완료 |
| P1 | T103 | 모바일 우선 미디어 쿼리 인프라 | ✅ 완료 |
| P1 | T104 | lucide-react 설치 + Icon wrapper | ✅ 완료 |
| P2 | T201 | `BottomTabBar` 컴포넌트 | ✅ 완료 |
| P2 | T202 | layout.tsx 상단 nav/하단 탭바 분기 | ✅ 완료 |
| P2 | T203 | container padding 단계화 + main padding-bottom | ✅ 완료 |
| P3 | T301 | `ResponsiveTable` 컴포넌트 | ✅ 완료 |
| P3 | T302 | dashboard/expenses/summary 테이블 교체 | ✅ 완료 |
| P3 | T303 | `AgendaView` 컴포넌트 | ✅ 완료 |
| P3 | T304 | calendar page viewport 분기 (`.calendar-desktop`/`.agenda-mobile`) | ✅ 완료 |
| P3 | T305 | form-row 모바일 stack 전환 (globals.css 분기) | ✅ 완료 |
| P3 | T306 | `ConfirmDialog` 컴포넌트 | ✅ 완료 |
| P3 | T307 | 두 곳의 confirm() → ConfirmDialog 교체 (EntriesScreen, ExpensesView) | ✅ 완료 |
| P3 | T308 | 인라인 패널 bottom-sheet 스타일 (CategoryForm/OccurrencePanel) | ⚠️ 보류 |
| P4 | T401 | min-height 44px 터치 타깃 | ✅ 완료 (P1 globals.css 흡수) |
| P4 | T402 | :focus-visible 글로벌 스타일 | ✅ 완료 (P1 globals.css 흡수) |
| P4 | T403 | font-size 분기 (모바일 16/데스크탑 14) | ✅ 완료 (P1 globals.css 흡수) |
| P4 | T404 | motion 토큰 + transition 유틸 | ✅ 완료 (P1 globals.css 흡수) |
| P4 | T405 | prefers-reduced-motion 무력화 | ✅ 완료 (P1 globals.css 흡수) |
| P4 | T406 | `Skeleton` 컴포넌트 + loading state 교체 (vault, summary) | ✅ 완료 |
| P4 | T407 | axe-playwright 1회 통과 | ⚠️ 인프라 준비, 실행은 사용자 |
| P5 | T501 | PWA 아이콘 192/512/maskable | ⚠️ README 안내, PNG 생성은 사용자 |
| P5 | T502 | manifest.webmanifest | ✅ 완료 |
| P5 | T503 | layout.tsx <head> 메타 정비 (manifest, theme-color, viewport-fit, apple-touch-icon) | ✅ 완료 |
| P5 | T504 | Service Worker 등록 + 캐시 정책 (`/api/vault` 제외) | ✅ 완료 |
| P5 | T505 | 신버전 감지 토스트 (`UpdateToast`) | ✅ 완료 |
| P5 | T506 | "홈 화면에 추가" 안내 배너 (`InstallBanner` + 7일 dismiss) | ✅ 완료 |
| P6 | T601 | `playwright.visual.config.ts` (3 viewport × maxDiffPixelRatio 0.01) | ✅ 완료 |
| P6 | T602 | 5개 visual spec + accessibility spec | ✅ 완료 |
| P6 | T603 | baseline 이미지 15장 캡처 | ⚠️ 사용자가 `pnpm test:visual:update` 1회 실행 |
| P6 | T604 | npm script (`test:visual`, `test:visual:update`) + README 안내 | ✅ 완료 |

## 블로커 / 이슈 / 특이사항

**보류 항목**

- T308 인라인 패널 bottom-sheet 변환은 `CategoryForm`/`OccurrencePanel` 의 렌더 트리 자체를 옮겨야 해서 본 스코프(시각 토큰·터치 타깃·반응형 인프라) 보다 invasive. 별도 작업으로 분리 권장.

**사용자가 직접 수행할 일 (블로커 아님)**

- `apps/web/public/icons/` 의 PNG 3개 생성 (README 가이드 참조)
- `pnpm --filter @secrets-manager/web exec playwright install` 로 브라우저 다운로드
- `pnpm --filter @secrets-manager/web run test:visual:update` 로 baseline 15장 초기 캡처

**검증 결과**

- `pnpm --filter @secrets-manager/web run typecheck` ✅ 통과
- `pnpm --filter @secrets-manager/web test` ✅ 통과 (clipboard-clear 5건)

## 최근 업데이트

2026-05-17 — 사용자 피드백 2차 반영. 휴대폰 단말 시뮬레이션(베젤·노치·둥근 모서리·그림자) 제거. 데스크탑에서는 가운데 420px 폭 정렬만 유지하여 "모바일 웹과 동일한 화면" 구현. spec/plan/구현/review 갱신.

2026-05-17 — 사용자 피드백 1차 반영. 데스크탑에서도 모바일 인터페이스가 보이도록 단일 모바일 레이아웃 + 데스크탑 phone-frame 패턴으로 전환. spec/plan/구현/review 동시 갱신.

2026-05-17 (이전) — 직전 OPEN 3건 모두 패치 후 4회차 검증 완료.

## 다음 액션 아이템

| 담당 | 내용 | 기한 |
|------|------|------|
| 사용자 | PWA 아이콘 PNG 3개 생성 후 `apps/web/public/icons/` 에 배치 | - |
| 사용자 | `pnpm test:visual:update` 로 baseline 캡처 후 커밋 | - |
| 검증자 | `/project-verify ui-ux-redesign` 로 검증 진행 | - |
