# 카테고리 추가/수정 UI 개선(표준 입력 + HEX 색상) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 카테고리 추가 폼의 이름 입력을 앱 표준 스타일로 맞추고, 색상을 고정 팔레트 대신 HEX 코드 직접 입력(추가·수정 공용)으로 바꾼다.

**Architecture:** 팔레트 컴포넌트 `CategoryColorPicker`를 HEX 입력 컴포넌트 `CategoryColorInput`(미리보기 스와치 + `#rrggbb` 텍스트 입력)으로 rename·재작성해 추가/수정 양쪽이 쓰게 한다. 순수 헬퍼(`isValidHexColor`/`normalizeHexInput`)로 검증·정규화하고, 유효 hex가 아니면 제출을 막는다. 이름 입력은 표준 `field-label`+`field-control`로 교체한다.

**Tech Stack:** Next.js + React + TypeScript, Jest(순수 단위), Playwright(e2e).

## Global Constraints

- 색상은 `/^#[0-9a-fA-F]{6}$/`(서버 DTO와 동일)만 유효. 유효하지 않으면 추가/저장 버튼 비활성.
- 팔레트 UI 제거. HEX 입력은 추가(`CategoryAddSection`) + 수정(`CategoryRow`) 둘 다.
- 상태 로직/저장 흐름/에러 처리 불변 — 입력 UI·검증 게이트만 변경.
- 불변 패턴, `any`/`console.*`/`React.FC` 금지. `rm` 금지(파일 제거는 `git mv` 리네임 사용).
- 검증: `pnpm --filter web test` / `... exec tsc --noEmit` / `... lint`(--max-warnings 0) / `... build`. e2e: dev(:3010) 기동 후 `... exec playwright test --config=playwright.e2e.config.ts`.

---

## Task 1: HEX 검증·정규화 헬퍼 + 단위 테스트

**Files:**
- Modify: `apps/web/app/(vault)/asset/_lib/asset-categories.ts`
- Create: `apps/web/app/(vault)/asset/_lib/asset-color.spec.ts`

**Interfaces:**
- Produces: `HEX_COLOR_RE`, `isValidHexColor(v: string): boolean`, `normalizeHexInput(raw: string): string`.

- [ ] **Step 1: 실패 테스트 작성**

Create `apps/web/app/(vault)/asset/_lib/asset-color.spec.ts`:

```typescript
import { isValidHexColor, normalizeHexInput } from "./asset-categories"

describe("isValidHexColor", () => {
    it("#rrggbb 6자리는 유효", () => {
        expect(isValidHexColor("#f2994a")).toBe(true)
        expect(isValidHexColor("#ABCDEF")).toBe(true)
    })
    it("형식 불일치는 무효", () => {
        expect(isValidHexColor("")).toBe(false)
        expect(isValidHexColor("#fff")).toBe(false)
        expect(isValidHexColor("f2994a")).toBe(false)
        expect(isValidHexColor("#f2994g")).toBe(false)
        expect(isValidHexColor("#f2994a1")).toBe(false)
    })
})

describe("normalizeHexInput", () => {
    it("선행 # 를 보정하고 소문자로", () => {
        expect(normalizeHexInput("f2994a")).toBe("#f2994a")
        expect(normalizeHexInput("#F2994A")).toBe("#f2994a")
    })
    it("허용문자 외 제거, 중복 # 정리, 최대 7자", () => {
        expect(normalizeHexInput("##f2994a")).toBe("#f2994a")
        expect(normalizeHexInput("#f2 99 4a")).toBe("#f2994a")
        expect(normalizeHexInput("#f2994azzz99")).toBe("#f2994a")
    })
    it("빈 입력은 빈 문자열", () => {
        expect(normalizeHexInput("")).toBe("")
        expect(normalizeHexInput("#")).toBe("")
    })
})
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter web test asset-color`
Expected: FAIL — 함수 미존재.

- [ ] **Step 3: 헬퍼 구현**

`asset-categories.ts`에 추가(파일 하단 또는 팔레트 상수 인근):

```typescript
// 색상 hex 검증(서버 DTO 규칙과 동일: #rrggbb).
export const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/
export function isValidHexColor(v: string): boolean {
    return HEX_COLOR_RE.test(v)
}

// 입력 정규화: 허용문자(#·hex)만 남기고, 선행 # 하나 보장, 소문자화, 최대 7자(#rrggbb).
export function normalizeHexInput(raw: string): string {
    const cleaned = raw
        .replace(/[^#0-9a-fA-F]/g, "")
        .replace(/#/g, "")
        .toLowerCase()
    if (cleaned === "") return ""
    return `#${cleaned}`.slice(0, 7)
}
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm --filter web test asset-color`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "apps/web/app/(vault)/asset/_lib/asset-categories.ts" "apps/web/app/(vault)/asset/_lib/asset-color.spec.ts"
git commit -m "feat(web): 카테고리 색상 hex 검증·정규화 헬퍼 추가"
```

---

## Task 2: HEX 색상 입력 컴포넌트 + 폼 2곳 적용 + 이름 필드 표준화

**Files:**
- Rename+rewrite: `apps/web/app/(vault)/asset/_components/CategoryColorPicker.tsx` → `CategoryColorInput.tsx` (`git mv`)
- Modify: `apps/web/app/(vault)/asset/_components/CategoryAddSection.tsx`
- Modify: `apps/web/app/(vault)/asset/_components/CategoryRow.tsx`

**Interfaces:**
- Consumes: `isValidHexColor`, `normalizeHexInput`(Task 1).
- Produces: `CategoryColorInput({ value: string, onChange: (v: string) => void })`.

- [ ] **Step 1: 컴포넌트 rename**

Run: `git mv "apps/web/app/(vault)/asset/_components/CategoryColorPicker.tsx" "apps/web/app/(vault)/asset/_components/CategoryColorInput.tsx"`

- [ ] **Step 2: `CategoryColorInput.tsx` 전체 재작성**

```tsx
"use client"
// 카테고리 색상 HEX 입력. 미리보기 스와치 + #rrggbb 텍스트 입력(팔레트 대체).
import { isValidHexColor, normalizeHexInput } from "../_lib/asset-categories"

interface CategoryColorInputProps {
    value: string
    onChange: (v: string) => void
}

export function CategoryColorInput({ value, onChange }: CategoryColorInputProps) {
    const valid = isValidHexColor(value)
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
                aria-hidden="true"
                style={{
                    width: 30,
                    height: 30,
                    borderRadius: "50%",
                    background: valid ? value : "var(--soft)",
                    border: "1px solid var(--color-border)",
                    flexShrink: 0,
                }}
            />
            <input
                type="text"
                className="field-control"
                aria-label="색상 HEX 코드"
                placeholder="#f2994a"
                value={value}
                maxLength={7}
                spellCheck={false}
                autoCapitalize="none"
                onChange={(e) => onChange(normalizeHexInput(e.target.value))}
                style={{ fontFamily: "var(--font-mono)" }}
            />
        </div>
    )
}
```

- [ ] **Step 3: `CategoryAddSection.tsx` — 이름 필드 표준화 + 색 입력 교체 + 검증 게이트**

- import 교체: `import { CategoryColorInput } from "./CategoryColorInput"` + `import { CATEGORY_PALETTE, isValidHexColor } from "../_lib/asset-categories"`.
- 이름 필드를 표준 패턴으로:
```tsx
<div className="field-label" style={{ marginBottom: 8 }}>이름</div>
<input
    type="text"
    className="field-control"
    placeholder="예: 식비"
    value={name}
    maxLength={20}
    aria-label="카테고리 이름"
    onChange={(e) => {
        onActivity()
        setName(e.target.value)
    }}
    style={{ marginBottom: 12 }}
/>
```
  (기존 회색 "새 카테고리" 라벨 div + `<input className="input">` 제거.)
- `<CategoryColorPicker …>` → `<CategoryColorInput value={color} onChange={(c) => { onActivity(); setColor(c) }} />`.
- 추가 버튼 disabled 조건: `disabled={!name.trim() || !isValidHexColor(color)}`.
- 색 초기값·리셋은 기존대로 `CATEGORY_PALETTE[0] ?? "#f2994a"` 유지.

- [ ] **Step 4: `CategoryRow.tsx` — 색 입력 교체 + 저장 게이트**

- import 교체: `import { CategoryColorInput } from "./CategoryColorInput"` + `import { isValidHexColor } from "../_lib/asset-categories"`.
- 편집 모드의 `<CategoryColorPicker …>` → `<CategoryColorInput value={color} onChange={(c) => { onActivity(); setColor(c) }} />`.
- 저장 `Button`에 `disabled={!isValidHexColor(color)}` 추가(이름은 비면 기존 이름으로 폴백하므로 색만 게이트).
- (인라인 이름 입력 `className="input"`은 이번 범위 밖 — 그대로 둔다.)

- [ ] **Step 5: 검증(정적)**

Run: `pnpm --filter web exec tsc --noEmit && pnpm --filter web lint && pnpm --filter web build`
Expected: PASS. (e2e 는 Task 3 에서 갱신 — 이 시점엔 팔레트 클릭 e2e 가 깨지지만 정적 빌드는 통과.)

- [ ] **Step 6: Commit**

```bash
git add "apps/web/app/(vault)/asset/_components"
git commit -m "feat(web): 카테고리 색상을 HEX 입력으로, 추가 폼 이름 필드 표준화"
```

---

## Task 3: e2e 갱신(팔레트 클릭 → HEX 입력) + 최종 그린

**Files:**
- Modify: `apps/web/tests/e2e/asset.spec.ts`
- Modify: `apps/web/tests/e2e/category-crud.spec.ts`

**Interfaces:**
- Consumes: 새 HEX 입력(`aria-label="색상 HEX 코드"`).

- [ ] **Step 1: `asset.spec.ts` 색 선택 2곳 교체**

두 곳의 `await dialog.getByRole("button", { name: "#4a90d9" }).click({ force: true })`(≈ line 98, 260)를 다음으로 교체:
```ts
await dialog.getByLabel("색상 HEX 코드").fill("#4a90d9")
```
(추가 폼 컨텍스트라 입력이 하나. 여러 개면 `.first()`.)

- [ ] **Step 2: `category-crud.spec.ts` 등록·수정 색 선택 교체**

- 등록(≈ line 167–172): 스와치 클릭 3줄을
```ts
await dialog.getByLabel("색상 HEX 코드").fill("#4a90d9")
```
로 교체.
- 수정(≈ line 234–239): 편집 모드에선 색 입력이 하나(편집 행)이므로
```ts
await dialog.getByLabel("색상 HEX 코드").fill("#9b6bd6")
```
로 교체(`.last()` 불필요 — 편집 행에만 존재. 만약 add form 입력과 동시에 잡히면 `.last()`).

- [ ] **Step 3: e2e 실행(dev 기동 필요)**

Run: `pnpm --filter web exec playwright test --config=playwright.e2e.config.ts --reporter=line`
Expected: 전체 PASS(asset 6 + category 4). 2회 안정.

- [ ] **Step 4: 최종 정적 그린**

Run: `pnpm --filter web exec tsc --noEmit && pnpm --filter web lint && pnpm --filter web test && pnpm --filter web build`
Expected: 모두 PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/tests/e2e/asset.spec.ts apps/web/tests/e2e/category-crud.spec.ts
git commit -m "test(web): 카테고리 색 선택 e2e 를 HEX 입력 방식으로 갱신"
```

---

## 최종 검증
- [ ] jest(asset-color 포함)·tsc·lint·build 그린.
- [ ] e2e 전체 그린(HEX 입력으로 등록·수정 동작).
- [ ] 수동/headed: 추가 폼 이름 필드가 표준 룩, 색은 HEX 입력+미리보기, 잘못된 hex면 추가 버튼 비활성.

## Self-Review 메모(작성자)
- 스펙 §3.1(이름 표준화)=T2 Step3, §3.2(HEX 입력 추가+수정)=T2 Step2·3·4, §3.3(헬퍼)=T1, §5(테스트/e2e)=T1·T3. 전 항목 매핑.
- 타입 일관성: `CategoryColorInput({value,onChange})`, `isValidHexColor`/`normalizeHexInput` 시그니처 Task 간 동일. aria-label "색상 HEX 코드" 일관.
- `rm` 미사용(`git mv` 리네임). CATEGORY_PALETTE 는 기본값으로만 잔존.
