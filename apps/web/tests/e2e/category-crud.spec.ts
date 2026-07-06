/**
 * E2E QA: 카테고리 관리 CRUD
 * 조회(read) · 등록(create) · 수정(update) · 삭제(delete)
 *
 * Auth bypass: dev 환경에서 "패스키로 잠금해제" 클릭 → devUnlock() 호출.
 * Tests run serially (test.describe.serial) so API state persists across
 * test boundaries (created category stays in DB between tests).
 * Cleanup: test 4 (delete) removes the QA category so no leftover on success.
 *
 * Viewport note: a tall viewport(1280×2000) keeps the whole sheet in view so
 * actions stay simple. 시트 자체도 max-height + overflow-y(scroll)라 실기기에서
 * 카테고리가 많아도 잘리지 않는다.
 */

import { test, expect, type Page, type Locator } from "@playwright/test"
import path from "path"

const SCREENSHOTS_DIR = path.join(__dirname, "__screenshots__")

// Unique names fixed at module load time so serial tests share them.
const UNIQUE = `QA-${Date.now()}`
const RENAMED = `${UNIQUE.slice(0, 12)}-수정`
// 카테고리 코드(카테고리 간 고유). UNIQUE 에서 파생해 매 실행마다 달라진다.
const CODE = `C${UNIQUE.slice(3)}`

// Tall viewport so the bottom sheet never extends above the visible area.
const TALL_VIEWPORT = { width: 1280, height: 2000 }

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Navigate to targetPath, click the dev-unlock button if the VaultGate
 * lock screen appears.  Callers must wait for vault content afterward.
 */
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

/** Wait until the "자산" heading is visible (vault unlocked, dashboard rendered). */
async function waitForAssetDashboard(page: Page): Promise<void> {
    await expect(
        page
            .locator("div")
            .filter({ hasText: /^자산$/ })
            .first(),
    ).toBeVisible({ timeout: 30_000 })
}

/** Open the CategoryManager bottom-sheet and return a Locator scoped to it. */
async function openCategoryManager(page: Page): Promise<Locator> {
    await page.getByRole("button", { name: "카테고리 관리" }).click()
    const dialog = page.getByRole("dialog", { name: "카테고리 관리" })
    await expect(dialog).toBeVisible({ timeout: 10_000 })
    return dialog
}

/**
 * Close the CategoryManager by clicking its "닫기" button.
 * With the tall viewport the button is always within the visible area.
 */
async function closeCategoryManager(
    page: Page,
    dialog: Locator,
): Promise<void> {
    await dialog.getByRole("button", { name: "닫기" }).click()
    await expect(dialog).toBeHidden({ timeout: 10_000 })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe.serial("카테고리 관리 CRUD", () => {
    /**
     * Cleanup: delete any leftover QA-prefixed categories that accumulated
     * from previous failed test runs.  These make the category sheet taller
     * than the default 720 px viewport used by asset.spec.ts, breaking those
     * tests too.  Running once here keeps the list bounded.
     */
    test.beforeAll(async ({ browser }) => {
        const ctx = await browser.newContext()
        const pg = await ctx.newPage()
        await pg.setViewportSize(TALL_VIEWPORT)

        await pg.goto("/asset")
        const unlockBtn = pg.getByRole("button", { name: "패스키로 잠금해제" })
        await unlockBtn.waitFor({ state: "visible", timeout: 15_000 })
        await unlockBtn.click()
        await expect(
            pg
                .locator("div")
                .filter({ hasText: /^자산$/ })
                .first(),
        ).toBeVisible({ timeout: 30_000 })

        await pg.getByRole("button", { name: "카테고리 관리" }).click()
        const dialog = pg.getByRole("dialog", { name: "카테고리 관리" })
        await expect(dialog).toBeVisible({ timeout: 10_000 })

        // Delete all categories whose name contains "QA" (leftover from failed runs).
        // Safety cap of 30 iterations.
        for (let i = 0; i < 30; i++) {
            const qaCount = await dialog.getByText(/QA/).count()
            if (qaCount === 0) break

            // QA categories are always appended after the 8 defaults, so the
            // last "삭제" button always targets a QA category.
            await dialog.getByRole("button", { name: "삭제" }).last().click()
            const confirmDialog = pg.getByRole("dialog", {
                name: "카테고리 삭제",
            })
            await expect(confirmDialog).toBeVisible({ timeout: 5_000 })
            await confirmDialog.getByRole("button", { name: "삭제" }).click()
            await expect(confirmDialog).toBeHidden({ timeout: 10_000 })
        }

        await ctx.close()
    })
    // ── 1. 조회 ───────────────────────────────────────────────────────────────
    test("1. 조회 — 시드 기본 카테고리 목록이 전부 노출된다", async ({
        page,
    }) => {
        test.setTimeout(120_000)
        await page.setViewportSize(TALL_VIEWPORT)

        await enterVaultAt(page, "/asset")
        await waitForAssetDashboard(page)

        const dialog = await openCategoryManager(page)

        // All eight seeded default categories must appear in the manager list.
        const DEFAULT_NAMES = [
            "식비",
            "교통",
            "주거·공과금",
            "쇼핑",
            "문화",
            "저축",
            "투자",
            "기타",
        ]
        for (const name of DEFAULT_NAMES) {
            await expect(dialog.getByText(name)).toBeVisible({ timeout: 5_000 })
        }

        await page.screenshot({
            path: path.join(SCREENSHOTS_DIR, "cat-crud-01-read.png"),
            fullPage: false,
        })
    })

    // ── 2. 등록 ───────────────────────────────────────────────────────────────
    test("2. 등록 — 새 카테고리 추가 후 목록 및 지출 폼 칩에 표시된다", async ({
        page,
    }) => {
        test.setTimeout(120_000)
        await page.setViewportSize(TALL_VIEWPORT)

        await enterVaultAt(page, "/asset")
        await waitForAssetDashboard(page)

        const dialog = await openCategoryManager(page)

        // 이름 입력 + HEX 색상 입력(팔레트 제거됨) + 코드 입력(선택·고유).
        await dialog.getByLabel("카테고리 이름").fill(UNIQUE)
        await dialog.getByLabel("색상 HEX 코드").fill("#4a90d9")
        await dialog.getByLabel("카테고리 코드").fill(CODE)
        await dialog.getByRole("button", { name: "+ 추가" }).click()

        // Assert new category appears in the manager list.
        await expect(dialog.getByText(UNIQUE)).toBeVisible({ timeout: 10_000 })
        // 코드 배지가 목록 행에 노출된다.
        await expect(dialog.getByText(CODE)).toBeVisible({ timeout: 10_000 })

        await page.screenshot({
            path: path.join(SCREENSHOTS_DIR, "cat-crud-02-create-manager.png"),
            fullPage: false,
        })

        // Read-consistency: close manager → navigate to /asset/new → assert chip.
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

    // ── 2-1. 코드 중복 ──────────────────────────────────────────────────────────
    test("2-1. 코드 중복 — 같은 코드로 추가하면 거부된다", async ({ page }) => {
        test.setTimeout(120_000)
        await page.setViewportSize(TALL_VIEWPORT)

        await enterVaultAt(page, "/asset")
        await waitForAssetDashboard(page)

        const dialog = await openCategoryManager(page)

        // test 2 에서 CODE 를 가진 카테고리가 이미 존재한다. 같은 코드로 추가 시도.
        const dupName = `${UNIQUE}-dup`
        await dialog.getByLabel("카테고리 이름").fill(dupName)
        await dialog.getByLabel("색상 HEX 코드").fill("#3bb273")
        await dialog.getByLabel("카테고리 코드").fill(CODE)
        await dialog.getByRole("button", { name: "+ 추가" }).click()

        // 서버 409 → 에러 문구 노출, 새 카테고리는 추가되지 않는다.
        await expect(
            dialog.getByText("같은 코드의 카테고리가 이미 있습니다."),
        ).toBeVisible({ timeout: 10_000 })
        await expect(dialog.getByText(dupName)).toBeHidden()

        await page.screenshot({
            path: path.join(SCREENSHOTS_DIR, "cat-crud-02-1-code-dup.png"),
            fullPage: false,
        })
    })

    // ── 3. 수정 ───────────────────────────────────────────────────────────────
    test("3. 수정 — 이름·색 변경 후 목록 및 지출 폼 칩에 반영된다", async ({
        page,
    }) => {
        test.setTimeout(120_000)
        await page.setViewportSize(TALL_VIEWPORT)

        await enterVaultAt(page, "/asset")
        await waitForAssetDashboard(page)

        const dialog = await openCategoryManager(page)

        // The QA category added in test 2 must still exist.
        await expect(dialog.getByText(UNIQUE)).toBeVisible({ timeout: 10_000 })

        // Click "수정" for the UNIQUE category row.
        // Strategy: find the category name <span>, walk up two levels via XPath
        // (span → name-container div → row div), then step into the second child
        // div (action-buttons div) and click its first button (수정).
        // This is robust against parallel tests adding/removing other categories.
        await dialog
            .locator("span")
            .filter({ hasText: UNIQUE })
            .locator("xpath=../../div[2]/button[1]")
            .click()

        // 편집 행의 이름 입력만 className="input"(추가 폼은 field-control).
        const editInput = dialog.locator("input.input:not([placeholder])")
        await editInput.clear()
        await editInput.fill(RENAMED)

        // 색상 HEX 입력: 편집 모드엔 입력이 둘(추가 폼 + 편집 행)이므로 .last()=편집 행.
        await dialog.getByLabel("색상 HEX 코드").last().fill("#9b6bd6")

        // Save.
        await dialog.getByRole("button", { name: "저장" }).click()

        // Assert renamed in manager; old name must be gone.
        await expect(dialog.getByText(RENAMED)).toBeVisible({ timeout: 10_000 })
        await expect(dialog.getByText(UNIQUE)).toBeHidden()
        // 이름·색 수정이 코드는 보존한다(코드 배지 유지).
        await expect(dialog.getByText(CODE)).toBeVisible({ timeout: 10_000 })

        await page.screenshot({
            path: path.join(SCREENSHOTS_DIR, "cat-crud-03-update-manager.png"),
            fullPage: false,
        })

        // Read-consistency: renamed chip visible; old name chip gone.
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
    test("4. 삭제 — ConfirmDialog 미분류 문구 확인 후 목록·칩 모두 제거된다", async ({
        page,
    }) => {
        test.setTimeout(120_000)
        await page.setViewportSize(TALL_VIEWPORT)

        await enterVaultAt(page, "/asset")
        await waitForAssetDashboard(page)

        const dialog = await openCategoryManager(page)

        // The renamed QA category from test 3 must still exist.
        await expect(dialog.getByText(RENAMED)).toBeVisible({ timeout: 10_000 })

        // Click "삭제" for the RENAMED category row.
        // Same XPath strategy as test 3: span → name-container div → row div →
        // action-buttons div → second button (삭제).
        await dialog
            .locator("span")
            .filter({ hasText: RENAMED })
            .locator("xpath=../../div[2]/button[2]")
            .click()

        // ConfirmDialog must appear with the "미분류" warning.
        const confirmDialog = page.getByRole("dialog", {
            name: "카테고리 삭제",
        })
        await expect(confirmDialog).toBeVisible({ timeout: 5_000 })
        await expect(
            confirmDialog.getByText("이 카테고리의 지출은 미분류가 됩니다."),
        ).toBeVisible()

        await page.screenshot({
            path: path.join(SCREENSHOTS_DIR, "cat-crud-04-confirm.png"),
            fullPage: false,
        })

        // Confirm deletion.
        await confirmDialog.getByRole("button", { name: "삭제" }).click()

        // Category must be gone from the manager list.
        await expect(dialog.getByText(RENAMED)).toBeHidden({ timeout: 10_000 })

        await page.screenshot({
            path: path.join(SCREENSHOTS_DIR, "cat-crud-04-delete-manager.png"),
            fullPage: false,
        })

        // Read-consistency: deleted category no longer a chip on /asset/new.
        await closeCategoryManager(page, dialog)

        await page.getByRole("link", { name: "새 지출 추가" }).click()
        await page.waitForURL("**/asset/new", { timeout: 15_000 })
        // At least one chip (default categories) must still be present.
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
