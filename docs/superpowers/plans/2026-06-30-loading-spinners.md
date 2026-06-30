# 앱 전역 버튼 로딩 스피너 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 저장·수정·삭제 등 쓰기 액션 버튼에 인라인 스피너를 넣어 진행 중 상태를 즉시 보이게 한다.

**Architecture:** 공용 `Spinner`(CSS 회전 원)와 `Button`(loading prop → 스피너+disabled+aria-busy) 컴포넌트를 신설하고, 앱 전역의 비동기 액션 버튼을 `Button`으로 교체한다. 각 폼의 기존 `busy/saving` 상태·핸들러·에러 처리는 그대로 두고 버튼 표현만 통일한다. 조회 로딩(스켈레톤)은 이미 존재하므로 변경하지 않는다.

**Tech Stack:** Next.js(App Router) + React + TypeScript, 전역 CSS(globals.css), Jest(순수 단위), Playwright(e2e).

## Global Constraints

- 형태는 버튼 인라인 스피너만. 토스트/오버레이/상단바 금지(YAGNI).
- 결과 피드백(성공/실패 토스트) 비목표. 에러는 기존 에러박스 유지.
- 상태 로직·API·에러 처리 변경 금지 — 버튼 시각 표현만 교체.
- 불변 패턴, `any` 금지, `console.*` 금지, `React.FC` 미사용. props 는 named interface.
- 비액션(취소·월 이동 ‹ › 등 비동기 없는) 버튼은 대상 아님.
- 컴포넌트 단위 렌더 테스트 도구(RTL)는 repo 에 없음(설치 금지). `Button`/`Spinner` 동작 검증은 tsc/lint/build + Playwright e2e 로 한다.
- 검증 명령: `pnpm --filter web exec tsc --noEmit`, `pnpm --filter web lint`(--max-warnings 0), `pnpm --filter web test`, `pnpm --filter web build`. e2e: `pnpm --filter web exec playwright test --config=playwright.e2e.config.ts`(dev 서버 :3010 필요).
- 클래스 매핑: variant `primary`→`btn`, `secondary`→`btn secondary`, `danger`→`btn danger`, `text`→`btn-text`.

---

## Task 1: Spinner 컴포넌트 + CSS

**Files:**
- Create: `apps/web/components/Spinner.tsx`
- Modify: `apps/web/app/globals.css` (스피너 키프레임·클래스 추가)

**Interfaces:**
- Produces: `Spinner({ size?: number, className?: string })` — `currentColor` 기반 회전 원. `aria-hidden`.

- [ ] **Step 1: globals.css 에 스피너 스타일 추가**

`.field-control.compact { ... }` 블록 뒤(혹은 Skeleton 섹션 인근)에 추가:

```css
/* ── Spinner ────────────────────────────────────────── */
@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}

.spinner {
    display: inline-block;
    width: 16px;
    height: 16px;
    border: 2px solid currentColor;
    border-right-color: transparent;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
    /* 글자 옆 정렬 보정 */
    vertical-align: -2px;
}

@media (prefers-reduced-motion: reduce) {
    .spinner {
        animation-duration: 1.2s;
    }
}
```

- [ ] **Step 2: Spinner 컴포넌트 작성**

Create `apps/web/components/Spinner.tsx`:

```tsx
// 인라인 로딩 스피너. 색은 currentColor 를 상속해 버튼 글자색에 맞춘다. 장식 요소(aria-hidden).
interface SpinnerProps {
    // 지름(px). 기본 16.
    size?: number
    className?: string
}

export function Spinner({ size = 16, className }: SpinnerProps) {
    return (
        <span
            className={className ? `spinner ${className}` : "spinner"}
            style={{ width: size, height: size }}
            aria-hidden="true"
        />
    )
}
```

- [ ] **Step 3: 타입체크·린트**

Run: `pnpm --filter web exec tsc --noEmit && pnpm --filter web lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/Spinner.tsx apps/web/app/globals.css
git commit -m "feat(web): 인라인 로딩 스피너 컴포넌트·스타일 추가"
```

---

## Task 2: Button 컴포넌트

**Files:**
- Create: `apps/web/components/Button.tsx`

**Interfaces:**
- Consumes: `Spinner` (Task 1).
- Produces: `Button` — `loading`이면 스피너+`disabled`+`aria-busy`. variant 로 기존 클래스 매핑.
  - `interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> { loading?: boolean; variant?: "primary" | "secondary" | "danger" | "text" }`

- [ ] **Step 1: Button 컴포넌트 작성**

Create `apps/web/components/Button.tsx`:

```tsx
import type { ButtonHTMLAttributes, ReactNode } from "react"
import { Spinner } from "./Spinner"

type Variant = "primary" | "secondary" | "danger" | "text"

const VARIANT_CLASS: Record<Variant, string> = {
    primary: "btn",
    secondary: "btn secondary",
    danger: "btn danger",
    text: "btn-text",
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    // 진행 중이면 스피너 표시 + 자동 비활성화 + aria-busy.
    loading?: boolean
    variant?: Variant
    children?: ReactNode
}

// 공용 버튼. 기존 .btn/.btn-text 마크업을 감싸 로딩 표현을 통일한다.
// 상태/핸들러는 호출처가 그대로 갖고, loading 만 내려준다.
export function Button({
    loading = false,
    variant = "primary",
    disabled,
    className,
    children,
    type = "button",
    ...rest
}: ButtonProps) {
    const base = VARIANT_CLASS[variant]
    const cls = className ? `${base} ${className}` : base
    return (
        <button
            type={type}
            className={cls}
            disabled={loading || disabled}
            aria-busy={loading || undefined}
            {...rest}
        >
            {loading && (
                <Spinner
                    size={16}
                    className="btn-spinner"
                />
            )}
            {children}
        </button>
    )
}
```

그리고 `globals.css` 에 스피너-라벨 간격용 보조 클래스(선택)와 버튼 내 정렬 보정을 추가:

```css
.btn-spinner {
    margin-right: 8px;
}
```

> 참고: `.btn`/`.btn-text` 가 이미 flex/centering 을 갖는다면 스피너가 라벨과 함께 가운데 정렬된다. 정렬이 어긋나면 해당 버튼의 기존 스타일을 존중하되 `.btn-spinner` 마진만 조정한다(레이아웃 대규모 변경 금지).

- [ ] **Step 2: 타입체크·린트·빌드**

Run: `pnpm --filter web exec tsc --noEmit && pnpm --filter web lint && pnpm --filter web build`
Expected: PASS (아직 사용처 없음 — 추가 전용).

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/Button.tsx apps/web/app/globals.css
git commit -m "feat(web): loading 상태를 갖는 공용 Button 컴포넌트 추가"
```

---

## Task 3: ConfirmDialog 에 confirmLoading 추가

**Files:**
- Modify: `apps/web/components/ConfirmDialog.tsx`

**Interfaces:**
- Produces: `ConfirmDialog` props 에 `confirmLoading?: boolean` 추가 — 확인 버튼에 스피너/disabled 적용. 기존 props·동작 유지.

- [ ] **Step 1: ConfirmDialog 수정**

`apps/web/components/ConfirmDialog.tsx` 를 읽고:
- Props 인터페이스에 `confirmLoading?: boolean` 추가.
- 확인(`onConfirm`) 버튼을 Task 2 의 `Button` 으로 교체:
  - destructive 면 `variant="danger"`, 아니면 `variant="primary"`.
  - `loading={confirmLoading}`.
- 취소 버튼은 기존 `.btn secondary` → `Button variant="secondary"` 로 교체(로딩 없음), 또는 그대로 두되 일관성을 위해 Button 사용 권장. 단 취소는 `disabled={confirmLoading}` 로 진행 중 닫기 방지.
- 포커스 트랩/Esc 등 기존 로직은 유지.

- [ ] **Step 2: 타입체크·린트·빌드**

Run: `pnpm --filter web exec tsc --noEmit && pnpm --filter web lint && pnpm --filter web build`
Expected: PASS. 기존 ConfirmDialog 호출처는 `confirmLoading` 미전달 시 false 로 동작(하위호환).

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/ConfirmDialog.tsx
git commit -m "feat(web): ConfirmDialog 확인 버튼 로딩 상태 지원"
```

---

## Task 4: 가계부(자산) 액션 버튼 마이그레이션

**Files:**
- Modify: `apps/web/app/(vault)/asset/_components/ExpenseForm.tsx`
- Modify: `apps/web/app/(vault)/asset/_components/income/IncomeEntryForm.tsx`
- Modify: `apps/web/app/(vault)/asset/_components/income/IncomeSheet.tsx`
- Modify: `apps/web/app/(vault)/asset/_components/CategoryAddSection.tsx`
- Modify: `apps/web/app/(vault)/asset/_components/CategoryRow.tsx`
- Modify: `apps/web/app/(vault)/asset/_components/CategoryManager.tsx` (삭제 ConfirmDialog 에 confirmLoading 연결)

**Interfaces:**
- Consumes: `Button`(Task 2), `ConfirmDialog.confirmLoading`(Task 3).

- [ ] **Step 1: 각 파일의 비동기 액션 버튼을 Button 으로 교체**

각 파일을 읽고, 제출/삭제 등 **비동기 요청을 트리거하는 버튼**만 교체한다. 패턴(예시 — CategoryAddSection 의 "추가" 버튼):

```tsx
// Before
<button type="submit" className="btn" disabled={saving || !name.trim()}>
    추가
</button>

// After
import { Button } from "@/components/Button"
...
<Button type="submit" variant="primary" loading={saving} disabled={!name.trim()}>
    추가
</Button>
```

규칙:
- 기존 `disabled={saving || X}` → `loading={saving}` + `disabled={X}` (loading 이 disabled 를 포함).
- 기존에 "저장 중…"/"인증 중…" 처럼 텍스트를 바꾸던 버튼은 **라벨을 고정**하고 스피너로 진행 표시(텍스트 토글 제거).
- 삭제 버튼(위험)은 `variant="danger"`. 일반 저장은 `variant="primary"`. 텍스트 링크형은 `variant="text"`.
- `ExpenseForm` 의 삭제 메뉴(이 지출 삭제 등) 각 액션 버튼도 진행 중이면 `loading`. 해당 핸들러의 busy 상태를 내려준다.
- `CategoryManager`: 카테고리 삭제가 ConfirmDialog 로 확인받는다. 삭제 진행 상태(`deleting` 등)를 `confirmLoading` 으로 ConfirmDialog 에 전달. 진행 상태가 없으면 최소 상태를 추가(삭제 호출 전후 true/false).
- **취소·네비게이션 버튼은 건드리지 않는다.**

- [ ] **Step 2: 검증**

Run: `pnpm --filter web exec tsc --noEmit && pnpm --filter web lint && pnpm --filter web test`
Expected: PASS (기존 48~53 테스트 그대로 — UI 마이그레이션은 jest 에 영향 없음).

- [ ] **Step 3: Commit**

```bash
git add "apps/web/app/(vault)/asset/_components"
git commit -m "feat(web): 가계부 액션 버튼에 로딩 스피너 적용"
```

---

## Task 5: 비밀번호·백업 액션 버튼 마이그레이션

**Files:**
- Modify: `apps/web/app/(vault)/_components/secret-form/SecretEditStep.tsx`
- Modify: `apps/web/app/(vault)/_components/secret-form/SecretReviewStep.tsx`
- Modify: `apps/web/app/(vault)/[id]/page.tsx` (상세의 수정/삭제 액션 버튼)
- Modify: `apps/web/app/(vault)/_components/EntriesScreen.tsx` (비동기 액션 버튼이 있을 때만)
- Modify: `apps/web/app/(vault)/_components/BackupPanel.tsx`
- Modify: `apps/web/app/(vault)/backup/page.tsx`

**Interfaces:**
- Consumes: `Button`(Task 2), `ConfirmDialog.confirmLoading`(Task 3).

- [ ] **Step 1: 각 파일의 비동기 액션 버튼을 Button 으로 교체**

Task 4 와 동일한 규칙. 각 파일을 읽고:
- 시크릿 저장/수정/삭제 버튼 → `Button loading={busy}` (삭제는 `variant="danger"`). 삭제가 ConfirmDialog 면 `confirmLoading` 연결.
- `BackupPanel`/`backup/page.tsx` 의 내보내기·가져오기 버튼 → 요청 중 `loading`. (가져오기는 파일 업로드 후 처리 동안 로딩.)
- 비동기 요청이 없는 버튼(취소/뒤로/복사 등 동기 동작)은 제외. 단 "복구코드 복사"처럼 즉시 끝나는 동작은 로딩 불필요.
- 진행 상태가 없던 버튼에는 최소 busy 상태를 추가(요청 전 true, finally false)하되, 상태 추가가 과하면 그 버튼은 범위에서 제외하고 보고한다.

- [ ] **Step 2: 검증**

Run: `pnpm --filter web exec tsc --noEmit && pnpm --filter web lint && pnpm --filter web test && pnpm --filter web build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add "apps/web/app/(vault)/_components" "apps/web/app/(vault)/[id]/page.tsx" "apps/web/app/(vault)/backup/page.tsx"
git commit -m "feat(web): 비밀번호·백업 액션 버튼에 로딩 스피너 적용"
```

---

## Task 6: 인증 화면 액션 버튼 마이그레이션

**Files:**
- Modify: `apps/web/app/(vault)/auth/UnlockScreen.tsx`
- Modify: `apps/web/app/(vault)/auth/OnboardingScreen.tsx`
- Modify: `apps/web/app/(vault)/auth/RecoveryCodeDisplay.tsx` (비동기 액션 있을 때만)

**Interfaces:**
- Consumes: `Button`(Task 2).

- [ ] **Step 1: 인증 버튼 교체**

- `UnlockScreen`: "패스키로 잠금해제"/"다시 시도" 버튼 → `Button variant="primary" loading={busy === "unlocking"}`. 기존 `{busy ? "인증 중…" : ...}` 텍스트 토글은 **라벨 고정 + 스피너**로 단순화(라벨은 "패스키로 잠금해제" 유지, 실패 시 "다시 시도"). "복구코드로 접근"은 네비게이션이므로 `variant="text"`, 로딩 없음.
- `OnboardingScreen`: 등록/시작 버튼 → `Button loading`(registering 상태). 텍스트 토글 제거.
- `RecoveryCodeDisplay`: 비동기 액션(예: 확인 후 진입)이 있으면 적용, 단순 복사/계속이면 제외.
- 복구 모드의 "검증하고 복구" submit 버튼도 `loading={busy === "recovering"}`.

- [ ] **Step 2: 검증**

Run: `pnpm --filter web exec tsc --noEmit && pnpm --filter web lint && pnpm --filter web build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add "apps/web/app/(vault)/auth"
git commit -m "feat(web): 인증 화면 버튼에 로딩 스피너 적용"
```

---

## Task 7: e2e 로딩 표시 검증 + 최종 그린

**Files:**
- Modify: `apps/web/tests/e2e/asset.spec.ts`

**Interfaces:**
- Consumes: 위 마이그레이션 결과(저장·삭제 버튼이 `aria-busy`/`disabled` 됨).

- [ ] **Step 1: e2e 단언 추가**

`tests/e2e/asset.spec.ts` 의 카테고리 추가 또는 지출 저장 플로우에, 액션 클릭 직후 버튼이 진행 표시되는지 가벼운 단언을 추가한다(요청이 매우 빠를 수 있으니 관대하게). 예:

```ts
// 저장 클릭 직후 버튼이 비활성/aria-busy 가 되는지(레이스 관대하게) 확인
const saveBtn = page.getByRole("button", { name: "저장" })
await saveBtn.click()
// 진행 표시(둘 중 하나라도): 빠른 완료 시 곧 사라질 수 있으므로 즉시 평가
// (검증이 불안정하면 이 단언은 toBeDisabled 한 가지로 축소)
```

> 주의: 요청이 너무 빨라 단언이 깜빡일 수 있다. 불안정하면 네트워크를 느리게 하는 대신, 클릭 직후 동기적으로 평가하거나 이 단언을 생략하고 "버튼이 존재하고 클릭 가능"까지만 확인한다. e2e 안정성을 깨지 않는 선에서 추가한다.

- [ ] **Step 2: 전체 검증 (최종 그린)**

Run:
```
pnpm --filter web exec tsc --noEmit
pnpm --filter web lint
pnpm --filter web test
pnpm --filter web build
```
Expected: 모두 PASS. (e2e 는 dev 서버 :3010 기동 시 별도 실행: `pnpm --filter web exec playwright test --config=playwright.e2e.config.ts` → 기존 5 + 보강.)

- [ ] **Step 3: Commit**

```bash
git add apps/web/tests/e2e/asset.spec.ts
git commit -m "test(web): 저장 액션 로딩 표시 e2e 보강"
```

---

## 최종 검증

- [ ] `pnpm --filter web exec tsc --noEmit && pnpm --filter web lint && pnpm --filter web test && pnpm --filter web build` 그린.
- [ ] 수동/e2e: 가계부·비밀번호의 저장·삭제 클릭 시 버튼에 스피너 표시 + 더블클릭 방지.
- [ ] 취소·네비게이션 버튼은 변화 없음. 조회 스켈레톤 기존대로.

## Self-Review 메모(작성자)

- 스펙 §3(Spinner/Button)=T1·T2, §4 ConfirmDialog=T3, §4 적용=T4·T5·T6, §6 테스트=T7. 모든 스펙 항목 매핑됨.
- 타입 일관성: `Button` props(`loading`,`variant`), `ConfirmDialog.confirmLoading`, variant→class 매핑 전 Task 동일.
- RTL 부재로 컴포넌트 단위 테스트 대신 tsc/lint/build + e2e 로 검증(Global Constraints 에 명시).
- 미해결: 일부 버튼(진행 상태가 없던 동기·반동기 동작)은 상태 추가가 과하면 범위 제외하고 보고(T5 Step1 명시) — 구현 시 판단.
