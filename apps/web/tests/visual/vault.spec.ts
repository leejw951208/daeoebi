// 보관함 페이지 (unlock 전 상태) 시각 회귀.
import { test, expect } from "@playwright/test"

test("vault unlock screen renders", async ({ page }) => {
    await page.goto("/")
    await page.waitForLoadState("networkidle")
    await expect(page).toHaveScreenshot("vault.png")
})
