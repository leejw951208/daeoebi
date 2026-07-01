# 데모 페이지 업데이트(비밀번호 갱신 + 가계부 추가) 설계

작성일: 2026-07-01
대상: apps/web `/demo` 공개 데모

## 1. 목적과 범위

공개 데모(`/demo`)에 (1) 상단 **비밀번호 ↔ 가계부** 전환 네비를 추가하고, (2) **가계부(자산) 화면**을 대시보드 + 간단 상호작용(지출 추가·카테고리 관리) 수준으로 넣는다. 기존 비밀번호 데모는 토글 아래로 통합하고 경미하게 갱신한다.

- 데모 격리 원칙 유지: `vault-client`·실제 인증·암호화를 일절 쓰지 않고 **메모리 상태**로만 동작.
- 가계부 대시보드는 **실제 프레젠테이션 컴포넌트 재사용**, 상호작용은 데모 전용 컴포넌트(로컬 상태).

### 비목표(YAGNI)
- 고정 지출(recurring)·수입 시트의 완전한 상호작용(수입은 표시만)
- 월 이동/이전 달 데이터, 결제일 이연 등 복잡 로직
- 데모 데이터의 서버 왕복·영속화

## 2. 현황

- `demo/page.tsx`(447줄): 비밀번호 금고만. `view`(list/detail/new/edit) 상태머신 + 가짜 `secrets`(`demo-data.ts`) + `DemoSecretForm`. `ConfirmDialog`/`CopyField` 재사용, `vault-client` 미사용.
- `AssetDashboard`(+`RemainingHero`/`IncomeExpenseCards`/`CategoryBreakdown`/`ExpenseCalendar`/`DayDetail`): `vault-client`를 **타입 전용**으로만 import → 순수 프레젠테이션, 재사용 가능.
- 데이터 형태: `ComputedExpense{ id,date,recurringId,item,amount,categoryId }`, `ComputedIncome{ id,month,item,amount,category }`, `AssetCategory{ id,name,color,createdAt,updatedAt }`. `byDay(expenses): Map<date,amount>`, `byCategory(expenses, categories)`.

## 3. 설계

### 3.1 네비게이션
`demo/page.tsx`에 최상위 `tab: "secret" | "asset"` 상태 + 상단 세그먼트 토글(비밀번호/가계부). `tab`에 따라 기존 비밀번호 데모 또는 `DemoAssetScreen` 렌더. `DemoBanner`는 공통 유지.

### 3.2 가계부 데모 — `DemoAssetScreen.tsx`
- 로컬 상태: `categories: AssetCategory[]`, `expenses: ComputedExpense[]`, 고정 `incomeAmount`/`incomes`(표시용), `selectedDay`, 폼/시트 열림 상태.
- **대시보드**: 실제 `AssetDashboard`에 `data={{ incomeAmount, incomes, expenses, categories }}`, `dayTotals={byDay(expenses)}`, `month`(고정 예: 현재월 문자열), `selectedDay`, `onSelectDay`(로컬 갱신), `onOpenIncome`(데모는 no-op 또는 안내) 전달.
- **지출 추가**: FAB(+) → `DemoExpenseForm`(금액·항목·카테고리 칩·날짜) → 로컬 `expenses`에 push(고유 id, `categoryId`) → 대시보드 반영.
- **카테고리 관리**: "카테고리 관리" 버튼 → `DemoCategoryManager`(목록 + 추가[이름 표준 입력 + `CategoryColorInput` HEX] · 수정 · 삭제[`ConfirmDialog` "미분류" 안내]) → 로컬 `categories` 갱신. 삭제 시 해당 지출 `categoryId=null`(미분류)로 로컬 반영.
- 버튼은 공용 `Button`. 실제 저장이 없어 즉시 반영(로딩 상태 불필요).

### 3.3 데모 가짜 데이터 — `demo-asset-data.ts`
- `DEMO_ASSET_CATEGORIES: AssetCategory[]`(기본 8종 유사, createdAt 문자열 고정).
- `DEMO_EXPENSES: ComputedExpense[]`(현재월 여러 날짜, 카테고리 분산, 금액 예시).
- `DEMO_INCOME`(총액 + `ComputedIncome[]` 표시용).
- `DEMO_MONTH`(고정 "YYYY-MM").

### 3.4 데모 상호작용 컴포넌트
- `DemoExpenseForm.tsx`: `ExpenseForm` UX를 로컬 상태 버전으로 축약(금액·항목·카테고리 선택·날짜·저장/취소). props: `{ categories, onSave(expense), onCancel }`.
- `DemoCategoryManager.tsx`: `CategoryManager`+`CategoryAddSection`+`CategoryRow` UX를 로컬 버전으로. `CategoryColorInput`(HEX)·`ConfirmDialog` 재사용. props: `{ categories, onChange(categories) }`.
  - (실제 CategoryManager/CategoryAddSection 은 vault-client·useVault 의존이라 직접 재사용 불가 → 데모 전용 축약본.)

### 3.5 비밀번호 데모 갱신
- 기존 흐름 유지, 토글 아래로 통합. 원시 `<button className="btn">` 중 액션 버튼을 공용 `Button`으로 정리(선택적, 경미). 예시 데이터는 유지/소폭 손질.

## 4. 검증

- 순수 로직이 생기면(예: 데모 지출 추가 후 dayTotals/byCategory 반영) 단위 테스트는 이미 `asset-compute` 로 커버 → 데모 자체는 컴포넌트라 tsc/lint/build 로 검증.
- e2e(선택): `/demo`에서 가계부 토글 → 대시보드 렌더 + 카테고리 추가(HEX) 스모크 1개.
- 회귀: 기존 jest·tsc·lint·build·e2e green 유지. 기존 비밀번호 데모 흐름 정상.

## 5. 영향 파일

- 신규: `apps/web/app/demo/demo-asset-data.ts`, `DemoAssetScreen.tsx`, `DemoExpenseForm.tsx`, `DemoCategoryManager.tsx`.
- 수정: `apps/web/app/demo/page.tsx`(탭 토글 + 라우팅), (경미) 비밀번호 데모 버튼 정리.
- 재사용: `AssetDashboard`(+하위), `asset-compute`(byDay/byCategory), `asset-categories`(CategoryColorInput 은 `_components` 라 데모에서 import 가능 여부 확인 — 가능), `ConfirmDialog`, `Button`.
- vault-client·인증·암호화 변경 없음.
