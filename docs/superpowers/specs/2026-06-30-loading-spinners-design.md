# 앱 전역 버튼 로딩 스피너 설계

작성일: 2026-06-30
대상: apps/web (Next.js 프론트엔드)

## 1. 목적과 범위

저장·수정·삭제 같은 쓰기 동작 중 "진행 중"이 눈에 보이지 않아(버튼이 비활성화만 됨) 사용자가 동작 여부를 확신하기 어렵다. **액션 버튼에 인라인 스피너**를 넣어 즉각적 피드백을 준다. 조회는 기존 스켈레톤을 유지한다.

- **범위**: 앱 전체(비밀번호 + 가계부)의 쓰기 액션 버튼.
- **형태**: 버튼 인라인 스피너(화면 전환·오버레이 없음).
- **결과 피드백**: 이번 작업은 로딩 표시만. 성공/실패 토스트는 비목표(에러는 기존 에러박스 유지).

### 비목표 (YAGNI)
- 토스트/스낵바 알림 시스템
- 전체 화면 오버레이, 상단 진행 바
- 조회 경로 스켈레톤 신규 추가(이미 주요 경로에 존재 — 점검만)

## 2. 현황

- 각 폼은 이미 `busy`/`saving` 상태를 갖고 요청 중 버튼을 `disabled` 처리한다. **상태 로직은 그대로 두고 버튼의 시각 표현만 보강**한다.
- 조회 로딩: `SkeletonCard`가 시크릿 목록(`EntriesScreen`)·시크릿 상세(`[id]/page.tsx`)·자산(`asset/page.tsx`)에 이미 적용됨. 신규 추가 불필요.
- 공용 버튼 컴포넌트는 없고, 곳곳에서 `<button className="btn" disabled={busy}>`를 직접 쓴다.
- 스피너 컴포넌트 없음. globals.css에 `ring`/`pulse`/`shimmer` 키프레임은 있으나 범용 회전 스피너는 없음.

## 3. 신규 컴포넌트

### Spinner — `apps/web/components/Spinner.tsx`
- 작은 원형 회전 스피너. 색은 `currentColor` 상속(버튼 글자색에 맞음).
- props: `size?: number`(기본 16), `aria-hidden` 처리(장식 요소). 접근성 텍스트는 버튼의 `aria-busy`가 담당.
- CSS: globals.css에 `@keyframes spin` + `.spinner`(border 기반 원, `currentColor` 테두리 + 투명 한쪽) 추가. 모션 톤은 기존과 일관.

### Button — `apps/web/components/Button.tsx`
- 기존 `.btn`/`.btn-text` 마크업을 감싸는 공용 버튼.
- props:
  - `loading?: boolean` — true면 `<Spinner/>` 표시 + 자동 `disabled` + `aria-busy={true}`.
  - `variant?: "primary" | "text" | "danger"` — 각각 `.btn` / `.btn-text` / 위험(삭제) 스타일 매핑. (기존 클래스 재사용; danger는 기존 삭제 버튼 스타일에 맞춤.)
  - 표준 `button` 속성 전부 전달(`type`, `onClick`, `disabled`, `style`, `className` 병합, `children`).
- 표현: `loading`일 때 라벨은 유지하고 라벨 옆(앞)에 스피너를 둔다. `disabled`는 `loading || props.disabled`.
- `React.FC` 미사용. props는 named interface. 콜백 타입 명시.

## 4. 적용 (쓰기 액션 버튼 → Button)

각 파일의 제출/삭제 등 액션 버튼을 `<Button loading={busy/saving}>`로 교체한다. **기존 상태/핸들러는 유지**한다.

대상(조사 기준):
- 가계부: `asset/_components/ExpenseForm.tsx`(저장·삭제 메뉴), `income/IncomeEntryForm.tsx`·`income/IncomeSheet.tsx`(저장·삭제), `asset/_components/CategoryAddSection.tsx`(추가), `asset/_components/CategoryRow.tsx`(저장·삭제)
- 비밀번호: `_components/secret-form/SecretEditStep.tsx`·`SecretReviewStep.tsx`(저장 등), `[id]/page.tsx`(상세의 수정/삭제 액션), `_components/EntriesScreen.tsx`(있다면 액션)
- 공용: `components/ConfirmDialog.tsx`(확인 버튼 — 삭제 진행 중 스피너), `_components/BackupPanel.tsx`·`backup/page.tsx`(내보내기·가져오기)
- 인증: `auth/UnlockScreen.tsx`·`auth/OnboardingScreen.tsx`(기존 "인증 중…" 텍스트를 스피너로 통일), `auth/RecoveryCodeDisplay.tsx`(액션 있으면)

> 비액션(단순 네비게이션) 버튼(예: 취소, 월 이동 ‹ ›)은 대상 아님 — 비동기 요청이 없으므로 로딩 불필요.

### ConfirmDialog 특이사항
`ConfirmDialog`는 현재 `onConfirm`이 동기 콜백이다. 삭제가 비동기인 호출처(CategoryManager 등)에서 진행 표시를 하려면, 다이얼로그에 `confirmLoading?: boolean`(또는 `busy`) prop을 추가해 확인 버튼에 스피너/disabled를 적용한다. 호출처가 자신의 삭제 진행 상태를 내려준다.

## 5. 접근성·동작

- 로딩 중 버튼은 `disabled` + `aria-busy="true"`로 스크린리더가 인지.
- 스피너는 `aria-hidden`(장식). 라벨 텍스트는 유지(레이아웃 점프 최소화 위해 라벨 폭 유지).
- 더블 클릭/중복 제출 방지: `loading`이면 `disabled`라 추가 클릭 차단(기존 busy 가드와 동일).

## 6. 테스트

- 단위: `Button`이 `loading`일 때 `disabled`·`aria-busy`·스피너 렌더, 아닐 때 정상. (RTL/jsx 테스트가 repo에 없으므로, 순수 로직이 적은 컴포넌트는 e2e로 커버 — 아래.)
- e2e(Playwright): 기존 `tests/e2e/asset.spec.ts`에 가벼운 단언 추가 — 카테고리/지출 저장·삭제 클릭 직후 해당 버튼이 `aria-busy`(또는 disabled) 됨을 확인.
- 회귀: 기존 jest 스위트·tsc·lint·build 그린 유지.

## 7. 영향 파일 요약

신규: `components/Spinner.tsx`, `components/Button.tsx`, globals.css(`@keyframes spin` + `.spinner`).
수정: §4의 액션 버튼 보유 컴포넌트들 + `ConfirmDialog.tsx`(confirmLoading prop). e2e 스펙 보강.
상태 로직·API·에러 처리 변경 없음.
