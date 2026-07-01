import { test, expect } from "@playwright/test"

test.describe("demo", () => {
    test("가계부 탭 → 대시보드 렌더 + 카테고리 HEX 추가", async ({ page }) => {
        test.setTimeout(120_000)
        await page.goto("/demo")
        // 가계부 탭 전환
        await page.getByRole("button", { name: "가계부" }).click()
        // 자산 대시보드 heading
        await expect(
            page
                .locator("div")
                .filter({ hasText: /^자산$/ })
                .first(),
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
