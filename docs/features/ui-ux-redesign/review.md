# Review: ui-ux-redesign

## 리뷰 개요

- 일자: 2026-05-17
- Spec: docs/features/ui-ux-redesign/spec.md
- Plan: docs/features/ui-ux-redesign/plan.md

---

## 1. Spec 일치 여부

| # | 요구사항 | 상태 | 근거 |
|---|----------|------|------|
| 1 | 단일 모바일 레이아웃과 데스크탑 768px 중앙 정렬 | DONE | `apps/web/app/layout.tsx:34`의 `.phone-frame`, `apps/web/components/BottomTabBar.tsx:19`의 하단 탭바, `apps/web/app/globals.css:644`의 480px 이상 768px 중앙 정렬 구현 확인. |
| 2 | 모든 페이지가 phone-frame 안에서 모바일 레이아웃으로 렌더 | DONE | `apps/web/app/layout.tsx:35`에서 모든 `children`을 `.container` 안에 배치하고 `apps/web/app/layout.tsx:36`에서 BottomTabBar를 같은 frame에 배치함. |
| 3 | 테이블을 항상 카드 리스트로 표시 | DONE | `apps/web/components/ResponsiveTable.tsx:19`와 `apps/web/app/globals.css:314`에서 table을 숨기고 카드 stack으로 렌더함. 대시보드, 지출, 합계에서 사용 확인. |
| 4 | 캘린더를 항상 아젠다 리스트로 표시 | DONE | `apps/web/app/calendar/page.tsx`가 `AgendaView`만 렌더하고, `apps/web/app/calendar/AgendaView.tsx`가 occurrence를 날짜 그룹 세로 목록으로 표시함. |
| 5 | CategoryForm, OccurrencePanel 인라인 패널을 bottom-sheet처럼 표시 | DONE | `apps/web/app/vault/CategoryForm.tsx:138`, `apps/web/components/OccurrencePanel.tsx:56`, `apps/web/app/globals.css:529`에서 `inline-bottom-sheet` sticky 스타일 확인. |
| 6 | native confirm() 대체 ConfirmDialog | DONE | `apps/web/components/ConfirmDialog.tsx:16` 구현, `apps/web/app/expenses/ExpensesView.tsx:352`와 `apps/web/app/vault/EntriesScreen.tsx:214` 사용 확인. |
| 7 | 모든 인터랙티브 요소 44px 터치 타깃 | DONE | `.btn`은 `apps/web/app/globals.css:198`, form control은 `apps/web/app/globals.css:263`, 하단 탭은 `apps/web/app/globals.css:142`, update/install 버튼은 `apps/web/app/globals.css:588`과 `apps/web/app/globals.css:617`에서 최소 높이 적용. |
| 8 | focus-visible 포커스 링 | DONE | `apps/web/app/globals.css:116`에서 2px outline과 offset 적용. |
| 9 | 본문 font-size 모바일 16px, 데스크탑 14px 분기 | CHANGED | `apps/web/app/globals.css:67`에서 16px 기본값은 구현됐지만 데스크탑 14px 분기는 의도적으로 제거됨. spec의 단일 모바일 레이아웃 원칙과 실제 시각 회귀 결과를 우선한 변경으로 판단. |
| 10 | 색 대비 WCAG AA | DONE | `apps/web/tests/visual/accessibility.spec.ts:14`의 axe WCAG 검사와 `pnpm --filter @life-key/web run test:visual` 30개 통과 확인. |
| 11 | zinc/slate 토큰과 hardcoded hex 토큰화 | DONE | `apps/web/app/globals.css:3`의 토큰 세트, `apps/web/app/globals.css:647`의 desktop body 배경 토큰 사용 확인. 색상 hex는 토큰 선언과 메타데이터/manifest 값에 한정됨. |
| 12 | motion token과 prefers-reduced-motion | DONE | `apps/web/app/globals.css:76`의 motion token, `apps/web/app/globals.css:664`의 reduced-motion 무력화 확인. |
| 13 | Skeleton 로더 | DONE | `apps/web/components/Skeleton.tsx:8`, `apps/web/app/summary/SummaryView.tsx:81`, `apps/web/app/vault/EntriesScreen.tsx:149` 사용 확인. |
| 14 | PWA manifest와 PNG 아이콘 3종 | DONE | `apps/web/public/manifest.webmanifest:12`의 192/512/maskable 아이콘 참조와 실제 PNG 파일 192x192, 512x512, 512x512 확인. |
| 15 | Service Worker 앱 셸 캐시와 `/api/vault/*` 제외 | DONE | `apps/web/public/sw.js:5` 앱 셸 precache, `apps/web/public/sw.js:27` vault API 캐시 제외, `apps/web/public/sw.js:36` API runtime cache 확인. |
| 16 | 새 버전 토스트와 skipWaiting | DONE | `apps/web/components/UpdateToast.tsx:15`에서 waiting worker 감지, `apps/web/components/UpdateToast.tsx:48`에서 `SKIP_WAITING` 전송 확인. |
| 17 | 보관함 설치 안내 배너와 7일 dismiss cookie | DONE | `apps/web/components/InstallBanner.tsx:28`, `apps/web/components/install-banner-visibility.ts`, `apps/web/app/vault/page.tsx` cookie 연동, `apps/web/app/vault/install-banner-visibility.spec.ts` 테스트 확인. |
| 18 | Playwright 5페이지 × 3 viewport baseline | DONE | `apps/web/playwright.visual.config.ts:19`의 3개 viewport, `apps/web/tests/visual/*.spec.ts`, baseline PNG 15장, `test:visual` 30개 통과 확인. |

**요약:** DONE 17 / PARTIAL 0 / NOT DONE 0 / CHANGED 1

---

## 2. Plan 일치 여부

| 태스크 | 상태 | 비고 |
|--------|------|------|
| T101 | DONE | `globals.css` 토큰 확장 확인. |
| T102 | DONE | zinc/slate 중심 토큰과 hardcoded background 토큰화 확인. |
| T103 | DONE | 단일 모바일 베이스라인과 480px phone-frame 분기 확인. |
| T104 | DONE | `lucide-react`와 `components/Icon.tsx` 사용 확인. |
| T201 | DONE | `BottomTabBar` 5탭, 활성 탭, 키보드 링크 구조 확인. |
| T202 | DONE | layout에서 상단 nav 없이 하단 탭 항상 노출. |
| T203 | DONE | `.container` 12px padding과 bottom padding 적용. |
| T301 | DONE | `ResponsiveTable` 신규 구현. |
| T302 | DONE | 대시보드, 지출, 합계에서 `ResponsiveTable` 사용. |
| T303 | DONE | `AgendaView` 신규 구현. |
| T304 | DONE | calendar page가 `AgendaView`만 렌더. |
| T305 | DONE | `.form-row` 모바일 stack 기본값 적용. |
| T306 | DONE | `ConfirmDialog` 신규 구현과 focus trap 확인. |
| T307 | DONE | 지출/보관함 삭제 confirm 교체. |
| T308 | DONE | `inline-bottom-sheet` sticky 패널 적용. |
| T401 | DONE | 44px touch target 적용. |
| T402 | DONE | 전역 focus-visible 적용. |
| T403 | CHANGED | 데스크탑 14px 분기는 단일 모바일 레이아웃 유지 판단으로 미적용. |
| T404 | DONE | motion token과 transition 적용. |
| T405 | DONE | reduced-motion 무력화 적용. |
| T406 | DONE | Skeleton 컴포넌트와 로딩 화면 적용. |
| T407 | DONE | axe WCAG 검사 15개 통과. |
| T501 | DONE | PNG 아이콘 3종 생성 확인. |
| T502 | DONE | manifest 작성 확인. |
| T503 | DONE | layout metadata/viewport에 manifest, theme-color, apple icon 반영. |
| T504 | DONE | service worker 직접 구현과 등록 확인. |
| T505 | DONE | update toast 구현 확인. |
| T506 | DONE | install banner와 7일 cookie dismiss 구현 확인. |
| T601 | DONE | Playwright visual config 작성. |
| T602 | DONE | 5개 페이지 visual spec 작성. |
| T603 | DONE | baseline PNG 15장 확인. |
| T604 | DONE | `test:visual`, `test:visual:update` 스크립트 확인. |
| T701 | DONE | 480px 이상 `.phone-frame` 768px 중앙 정렬 확인. |
| T702 | DONE | layout wrapper 적용 확인. |

**스코프 이탈:** 없음.

---

## 3. 테스트 커버리지

| 요구사항 | 테스트 | 비고 |
|----------|--------|------|
| 이전 OPEN 보강 3건 | `pnpm --filter @life-key/web test` | `apps/web/app/ui-ux-redesign-open-items.spec.ts:11`에서 PNG 아이콘, bottom-sheet class, desktop background token 회귀 방지. |
| 설치 배너 dismiss | `pnpm --filter @life-key/web test` | `apps/web/app/vault/install-banner-visibility.spec.ts` 통과. |
| 타입 안정성 | `pnpm --filter @life-key/web run typecheck` | `tsc --noEmit` 통과. |
| production build | `pnpm --filter @life-key/web run build` | Next.js 15.5.18 production build 통과. |
| 시각 회귀 | `pnpm --filter @life-key/web run test:visual` | 5페이지 × 3 viewport screenshot 15개 통과. |
| 접근성 | `pnpm --filter @life-key/web run test:visual` | axe WCAG 2 A/AA/2.2 AA 검사 15개 통과. |
| PWA PNG 파일 | `file apps/web/public/icons/*.png` | 192x192, 512x512, 512x512 maskable 확인. |
| 보안 감사 | `pnpm audit --prod` | UI 변경과 무관한 기존 의존성 취약점 10건 확인. |

**미테스트:** 4건.

- 모바일 Safari 실제 홈 화면 설치.
- Service Worker 오프라인 앱 셸 로드의 실제 브라우저 Application Cache 검증.
- SW 업데이트 토스트의 실제 updatefound 이벤트 플로우.
- 키보드 only 전 경로 수동 탐색.

---

## 4. 발견 항목

| 상태 | 심각도 | 신뢰도 | 위치 | 내용 |
|------|--------|--------|------|------|
| INFO | HIGH | 5 | `pnpm audit --prod` | production dependency audit에서 10건 발견. `multer` 3건 high, `lodash` 1건 high와 2건 moderate, `file-type` 2건 moderate, `postcss` 1건 moderate, `@nestjs/core` 1건 moderate. 대부분 `apps/api` transitive이며 이번 UI/UX redesign의 직접 변경 범위는 아님. `postcss`는 `apps/web>next>postcss` 경로라 추후 Next/PostCSS 패치 주기로 처리 권장. |

### Appendix (confidence 5 미만)

| 심각도 | 신뢰도 | 위치 | 내용 |
|--------|--------|------|------|
| LOW | 4 | `apps/web/app/globals.css:362` | `CalendarView`용 `.calendar` 스타일이 남아 있지만 현재 `AgendaView`만 렌더되므로 dead style에 가까움. 차후 데스크탑 옵션 보존 목적이면 유지 가능. |

---

## 5. 기능 검증

- `pnpm --filter @life-key/web test` 통과. 3 suites, 12 tests.
- `pnpm --filter @life-key/web run typecheck` 통과.
- `pnpm --filter @life-key/web run build` 통과.
- `pnpm --filter @life-key/web run test:visual` 통과. 30 passed.
- baseline PNG 15장 확인.
- PWA 아이콘 3종 파일 크기 확인. 192x192, 512x512, 512x512.

---

## 6. 보안 감사

- Service Worker는 same-origin GET만 처리하고 `apps/web/public/sw.js:27`에서 `/api/vault/*` 캐시를 제외한다.
- runtime cache는 `Cache-Control: no-store` 또는 `private` 응답을 저장하지 않는다.
- `pnpm audit --prod`는 10 vulnerabilities를 보고했다. Severity는 high 4, moderate 6이다.
- 이번 UI/UX redesign의 직접 변경에서 새 OPEN 보안 결함은 발견하지 못했다.
- 남은 의존성 취약점은 API/프레임워크 업데이트 작업으로 별도 추적하는 것이 적절하다.
