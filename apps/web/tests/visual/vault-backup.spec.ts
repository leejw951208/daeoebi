// 백업·복원 라우트 시각 회귀. VK 미보유(잠금) 상태에서는 layout 이 인증 화면으로 fallback 한다.
import { test, expect } from "@playwright/test"

test("vault backup route renders", async ({ page }) => {
    await page.goto("/backup")
    await page.waitForLoadState("networkidle")
    await expect(page).toHaveScreenshot("vault-backup.png")
})
