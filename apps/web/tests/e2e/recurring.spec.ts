/**
 * E2E QA: 고정 지출(RecurringExpense) 수정 — "앞으로만 반영"
 *
 * 회귀 대상(수정 경로가 템플릿을 갱신하지 않아 생긴 3가지 증상):
 *   A. 수정 화면에 "개월 수"가 항상 비어 보임(템플릿 값을 안 읽음)
 *   B. 제목·카테고리를 고쳐도 다음 달엔 옛 내용으로 다시 생성됨(템플릿을 안 고침)
 *   C. 개월 수를 고쳐도 저장되지 않음(PATCH DTO 가 받지 않음)
 *
 * 세 증상이 각각 독립적으로 잡히도록 테스트마다 자기 고정 지출을 새로 만든다.
 * (한 테스트에 몰면 첫 단언에서 멈춰 나머지 회귀를 검증하지 못한다.)
 *
 * Auth bypass: dev 환경에서 devUnlock() — 잠금 해제/온보딩 화면 모두 우회한다.
 *
 * 고정 지출 인스턴스는 그 달을 열 때 클라이언트가 생성한다(materializeRecurring).
 * 따라서 "다음 달로 이동 → 새 내용으로 생성되는지" 가 앞으로만 반영의 최종 검증이다.
 */

import { test, expect, type Page } from "@playwright/test"

const AMOUNT = 33_000
const CATEGORY_BEFORE = "식비·카페"
const CATEGORY_AFTER = "교통"

// 15일이라 월 길이와 무관하게 항상 유효하다.
const DAY = 15

const TALL_VIEWPORT = { width: 1280, height: 2000 }

/**
 * 잠금 해제 화면(등록된 패스키 있음)이면 "패스키로 잠금해제",
 * 온보딩 화면(빈 DB)이면 토큰 입력 후 "패스키 만들기" — dev 에선 둘 다 devUnlock() 으로 진입한다.
 * (부트스트랩 토큰은 dev 분기에서 검증하지 않지만 버튼 활성화 조건이라 아무 값이나 채운다.)
 */
async function enterVaultAt(page: Page, targetPath: string): Promise<void> {
    await page.goto(targetPath)
    const unlockBtn = page.getByRole("button", { name: "패스키로 잠금해제" })
    const registerBtn = page.getByRole("button", { name: "패스키 만들기" })
    try {
        await expect(unlockBtn.or(registerBtn).first()).toBeVisible({
            timeout: 15_000,
        })
    } catch {
        return // 이미 잠금 해제된 상태
    }
    if (await unlockBtn.isVisible()) {
        await unlockBtn.click()
        return
    }
    await page.getByLabel("부트스트랩 토큰").fill("dev")
    await registerBtn.click()
}

async function waitForAssetDashboard(page: Page): Promise<void> {
    await expect(page.getByRole("button", { name: "카테고리" })).toBeVisible({
        timeout: 30_000,
    })
}

function pad2(n: number): string {
    return String(n).padStart(2, "0")
}

/** 이번 달 15일("YYYY-MM-15"). */
function midOfThisMonth(): string {
    const now = new Date()
    return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${DAY}`
}

/** 카테고리 칩(API 로드 후 등장)을 골라 선택 상태를 확인한다. */
async function pickCategory(page: Page, name: string): Promise<void> {
    const chips = page.locator("button.chip")
    await chips.first().waitFor({ state: "visible", timeout: 20_000 })
    const chip = page.locator("button.chip", { hasText: name }).first()
    await chip.click()
    await expect(chip).toHaveAttribute("aria-pressed", "true")
}

/** 달력에서 특정 일자를 선택해 DayDetail(그 날의 지출 목록)을 연다. */
async function selectDay(page: Page, day: number): Promise<void> {
    await page
        .locator("button.cal-cell")
        .filter({
            has: page.locator("span.cal-day", {
                hasText: new RegExp(`^${day}$`),
            }),
        })
        .click()
}

/** 이번 달 15일에 고정 지출 1건(개월 수 지정)을 만들고 대시보드로 돌아온다. */
async function createRecurringExpense(
    page: Page,
    opts: { item: string; category: string; term: string },
): Promise<void> {
    await enterVaultAt(page, "/asset")
    await waitForAssetDashboard(page)
    await page.getByRole("link", { name: "새 지출 추가" }).click()
    await page.waitForURL("**/asset/new", { timeout: 15_000 })

    await page.getByLabel("금액").fill(String(AMOUNT))
    await page.getByLabel("항목").fill(opts.item)
    await page.getByLabel("날짜").fill(midOfThisMonth())
    await pickCategory(page, opts.category)

    await page.getByRole("switch", { name: "고정 지출" }).click()
    const termInput = page.getByLabel("개월 수")
    await expect(termInput).toBeVisible({ timeout: 10_000 })
    await termInput.fill(opts.term)

    await page.getByRole("button", { name: "저장" }).click()
    await page.waitForURL("**/asset", { timeout: 20_000 })
    await waitForAssetDashboard(page)
}

/** 이번 달 15일의 해당 지출을 눌러 수정 화면을 연다. */
async function openExpenseOfThisMonth(page: Page, item: string): Promise<void> {
    await selectDay(page, DAY)
    await page.getByRole("link", { name: new RegExp(item) }).click()
    await page.waitForURL(/\/asset\/[^/]+$/, { timeout: 15_000 })
}

test.describe("고정 지출 수정 — 앞으로만 반영", () => {
    // 회귀 A: 수정 화면이 템플릿의 termMonths 를 읽지 않아 개월 수가 늘 비어 보이던 버그.
    test("수정 화면에 템플릿의 개월 수가 채워져 보인다", async ({ page }) => {
        test.setTimeout(120_000)
        await page.setViewportSize(TALL_VIEWPORT)

        const item = `QA개월수-${Date.now()}`
        await createRecurringExpense(page, {
            item,
            category: CATEGORY_BEFORE,
            term: "6",
        })

        await openExpenseOfThisMonth(page, item)
        await expect(page.getByLabel("개월 수")).toHaveValue("6", {
            timeout: 20_000,
        })
    })

    // 회귀 B: 수정이 이번 달 인스턴스만 고치고 템플릿은 그대로 둬서
    //         다음 달에 옛 제목·옛 카테고리로 뜨던 버그.
    //
    // 미래 달은 인스턴스를 만들지 않는다(열어보기만 해도 DB 에 박히면 저축·투자 누적이 부풀려진다).
    // 대신 템플릿에서 "예정"으로 합성해 화면에만 보여준다 — 링크가 아니라 수정할 수 없다.
    // 따라서 "다음 달에 새 내용으로 보이는가"가 곧 템플릿이 고쳐졌는지의 검증이다.
    test("제목·카테고리 수정이 다음 달 예정분에 반영된다", async ({ page }) => {
        test.setTimeout(180_000)
        await page.setViewportSize(TALL_VIEWPORT)

        const stamp = Date.now()
        const itemBefore = `QA제목-${stamp}`
        const itemAfter = `QA제목수정-${stamp}`

        await createRecurringExpense(page, {
            item: itemBefore,
            category: CATEGORY_BEFORE,
            term: "6",
        })

        // 제목·카테고리만 고쳐 저장(개월 수는 건드리지 않는다).
        await openExpenseOfThisMonth(page, itemBefore)
        await page.getByLabel("항목").fill(itemAfter)
        await pickCategory(page, CATEGORY_AFTER)
        await page.getByRole("button", { name: "저장" }).click()
        await page.waitForURL("**/asset", { timeout: 20_000 })
        await waitForAssetDashboard(page)

        // 다음 달엔 새 제목·새 카테고리의 "예정" 항목이 보여야 한다.
        await page.getByRole("button", { name: "다음 달" }).click()
        await selectDay(page, DAY)

        const nextMonthEntry = page
            .getByText(new RegExp(itemAfter))
            .locator("xpath=ancestor::*[contains(@class,'entry-card')]")
        await expect(nextMonthEntry).toBeVisible({ timeout: 20_000 })
        await expect(nextMonthEntry).toContainText(CATEGORY_AFTER)
        await expect(nextMonthEntry).toContainText("예정")

        // 옛 제목이 남아 있으면 템플릿이 안 고쳐진 것이다.
        await expect(page.getByText(new RegExp(itemBefore))).toHaveCount(0)

        // 예정 항목은 DB 행이 아니라 수정 링크가 없어야 한다(누르면 없는 지출로 들어간다).
        await expect(
            page.getByRole("link", { name: new RegExp(itemAfter) }),
        ).toHaveCount(0)
    })

    // 고정 지출 탭: 등록해 둔 템플릿을 한 곳에 모아 보여준다(읽기 전용).
    // 합계는 볼트당 누적값(이전 실행의 템플릿이 계속 쌓임)이라 총액 대신 행 내용을 검증한다.
    test("고정 지출 탭에 지출명·결제일·개월 수·금액이 보인다", async ({
        page,
    }) => {
        test.setTimeout(120_000)
        await page.setViewportSize(TALL_VIEWPORT)

        const item = `QA탭-${Date.now()}`
        await createRecurringExpense(page, {
            item,
            category: CATEGORY_BEFORE,
            term: "6",
        })

        await page.getByRole("button", { name: "고정 지출" }).click()
        await expect(
            page.getByText("매달 나가는 고정 지출", { exact: true }),
        ).toBeVisible({ timeout: 20_000 })

        // 방금 만든 템플릿 행에 4개 항목이 모두 보인다.
        const row = page.locator(".entry-card").filter({ hasText: item })
        await expect(row).toBeVisible({ timeout: 10_000 })
        await expect(row).toContainText(`매월 ${DAY}일 · 6개월`)
        await expect(row).toContainText(`-₩${AMOUNT.toLocaleString("ko-KR")}`)
    })

    // 회귀 C: PATCH /recurring 이 termMonths 를 받지 않아 개월 수를 고칠 수 없던 버그.
    test("개월 수를 고치면 템플릿에 저장된다", async ({ page }) => {
        test.setTimeout(180_000)
        await page.setViewportSize(TALL_VIEWPORT)

        const item = `QA개월수변경-${Date.now()}`
        await createRecurringExpense(page, {
            item,
            category: CATEGORY_BEFORE,
            term: "6",
        })

        await openExpenseOfThisMonth(page, item)
        await page.getByLabel("개월 수").fill("3")
        await page.getByRole("button", { name: "저장" }).click()
        await page.waitForURL("**/asset", { timeout: 20_000 })
        await waitForAssetDashboard(page)

        await openExpenseOfThisMonth(page, item)
        await expect(page.getByLabel("개월 수")).toHaveValue("3", {
            timeout: 20_000,
        })
    })
})
