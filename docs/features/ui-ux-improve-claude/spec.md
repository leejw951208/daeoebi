# Spec. UI/UX 개선 — CRUD 라우트 분리와 IA 정리

> 한 줄 요약. /expenses 와 /vault 한 화면에 뒤섞인 조회·등록·수정·삭제를 Next.js 중첩 라우트로 분리하고, detail 페이지의 필드를 의미 단위 섹션으로 그룹화하며, 필터·검색 상태를 URL query string 으로 옮겨 "정보 산만 + CRUD 혼재" 두 통증을 한 회차에 해결한다.

## 배경

직전 `ui-ux-redesign` 회차에서 모바일 우선 레이아웃, 디자인 토큰, BottomTabBar, ResponsiveTable, ConfirmDialog, PWA 인프라가 정비됐다. 그러나 IA(정보 구조)와 navigation 은 그대로 유지돼 두 핵심 화면이 여전히 비대하다.

- `apps/web/app/expenses/ExpensesView.tsx` 363줄. 헤더, 추가/수정 폼(8 필드, 토글), 등록된 목록 테이블, ConfirmDialog 가 한 페이지에 직렬. `editingId` 상태가 "신규 생성" 과 "기존 수정" 을 한 폼이 분기한다. 모바일에서 폼 펼치면 목록은 스크롤 밖으로 밀려나고, 거꾸로 목록 보려고 폼을 닫으면 입력값이 사라진다.
- `apps/web/app/vault/EntriesScreen.tsx` 225줄 + `CategoryForm.tsx` 248줄. 헤더(잠금 상태/idle timer), 카테고리 필터/검색 toolbar, `editing` 상태 기반 인라인 폼(`'new' | entry`), 카드 목록(확장 가능 reveal), 삭제 다이얼로그가 한 페이지에 쌓여 있다. 카테고리 메타 관리와 백업·복원도 같은 vault 안에 인라인.

기존 inline 패턴은 1인 사용자가 한 작업을 끝내고 다음 작업으로 넘어가는 흐름을 가정하지 않는다. 모바일 PWA 의 back stack, 새로고침, 딥링크와도 어긋난다. 본 회차는 spec 의 단일 모바일 레이아웃·디자인 토큰·접근성 정책은 모두 유지하면서 navigation 과 IA 만 바꾼다.

## 기능 목록

### 1. /expenses 라우트 분리 (list / new / detail-edit-delete)

정기 지출 화면을 목록 전용 라우트와 건별 모달링 라우트로 나눈다.

**동작 방식**

- `/expenses` 는 목록만. 상단 toolbar 에 "추가" 버튼과 URL 기반 필터(상태/카테고리). 폼은 노출되지 않음.
- "추가" 클릭 시 `/expenses/new` 로 이동. 빈 폼만 표시. 저장 후 `/expenses` 로 router.push.
- 목록 행 클릭 시 `/expenses/[id]` 로 이동. detail 페이지는 "기본 정보 / 스케줄 / 결제 / 액션" 4개 섹션으로 그룹화된 카드. 수정·삭제 모두 이 페이지에서 수행. 삭제는 기존 ConfirmDialog 유지.
- 모든 라우트는 `apps/web/app/expenses/layout.tsx` 의 공통 헤더 아래 렌더(타이틀·BottomTabBar).

**포함 범위**

- `apps/web/app/expenses/page.tsx` 목록 전용으로 축소
- `apps/web/app/expenses/new/page.tsx` 신규
- `apps/web/app/expenses/[id]/page.tsx` 신규 + section 컴포넌트
- 필터 URL state. 예. `/expenses?status=SCHEDULED&category=구독`
- 기존 ResponsiveTable 의 row click → router navigation 으로 변경

**제외 범위**

- 정기 지출 데이터 모델·API 변경. 본 회차는 100% 프론트.
- "복제(duplicate)" 같은 신규 기능. spec 외.

### 2. /vault 라우트 분리 (entries / new / detail / categories / backup)

비밀번호 보관함을 다섯 개 라우트로 나누고 잠금 상태는 segment layout 으로 공유한다.

**동작 방식**

- `/vault` 는 entries 목록 전용. 잠금 해제 전이면 `<UnlockScreen />`, 해제 후이면 entries 목록 + 필터/검색 URL state.
- `/vault/new` 는 신규 항목 추가 폼. `/vault/[id]` 는 detail + reveal + 수정 + 삭제.
- `/vault/categories` 는 카테고리 메타 관리 라우트(현재 vault 안 인라인이던 흐름을 분리). 본 회차 구현은 read-only reference view 로 제한한다. 사유. 카테고리 정의가 코드 상수(`CATEGORY_LABELS`, `CATEGORY_FIELDS`) 이고 본 spec 의 "API/Crypto 변경 금지" 제약상 사용자 CRUD UI 는 백엔드 endpoint 추가 회차로 이관.
- `/vault/backup` 은 export/import 패널 (`BackupPanel` 이전).
- `apps/web/app/vault/layout.tsx` 는 잠금 상태와 idle timer 를 segment layout 으로 공유. 모든 vault 서브라우트에서 잠금 해제 후 access. 잠금 시 layout 이 `<UnlockScreen />` 으로 fallback.

**포함 범위**

- `apps/web/app/vault/layout.tsx` 신규(잠금/idle 공유)
- `apps/web/app/vault/page.tsx` entries 목록 전용으로 축소
- `apps/web/app/vault/new/page.tsx`, `apps/web/app/vault/[id]/page.tsx` 신규
- `apps/web/app/vault/categories/page.tsx` 신규
- `apps/web/app/vault/backup/page.tsx` 신규
- 필터/검색 URL state. 예. `/vault?cat=LOGIN&q=git`

**제외 범위**

- vault API/Crypto 변경. 마스터 패스워드 검증, AEAD 정책 등은 그대로.
- IndexedDB 같은 클라이언트 저장 도입. spec 외.

### 3. detail 페이지 정보 그룹화 (IA)

detail 페이지의 필드를 의미 단위 섹션 카드로 묶어 "산만" 통증을 해결한다.

**동작 방식**

- expense detail 섹션. **기본 정보**(이름·카테고리·금액·통화) / **스케줄**(주기·시작일·종료일) / **결제**(수단·메모) / **액션**(수정·삭제).
- vault entry detail 섹션. **라벨·메타**(라벨·카테고리·생성일/수정일) / **민감 필드**(카테고리별 reveal/copy) / **액션**(수정·삭제).
- 각 섹션은 기존 `.card` + `.section-title` 토큰 그대로 사용. 추가 토큰 없음.
- 수정 모드는 같은 라우트에서 inline 전환 (편집 버튼 → 폼 모드 → 저장/취소). 별도 `/edit` 라우트는 만들지 않는다(라우트 폭증 방지).

**포함 범위**

- detail 페이지 안에 view-mode 와 edit-mode 의 conditional render
- 섹션 제목·필드 묶음 결정

**제외 범위**

- 신규 디자인 토큰. 본 회차는 기존 토큰만 조합한다.

### 4. 필터·검색 URL state 마이그레이션

filter/search 를 client state 가 아닌 URL query string 으로 옮겨 북마크·공유·뒤로가기를 가능하게 한다.

**동작 방식**

- `useSearchParams()` + `useRouter()` 로 query 읽고 쓴다.
- 필터 컨트롤 onChange → `router.replace(\`/expenses?\${params}\`, { scroll: false })`.
- 초기 진입 시 query 가 없으면 디폴트(전체/공백) 적용.

**포함 범위**

- `/expenses` 의 status·category 필터
- `/vault` 의 cat·q (검색)

**제외 범위**

- 페이지네이션. 현재 데이터 규모상 불필요.

## 입출력

본 기능은 UI 변경이므로 코드 레벨 입출력 대신 사용자 가시 산출물·라우트를 명시한다.

**입력 (개발자 관점)**

- 기존 API 클라이언트(`apps/web/lib/api-client.ts`, `vault-client.ts`) props·시그너처 변경 없음.
- 기존 컴포넌트 `ResponsiveTable`, `ConfirmDialog`, `CategoryForm`, `OccurrencePanel` 의 외부 인터페이스 유지. CategoryForm 은 별도 라우트 페이지에서도 동일 props 로 사용.

**출력 (사용자 관점)**

- `/expenses` 목록 진입 시 폼이 보이지 않고 데이터만 표시.
- 신규/수정 작업이 별도 라우트라 모바일 뒤로가기와 새로고침이 자연스럽게 작동.
- 필터/검색 URL 을 북마크하거나 공유 시 동일 상태 재현.
- vault 의 카테고리 관리·백업/복원 도 독립 라우트로 분리돼 entries 화면이 가벼워짐.

## 제약 조건

- Next.js 15 App Router + React 19 구조 유지. 외부 의존성 추가 없음.
- 백엔드(`apps/api`)·Prisma schema·API DTO 변경 금지.
- 기존 디자인 토큰·BottomTabBar·접근성 정책(focus-visible·44px 터치 타깃·prefers-reduced-motion) 100% 유지.
- 시각 회규 baseline 은 본 변경으로 다수 갱신되지만 본 spec 의 책임. axe WCAG 위반 0건 유지.
- 라우트 추가는 최대 7개(`/expenses/new`, `/expenses/[id]`, `/vault/layout`, `/vault/new`, `/vault/[id]`, `/vault/categories`, `/vault/backup`).

## 예외 케이스

- `/expenses/[id]` 에서 잘못된 id 진입 → 404 페이지 또는 목록으로 redirect 후 toast.
- `/vault/*` 진입 시 잠금 상태 → layout 이 `<UnlockScreen />` 으로 fallback 하고 잠금 해제 후 원래 라우트로 복귀.
- 필터 query string 에 알 수 없는 값 → 디폴트(전체)로 fallback, URL 은 정리하지 않음(사용자 직접 수정 가능).
- 모바일에서 수정 중 뒤로가기 → 브라우저 표준 confirm 없음. 변경사항 자동 저장 안 함(기존 동작 유지). 단, edit-mode 에서는 헤더에 "저장하지 않은 변경" 시각 표시 정도는 검토 가능(스코프 외 후보).
- 카테고리 삭제 시 종속 entries 존재 → 기존 동작 유지(거부 또는 cascade 정책은 vault 서비스 기존 정책 따름).

## 채택 근거

**핵심 이유**

- "조회/등록/수정/삭제 한 화면" 통증은 한 화면 안에서 컴포넌트만 재배치해선 해결되지 않는다. App Router 의 라우트 분리는 의도 분리와 navigation 자연스러움을 동시에 얻는다.

**보조 이유**

- 필터/검색 URL state 는 mobile PWA 의 back stack·새로고침·딥링크와 자연스럽게 결합되고 추가 도구 비용 0.
- detail 페이지 섹션 그룹화는 기존 `.card`/`.section-title` 토큰만 재사용해 신규 디자인 토큰 도입 없이 "산만" 통증을 해결.
- segment layout 의 vault 잠금 공유는 layout.tsx 패턴의 정석. 책임 분리 + 코드 감소.

**기각된 대안**

- Approach A (라우트 분리만). 절반만 해결. detail 페이지가 여전히 단일 큰 폼이라 "산만" 불만은 남음.
- Approach C (parallel routes + intercepting routes). 본 앱 규모 대비 학습/디버깅 비용 과투자. PWA 느낌은 좋지만 본 통증과 직교.
- inline 폼을 bottom-sheet 로만 바꾸는 옵션. CRUD 의도 분리가 아니라 시각적 가림만 바뀌어 본질 해결 아님.
- 필터 상태를 zustand/Recoil 도입으로 옮기는 옵션. 외부 의존성 추가는 spec 의 제약 위반.

## 비기능 요건

**성능**

- 라우트 추가에 따른 First Load JS 증가 +20KB 이내(직전 ui-ux-redesign 의 +60KB 한도 안에서).
- detail 페이지 진입 후 first contentful paint 모바일 < 1s (4G 가정).

**보안**

- vault layout 의 잠금 fallback 이 모든 서브라우트에 대해 작동해야 함. 라우트 직접 진입(`/vault/[id]`)에서도 잠금 해제 전에는 키·민감 필드 노출 금지.
- 카테고리·entry id 가 URL 에 노출되지만 vault 의 보호는 잠금 상태와 API 인증에 있으므로 id 노출 자체는 위협 모델 변화 없음.
- 본 회차는 신규 공격 표면 도입 없음.

**확장성**

- 라우트 7개 추가 후 vault 가 더 커지면 `app/vault/(authenticated)/` 라우트 그룹으로 다시 묶는 것을 검토.
- 필터가 5개를 넘어가면 URL state 만으론 부족해 dedicated filter sheet 컴포넌트가 필요해질 수 있음.

## 용어 정의

- **App Router segment layout**. Next.js 13+ 의 디렉터리 기반 layout.tsx 가 그 segment 아래 모든 페이지를 감싸는 패턴. 본 spec 의 vault 잠금 공유에 사용.
- **URL state**. UI 상태(필터·검색·정렬)를 React state 가 아닌 URL query string 에 보관하는 패턴. 북마크·공유·뒤로가기가 자연스러워짐.
- **IA (Information Architecture)**. 사용자가 보는 정보의 그룹·계층·순서. 본 spec 에서는 detail 페이지의 섹션 분할을 의미.
- **inline form**. 별도 라우트나 모달 없이 같은 페이지 안에 폼이 펼쳐지는 패턴. 본 spec 이 제거하려는 대상.
- **건별 모달링**. 신규/수정/상세를 한 항목 단위 라우트로 분리해 작업 중 다른 항목에 영향 없는 흐름.
