// axe-core 로 보관함 페이지의 WCAG AA 위반을 1회 검출한다.
import { test, expect } from "@playwright/test"
import AxeBuilder from "@axe-core/playwright"

const PAGES = [
    { name: "vault", url: "/" },
    { name: "vault-new", url: "/new" },
    { name: "vault-detail-missing", url: "/missing-id" },
    { name: "vault-categories", url: "/categories" },
    { name: "vault-backup", url: "/backup" },
]

for (const p of PAGES) {
    test(`${p.name} has no WCAG AA violations`, async ({ page }) => {
        await page.goto(p.url)
        await page.waitForLoadState("networkidle")
        const results = await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
            .analyze()
        expect(results.violations).toEqual([])
    })
}
