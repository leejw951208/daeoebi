/**
 * E2E QA: 카테고리 관리
 * 고정 카테고리(읽기 전용) 노출 + 사용자 생성 카테고리 CRUD.
 *
 * 카테고리는 고정(수정·삭제 불가, 코드 보유)과 사용자 생성(이름·색만)으로 나뉜다.
 * - 조회: 고정 12종이 "고정 카테고리" 섹션에 노출된다.
 * - 등록: "내 카테고리" 섹션에 이름·색으로 추가한다(코드 입력 없음).
 * - 수정: 사용자 카테고리의 이름·색을 변경한다.
 * - 삭제: 사용자 카테고리를 삭제한다(확인 단계 없이 즉시 — 디자인).
 *
 * Auth bypass: dev 환경에서 "패스키로 잠금해제" 클릭 → devUnlock() 호출.
 * Tests run serially so API state persists across test boundaries.
 */

import { test, expect, type Page, type Locator } from "@playwright/test"
import path from "path"

const SCREENSHOTS_DIR = path.join(__dirname, "__screenshots__")

// Unique names fixed at module load time so serial tests share them.
const UNIQUE = `QA-${Date.now()}`
const RENAMED = `${UNIQUE.slice(0, 12)}-수정`

// 고정 카테고리 14종(코드 보유, 읽기 전용).
const FIXED_NAMES = [
    "식비",
    "카페·간식",
    "편의점·마트·잡화",
    "쇼핑",
    "의료·건강",
    "주거·통신",
    "보험·세금",
    "미용",
    "교통",
    "구독",
    "문화",
    "투자",
    "저축",
    "기타",
]

// Tall viewport so the bottom sheet never extends above the visible area.
const TALL_VIEWPORT = { width: 1280, height: 2000 }

// ── Helpers ──────────────────────────────────────────────────────────────────

async function enterVaultAt(page: Page, targetPath: string): Promise<void> {
    await page.goto(targetPath)
    const unlockBtn = page.getByRole("button", { name: "패스키로 잠금해제" })
    try {
        await unlockBtn.waitFor({ state: "visible", timeout: 15_000 })
        await unlockBtn.click()
    } catch {
        // Already unlocked or onboarding screen shown
    }
}

async function waitForAssetDashboard(page: Page): Promise<void> {
    // 대시보드 헤더의 "카테고리" 버튼이 뜨면 보관함이 열리고 대시보드가 렌더된 것이다.
    await expect(page.getByRole("button", { name: "카테고리" })).toBeVisible({
        timeout: 30_000,
    })
}

async function openCategoryManager(page: Page): Promise<Locator> {
    await page.getByRole("button", { name: "카테고리" }).click()
    const dialog = page.getByRole("dialog", { name: "카테고리 관리" })
    await expect(dialog).toBeVisible({ timeout: 10_000 })
    return dialog
}

async function closeCategoryManager(
    page: Page,
    dialog: Locator,
): Promise<void> {
    await dialog.getByRole("button", { name: "닫기" }).click()
    await expect(dialog).toBeHidden({ timeout: 10_000 })
}

/** 이름으로 카테고리 행 Locator 를 특정한다. */
function categoryRow(dialog: Locator, name: string): Locator {
    return dialog
        .locator('[data-testid="category-row"]')
        .filter({ hasText: name })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe.serial("카테고리 관리", () => {
    // 이전 실패 런에서 남은 QA 사용자 카테고리를 정리한다(삭제는 즉시 — 확인 없음).
    test.beforeAll(async ({ browser }) => {
        const ctx = await browser.newContext()
        const pg = await ctx.newPage()
        await pg.setViewportSize(TALL_VIEWPORT)

        await pg.goto("/asset")
        const unlockBtn = pg.getByRole("button", { name: "패스키로 잠금해제" })
        await unlockBtn.waitFor({ state: "visible", timeout: 15_000 })
        await unlockBtn.click()
        await expect(pg.getByRole("button", { name: "카테고리" })).toBeVisible({
            timeout: 30_000,
        })

        await pg.getByRole("button", { name: "카테고리" }).click()
        const dialog = pg.getByRole("dialog", { name: "카테고리 관리" })
        await expect(dialog).toBeVisible({ timeout: 10_000 })

        for (let i = 0; i < 30; i++) {
            const row = dialog
                .locator('[data-testid="category-row"]')
                .filter({ hasText: /QA/ })
            if ((await row.count()) === 0) break
            await row.first().getByRole("button", { name: "삭제" }).click()
            await expect(row.first()).toBeHidden({ timeout: 10_000 })
        }

        await ctx.close()
    })

    // ── 1. 조회 ───────────────────────────────────────────────────────────────
    test("1. 조회 — 고정 카테고리 14종이 노출된다", async ({ page }) => {
        test.setTimeout(120_000)
        await page.setViewportSize(TALL_VIEWPORT)

        await enterVaultAt(page, "/asset")
        await waitForAssetDashboard(page)

        const dialog = await openCategoryManager(page)

        for (const name of FIXED_NAMES) {
            await expect(dialog.getByText(name, { exact: true })).toBeVisible({
                timeout: 5_000,
            })
        }

        // 고정 카테고리 행에는 수정 버튼이 없다(읽기 전용).
        await expect(
            categoryRow(dialog, "식비").getByRole("button", { name: "수정" }),
        ).toHaveCount(0)

        await page.screenshot({
            path: path.join(SCREENSHOTS_DIR, "cat-crud-01-read.png"),
            fullPage: false,
        })
    })

    // ── 2. 등록 ───────────────────────────────────────────────────────────────
    test("2. 등록 — 사용자 카테고리 추가 후 목록·지출 폼 칩에 표시된다", async ({
        page,
    }) => {
        test.setTimeout(120_000)
        await page.setViewportSize(TALL_VIEWPORT)

        await enterVaultAt(page, "/asset")
        await waitForAssetDashboard(page)

        const dialog = await openCategoryManager(page)

        // FORM 모드: 이름 + 색상 스와치(코드 입력 없음).
        await dialog.getByRole("button", { name: "+ 카테고리 추가" }).click()
        await dialog.getByLabel("카테고리 이름").fill(UNIQUE)
        await dialog.getByRole("button", { name: "#4a90d9" }).click()
        await dialog.getByRole("button", { name: "저장" }).click()

        await expect(dialog.getByText(UNIQUE)).toBeVisible({ timeout: 10_000 })

        await page.screenshot({
            path: path.join(SCREENSHOTS_DIR, "cat-crud-02-create-manager.png"),
            fullPage: false,
        })

        // Read-consistency: 지출 폼 칩에 노출.
        await closeCategoryManager(page, dialog)

        await page.getByRole("link", { name: "새 지출 추가" }).click()
        await page.waitForURL("**/asset/new", { timeout: 15_000 })
        await page
            .locator("button.chip")
            .first()
            .waitFor({ state: "visible", timeout: 20_000 })

        await expect(
            page.locator("button.chip").filter({ hasText: UNIQUE }),
        ).toBeVisible({ timeout: 10_000 })

        await page.screenshot({
            path: path.join(SCREENSHOTS_DIR, "cat-crud-02-create-chip.png"),
            fullPage: false,
        })
    })

    // ── 3. 수정 ───────────────────────────────────────────────────────────────
    test("3. 수정 — 이름·색 변경 후 목록·지출 폼 칩에 반영된다", async ({
        page,
    }) => {
        test.setTimeout(120_000)
        await page.setViewportSize(TALL_VIEWPORT)

        await enterVaultAt(page, "/asset")
        await waitForAssetDashboard(page)

        const dialog = await openCategoryManager(page)

        await expect(dialog.getByText(UNIQUE)).toBeVisible({ timeout: 10_000 })

        await categoryRow(dialog, UNIQUE)
            .getByRole("button", { name: "수정" })
            .click()

        const editInput = dialog.getByLabel("카테고리 이름")
        await editInput.clear()
        await editInput.fill(RENAMED)
        await dialog.getByRole("button", { name: "#9b6bd6" }).click()
        await dialog.getByRole("button", { name: "저장" }).click()

        await expect(dialog.getByText(RENAMED)).toBeVisible({ timeout: 10_000 })
        await expect(dialog.getByText(UNIQUE)).toBeHidden()

        await page.screenshot({
            path: path.join(SCREENSHOTS_DIR, "cat-crud-03-update-manager.png"),
            fullPage: false,
        })

        await closeCategoryManager(page, dialog)

        await page.getByRole("link", { name: "새 지출 추가" }).click()
        await page.waitForURL("**/asset/new", { timeout: 15_000 })
        await page
            .locator("button.chip")
            .first()
            .waitFor({ state: "visible", timeout: 20_000 })

        await expect(
            page.locator("button.chip").filter({ hasText: RENAMED }),
        ).toBeVisible({ timeout: 10_000 })
        await expect(
            page.locator("button.chip").filter({ hasText: UNIQUE }),
        ).toBeHidden()

        await page.screenshot({
            path: path.join(SCREENSHOTS_DIR, "cat-crud-03-update-chip.png"),
            fullPage: false,
        })
    })

    // ── 4. 삭제 ───────────────────────────────────────────────────────────────
    test("4. 삭제 — 사용자 카테고리 삭제 후 목록·칩에서 제거된다", async ({
        page,
    }) => {
        test.setTimeout(120_000)
        await page.setViewportSize(TALL_VIEWPORT)

        await enterVaultAt(page, "/asset")
        await waitForAssetDashboard(page)

        const dialog = await openCategoryManager(page)

        await expect(dialog.getByText(RENAMED)).toBeVisible({ timeout: 10_000 })

        // 삭제는 확인 단계 없이 즉시 수행된다(디자인).
        await categoryRow(dialog, RENAMED)
            .getByRole("button", { name: "삭제" })
            .click()

        await expect(dialog.getByText(RENAMED)).toBeHidden({ timeout: 10_000 })

        await page.screenshot({
            path: path.join(SCREENSHOTS_DIR, "cat-crud-04-delete-manager.png"),
            fullPage: false,
        })

        await closeCategoryManager(page, dialog)

        await page.getByRole("link", { name: "새 지출 추가" }).click()
        await page.waitForURL("**/asset/new", { timeout: 15_000 })
        await page
            .locator("button.chip")
            .first()
            .waitFor({ state: "visible", timeout: 20_000 })

        await expect(
            page.locator("button.chip").filter({ hasText: RENAMED }),
        ).toBeHidden()

        await page.screenshot({
            path: path.join(SCREENSHOTS_DIR, "cat-crud-04-delete-chip.png"),
            fullPage: false,
        })
    })
})
