// 보관함 진입 화면 시각 회귀. 미등록 시 온보딩, 등록 후 잠금해제 화면이 렌더된다.
import { test, expect } from "@playwright/test"

test("vault unlock screen renders", async ({ page }) => {
    await page.goto("/")
    await page.waitForLoadState("networkidle")
    await expect(page).toHaveScreenshot("vault.png")
})
