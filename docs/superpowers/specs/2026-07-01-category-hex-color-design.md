# 카테고리 추가/수정 UI 개선(표준 입력 + HEX 색상) 설계

작성일: 2026-07-01
대상: apps/web 자산(가계부) 카테고리 관리

## 1. 목적과 범위

카테고리 추가 시 (1) 이름 입력 UI를 앱의 서비스 표준 폼 스타일과 동일하게 맞추고, (2) 색상을 고정 팔레트 대신 **HEX 코드로 직접 입력**할 수 있게 한다.

- 이름 입력 표준화: **추가 폼**의 이름 필드.
- HEX 색상 입력: **추가 + 수정** 모두(공용 색상 컴포넌트 교체).
- 고정 팔레트 UI는 제거한다.

### 비목표(YAGNI)
- 최근 사용 색·색 히스토리, 색 이름 프리셋
- 네이티브 컬러 피커(`<input type=color>`) — 요청은 "HEX 코드 입력"

## 2. 현황

- `CategoryAddSection.tsx`: 이름 입력이 `className="input"` + 커스텀 회색 라벨("새 카테고리"). 색상은 `CategoryColorPicker`(팔레트).
- 앱 표준 입력 패턴(예: `ExpenseForm` 항목): `<div className="field-label">…</div>` + `<input className="field-control">`.
- `CategoryColorPicker.tsx`: `CATEGORY_PALETTE` 스와치 버튼 목록. 추가 폼과 `CategoryRow`(수정 행)에서 공용.
- 서버 검증: `AssetCategory.color`는 `/^#[0-9a-fA-F]{6}$/`(`asset-category.dto.ts`).
- e2e(`asset.spec.ts` test B, `category-crud.spec.ts`)가 팔레트 스와치를 클릭한다 → 팔레트 제거 시 갱신 필요.

## 3. 변경 설계

### 3.1 이름 입력(추가 폼) — 표준화
`CategoryAddSection`의 이름 필드를 표준 패턴으로 교체:
- 커스텀 회색 "새 카테고리" 라벨 → `<div className="field-label">이름</div>`.
- `<input className="input" …>` → `<input className="field-control" …>`.
- placeholder는 간결하게(예: `예: 식비`). `maxLength`는 기존 20 유지.
- (수정 행 `CategoryRow`의 인라인 이름 입력은 컴팩트 컨텍스트라 이번 범위 밖 — 그대로 둔다.)

### 3.2 색상 HEX 입력 — 신규 컴포넌트(추가 + 수정)
`CategoryColorPicker`(팔레트)를 제거하고 신규 `CategoryColorInput`으로 대체:
- **미리보기 스와치**: 현재 `value` 색을 채운 원(지름 ~26px). 유효하지 않은 hex면 회색/중립 표시.
- **HEX 텍스트 입력**: `field-control` 스타일. placeholder `#f2994a`, `maxLength=7`. 사용자가 `#` 없이 입력하면 앞에 `#` 자동 보정. 값은 소문자로 정규화.
- props: `{ value: string; onChange: (v: string) => void }` (기존 시그니처 유지 → 부모 교체 최소화).
- 부모(`CategoryAddSection`, `CategoryRow`)는 `color` 상태를 그대로 두되, **제출/저장 버튼 활성 조건에 `isValidHexColor(color)` 추가**(이름 조건과 함께).

### 3.3 헬퍼
`asset-categories.ts`에 순수 함수 추가:
```
export const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/
export function isValidHexColor(v: string): boolean
export function normalizeHexInput(raw: string): string  // '#' 보정 + 소문자, 최대 7자
```
`CATEGORY_PALETTE`는 기본 색상값(신규 추가 시 초기값)으로만 유지한다.

## 4. 동작·검증

- 유효하지 않은 hex 입력 상태에서는 추가/저장 불가(버튼 disabled). 서버 검증(400)과 이중 방어.
- 수정 행: 진입 시 기존 색을 hex 입력에 채우고, 변경·저장.
- 에러(네트워크 등)는 기존 에러박스 유지. 상태 로직/저장 흐름은 불변.

## 5. 테스트

- 단위: `isValidHexColor`/`normalizeHexInput` 순수 함수 테스트(유효/무효/`#`보정/길이).
- e2e 갱신(필수): `asset.spec.ts`(B의 색 선택 2곳)와 `category-crud.spec.ts`(등록·수정 색 선택)를 **팔레트 스와치 클릭 → HEX 입력 fill**로 변경. 기존 흐름/단언은 유지.
- 회귀: jest·tsc·lint·build·e2e green 유지.

## 6. 영향 파일

- 수정: `CategoryAddSection.tsx`(이름 필드 표준화 + 색 입력 교체), `CategoryRow.tsx`(색 입력 교체 + 유효성 게이트), `asset-categories.ts`(헬퍼), e2e 2개.
- 신규: `CategoryColorInput.tsx`, `asset-categories` 헬퍼 spec(또는 기존 spec에 추가).
- 제거: `CategoryColorPicker.tsx`.
- 상태 로직·API·서버 검증 변경 없음.
