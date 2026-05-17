# Plan. UI/UX Redesign

## 단계 구성

| Phase | 이름 | 목표 |
|-------|------|------|
| P1 | 토큰 & 반응형 기반 | 디자인 토큰(컬러/스페이싱/타이포/모션) 확장이 완비되어 후속 페이지 작업이 토큰 위에서 작성 가능해진다. |
| P2 | 네비게이션 & 글로벌 셸 | BottomTabBar 가 항상 표시되고, 모든 페이지가 단일 모바일 레이아웃으로 열린다. |
| P3 | 페이지별 모바일 대응 | 대시보드/지출/캘린더/합계/보관함 5개 페이지가 카드·아젠다·bottom-sheet 패턴으로 동작한다. |
| P4 | 접근성 & 모션 | 모든 인터랙티브 요소가 WCAG 2.2 AA 를 충족하고, prefers-reduced-motion 을 존중하는 차분한 모션이 적용된다. |
| P5 | PWA | manifest + service worker 로 모바일 홈 화면 설치가 가능하고, 앱 셸이 오프라인에서 로드된다. |
| P6 | 시각 회귀 테스트 | Playwright baseline 15장이 등록되고 npm script 로 회귀 감지가 가능하다. |
| P7 | 데스크탑 모바일 폭 정렬 | 데스크탑(≥480px) 에서 본문이 가운데 768px 폭으로 정렬되어 모바일 웹과 동일한 화면을 보여주고, 모바일(<480px) 에서는 풀스크린 유지. 휴대폰 단말 시뮬레이션(베젤·노치·둥근 모서리·그림자) 은 제외. |

## 구현 태스크

### P1. 토큰 & 반응형 기반

- [ ] **T101** `globals.css` 의 `:root` 토큰을 60종 수준으로 확장 (color/space/radius/shadow/font/motion)
  - 선행. 없음 · 예상. 2h
- [ ] **T102** 컬러 팔레트를 zinc/slate 계열로 재구성하고 기존 hex hardcoded 위치를 토큰으로 치환
  - 선행. T101 · 예상. 1.5h
- [ ] **T103** 단일 모바일 베이스라인 (viewport 분기 미디어 쿼리 제거, 모바일 스타일을 전 viewport 에 적용)
  - 선행. T101 · 예상. 1h
- [ ] **T104** `lucide-react` 설치 및 아이콘 wrapper 컴포넌트 `components/Icon.tsx` (size/aria 표준화)
  - 선행. 없음 · 예상. 0.5h

### P2. 네비게이션 & 글로벌 셸

- [ ] **T201** `components/BottomTabBar.tsx` 신규 — 5탭(대시보드/지출/캘린더/합계/보관함) 하단 고정, 활성 탭 강조, 키보드 포커스, lucide 아이콘
  - 선행. T101, T104 · 예상. 2h
- [ ] **T202** `app/layout.tsx` 에 BottomTabBar 항상 노출, 상단 nav 제거 (TopBar 컴포넌트 자체 제거)
  - 선행. T201 · 예상. 0.5h
- [ ] **T203** `.container` padding 통일 (12px) + BottomTabBar 와 겹치지 않도록 main padding-bottom 64px 적용
  - 선행. T103, T202 · 예상. 0.5h

### P3. 페이지별 모바일 대응

- [ ] **T301** `components/ResponsiveTable.tsx` 신규 — `<table>` row 를 항상 card stack 으로 렌더, props 로 모바일 헤더/값 매핑 명시
  - 선행. T101 · 예상. 2h
- [ ] **T302** 대시보드(`app/page.tsx`) 와 지출(`app/expenses/ExpensesView.tsx`), 합계(`app/summary/SummaryView.tsx`) 의 테이블을 ResponsiveTable 로 교체
  - 선행. T301 · 예상. 1.5h
- [ ] **T303** `app/calendar/AgendaView.tsx` 신규 — 동일한 occurrences props, 날짜 그룹 헤더 + 세로 리스트로 렌더
  - 선행. T101 · 예상. 1.5h
- [ ] **T304** `app/calendar/page.tsx` 에서 viewport 분기 wrapper 제거 후 AgendaView 만 렌더 (CalendarView 컴포넌트는 dead code 로 보존)
  - 선행. T303 · 예상. 0.5h
- [ ] **T305** `app/expenses/ExpensesView.tsx`, `app/vault/CategoryForm.tsx` 의 `.form-row` 를 `@media (max-width: 640px)` 에서 stack(라벨 위, 입력 아래) 으로 전환
  - 선행. T103 · 예상. 1h
- [ ] **T306** `components/ConfirmDialog.tsx` 신규 — `confirm()` native 다이얼로그 대체, focus trap, ESC 닫기, 모바일 bottom-sheet 스타일
  - 선행. T101 · 예상. 1.5h
- [ ] **T307** `EntriesScreen.tsx` 의 `confirm('정말 삭제하시겠습니까?')` 와 `ExpensesView.tsx` 의 `confirm()` 두 위치를 ConfirmDialog 로 교체
  - 선행. T306 · 예상. 0.5h
- [ ] **T308** `CategoryForm`, `OccurrencePanel` 등 인라인 패널을 모바일에서 bottom-sheet 스타일(화면 하단 sticky, 드래그 핸들) 로 표시
  - 선행. T101, T103 · 예상. 1.5h

### P4. 접근성 & 모션

- [ ] **T401** `.btn`, `.form-row input/select/textarea`, `.calendar .chip`, 하단 탭 버튼의 `min-height: 44px` 보장
  - 선행. T101 · 예상. 0.5h
- [ ] **T402** 전역 `:focus-visible` 스타일(2px outline + 2px offset, 토큰 컬러) 적용
  - 선행. T101 · 예상. 0.5h
- [ ] **T403** 본문 기본 font-size 를 모바일 16px / 데스크탑 14px 로 분기 (`html { font-size: 16px } @media (min-width: 768px) { html { font-size: 14px } }`)
  - 선행. T103 · 예상. 0.5h
- [ ] **T404** `globals.css` 에 motion 토큰(`--motion-fast: 150ms`, `--motion-normal: 250ms`, `--ease: cubic-bezier(0.2, 0, 0, 1)`)과 transition 유틸 적용
  - 선행. T101 · 예상. 0.5h
- [ ] **T405** `@media (prefers-reduced-motion: reduce)` 에서 모든 transition/animation 을 0.01ms 로 무력화
  - 선행. T404 · 예상. 0.25h
- [ ] **T406** `components/Skeleton.tsx` 신규 + 각 페이지의 "불러오는 중..." 텍스트를 Skeleton 카드로 교체
  - 선행. T101, T404 · 예상. 1h
- [ ] **T407** axe-playwright 1회 통과 (CI 게이트 등록은 P6 와 함께)
  - 선행. P3 완료 · 예상. 1h

### P5. PWA

- [ ] **T501** `public/icons/icon-192.png`, `icon-512.png`, `icon-512-maskable.png` 생성 (단순 monogram L)
  - 선행. 없음 · 예상. 0.5h
- [ ] **T502** `public/manifest.webmanifest` 작성 (name, short_name, icons, start_url, display=standalone, theme_color, background_color)
  - 선행. T501 · 예상. 0.25h
- [ ] **T503** `app/layout.tsx` 의 `<head>` 에 manifest link, theme-color, apple-touch-icon, viewport (`width=device-width, initial-scale=1, viewport-fit=cover`) 메타 추가
  - 선행. T502 · 예상. 0.25h
- [ ] **T504** Service Worker 등록 (next-pwa 채택 또는 직접 작성) — 앱 셸 precache + `/api/*` runtime cache (단, `/api/vault/*` 는 명시적 제외)
  - 선행. T503 · 예상. 2h
- [ ] **T505** 신버전 감지 토스트 — `skipWaiting()` 트리거하는 "새 버전이 있습니다 — 새로고침" UI
  - 선행. T504 · 예상. 1h
- [ ] **T506** 보관함 페이지 헤더 하단에 "홈 화면에 추가" 안내 배너, 7일 dismiss cookie
  - 선행. T504 · 예상. 0.75h

### P6. 시각 회귀 테스트

- [ ] **T601** `apps/web/playwright.config.ts` 작성 (viewport 375/768/1280, screenshot 옵션 `maxDiffPixelRatio: 0.01`)
  - 선행. 없음 · 예상. 0.5h
- [ ] **T602** `apps/web/tests/visual/dashboard.spec.ts` 등 5개 spec 파일 작성, 각 페이지에서 보관함은 unlock 전 상태 캡처
  - 선행. T601, P3 완료 · 예상. 2h
- [ ] **T603** baseline 이미지 15장 초기 캡처 + git 커밋
  - 선행. T602 · 예상. 0.5h
- [ ] **T604** `package.json` 에 `test:visual`, `test:visual:update` script 추가 + README 짧은 안내 한 단락
  - 선행. T603 · 예상. 0.25h

### P7. 데스크탑 모바일 폭 정렬

- [ ] **T701** `globals.css` 에 `.phone-frame` 클래스 추가 (`@media (min-width: 480px)` 에서 width 768px + margin: 0 auto + 본문 배경, 양옆 body 배경 zinc-100 노출). 휴대폰 장식(베젤·노치·둥근 모서리·그림자) 미적용.
  - 선행. T101 · 예상. 0.5h
- [ ] **T702** `app/layout.tsx` 에 `.phone-frame` wrapper 적용 (main + BottomTabBar 가 같은 wrapper 안. BottomTabBar 의 position 을 absolute 로 wrapper 기준)
  - 선행. T701 · 예상. 0.5h

**총 추정. 약 28.5h** (실제 변동폭 ±30%). 단계 단위 확정 후 한 단계씩 검수 권장.

## 아키텍처 다이어그램

```
┌──────────────────────────────────────────────────────────────────────┐
│  apps/web/app/layout.tsx                                              │
│  ┌────────────────────────────┐    ┌─────────────────────────────┐   │
│  │  TopBar (≥768px only)      │    │  PWA <head>                  │   │
│  │  - 5 nav links             │    │  - manifest                  │   │
│  └────────────────────────────┘    │  - theme-color               │   │
│  ┌────────────────────────────┐    │  - apple-touch-icon          │   │
│  │  <main className=container>│    │  - viewport-fit=cover        │   │
│  │  ┌──────────────────────┐  │    └─────────────────────────────┘   │
│  │  │ page contents        │  │                                       │
│  │  │  - ResponsiveTable   │  │    ┌─────────────────────────────┐   │
│  │  │  - AgendaView /      │  │    │  Service Worker              │   │
│  │  │    CalendarView      │  │    │  - precache: app shell       │   │
│  │  │  - ConfirmDialog     │  │    │  - runtime: /api/* SWR       │   │
│  │  │  - Skeleton          │  │    │  - exclude: /api/vault/*     │   │
│  │  └──────────────────────┘  │    └─────────────────────────────┘   │
│  └────────────────────────────┘                                       │
│  ┌────────────────────────────┐                                       │
│  │  BottomTabBar (<768px only)│  ← lucide-react icons                 │
│  │  대시보드 지출 캘린더 합계 보관함 │                                       │
│  └────────────────────────────┘                                       │
└──────────────────────────────────────────────────────────────────────┘

토큰 계층:
  globals.css :root
    ├─ --color-{role}-{shade}     (zinc/slate 기반)
    ├─ --color-{state}-{bg|fg}    (success/warning/danger/info)
    ├─ --space-{1..8}              (4/8/12/16/24/32/40/48)
    ├─ --radius-{sm|md|lg}         (4/8/12)
    ├─ --shadow-{sm|md}
    ├─ --font-{xs..3xl}            (12/14/16/18/22/28)
    └─ --motion-{fast|normal} + --ease

미디어 쿼리 단계:
  base (mobile)        320~767px   → font 16px, container 12px, BottomTabBar 표시
  @media min-width 768  768~1023   → font 14px, container 16px, TopBar 표시
  @media min-width 1024 1024+      → container 24px, max-width 1100px
```

## 테스트 매트릭스

| # | 케이스 | 입력 | 기대 결과 |
|---|--------|------|----------|
| 1 | 모바일 첫 진입 (375×667 iPhone SE) | 대시보드 URL 접근 | 가로 스크롤 없음, 하단 탭바 노출, 카드 4장이 1열로 적층 |
| 2 | 모바일 폼 입력 | 지출 페이지에서 input focus | iOS Safari 에서 auto-zoom 발생하지 않음 (font-size 16px) |
| 3 | 키보드 Tab 순회 | 보관함 unlock 화면 | 모든 인터랙티브 요소가 Tab 도달 가능 + focus-visible outline 가시 |
| 4 | 터치 타깃 측정 | DevTools 로 `.btn` 높이 측정 | 모든 .btn ≥ 44px |
| 5 | 색 대비 검증 | axe-playwright 실행 | WCAG AA 위반 0개 |
| 6 | reduced motion | OS 설정 `prefers-reduced-motion: reduce` 후 카드 hover | transition 발생 없음 (즉시 변경) |
| 7 | 캘린더 viewport 분기 | 640px → 641px 로 리사이즈 | <640px: AgendaView, ≥640px: CalendarView 그리드 |
| 8 | 테이블 viewport 분기 | 지출 페이지를 767px → 768px 로 리사이즈 | <768px: card stack, ≥768px: 일반 테이블 |
| 9 | ConfirmDialog 동작 | 항목 삭제 클릭 | 모바일에서 bottom-sheet 스타일 다이얼로그 노출, ESC/배경 클릭으로 닫기, focus trap 동작 |
| 10 | PWA 설치 | 모바일 Safari 에서 manifest 검출 | "홈 화면에 추가" 가능, 설치 후 standalone 모드 |
| 11 | SW 오프라인 | 설치 후 네트워크 OFF, 보관함 페이지 진입 | 앱 셸 로드 성공, 데이터 fetch 는 에러 표시 |
| 12 | SW 보안 | DevTools Application > Cache 확인 | `/api/vault/*` 캐시 미존재 |
| 13 | 시각 회귀 baseline | `pnpm test:visual` 실행 | 15장 모두 통과(첫 실행은 baseline 생성) |
| 14 | 시각 회귀 회귀 감지 | 의도적으로 `.btn` 색상 변경 후 재실행 | 영향받은 페이지 baseline diff 로 실패 |
| 15 | 신버전 토스트 | SW 업데이트 후 페이지 진입 | "새 버전이 있습니다 — 새로고침" 토스트 노출, 클릭 시 새로고침 |

## 검수 게이트 (각 Phase 종료 시)

- **P1 종료**. 토큰 60종 정의 + 미디어 쿼리 3단계 동작 확인 + 기존 페이지가 회귀 없이 렌더링
- **P2 종료**. iPhone SE (375px) 와 데스크탑 (1280px) 양쪽에서 네비게이션 정상 동작
- **P3 종료**. 5개 페이지 × 3개 viewport 모두 사용 가능 (수동 통과)
- **P4 종료**. axe-playwright 위반 0개 + 키보드 only 로 모든 액션 도달
- **P5 종료**. 모바일 Safari 에서 설치 성공 + 오프라인에서 앱 셸 로드
- **P6 종료**. `pnpm test:visual` 이 CI 에서 그린

## 향후 작업 (TODOS 이관)

- Tailwind v4 + shadcn/ui 디자인 시스템 전면 도입 (본 계획에서 D1 으로 기각, 추후 평가)
- 다크모드 지원 (본 계획에서 D1 으로 제외, 토큰 네이밍은 다크모드 호환 형태 유지)
- 푸시 알림 (본 계획에서 D2 로 제외, SW 인프라는 도입됨)
- View Transitions API 페이지 전환 (Safari 호환성 확보 후 재평가)
- swipe to delete 제스처 (우발적 삭제 위험 평가 후 재고)
