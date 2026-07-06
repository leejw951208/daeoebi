# 데모 페이지 업데이트(비밀번호 갱신 + 가계부 추가) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 공개 데모(`/demo`)에 비밀번호↔가계부 전환 네비를 추가하고, 가계부 대시보드 + 간단 상호작용(지출 추가·카테고리 관리)을 메모리 상태로 재현한다.

**Architecture:** 실제 프레젠테이션 컴포넌트(`AssetDashboard` 등, vault-client 타입 전용)를 가짜 데이터로 재사용하고, 상호작용(카테고리 CRUD·지출 추가)은 vault-client·useVault 의존이 없는 데모 전용 컴포넌트로 로컬 상태만 변경한다. `CategoryColorInput`/`ConfirmDialog`/`Button`은 그대로 재사용한다.

**Tech Stack:** Next.js(App Router) + React + TypeScript. 데모는 서버·인증·암호화 미사용.

## Global Constraints

- 데모 격리: `@/lib/vault-client`(런타임), 실제 인증/암호화, `useVault` import 금지. 메모리 상태만.
- 가계부 대시보드는 실제 `AssetDashboard`(+하위) 재사용(순수 프레젠테이션).
- 색상 입력은 `CategoryColorInput`(HEX) 재사용, 카테고리 삭제 시 해당 지출 `categoryId=null`.
- 불변 패턴, `any`/`console.*`/`React.FC` 금지. 액션 버튼은 공용 `Button`.
- 검증: `pnpm --filter web exec tsc --noEmit` / `... lint`(--max-warnings 0) / `... test` / `... build`. e2e(선택): dev(:3010) 기동 후 `... exec playwright test --config=playwright.e2e.config.ts`.

---

## Task 1: 데모 가짜 자산 데이터

**Files:**
- Create: `apps/web/app/demo/demo-asset-data.ts`

**Interfaces:**
- Produces: `DEMO_MONTH: string`, `DEMO_ASSET_CATEGORIES: AssetCategory[]`, `DEMO_EXPENSES: ComputedExpense[]`, `DEMO_INCOME_AMOUNT: number`, `DEMO_INCOMES: ComputedIncome[]`.

- [ ] **Step 1: 데이터 파일 작성**

Create `apps/web/app/demo/demo-asset-data.ts`:

```typescript
// 공개 데모(/demo)용 가짜 자산 데이터. vault-client 를 절대 import 하지 않는다(타입만).
import type { AssetCategory } from "@/lib/vault-client"
import type {
    ComputedExpense,
    ComputedIncome,
} from "../(vault)/asset/_lib/asset-compute"

// 고정 표시 월(예시). 실제 오늘과 무관한 상수.
export const DEMO_MONTH = "2026-06"

export const DEMO_ASSET_CATEGORIES: AssetCategory[] = [
    { id: "c-food", name: "식비", color: "#f2994a", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
    { id: "c-transport", name: "교통", color: "#4a90d9", createdAt: "2026-01-02T00:00:00.000Z", updatedAt: "2026-01-02T00:00:00.000Z" },
    { id: "c-home", name: "주거·공과금", color: "#9b6bd6", createdAt: "2026-01-03T00:00:00.000Z", updatedAt: "2026-01-03T00:00:00.000Z" },
    { id: "c-shop", name: "쇼핑", color: "#e0689a", createdAt: "2026-01-04T00:00:00.000Z", updatedAt: "2026-01-04T00:00:00.000Z" },
    { id: "c-culture", name: "문화", color: "#3bb273", createdAt: "2026-01-05T00:00:00.000Z", updatedAt: "2026-01-05T00:00:00.000Z" },
    { id: "c-etc", name: "기타", color: "#98a0a8", createdAt: "2026-01-06T00:00:00.000Z", updatedAt: "2026-01-06T00:00:00.000Z" },
]

// 현재월 여러 날짜에 분산된 예시 지출. categoryId 는 위 카테고리를 참조.
export const DEMO_EXPENSES: ComputedExpense[] = [
    { id: "e1", date: "2026-06-02", recurringId: null, item: "점심 김밥천국", amount: 8500, categoryId: "c-food" },
    { id: "e2", date: "2026-06-03", recurringId: null, item: "지하철 정기권", amount: 62000, categoryId: "c-transport" },
    { id: "e3", date: "2026-06-05", recurringId: null, item: "6월 전기요금", amount: 43000, categoryId: "c-home" },
    { id: "e4", date: "2026-06-08", recurringId: null, item: "쿠팡 생필품", amount: 29310, categoryId: "c-shop" },
    { id: "e5", date: "2026-06-08", recurringId: null, item: "카카오페이 송금", amount: 16700, categoryId: "c-etc" },
    { id: "e6", date: "2026-06-12", recurringId: null, item: "영화관", amount: 15000, categoryId: "c-culture" },
    { id: "e7", date: "2026-06-15", recurringId: null, item: "마트 장보기", amount: 54200, categoryId: "c-food" },
    { id: "e8", date: "2026-06-20", recurringId: null, item: "택시", amount: 11200, categoryId: "c-transport" },
    { id: "e9", date: "2026-06-24", recurringId: null, item: "옷 구매", amount: 68000, categoryId: "c-shop" },
    { id: "e10", date: "2026-06-27", recurringId: null, item: "커피 정기구독", amount: 12900, categoryId: "c-etc" },
]

export const DEMO_INCOME_AMOUNT = 3_200_000
export const DEMO_INCOMES: ComputedIncome[] = [
    { id: "i1", month: DEMO_MONTH, item: "6월 급여", amount: 3_000_000, category: "월급" },
    { id: "i2", month: DEMO_MONTH, item: "상여", amount: 200_000, category: "상여" },
]
```

- [ ] **Step 2: 타입체크**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: PASS(소비처 없음, 타입만). (다음 Task 에서 사용.)

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/demo/demo-asset-data.ts
git commit -m "feat(web): 데모용 가짜 자산 데이터 추가"
```

---

## Task 2: 데모 카테고리 관리 컴포넌트

**Files:**
- Create: `apps/web/app/demo/DemoCategoryManager.tsx`

**Interfaces:**
- Consumes: `AssetCategory`(vault-client type), `CategoryColorInput`, `ConfirmDialog`, `Button`, `isValidHexColor`.
- Produces: `DemoCategoryManager({ categories: AssetCategory[], onChange: (next: AssetCategory[]) => void, onClose: () => void })`.

- [ ] **Step 1: 컴포넌트 작성**

`CategoryManager`/`CategoryAddSection`/`CategoryRow` UX 를 로컬 상태 버전으로 축약한다. 실제 컴포넌트(참고: `apps/web/app/(vault)/asset/_components/CategoryManager.tsx`, `CategoryAddSection.tsx`, `CategoryRow.tsx`)의 마크업·클래스를 본떠 만들되, `vault-client`/`useVault` 는 쓰지 않고 props 콜백으로만 상태를 바꾼다.

Create `apps/web/app/demo/DemoCategoryManager.tsx`:

```tsx
"use client"
// 데모용 카테고리 관리(로컬 상태). 실제 CategoryManager 의 축약본 — 서버·암호화 없음.
import { useState } from "react"
import type { AssetCategory } from "@/lib/vault-client"
import { Button } from "@/components/Button"
import { ConfirmDialog } from "@/components/ConfirmDialog"
import { CategoryColorInput } from "../(vault)/asset/_components/CategoryColorInput"
import { isValidHexColor } from "../(vault)/asset/_lib/asset-categories"

interface DemoCategoryManagerProps {
    categories: AssetCategory[]
    onChange: (next: AssetCategory[]) => void
    onClose: () => void
}

let demoCatSeq = 0

export function DemoCategoryManager({
    categories,
    onChange,
    onClose,
}: DemoCategoryManagerProps) {
    const [name, setName] = useState("")
    const [color, setColor] = useState("#f2994a")
    const [editId, setEditId] = useState<string | null>(null)
    const [editName, setEditName] = useState("")
    const [editColor, setEditColor] = useState("#f2994a")
    const [pendingDelete, setPendingDelete] = useState<AssetCategory | null>(
        null,
    )

    function add() {
        if (!name.trim() || !isValidHexColor(color)) return
        demoCatSeq += 1
        const ts = "2026-06-30T00:00:00.000Z"
        onChange([
            ...categories,
            {
                id: `demo-cat-${demoCatSeq}`,
                name: name.trim(),
                color,
                createdAt: ts,
                updatedAt: ts,
            },
        ])
        setName("")
        setColor("#f2994a")
    }

    function startEdit(c: AssetCategory) {
        setEditId(c.id)
        setEditName(c.name)
        setEditColor(c.color)
    }

    function saveEdit() {
        if (editId === null || !isValidHexColor(editColor)) return
        onChange(
            categories.map((c) =>
                c.id === editId
                    ? { ...c, name: editName.trim() || c.name, color: editColor }
                    : c,
            ),
        )
        setEditId(null)
    }

    function confirmDelete() {
        if (!pendingDelete) return
        onChange(categories.filter((c) => c.id !== pendingDelete.id))
        setPendingDelete(null)
    }

    return (
        <div
            className="dialog-backdrop"
            role="dialog"
            aria-modal="true"
            aria-label="카테고리 관리"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose()
            }}
        >
            <div className="sheet">
                <div className="sheet-grip" aria-hidden="true" />
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "baseline",
                        marginBottom: 16,
                    }}
                >
                    <div style={{ fontSize: 18, fontWeight: 800 }}>
                        카테고리 관리
                    </div>
                    <button type="button" className="btn-text" onClick={onClose}>
                        닫기
                    </button>
                </div>

                {/* 추가 폼 */}
                <div style={{ marginBottom: 20 }}>
                    <div className="field-label" style={{ marginBottom: 8 }}>
                        이름
                    </div>
                    <input
                        type="text"
                        className="field-control"
                        placeholder="예: 식비"
                        value={name}
                        maxLength={20}
                        aria-label="카테고리 이름"
                        onChange={(e) => setName(e.target.value)}
                        style={{ marginBottom: 12 }}
                    />
                    <CategoryColorInput value={color} onChange={setColor} />
                    <Button
                        type="button"
                        variant="primary"
                        onClick={add}
                        disabled={!name.trim() || !isValidHexColor(color)}
                        style={{ width: "100%", marginTop: 12 }}
                    >
                        + 추가
                    </Button>
                </div>

                {/* 목록 */}
                {categories.map((c) =>
                    editId === c.id ? (
                        <div
                            key={c.id}
                            style={{
                                padding: "12px 0",
                                borderBottom: "1px solid var(--color-border)",
                            }}
                        >
                            <input
                                type="text"
                                className="input"
                                value={editName}
                                maxLength={20}
                                onChange={(e) => setEditName(e.target.value)}
                                style={{ marginBottom: 10 }}
                            />
                            <CategoryColorInput
                                value={editColor}
                                onChange={setEditColor}
                            />
                            <div
                                style={{
                                    display: "flex",
                                    gap: 8,
                                    marginTop: 12,
                                }}
                            >
                                <button
                                    type="button"
                                    className="btn secondary"
                                    onClick={() => setEditId(null)}
                                    style={{ flex: 1 }}
                                >
                                    취소
                                </button>
                                <Button
                                    variant="primary"
                                    onClick={saveEdit}
                                    disabled={!isValidHexColor(editColor)}
                                    style={{ flex: 1 }}
                                >
                                    저장
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div
                            key={c.id}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                padding: "12px 0",
                                borderBottom: "1px solid var(--color-border)",
                            }}
                        >
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 10,
                                }}
                            >
                                <span
                                    aria-hidden="true"
                                    style={{
                                        width: 12,
                                        height: 12,
                                        borderRadius: "50%",
                                        background: c.color,
                                        flexShrink: 0,
                                    }}
                                />
                                <span style={{ fontSize: 14, fontWeight: 600 }}>
                                    {c.name}
                                </span>
                            </div>
                            <div style={{ display: "flex", gap: 12 }}>
                                <button
                                    type="button"
                                    className="btn-text"
                                    onClick={() => startEdit(c)}
                                >
                                    수정
                                </button>
                                <button
                                    type="button"
                                    className="btn-text"
                                    style={{ color: "var(--color-danger, #ef4444)" }}
                                    onClick={() => setPendingDelete(c)}
                                >
                                    삭제
                                </button>
                            </div>
                        </div>
                    ),
                )}
            </div>

            <ConfirmDialog
                open={pendingDelete !== null}
                title="카테고리 삭제"
                message="이 카테고리의 지출은 미분류가 됩니다."
                confirmLabel="삭제"
                destructive
                onConfirm={confirmDelete}
                onCancel={() => setPendingDelete(null)}
            />
        </div>
    )
}
```

- [ ] **Step 2: 타입체크·린트**

Run: `pnpm --filter web exec tsc --noEmit && pnpm --filter web lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/demo/DemoCategoryManager.tsx
git commit -m "feat(web): 데모 카테고리 관리 컴포넌트(로컬 상태)"
```

---

## Task 3: 데모 지출 추가 폼

**Files:**
- Create: `apps/web/app/demo/DemoExpenseForm.tsx`

**Interfaces:**
- Consumes: `AssetCategory`, `ComputedExpense`, `Button`.
- Produces: `DemoExpenseForm({ categories, onSave, onCancel })` where `onSave: (e: ComputedExpense) => void`.

- [ ] **Step 1: 컴포넌트 작성**

실제 `ExpenseForm`(참고: `apps/web/app/(vault)/asset/_components/ExpenseForm.tsx`)의 금액·항목·카테고리 칩·날짜 UX 를 로컬 버전으로. `DEMO_MONTH` 안의 날짜 기본값 사용.

Create `apps/web/app/demo/DemoExpenseForm.tsx`:

```tsx
"use client"
// 데모용 지출 추가 폼(로컬 상태). 실제 ExpenseForm 의 축약본.
import { useState } from "react"
import type { AssetCategory } from "@/lib/vault-client"
import type { ComputedExpense } from "../(vault)/asset/_lib/asset-compute"
import { Button } from "@/components/Button"
import { DEMO_MONTH } from "./demo-asset-data"

interface DemoExpenseFormProps {
    categories: AssetCategory[]
    onSave: (expense: ComputedExpense) => void
    onCancel: () => void
}

let demoExpSeq = 0

export function DemoExpenseForm({
    categories,
    onSave,
    onCancel,
}: DemoExpenseFormProps) {
    const [amount, setAmount] = useState("")
    const [item, setItem] = useState("")
    const [categoryId, setCategoryId] = useState<string | null>(
        categories[0]?.id ?? null,
    )
    const [date, setDate] = useState(`${DEMO_MONTH}-15`)

    const amountNum = Number(amount || "0")

    function save() {
        if (amountNum <= 0) return
        demoExpSeq += 1
        onSave({
            id: `demo-exp-${demoExpSeq}`,
            date,
            recurringId: null,
            item: item.trim(),
            amount: amountNum,
            categoryId,
        })
    }

    return (
        <section style={{ minHeight: "100%", background: "#fff" }}>
            <div
                className="sticky-header"
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                }}
            >
                <button
                    type="button"
                    className="btn-text"
                    onClick={onCancel}
                    style={{ color: "var(--color-text-muted)" }}
                >
                    취소
                </button>
                <div style={{ fontSize: 15, fontWeight: 700 }}>지출 추가</div>
                <button
                    type="button"
                    className="btn-text"
                    onClick={save}
                    style={{ color: "var(--ac)", fontWeight: 700 }}
                >
                    저장
                </button>
            </div>

            <div
                style={{
                    padding: "14px 4px 50px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 24,
                }}
            >
                {/* 금액 */}
                <div style={{ textAlign: "center", padding: "14px 0 4px" }}>
                    <div className="field-label" style={{ marginBottom: 10 }}>
                        금액
                    </div>
                    <input
                        inputMode="numeric"
                        aria-label="금액"
                        value={amount}
                        onChange={(e) =>
                            setAmount(e.target.value.replace(/[^\d]/g, "").slice(0, 12))
                        }
                        placeholder="0"
                        className="field-control"
                        style={{ textAlign: "center", fontSize: 22, fontWeight: 800 }}
                    />
                </div>

                {/* 항목 */}
                <div>
                    <div className="field-label">항목</div>
                    <input
                        value={item}
                        onChange={(e) => setItem(e.target.value)}
                        placeholder="예: 점심 김밥천국"
                        aria-label="항목"
                        className="field-control"
                    />
                </div>

                {/* 카테고리 */}
                <div>
                    <div className="field-label" style={{ marginBottom: 10 }}>
                        카테고리
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {categories.map((c) => {
                            const active = c.id === categoryId
                            return (
                                <button
                                    key={c.id}
                                    type="button"
                                    className="chip"
                                    aria-pressed={active}
                                    onClick={() => setCategoryId(c.id)}
                                    style={
                                        active
                                            ? {
                                                  borderColor: "var(--ac)",
                                                  background: "var(--soft)",
                                                  color: "#222",
                                              }
                                            : undefined
                                    }
                                >
                                    <span
                                        aria-hidden="true"
                                        style={{
                                            width: 9,
                                            height: 9,
                                            borderRadius: "50%",
                                            background: c.color,
                                            display: "inline-block",
                                            marginRight: 6,
                                        }}
                                    />
                                    {c.name}
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* 날짜 */}
                <div>
                    <div className="field-label">날짜</div>
                    <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        aria-label="날짜"
                        className="field-control"
                    />
                </div>

                <Button
                    type="button"
                    variant="primary"
                    onClick={save}
                    disabled={amountNum <= 0}
                    style={{ width: "100%" }}
                >
                    저장
                </Button>
            </div>
        </section>
    )
}
```

- [ ] **Step 2: 타입체크·린트**

Run: `pnpm --filter web exec tsc --noEmit && pnpm --filter web lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/demo/DemoExpenseForm.tsx
git commit -m "feat(web): 데모 지출 추가 폼(로컬 상태)"
```

---

## Task 4: 데모 자산 화면(대시보드 조립)

**Files:**
- Create: `apps/web/app/demo/DemoAssetScreen.tsx`

**Interfaces:**
- Consumes: `AssetDashboard`(+`Loaded`), `byDay`, `DemoCategoryManager`, `DemoExpenseForm`, 데모 데이터.
- Produces: `DemoAssetScreen()` — 자산 데모 전체.

- [ ] **Step 1: 컴포넌트 작성**

Create `apps/web/app/demo/DemoAssetScreen.tsx`:

```tsx
"use client"
// 데모용 가계부 화면. 실제 AssetDashboard 를 가짜 데이터로 재사용 + 데모 상호작용.
import { useMemo, useState } from "react"
import type { AssetCategory } from "@/lib/vault-client"
import {
    AssetDashboard,
    type Loaded,
} from "../(vault)/asset/_components/dashboard/AssetDashboard"
import {
    byDay,
    type ComputedExpense,
} from "../(vault)/asset/_lib/asset-compute"
import {
    DEMO_ASSET_CATEGORIES,
    DEMO_EXPENSES,
    DEMO_INCOMES,
    DEMO_INCOME_AMOUNT,
    DEMO_MONTH,
} from "./demo-asset-data"
import { DemoCategoryManager } from "./DemoCategoryManager"
import { DemoExpenseForm } from "./DemoExpenseForm"

type Overlay = "none" | "expense" | "categories"

export function DemoAssetScreen() {
    const [categories, setCategories] =
        useState<AssetCategory[]>(DEMO_ASSET_CATEGORIES)
    const [expenses, setExpenses] = useState<ComputedExpense[]>(DEMO_EXPENSES)
    const [selectedDay, setSelectedDay] = useState<string | null>(
        `${DEMO_MONTH}-08`,
    )
    const [overlay, setOverlay] = useState<Overlay>("none")

    const dayTotals = useMemo(() => byDay(expenses), [expenses])

    const data: Loaded = {
        incomeAmount: DEMO_INCOME_AMOUNT,
        incomes: DEMO_INCOMES,
        expenses,
        categories,
    }

    if (overlay === "expense") {
        return (
            <DemoExpenseForm
                categories={categories}
                onSave={(e) => {
                    setExpenses((prev) => [...prev, e])
                    setOverlay("none")
                }}
                onCancel={() => setOverlay("none")}
            />
        )
    }

    return (
        <section style={{ minHeight: "100%", position: "relative" }}>
            <div
                className="sticky-header"
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                }}
            >
                <div style={{ fontSize: 21, fontWeight: 800 }}>자산</div>
                <button
                    type="button"
                    className="btn-text"
                    style={{ fontSize: 12 }}
                    onClick={() => setOverlay("categories")}
                >
                    카테고리 관리
                </button>
            </div>

            <AssetDashboard
                month={DEMO_MONTH}
                data={data}
                dayTotals={dayTotals}
                selectedDay={selectedDay}
                onSelectDay={(d) => setSelectedDay(d)}
                onOpenIncome={() => {
                    /* 데모: 수입은 표시만 */
                }}
            />

            <button
                type="button"
                className="fab"
                aria-label="새 지출 추가"
                onClick={() => setOverlay("expense")}
            >
                <span aria-hidden="true">+</span>
            </button>

            {overlay === "categories" && (
                <DemoCategoryManager
                    categories={categories}
                    onChange={(next) => {
                        // 삭제된 카테고리를 참조하던 지출은 미분류(null)로.
                        const ids = new Set(next.map((c) => c.id))
                        setExpenses((prev) =>
                            prev.map((e) =>
                                e.categoryId && !ids.has(e.categoryId)
                                    ? { ...e, categoryId: null }
                                    : e,
                            ),
                        )
                        setCategories(next)
                    }}
                    onClose={() => setOverlay("none")}
                />
            )}
        </section>
    )
}
```

> 주의: `.fab` 는 고정 위치 CSS. 데모 프레임 안에서 위치가 어색하면 인라인 `style`로 `position:absolute` 보정 가능하나, 우선 실제와 동일하게 두고 육안 확인 후 조정한다.

- [ ] **Step 2: 타입체크·린트·빌드**

Run: `pnpm --filter web exec tsc --noEmit && pnpm --filter web lint && pnpm --filter web build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/demo/DemoAssetScreen.tsx
git commit -m "feat(web): 데모 가계부 화면(대시보드 재사용 + 상호작용)"
```

---

## Task 5: 데모 페이지 탭 토글 통합

**Files:**
- Modify: `apps/web/app/demo/page.tsx`

**Interfaces:**
- Consumes: `DemoAssetScreen`(Task 4).

- [ ] **Step 1: 탭 상태 + 토글 UI 추가**

`apps/web/app/demo/page.tsx` 를 읽고:
- 최상위에 `const [tab, setTab] = useState<"secret" | "asset">("secret")` 추가.
- `DemoBanner` 바로 아래(모든 뷰 공통 위치)에 세그먼트 토글을 렌더하는 헬퍼를 만들고, 각 반환 지점(list/detail/new/edit)의 최상단에 공통으로 넣는다. 간단히: 컴포넌트 최상단에서 `if (tab === "asset") return (<section><DemoBanner /><DemoTabs tab={tab} onTab={setTab} /><DemoAssetScreen /></section>)` 로 분기하고, 비밀번호 뷰들에도 `DemoTabs` 를 `DemoBanner` 다음에 배치.
- `DemoTabs` 토글 마크업(파일 하단에 로컬 컴포넌트):
```tsx
function DemoTabs({
    tab,
    onTab,
}: {
    tab: "secret" | "asset"
    onTab: (t: "secret" | "asset") => void
}) {
    const base: React.CSSProperties = {
        flex: 1,
        padding: "8px 0",
        fontSize: 13,
        fontWeight: 700,
        borderRadius: 10,
        border: "none",
        cursor: "pointer",
    }
    return (
        <div
            style={{
                display: "flex",
                gap: 6,
                background: "var(--soft)",
                padding: 4,
                borderRadius: 12,
                margin: "12px 0 16px",
            }}
        >
            <button
                type="button"
                onClick={() => onTab("secret")}
                style={{
                    ...base,
                    background: tab === "secret" ? "#fff" : "transparent",
                    color: tab === "secret" ? "#222" : "var(--color-text-muted)",
                }}
            >
                비밀번호
            </button>
            <button
                type="button"
                onClick={() => onTab("asset")}
                style={{
                    ...base,
                    background: tab === "asset" ? "#fff" : "transparent",
                    color: tab === "asset" ? "#222" : "var(--color-text-muted)",
                }}
            >
                가계부
            </button>
        </div>
    )
}
```
- `DemoAssetScreen` import 추가.
- 가계부 탭이면 비밀번호 상태(view 등)와 무관하게 `DemoAssetScreen` 을 보여준다(탭 전환 시 비밀번호 view 는 그대로 보존).

- [ ] **Step 2: (경미) 비밀번호 데모 액션 버튼 정리(선택)**

시간이 되면 비밀번호 데모의 주요 액션 `<button className="btn">` 을 공용 `Button`(변형 매핑)으로 교체한다. 범위가 커지면 생략하고 보고한다.

- [ ] **Step 3: 검증**

Run: `pnpm --filter web exec tsc --noEmit && pnpm --filter web lint && pnpm --filter web build && pnpm --filter web test`
Expected: 모두 PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/demo/page.tsx
git commit -m "feat(web): 데모 비밀번호/가계부 탭 토글 추가"
```

---

## Task 6: 데모 e2e 스모크 + 최종 그린(선택)

**Files:**
- Create: `apps/web/tests/e2e/demo.spec.ts`

- [ ] **Step 1: 데모 스모크 스펙 작성**

`/demo` 는 인증 없이 열린다(dev-unlock 불필요). Create `apps/web/tests/e2e/demo.spec.ts`:

```ts
import { test, expect } from "@playwright/test"

test.describe("demo", () => {
    test("가계부 탭 → 대시보드 렌더 + 카테고리 HEX 추가", async ({ page }) => {
        test.setTimeout(120_000)
        await page.goto("/demo")
        // 가계부 탭 전환
        await page.getByRole("button", { name: "가계부" }).click()
        // 자산 대시보드 heading
        await expect(
            page.locator("div").filter({ hasText: /^자산$/ }).first(),
        ).toBeVisible({ timeout: 20_000 })
        // 카테고리 관리 → HEX 추가
        await page.getByRole("button", { name: "카테고리 관리" }).click()
        const dialog = page.getByRole("dialog", { name: "카테고리 관리" })
        await expect(dialog).toBeVisible()
        const unique = `데모QA${Date.now() % 100000}`
        await dialog.getByLabel("카테고리 이름").fill(unique)
        await dialog.getByLabel("색상 HEX 코드").fill("#3bb273")
        await dialog.getByRole("button", { name: "+ 추가" }).click()
        await expect(dialog.getByText(unique)).toBeVisible({ timeout: 10_000 })
    })
})
```

- [ ] **Step 2: 실행(dev 필요)**

Run: `pnpm --filter web exec playwright test --config=playwright.e2e.config.ts demo --reporter=line`
Expected: PASS(2회 안정). 전체 스위트도 1회 green 확인.

- [ ] **Step 3: 최종 정적 그린**

Run: `pnpm --filter web exec tsc --noEmit && pnpm --filter web lint && pnpm --filter web test && pnpm --filter web build`
Expected: 모두 PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/tests/e2e/demo.spec.ts
git commit -m "test(web): 데모 가계부 스모크 e2e 추가"
```

---

## 최종 검증
- [ ] tsc·lint·test·build 그린. 기존 비밀번호 데모 흐름 정상.
- [ ] `/demo` 가계부 탭: 대시보드(남은돈·카테고리 분해·달력·일자상세) 표시, +지출 추가·카테고리 관리(HEX) 동작.

## Self-Review 메모(작성자)
- 스펙 §3.1(토글)=T5, §3.2(가계부 대시보드+상호작용)=T4·T2·T3, §3.3(데이터)=T1, §3.4(데모 컴포넌트)=T2·T3, §3.5(비밀번호 갱신)=T5 Step2, §4(검증)=T6. 전 항목 매핑.
- 타입 일관성: `Loaded{incomeAmount,incomes,expenses,categories}`, `ComputedExpense`/`ComputedIncome`/`AssetCategory` 실제 정의와 동일. `DemoCategoryManager({categories,onChange,onClose})`, `DemoExpenseForm({categories,onSave,onCancel})` 시그니처 Task 간 동일.
- 데모 격리: vault-client 는 타입 전용 import 만. useVault 미사용.
- CATEGORY_PALETTE 대신 데모는 HEX 입력(CategoryColorInput) 재사용.
