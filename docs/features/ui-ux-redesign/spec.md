# Spec. UI/UX Redesign

> 한 줄 요약. apps/web 의 데스크탑 전용 UI 를 모바일 우선 반응형으로 재구성하고, WCAG 2.2 수준의 접근성과 PWA 설치 가능성을 확보한다.

## 배경

`apps/web` 은 Next.js App Router 위에 custom CSS 한 장(`globals.css`)으로 구성된 1인용 가계부 + 비밀번호 보관함이다. 사용자 D 가 일상에서 가장 많이 쓰는 환경은 모바일이지만, 현재 코드는 데스크탑 전용으로 작성되어 있다. `globals.css` 에 미디어 쿼리가 0개이고, `.container` 가 `max-width: 1100px` 고정에 padding 24px 만 적용되어 있어 320px 폭 단말에서 토픽 네비게이션 5개가 가로로 밀려나고, `.form-row` 의 `grid-template-columns: 160px 1fr` 는 입력 폭을 짓누른다. 테이블도 가로 스크롤이 강제된다.

접근성 측면에서도 부채가 누적되어 있다. `.btn` 의 실제 높이는 32~36px 로 WCAG 2.5.5 의 44px 최소 터치 타깃에 미달한다. `:focus-visible` 스타일이 없어 키보드 사용자는 어디에 포커스가 있는지 알기 어렵고, 색상 토큰은 `--bg`, `--surface`, `--text`, `--muted`, `--primary`, `--warn`, `--danger`, `--good` 8종만 정의되어 있는데 calendar chip 등 상태별 색상은 모두 hex 로 하드코딩되어 있다. `confirm()` native 다이얼로그는 모바일에서 깨진다.

2026년에도 살아남는 "modern" 의 정의는 트렌드를 추격하는 것이 아니라 기본기를 다지는 쪽이다. 다크모드, 푸시 알림, 디자인 시스템 전면 도입은 명시적으로 범위에서 제외한다(채택 근거 참조).

## 기능 목록

### 1. 단일 모바일 레이아웃 (데스크탑도 모바일 웹 뷰와 동일)

본 앱은 1인 모바일 사용자가 주 타깃이므로 데스크탑에서도 같은 인터페이스를 보여주는 게 학습 비용·유지 보수 측면에서 유리하다. 따라서 viewport 폭에 관계없이 항상 모바일 레이아웃(상단 nav 없음, 하단 탭바, 카드 stack, 아젠다)을 표시한다. 데스크탑(≥480px) 에서는 가운데 768px 폭으로 정렬되고 양옆은 body 배경(zinc-100) 으로 노출되어 "데스크탑 창에서 모바일 웹을 보는 것과 동일한 화면" 이 된다. 휴대폰 단말 시뮬레이션(베젤·노치·둥근 모서리·그림자) 은 명시적으로 제외한다.

**동작 방식**

- 어떤 viewport 폭에서도 상단 nav 는 표시하지 않고 하단 BottomTabBar 5탭(대시보드/지출/캘린더/합계/보관함)을 표시한다.
- 데스크탑(≥480px) 에서는 본문 컨테이너가 `width: 768px` + `margin: 0 auto` + body 배경 zinc-100 으로 가운데 정렬된다. 베젤/노치/둥근 모서리/그림자 같은 휴대폰 장식은 적용하지 않는다.
- 실제 모바일 단말(<480px) 에서는 풀스크린으로 본문을 표시한다(가운데 정렬 효과 없음).
- 컨테이너 padding 은 viewport 무관 12px 로 통일한다.

**포함 범위**

- `app/layout.tsx` 에 `.phone-frame` wrapper 추가, 상단 nav 제거, BottomTabBar 항상 노출
- `globals.css` 의 viewport 분기 통합 (768px/1024px 분기 제거, 480px 의 phone-frame 분기만 유지)
- 모든 페이지(`/`, `/expenses`, `/calendar`, `/summary`, `/vault`)가 phone-frame 안에서 모바일 레이아웃으로 렌더

**제외 범위**

- 다국어/RTL 대응. 이유는 사용자 1명·한국어 단일 환경.
- 데스크탑에서 정보 밀도가 더 필요한 작업(정기 지출 11컬럼 테이블, 합계 카테고리별 비교 등)은 본 회차에서 명시적으로 제외. 사용자는 모바일 인터페이스를 데스크탑에서도 동일하게 사용한다고 합의했다.

### 2. 데이터 표시의 모바일 통일

테이블(대시보드, 지출, 합계)은 viewport 폭과 무관하게 항상 카드 리스트로, 캘린더는 항상 아젠다 리스트로 표시한다.

**동작 방식**

- `<table className="table">` 을 감싸는 `<ResponsiveTable>` 컴포넌트는 어떤 viewport 에서도 row 를 card stack 으로 렌더한다(내부 `<table>` 은 display:none).
- 캘린더는 항상 "이번 달 예정/완료 occurrence 를 날짜 그룹 헤더와 함께 세로로 나열한 아젠다 뷰" 로 표시된다. 기존 7×6 그리드 `<CalendarView>` 는 본 회차에서 dead code 가 되지만 차후 데스크탑 옵션 가능성을 위해 보존한다.
- `CategoryForm`, `OccurrencePanel` 같은 인라인 편집 패널은 모바일에서 화면 하단에 sticky 로 붙어 bottom-sheet 처럼 동작한다.

**포함 범위**

- `components/ResponsiveTable.tsx` 신규
- `app/calendar/AgendaView.tsx` 신규 (CalendarView 와 동일한 props 인터페이스)
- 모바일에서 `confirm()` 을 대체하는 `<ConfirmDialog>` 컴포넌트

**제외 범위**

- swipe to delete 같은 제스처. 이유는 우발적 삭제 위험이 크고 1인 사용자에게 비용 대비 효익이 낮음.

### 3. 접근성 강화 (WCAG 2.2 AA)

키보드 사용성, 터치 타깃, 색 대비, 포커스 표시를 정비한다.

**동작 방식**

- 모든 인터랙티브 요소(button, a, input, select)는 min-height 44px (WCAG 2.5.5 Target Size Minimum) 를 보장한다.
- `:focus-visible` 에 2px outline + offset 의 일관된 포커스 링을 적용한다.
- 본문 텍스트 기본 크기를 모바일 16px, 데스크탑 14px 로 분기한다(iOS 의 input auto-zoom 방지).
- 본문 텍스트와 배경의 명도 대비 4.5:1 이상, 큰 텍스트는 3:1 이상을 충족한다.

**포함 범위**

- `.btn`, `.form-row input/select/textarea`, `.calendar .chip` 등 핵심 컴포넌트의 사이즈/포커스 재정의
- 키보드 트랩 검사(특히 모달, bottom-sheet)
- 색 대비 자동 검증을 위한 axe-playwright 한 번 통과

**제외 범위**

- 스크린리더 음성 라벨 전면 재작성. 이유는 한국어 환경 + 사용자 1인 가정상 ROI 가 낮음. 기본 `aria-label` 유지·보강만 수행.

### 4. zinc/slate 컬러 시스템과 디자인 토큰 확장

현재 CSS 변수 8종을 60종 수준의 디자인 토큰으로 확장하고, 색상 팔레트를 zinc/slate 계열로 재구성한다.

**동작 방식**

- 컬러 토큰을 `--color-{role}-{shade}` 형식으로 재작성한다(예: `--color-surface-1`, `--color-text-primary`, `--color-accent-500`).
- 상태 토큰(success/warning/danger/info) 의 background/foreground 쌍을 정의한다.
- 단일 액센트 컬러(현재 `#2c5fef`) 는 유지하되 새로운 zinc/slate 뉴트럴과 대비가 잘 맞도록 한 단계 조정한다.

**포함 범위**

- `globals.css` 의 `:root` 토큰 재작성
- 모든 hardcoded hex 를 토큰으로 치환
- `--space-*` (4/8/12/16/24/32), `--radius-*` (4/8/12), `--shadow-*` (sm/md), `--font-*` (12/14/16/18/22/28), `--motion-*` (fast/normal) 토큰

**제외 범위**

- Tailwind/shadcn 등 외부 디자인 시스템 도입. 이유는 D1 에서 채택되지 않음(다음 단계 후보, TODOS 로 이관).
- 다크모드. 이유는 D1 에서 명시적 제외(추후 토큰 시스템이 다크모드를 받아들일 수 있도록 의미론적 네이밍은 유지).

### 5. 모션과 마이크로 인터랙션

상태 변화에 차분한 모션을 적용하되, `prefers-reduced-motion` 을 존중한다.

**동작 방식**

- 버튼·카드·다이얼로그의 hover/press/expand 에 150~250ms transition 을 적용한다.
- `@media (prefers-reduced-motion: reduce)` 에서는 모든 transition/animation 을 0.01ms 로 무력화한다.
- skeleton 로더(`<Skeleton>` 컴포넌트) 가 fetch 중 화면 공백을 채운다.

**포함 범위**

- `globals.css` 의 transition 토큰과 유틸리티 클래스
- `components/Skeleton.tsx` 신규 (각 페이지의 loading state 대체)

**제외 범위**

- 페이지 전환 애니메이션(View Transitions API). 이유는 Safari 호환성 미흡 + 본 앱 규모에서 효익 작음.

### 6. PWA 설치 가능성

manifest + service worker 로 모바일 홈 화면 설치와 오프라인 캐시(앱 셸)를 제공한다. 푸시 알림은 제외한다.

**동작 방식**

- `public/manifest.webmanifest` 에 name/short_name/icons/theme_color/display=standalone 을 정의한다.
- Service Worker 는 Workbox 의 precache(앱 셸 정적 자산) + runtime cache(`/api/*` 는 network-first 후 stale-while-revalidate fallback) 패턴.
- 첫 방문 시 자동 install 프롬프트는 노출하지 않는다. 보관함 페이지 헤더 하단에 "홈 화면에 추가" 안내 배너를 한 번만 노출하고, 7일 dismiss cookie 로 재노출 억제.

**포함 범위**

- `public/manifest.webmanifest` + `public/icons/icon-{192,512}.png` (512 maskable 1종 포함)
- `next.config.ts` 에 service worker 등록(next-pwa 또는 직접 작성)
- `<head>` 의 `theme-color`, `apple-touch-icon`, viewport 메타 정비

**제외 범위**

- 푸시 알림. 이유는 D2 에서 명시적 제외.
- 백그라운드 동기화. 이유는 1인 로컬 사용 가정상 필요 없음.

### 7. 시각 회귀 테스트

Playwright 의 `toHaveScreenshot()` 으로 5개 페이지 × 3개 viewport (375/768/1280) = 15개 baseline 을 캡처하고 CI 게이트로 등록한다.

**동작 방식**

- `apps/web/tests/visual/` 에 페이지별 spec 파일을 둔다.
- baseline 이미지는 git LFS 또는 일반 git 으로 관리(<200KB/이미지 기준 일반 git 채택).
- 1% 픽셀 차이까지 허용하는 `maxDiffPixelRatio: 0.01` 설정.

**포함 범위**

- Playwright + `@playwright/test` 설정
- `apps/web/tests/visual/{dashboard,expenses,calendar,summary,vault}.spec.ts`
- npm script `test:visual` 와 baseline 업데이트용 `test:visual:update`

**제외 범위**

- E2E 사용자 시나리오 테스트(폼 입력 → 저장 → 검증). 이유는 기존 unit 테스트로 일부 커버, 본 스코프는 시각 회귀에 한정.

## 입출력

본 기능은 사용자 가시 UI 변경이므로 코드 레벨 입출력 대신 사용자 가시 산출물을 명시한다.

**입력 (개발자 관점)**

- 기존 컴포넌트 props 인터페이스는 유지한다(`VaultView`, `EntriesScreen`, `CalendarView`, `ExpensesView` 등). 모바일 분기는 컴포넌트 내부 viewport 감지 또는 CSS 미디어 쿼리로 처리한다.
- 새 컴포넌트 `<ResponsiveTable>`, `<AgendaView>`, `<BottomTabBar>`, `<Skeleton>`, `<ConfirmDialog>` 는 명시적 props 인터페이스를 가진다.

**출력 (사용자 관점)**

- 320~1280px 모든 viewport 에서 가로 스크롤 없이 동작
- 키보드 Tab 만으로 모든 액션 도달 가능 + focus 가시화
- 모바일 Safari 의 "홈 화면에 추가" 로 설치 가능, 설치 후 오프라인에서 보관함 페이지 까지 열림(데이터 fetch 는 실패할 수 있음)

## 제약 조건

- Next.js 15 App Router + React 19 구조 유지. 새 프레임워크 도입 금지.
- 외부 의존성은 `lucide-react`, `next-pwa`(또는 직접 SW), `@playwright/test` 3개만 추가.
- 백엔드(apps/api) 와 Prisma schema 는 건드리지 않는다. 본 변경은 100% 프론트엔드.
- 번들 사이즈 증가 +60KB 이내 (lucide tree-shaking + workbox runtime).

## 예외 케이스

- viewport 가 320px 미만 → 가로 스크롤 허용(현실적 단말이 없음, 명시적 비대응).
- 사용자가 JS 비활성화 → 기존 SSR 화면이 그대로 보이되 인터랙션(필터, 폼 토글) 은 동작하지 않음. PWA 설치 안내 배너는 노출되지 않음.
- 사용자가 `prefers-reduced-motion: reduce` 설정 → 모든 transition/animation 무력화. skeleton 의 shimmer 도 단순 회색 박스로 대체.
- 사용자가 axe-playwright 검사에서 신규 위반 발견 → 머지 차단.
- service worker 가 stale cache 를 반환하는데 사용자가 새 버전을 기대 → "새 버전이 있습니다 — 새로고침" 토스트를 노출하고 사용자 확인 후 `skipWaiting()`.

## 채택 근거

**핵심 이유**

- 사용자가 일상에서 가장 많이 접근하는 환경이 모바일인데 현재 코드는 데스크탑 전용이라 ROI 가 가장 큰 단일 투자다.

**보조 이유**

- 접근성 정비(터치 타깃, focus-visible, 색 대비)는 디자인 토큰 재정비와 한 단위로 묶을 때 비용 효율이 가장 좋다.
- PWA 는 manifest+SW 만으로 "앱처럼 느껴짐" 의 70% 를 달성하므로 효익/비용 비율이 우수하다.
- zinc/slate 컬러 시스템은 다크모드를 추후 도입하기 쉽도록 의미론적 토큰 네이밍을 강제하는 부수 효과가 있다.

**기각된 대안**

- Tailwind v4 + shadcn/ui 전면 도입. 초기 마이그레이션 비용 15~25h 가 본 스코프(11~18h) 보다 크고, 사용자 D1 에서 채택되지 않음. TODOS 로 이관.
- Bento + soft brutalism 트렌드 반영. 12개월 내 시각적 노후 위험이 큰 데 비해 본질적 사용성 개선과 직교. D1 에서 기각.
- 다크모드. 사용자가 D1 에서 명시적으로 제외. 단, 토큰 네이밍은 다크모드를 받아들일 수 있는 의미론적 형태로 작성하여 추후 추가 비용을 최소화.
- 푸시 알림. 사용자가 D2 에서 명시적으로 제외. service worker 자체는 도입.
- 페이지 전환 애니메이션(View Transitions). Safari 호환성 미흡, 본 앱 규모에서 효익 작음.
- swipe to delete 제스처. 우발적 삭제 위험 + 1인 사용자에게 비용 대비 효익 낮음.

## 비기능 요건

**성능**

- 모바일 4G Lighthouse Performance ≥ 85, Accessibility ≥ 95, Best Practices ≥ 95.
- First Contentful Paint 모바일 < 1.5s (3G slow 가정 X, 4G 가정).
- 번들 사이즈 증가 +60KB gzipped 이내.

**보안**

- Service Worker 는 same-origin 만 캐시. cross-origin (예: API auth) 은 캐시 제외.
- manifest 의 `scope` 는 `/` 로 한정.
- 위협 모델. 본 스코프는 UI 변경이므로 새 공격 표면 추가 없음. 단 SW 의 캐시 정책이 stale-while-revalidate 일 때 vault 응답이 캐시될 가능성을 차단하기 위해 `/api/vault/*` 는 명시적 cache exclusion.

**확장성**

- 페이지 추가 시 `<BottomTabBar>` 의 탭 한도는 5개(thumb 영역 기준). 6번째 페이지가 생기면 "더보기" 탭으로 분기 필요.
- 디자인 토큰 60종은 단일 파일 `globals.css` 로 관리. 100종을 넘으면 `tokens.css` 분리 검토.

## 용어 정의

- **터치 타깃**. 사용자가 손가락으로 누를 수 있는 영역의 최소 크기. WCAG 2.5.5 의 권고는 44×44 CSS 픽셀.
- **focus-visible**. 키보드 등 비포인터 입력으로 포커스되었을 때만 시각적 강조를 보여주는 CSS 의사 클래스. 마우스 클릭 시 outline 이 거슬리는 문제를 피한다.
- **bottom-sheet**. 화면 하단에서 올라와 컨텐츠를 덮는 패널. 모바일에서 modal 의 대체 패턴.
- **PWA (Progressive Web App)**. manifest + service worker 로 설치·오프라인 동작이 가능한 웹앱.
- **maskable 아이콘**. PWA 아이콘 중 OS 가 임의의 마스크(원/사각/squircle) 로 잘라낼 수 있도록 안전 영역(80%) 안에 그려진 변형.
- **stale-while-revalidate**. 캐시된 응답을 즉시 반환하면서 백그라운드로 fresh fetch 를 트리거하는 캐시 전략.
- **시각 회귀 테스트**. 의도치 않은 픽셀 단위 UI 변경을 baseline 이미지와 diff 로 잡아내는 자동화 테스트.
- **bento grid**. 크고 작은 카드를 비대칭으로 배치한 그리드 레이아웃. 2024~2025 트렌드.
- **soft brutalism**. 굵은 외곽선·그림자·큰 타이포를 절제된 채도와 결합한 디자인 스타일.
