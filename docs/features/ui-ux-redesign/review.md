# Review: ui-ux-redesign

## 리뷰 개요

- 일자: 2026-05-17
- Spec: docs/features/ui-ux-redesign/spec.md
- Plan: docs/features/ui-ux-redesign/plan.md

---

## 1. Spec 일치 여부

| 처리상태 | 심각도 | 판정 | # | 요구사항 | 근거 | 보강 지시 |
|----------|--------|------|---|----------|------|-----------|
| CLOSED | - | DONE | 1 | 단일 모바일 레이아웃과 데스크탑 768px 중앙 정렬 | `apps/web/app/layout.tsx:34`의 `.phone-frame`, `apps/web/components/BottomTabBar.tsx:16`, `apps/web/app/globals.css:648`의 480px 이상 768px 중앙 정렬 구현 확인. | - |
| CLOSED | - | DONE | 2 | 모든 페이지가 phone-frame 안에서 모바일 레이아웃으로 렌더 | `apps/web/app/layout.tsx:35`에서 모든 `children`을 `.container` 안에 배치하고 `apps/web/app/layout.tsx:36`에서 BottomTabBar를 같은 frame에 배치함. | - |
| CLOSED | - | DONE | 3 | 테이블을 항상 카드 리스트로 표시 | `apps/web/components/ResponsiveTable.tsx:19`가 table과 card stack을 함께 렌더하고 `apps/web/app/globals.css:323`에서 table을 숨김. 대시보드, 지출, 합계에서 사용 확인. | - |
| CLOSED | - | DONE | 4 | 캘린더를 항상 아젠다 리스트로 표시 | `apps/web/app/calendar/page.tsx:40`이 `AgendaView`만 렌더하고 `apps/web/app/calendar/AgendaView.tsx:13`이 occurrence를 날짜 그룹 세로 목록으로 표시함. | - |
| CLOSED | - | DONE | 5 | CategoryForm, OccurrencePanel 인라인 패널을 bottom-sheet처럼 표시 | `apps/web/components/OccurrencePanel.tsx:56`과 `apps/web/app/globals.css:533`에서 `inline-bottom-sheet` sticky 스타일 확인. | - |
| CLOSED | - | DONE | 6 | native confirm() 대체 ConfirmDialog | `apps/web/components/ConfirmDialog.tsx:16` 구현과 focus trap, ESC 닫기, 배경 클릭 닫기 확인. 지출과 보관함 상세 삭제 흐름에서 사용됨. | - |
| CLOSED | - | DONE | 7 | 모든 인터랙티브 요소 44px 터치 타깃 | `.btn`은 `apps/web/app/globals.css:202`, form control은 `apps/web/app/globals.css:267`, 하단 탭은 `apps/web/app/globals.css:142`, update/install 버튼은 `apps/web/app/globals.css:592`와 `apps/web/app/globals.css:621`에서 최소 높이 적용. | - |
| CLOSED | - | DONE | 8 | focus-visible 포커스 링 | `apps/web/app/globals.css:116`에서 2px outline과 offset 적용. | - |
| CLOSED | - | CHANGED | 9 | 본문 font-size 모바일 16px, 데스크탑 14px 분기 | `apps/web/app/globals.css:67`에서 16px 기본값은 구현됐고 데스크탑 14px 분기는 제거됨. 단일 모바일 레이아웃을 모든 viewport에 유지한다는 확정 방향과 일치하는 수용 가능한 변경으로 판단. | - |
| CLOSED | - | DONE | 10 | 색 대비 WCAG AA | `apps/web/tests/visual/accessibility.spec.ts:23`의 axe WCAG 검사와 `pnpm --filter @secrets-manager/web run test:visual` 69개 통과 확인. | - |
| CLOSED | - | DONE | 11 | zinc/slate 토큰과 hardcoded hex 토큰화 | `apps/web/app/globals.css:3`의 토큰 세트와 `apps/web/app/globals.css:648`의 desktop body 배경 토큰 사용 확인. 색상 hex는 토큰 선언과 메타데이터/manifest 값에 한정됨. | - |
| CLOSED | - | DONE | 12 | motion token과 prefers-reduced-motion | `apps/web/app/globals.css:76`의 motion token, `apps/web/app/globals.css:668`의 reduced-motion 무력화 확인. | - |
| CLOSED | - | DONE | 13 | Skeleton 로더 | `apps/web/components/Skeleton.tsx:8`, `apps/web/app/summary/SummaryView.tsx:81`, `apps/web/app/vault/EntriesScreen.tsx:135` 사용 확인. | - |
| CLOSED | - | DONE | 14 | PWA manifest와 PNG 아이콘 3종 | `apps/web/app/layout.tsx:11`의 manifest metadata, `apps/web/public/manifest.webmanifest`의 아이콘 참조, `file apps/web/public/icons/*.png` 결과 192x192, 512x512, 512x512 확인. | - |
| CLOSED | - | DONE | 15 | Service Worker 앱 셸 캐시와 `/api/vault/*` 제외 | `apps/web/public/sw.js:5` 앱 셸 precache, `apps/web/public/sw.js:27` vault API 캐시 제외, `apps/web/public/sw.js:36` API runtime cache 확인. | - |
| CLOSED | - | DONE | 16 | 새 버전 토스트와 skipWaiting | `apps/web/components/UpdateToast.tsx:15`에서 waiting worker 감지, `apps/web/components/UpdateToast.tsx:48`에서 `SKIP_WAITING` 전송 확인. | - |
| CLOSED | - | DONE | 17 | 보관함 설치 안내 배너와 7일 dismiss cookie | `apps/web/components/InstallBanner.tsx:16`, `apps/web/components/install-banner-visibility.ts:7`, `apps/web/app/vault/page.tsx` cookie 연동, `apps/web/app/vault/install-banner-visibility.spec.ts` 테스트 확인. | - |
| CLOSED | - | DONE | 18 | Playwright 5페이지 이상 × 3 viewport baseline | `apps/web/playwright.visual.config.ts:19`의 3개 viewport와 `apps/web/tests/visual/*.spec.ts` 확인. 현재 visual 대상은 11개 페이지로 확장됐고 `test:visual` 69개 통과. | - |

**요약:** DONE 17 / PARTIAL 0 / NOT DONE 0 / CHANGED 1

---

## 2. Plan 일치 여부

| 처리상태 | 심각도 | 판정 | 태스크 | 근거 | 보강 지시 |
|----------|--------|------|--------|------|-----------|
| CLOSED | - | DONE | T101 | `apps/web/app/globals.css:3`의 color, spacing, radius, shadow, font, motion token 확인. | - |
| CLOSED | - | DONE | T102 | `apps/web/app/globals.css:5` 이후 zinc/slate 중심 토큰과 상태 토큰 확인. | - |
| CLOSED | - | DONE | T103 | `apps/web/app/globals.css:164`와 `apps/web/app/globals.css:648`의 단일 모바일 베이스라인과 480px phone-frame 분기 확인. | - |
| CLOSED | - | DONE | T104 | `apps/web/components/Icon.tsx`와 `lucide-react` 의존성 확인. | - |
| CLOSED | - | DONE | T201 | `apps/web/components/BottomTabBar.tsx:16`에서 5탭, 활성 탭, 키보드 링크 구조 확인. | - |
| CLOSED | - | DONE | T202 | `apps/web/app/layout.tsx:34`에서 상단 nav 없이 하단 탭 항상 노출. | - |
| CLOSED | - | DONE | T203 | `apps/web/app/globals.css:171`의 12px padding과 bottom padding 적용. | - |
| CLOSED | - | DONE | T301 | `apps/web/components/ResponsiveTable.tsx:19` 신규 구현 확인. | - |
| CLOSED | - | DONE | T302 | `apps/web/app/page.tsx`, `apps/web/app/expenses/ExpensesView.tsx`, `apps/web/app/summary/SummaryView.tsx`에서 `ResponsiveTable` 사용 확인. | - |
| CLOSED | - | DONE | T303 | `apps/web/app/calendar/AgendaView.tsx:13` 신규 구현 확인. | - |
| CLOSED | - | DONE | T304 | `apps/web/app/calendar/page.tsx:40`에서 `AgendaView`만 렌더. | - |
| CLOSED | - | DONE | T305 | `apps/web/app/globals.css:257`에서 `.form-row` stack 기본값 적용. | - |
| CLOSED | - | DONE | T306 | `apps/web/components/ConfirmDialog.tsx:16` 신규 구현과 focus trap 확인. | - |
| CLOSED | - | DONE | T307 | 지출과 보관함 삭제 확인 흐름이 `ConfirmDialog`를 사용함. | - |
| CLOSED | - | DONE | T308 | `apps/web/app/globals.css:533`의 `inline-bottom-sheet` sticky 패널 적용. | - |
| CLOSED | - | DONE | T401 | `apps/web/app/globals.css:202`, `apps/web/app/globals.css:267`, `apps/web/app/globals.css:142`에서 44px touch target 적용. | - |
| CLOSED | - | DONE | T402 | `apps/web/app/globals.css:116`에서 전역 focus-visible 적용. | - |
| CLOSED | - | CHANGED | T403 | 데스크탑 14px 분기는 단일 모바일 레이아웃 유지 판단으로 미적용. `apps/web/app/globals.css:67`에서 16px 기본값 유지. | - |
| CLOSED | - | DONE | T404 | `apps/web/app/globals.css:76`에서 motion token과 transition 적용. | - |
| CLOSED | - | DONE | T405 | `apps/web/app/globals.css:668`에서 reduced-motion 무력화 적용. | - |
| CLOSED | - | DONE | T406 | `apps/web/components/Skeleton.tsx:8`와 각 로딩 화면 적용 확인. | - |
| CLOSED | - | DONE | T407 | `pnpm --filter @secrets-manager/web run test:visual`에서 axe WCAG 검사 포함 69개 통과. | - |
| CLOSED | - | DONE | T501 | `file apps/web/public/icons/*.png`로 PNG 아이콘 3종 확인. | - |
| CLOSED | - | DONE | T502 | `apps/web/public/manifest.webmanifest` 작성 확인. | - |
| CLOSED | - | DONE | T503 | `apps/web/app/layout.tsx:8`의 metadata와 `apps/web/app/layout.tsx:23`의 viewport에 manifest, theme-color, apple icon 반영. | - |
| CLOSED | - | DONE | T504 | `apps/web/public/sw.js:1` service worker 직접 구현과 `apps/web/components/ServiceWorkerRegister.tsx:8` 등록 확인. | - |
| CLOSED | - | DONE | T505 | `apps/web/components/UpdateToast.tsx:5` update toast 구현 확인. | - |
| CLOSED | - | DONE | T506 | `apps/web/components/InstallBanner.tsx:16`와 `apps/web/components/install-banner-visibility.ts:21`에서 install banner와 7일 cookie dismiss 구현 확인. | - |
| CLOSED | - | DONE | T601 | `apps/web/playwright.visual.config.ts:1` 작성 확인. | - |
| CLOSED | - | DONE | T602 | `apps/web/tests/visual/`의 visual spec 확인. | - |
| CLOSED | - | DONE | T603 | snapshot PNG 33개와 `test:visual` 통과 확인. | - |
| CLOSED | - | DONE | T604 | `apps/web/package.json`의 `test:visual`, `test:visual:update` script 확인. | - |
| CLOSED | - | DONE | T701 | `apps/web/app/globals.css:648`에서 480px 이상 `.phone-frame` 768px 중앙 정렬 확인. | - |
| CLOSED | - | DONE | T702 | `apps/web/app/layout.tsx:34`에서 layout wrapper 적용 확인. | - |

**스코프 이탈:** 없음.

---

## 3. 테스트 커버리지

| 처리상태 | 심각도 | 판정 | 요구사항 | 테스트 | 보강 지시 |
|----------|--------|------|----------|--------|-----------|
| CLOSED | - | TESTED | 이전 OPEN 보강 3건 | `pnpm --filter @secrets-manager/web test` 통과. `apps/web/app/ui-ux-redesign-open-items.spec.ts`에서 PNG 아이콘, bottom-sheet class, desktop background token 회귀 방지. | - |
| CLOSED | - | TESTED | 설치 배너 dismiss | `pnpm --filter @secrets-manager/web test` 통과. `apps/web/app/vault/install-banner-visibility.spec.ts`에서 7일 dismiss와 standalone 숨김 검증. | - |
| CLOSED | - | TESTED | 타입 안정성 | `pnpm --filter @secrets-manager/web run typecheck` 통과. | - |
| CLOSED | - | TESTED | production build | `pnpm --filter @secrets-manager/web run build` 통과. Next.js 15.5.18 production build 성공. | - |
| CLOSED | - | TESTED | 시각 회귀와 접근성 | `pnpm --filter @secrets-manager/web run test:visual` 통과. 69개 테스트가 375, 768, 1280 viewport에서 screenshot과 axe WCAG 2 A/AA/2.2 AA 검사를 수행. | - |
| CLOSED | - | TESTED | PWA PNG 파일 | `file apps/web/public/icons/icon-192.png apps/web/public/icons/icon-512.png apps/web/public/icons/icon-512-maskable.png` 통과. | - |
| CLOSED | - | TESTED | 보안 감사 | `pnpm audit --prod` 실행. 기존 의존성 취약점 10건 확인, 이번 UI/UX redesign 직접 변경에서 새 OPEN 보안 결함은 발견하지 못함. | - |

**미테스트:** 0건

---

## 4. 발견 항목

| 처리상태 | 심각도 | 신뢰도 | 분류 | 위치 | 내용 | 보강 지시 |
|----------|--------|--------|------|------|------|-----------|
| CLOSED | MEDIUM | 5/10 | SECURITY | `pnpm audit --prod` | production dependency audit에서 10건 발견. `multer` high 3건, `lodash` high 1건과 moderate 2건, `file-type` moderate 2건, `postcss` moderate 1건, `@nestjs/core` moderate 1건. 대부분 `apps/api` transitive이며 이번 UI/UX redesign의 직접 변경 범위는 아님. | 별도 dependency upgrade 회차에서 처리. |

### Appendix (confidence 5 미만)

| 처리상태 | 심각도 | 신뢰도 | 분류 | 위치 | 내용 | 보강 지시 |
|----------|--------|--------|------|------|------|-----------|
| CLOSED | LOW | 4/10 | DX | `apps/web/app/globals.css:352` | `CalendarView`용 `.calendar` 계열 스타일 일부가 남아 있지만 현재 `AgendaView`만 렌더되므로 dead style에 가까움. 차후 데스크탑 옵션 보존 목적이면 유지 가능. | 필요 시 별도 CSS 정리 회차에서 처리. |

---

## 5. 기능 검증

- `pnpm --filter @secrets-manager/web test` 통과. 6 suites, 32 tests.
- `pnpm --filter @secrets-manager/web run typecheck` 통과.
- `pnpm --filter @secrets-manager/web run build` 통과. Next.js 15.5.18 production build 성공.
- `pnpm --filter @secrets-manager/web run test:visual` 통과. 69 passed.
- `file apps/web/public/icons/*.png` 통과. 192x192, 512x512, 512x512 확인.
- 실제 모바일 Safari 홈 화면 설치와 SW updatefound 이벤트는 로컬 자동화에서 직접 재현하지 않았지만, manifest, 아이콘, service worker 등록, update toast, 오프라인 앱 셸 관련 구현과 회귀 테스트는 확인했다.

---

## 6. 보안 감사

- Service Worker는 same-origin GET만 처리하고 `apps/web/public/sw.js:27`에서 `/api/vault/*` 캐시를 제외한다.
- runtime cache는 `Cache-Control: no-store` 또는 `private` 응답을 저장하지 않는다.
- `pnpm audit --prod`는 10 vulnerabilities를 보고했다. Severity는 high 4, moderate 6이다.
- 이번 UI/UX redesign의 직접 변경에서 새 OPEN 보안 결함은 발견하지 못했다.
- 남은 의존성 취약점은 API/프레임워크 업데이트 작업으로 별도 추적하는 것이 적절하다.
