/**
 * E2E tests for the asset feature (expense categories + payment-method removal).
 *
 * Auth bypass: in dev mode (NODE_ENV !== "production"), clicking the
 * "패스키로 잠금해제" button calls devUnlock() and enters the vault immediately.
 *
 * Strategy: navigate to the target URL first, then unlock there.
 * Full-page navigation (page.goto) resets the VaultGate state, so we must
 * enter the vault at the URL we intend to test.
 */

import { test, expect, type Page } from "@playwright/test"
import path from "path"

const SCREENSHOTS_DIR = path.join(__dirname, "__screenshots__")

/**
 * Navigate to `targetPath`, click the passkey unlock button if the
 * UnlockScreen is shown, and exit immediately after the click.
 * Callers are responsible for waiting until vault content appears.
 */
async function enterVaultAt(page: Page, targetPath: string): Promise<void> {
    await page.goto(targetPath)

    // VaultGate starts as "loading" → fetches auth status → transitions to
    // "locked" (showing UnlockScreen) or stays "unlocked" (shouldn't happen in
    // headless Chromium after a fresh navigation).
    const unlockBtn = page.getByRole("button", { name: "패스키로 잠금해제" })
    try {
        await unlockBtn.waitFor({ state: "visible", timeout: 15_000 })
        await unlockBtn.click()
    } catch {
        // Button did not appear — already unlocked or onboarding screen shown.
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// A. Smoke: 자산 대시보드 렌더 확인
// ─────────────────────────────────────────────────────────────────────────────
test("A. smoke — 자산 대시보드가 에러 없이 렌더된다", async ({ page }) => {
    test.setTimeout(60_000)

    await enterVaultAt(page, "/asset")

    // Wait for AssetPage heading ("자산") to appear — confirms vault is
    // unlocked and the asset dashboard mounted successfully.
    const heading = page
        .locator("div")
        .filter({ hasText: /^자산$/ })
        .first()
    await expect(heading).toBeVisible({ timeout: 30_000 })

    // No error box should be present.
    const errorBox = page.locator('[role="alert"].error-box')
    await expect(errorBox).toBeHidden()

    // Capture smoke screenshot.
    await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, "smoke-asset-dashboard.png"),
        fullPage: true,
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// B. Category management CRUD
// ─────────────────────────────────────────────────────────────────────────────
test("B. category CRUD — 추가·수정·삭제가 정상 동작한다", async ({ page }) => {
    test.setTimeout(90_000)

    const uniqueName = `QA테스트${Date.now()}`
    const editedName = `${uniqueName.slice(0, 10)}수정됨`

    await enterVaultAt(page, "/asset")

    // Wait for vault content.
    await expect(
        page
            .locator("div")
            .filter({ hasText: /^자산$/ })
            .first(),
    ).toBeVisible({ timeout: 30_000 })

    // Open CategoryManager.
    const categoryMgrBtn = page.getByRole("button", { name: "카테고리 관리" })
    await expect(categoryMgrBtn).toBeVisible()
    await categoryMgrBtn.click()

    const dialog = page.getByRole("dialog", { name: "카테고리 관리" })
    await expect(dialog).toBeVisible({ timeout: 10_000 })

    // ── ADD ──────────────────────────────────────────────────────────────────
    const nameInput = dialog.getByPlaceholder("이름 (최대 20자)")
    await nameInput.fill(uniqueName)

    // Pick the second palette color (#4a90d9).
    // The sheet may be scrolled by the category list, so force-click to bypass
    // the viewport check (the element is in the DOM, just possibly off-screen).
    await dialog.getByRole("button", { name: "#4a90d9" }).click({ force: true })

    await dialog.getByRole("button", { name: "+ 추가" }).click()

    // New category appears in the list.
    await expect(dialog.getByText(uniqueName)).toBeVisible({ timeout: 10_000 })

    // ── EDIT ─────────────────────────────────────────────────────────────────
    // The newly added category is the last in the list.
    // Click the last "수정" button (corresponds to the just-added category).
    await dialog.getByRole("button", { name: "수정" }).last().click()

    // Find the editing input: it has no placeholder, unlike the add-form input
    // which has placeholder "이름 (최대 20자)".
    const editInput = dialog.locator("input.input:not([placeholder])")
    await editInput.fill(editedName)

    // Save the edit — there is exactly one "저장" button when a row is in edit
    // mode (the add-form uses "+ 추가" instead).
    await dialog.getByRole("button", { name: "저장" }).click()

    await expect(dialog.getByText(editedName)).toBeVisible({ timeout: 10_000 })
    await expect(dialog.getByText(uniqueName)).toBeHidden()

    // ── DELETE ────────────────────────────────────────────────────────────────
    // The edited category is still the last in the list.
    await dialog.getByRole("button", { name: "삭제" }).last().click()

    // ConfirmDialog appears.
    const confirmDialog = page.getByRole("dialog", { name: "카테고리 삭제" })
    await expect(confirmDialog).toBeVisible({ timeout: 5_000 })
    await expect(
        confirmDialog.getByText("이 카테고리의 지출은 미분류가 됩니다."),
    ).toBeVisible()

    await confirmDialog.getByRole("button", { name: "삭제" }).click()

    // Category is gone from the list.
    await expect(dialog.getByText(editedName)).toBeHidden({ timeout: 10_000 })

    // All CRUD assertions are complete. The close button lives in the sheet
    // header which may be scrolled above the viewport when the category list
    // is long — no close action needed for the test to be conclusive.
})

// ─────────────────────────────────────────────────────────────────────────────
// C. Expense create with category
// ─────────────────────────────────────────────────────────────────────────────
test("C. expense create — 카테고리 선택 후 저장하면 대시보드에 표시된다", async ({
    page,
}) => {
    test.setTimeout(90_000)

    const uniqueItem = `QA지출${Date.now()}`

    await enterVaultAt(page, "/asset")

    // Wait for dashboard.
    await expect(
        page
            .locator("div")
            .filter({ hasText: /^자산$/ })
            .first(),
    ).toBeVisible({ timeout: 30_000 })

    // Navigate to /asset/new via the FAB link (client-side navigation — vault
    // state is preserved).
    const fab = page.getByRole("link", { name: "새 지출 추가" })
    await expect(fab).toBeVisible()
    await fab.click()
    await page.waitForURL("**/asset/new", { timeout: 15_000 })

    // Fill the expense form.
    const amountInput = page.getByLabel("금액")
    await amountInput.fill("9999")

    const itemInput = page.getByLabel("항목")
    await itemInput.fill(uniqueItem)

    // Wait for category chips to load, then select the first one.
    const chips = page.locator("button.chip")
    await chips.first().waitFor({ state: "visible", timeout: 20_000 })
    await chips.first().click()

    // Save.
    await page.getByRole("button", { name: "저장" }).click()

    // After save, back on /asset (router.push then router.refresh).
    await page.waitForURL("**/asset", { timeout: 20_000 })

    // The new expense's item name should appear in DayDetail (today is auto-
    // selected when the current month is shown).
    await expect(page.getByText(uniqueItem)).toBeVisible({ timeout: 20_000 })
})

// ─────────────────────────────────────────────────────────────────────────────
// D. Regression — 결제방법 필드가 없음
// ─────────────────────────────────────────────────────────────────────────────
test("D. regression — 지출 폼에 결제방법 필드가 없다", async ({ page }) => {
    test.setTimeout(60_000)

    await enterVaultAt(page, "/asset")

    await expect(
        page
            .locator("div")
            .filter({ hasText: /^자산$/ })
            .first(),
    ).toBeVisible({ timeout: 30_000 })

    // Navigate to the new-expense form via the FAB.
    await page.getByRole("link", { name: "새 지출 추가" }).click()
    await page.waitForURL("**/asset/new", { timeout: 15_000 })

    // Wait for the form to be fully rendered (category chips load async).
    await page.locator("button.chip").first().waitFor({
        state: "visible",
        timeout: 20_000,
    })

    // "결제방법" text must not appear.
    await expect(page.getByText("결제방법")).toBeHidden()

    // Payment-method chips must not appear.
    await expect(page.getByRole("button", { name: "신용카드" })).toBeHidden()
    await expect(page.getByRole("button", { name: "체크카드" })).toBeHidden()
    await expect(page.getByRole("button", { name: "현금" })).toBeHidden()
})

// ─────────────────────────────────────────────────────────────────────────────
// E. Category chips are dynamic (API-backed)
// ─────────────────────────────────────────────────────────────────────────────
test("E. category chips — API 기반 카테고리가 동적으로 렌더된다", async ({
    page,
}) => {
    test.setTimeout(60_000)

    await enterVaultAt(page, "/asset")

    await expect(
        page
            .locator("div")
            .filter({ hasText: /^자산$/ })
            .first(),
    ).toBeVisible({ timeout: 30_000 })

    // Navigate to the new-expense form via the FAB.
    await page.getByRole("link", { name: "새 지출 추가" }).click()
    await page.waitForURL("**/asset/new", { timeout: 15_000 })

    // Wait for category chips to appear.
    const chips = page.locator("button.chip")
    await chips.first().waitFor({ state: "visible", timeout: 20_000 })

    const chipCount = await chips.count()
    // The seeded DB should have at least 2 default categories.
    expect(chipCount).toBeGreaterThanOrEqual(2)

    // The first chip must be auto-selected (aria-pressed="true").
    await expect(chips.first()).toHaveAttribute("aria-pressed", "true")
})
