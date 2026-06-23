// vault/new 라우트 시각 회귀. 잠금 상태에서는 layout 이 UnlockScreen 으로 fallback 한다.
import { test, expect } from "@playwright/test"

test("vault new route renders (locked fallback or form)", async ({ page }) => {
    await page.goto("/new")
    await page.waitForLoadState("networkidle")
    await expect(page).toHaveScreenshot("vault-new.png")
})
