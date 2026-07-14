/**
 * E2E QA: 저축·투자 탭
 * 세그먼트 전환 → 저축·투자 순자산 노출 → 저축 목표 설정 → 진행률/목표 반영.
 * 쌈짓돈 입금 → 입출금 내역 반영.
 *
 * Auth bypass: dev 환경에서 "패스키로 잠금해제" 클릭 → devUnlock() 호출.
 * `category-crud.spec.ts` 의 enterVaultAt·waitForAssetDashboard·tall viewport
 * 패턴을 그대로 재사용한다.
 *
 * 저축 목표는 볼트당 단일 레코드(덮어쓰기)이므로, 매 실행마다 Date.now() 로
 * 파생된 고유 이름을 사용해 이전 실행과 구분한다. 금액도 새로 저장하므로
 * "목표 ₩<금액>" 텍스트로 정확히 검증할 수 있다(누적 저축액은 이전 테스트
 * 실행에 따라 달라질 수 있어 진행률 % 값 자체는 정확한 수치 대신 존재만 검증한다).
 *
 * 쌈짓돈 잔액도 볼트당 누적값(이전 실행 입출금이 계속 쌓임)이라 총액을
 * 정확히 검증할 수 없다. 대신 이번 실행에서만 쓰는 고유 메모를 부여해
 * "입출금 내역" 목록에서 해당 건이 금액과 함께 나타나는지로 검증한다.
 */

import { test, expect, type Page } from "@playwright/test"

// Unique 적금 계좌 이름(이름이 계좌 식별 앵커라 실행마다 고유해야 함).
const ACCOUNT_NAME = `QA적금-${Date.now()}`
const ACCOUNT_BASE = 200_000
const ACCOUNT_GOAL = 2_000_000
const ACCOUNT_GOAL_FORMATTED = `₩${ACCOUNT_GOAL.toLocaleString("ko-KR")}`

// 투자 포지션은 볼트당 단일 레코드(덮어쓰기)이므로 이전 실행 상태에 기대지 않는다.
// 프리셋(3/5/8/10%)과 겹치지 않는 소수 값을 써서 "저장 전 우연히 같은 값" 가능성을 배제한다.
const RETURN_RATE = "7.3"
const RETURN_RATE_FORMATTED = `+${RETURN_RATE}%`

// 쌈짓돈 잔액은 볼트당 누적값(이전 실행 입출금이 누적)이라 정확한 총액을 검증할 수 없다.
// 대신 이번 실행에서만 쓰는 고유 메모를 "입출금 내역"에서 찾아 입금이 반영됐는지 확인한다.
const BOX_DEPOSIT_MEMO = `QA박스입금-${Date.now()}`
const BOX_DEPOSIT_AMOUNT = 55_000
const BOX_DEPOSIT_AMOUNT_FORMATTED = `+₩${BOX_DEPOSIT_AMOUNT.toLocaleString("ko-KR")}`

// Tall viewport so the bottom sheet never extends above the visible area.
const TALL_VIEWPORT = { width: 1280, height: 2000 }

// ── 월 경계 누적 검증용 ──────────────────────────────────────────────────────
// 적금 계좌의 total 은 base + "전체 기간" 적립이어야 한다(보고 있는 달과 무관).
// 지난 달·이번 달에 각각 적립하고, 이번 달 화면에서 두 달치가 합쳐 보이는지 확인한다.
// 계좌는 base=0 으로 만들어 total 이 온전히 적립분에서만 나오게 한다.
const CARRY_ACCOUNT = `QA누적-${Date.now()}`
const CARRY_GOAL = 1_000_000
const PREV_SAVE = 100_000
const CURR_SAVE = 200_000
const CARRY_TOTAL = PREV_SAVE + CURR_SAVE // 300,000 = 목표의 30%

function pad2(n: number): string {
    return String(n).padStart(2, "0")
}

// 이번 달·지난 달의 15일("YYYY-MM-15"). 15일이라 월 길이와 무관하게 항상 유효하다.
function midOfMonth(monthsAgo: number): string {
    const now = new Date()
    const d = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 15)
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-15`
}

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
    // 대시보드 헤더의 "카테고리" 버튼이 뜨면 보관함이 열리고 대시보드가 렌더된 것이다.
    await expect(page.getByRole("button", { name: "카테고리" })).toBeVisible({
        timeout: 30_000,
    })
}

/** 지출 폼(FAB → /asset/new)으로 지출 1건을 만든다. 날짜를 지정해 과거 달에도 넣을 수 있다. */
async function addExpense(
    page: Page,
    opts: { amount: number; item: string; date: string; category: string },
): Promise<void> {
    await enterVaultAt(page, "/asset")
    await waitForAssetDashboard(page)
    await page.getByRole("link", { name: "새 지출 추가" }).click()
    await page.waitForURL("**/asset/new", { timeout: 15_000 })

    await page.getByLabel("금액").fill(String(opts.amount))
    await page.getByLabel("항목").fill(opts.item)
    await page.getByLabel("날짜").fill(opts.date)

    // 카테고리 칩이 API 로 로드된 뒤 해당 칩을 고른다.
    const chips = page.locator("button.chip")
    await chips.first().waitFor({ state: "visible", timeout: 20_000 })
    const chip = page.locator("button.chip", { hasText: opts.category }).first()
    await chip.click()
    await expect(chip).toHaveAttribute("aria-pressed", "true")

    await page.getByRole("button", { name: "저장" }).click()
    await page.waitForURL("**/asset", { timeout: 20_000 })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe.serial("저축·투자 탭", () => {
    test("세그먼트 전환 → 저축·투자 순자산·카드 노출", async ({ page }) => {
        test.setTimeout(120_000)
        await page.setViewportSize(TALL_VIEWPORT)

        await enterVaultAt(page, "/asset")
        await waitForAssetDashboard(page)

        // ── 세그먼트 전환 → 저축·투자 뷰 ──
        await page.getByRole("button", { name: "저축·투자" }).click()
        await expect(
            page.getByText("저축·투자 순자산", { exact: true }),
        ).toBeVisible({ timeout: 20_000 })
        // 쌈짓돈 카드도 함께 렌더된다(저축·투자 뷰 구성 확인).
        await expect(page.getByText("쌈짓돈", { exact: true })).toBeVisible({
            timeout: 10_000,
        })
    })

    test("적금 계좌 추가 → 적금 목록에 이름·목표 진행률 반영", async ({
        page,
    }) => {
        test.setTimeout(120_000)
        await page.setViewportSize(TALL_VIEWPORT)

        await enterVaultAt(page, "/asset")
        await waitForAssetDashboard(page)

        // ── 세그먼트 전환 ──
        await page.getByRole("button", { name: "저축·투자" }).click()
        await expect(
            page.getByText("저축·투자 순자산", { exact: true }),
        ).toBeVisible({ timeout: 20_000 })

        // ── "+ 적금 추가" 로 시트 열기 ──
        await page.getByRole("button", { name: "+ 적금 추가" }).click()

        const sheet = page.getByRole("dialog", { name: "적금 추가" })
        await expect(sheet).toBeVisible({ timeout: 10_000 })

        // ── 이름·현재 저축액·목표 금액 입력 후 저장 ──
        await sheet.getByLabel("적금 이름").fill(ACCOUNT_NAME)
        await sheet.getByLabel("현재 저축액").fill(String(ACCOUNT_BASE))
        await sheet.getByLabel("목표 금액").fill(String(ACCOUNT_GOAL))
        await sheet.getByRole("button", { name: "적금 추가" }).click()

        await expect(sheet).toBeHidden({ timeout: 10_000 })

        // ── 적금 목록에 이름·목표 진행률 반영 확인 ──
        const accountCard = page.getByRole("button", {
            name: new RegExp(ACCOUNT_NAME),
        })
        await expect(accountCard).toBeVisible({ timeout: 10_000 })
        await expect(
            accountCard.getByText(`목표 ${ACCOUNT_GOAL_FORMATTED}`, {
                exact: false,
            }),
        ).toBeVisible()
        await expect(accountCard.getByText(/^\d+%$/)).toBeVisible()
    })

    test("수익률 입력 → 저장 → 카드에 수익률 반영", async ({ page }) => {
        test.setTimeout(120_000)
        await page.setViewportSize(TALL_VIEWPORT)

        await enterVaultAt(page, "/asset")
        await waitForAssetDashboard(page)

        // ── 세그먼트 전환 ──
        await page.getByRole("button", { name: "저축·투자" }).click()
        await expect(
            page.getByText("저축·투자 순자산", { exact: true }),
        ).toBeVisible({ timeout: 20_000 })

        // ── "투자 수익률" 카드 탭하여 시트 열기 ──
        const investCard = page.getByRole("button", { name: "투자 수익률" })
        await expect(investCard).toBeVisible({ timeout: 10_000 })
        await investCard.click()

        const sheet = page.getByRole("dialog", { name: "투자 수익률" })
        await expect(sheet).toBeVisible({ timeout: 10_000 })

        // ── 수익률만 입력 후 저장(투자 원금은 이 시트에서 더 이상 수정하지 않는다) ──
        await sheet.getByLabel("투자 수익률(%)").fill(RETURN_RATE)
        await sheet.getByRole("button", { name: "저장" }).click()

        await expect(sheet).toBeHidden({ timeout: 10_000 })

        // ── 수익률(%)이 카드에 반영됐는지 확인 ──
        await expect(
            investCard.getByText(RETURN_RATE_FORMATTED, { exact: true }),
        ).toBeVisible({ timeout: 10_000 })
    })

    test("쌈짓돈 입금 → 입출금 내역에 반영", async ({ page }) => {
        test.setTimeout(120_000)
        await page.setViewportSize(TALL_VIEWPORT)

        await enterVaultAt(page, "/asset")
        await waitForAssetDashboard(page)

        // ── 세그먼트 전환 ──
        await page.getByRole("button", { name: "저축·투자" }).click()
        await expect(
            page.getByText("저축·투자 순자산", { exact: true }),
        ).toBeVisible({ timeout: 20_000 })

        // ── 쌈짓돈 카드의 "입금" 버튼으로 시트 열기 ──
        await page.getByRole("button", { name: "입금", exact: true }).click()

        const sheet = page.getByRole("dialog", { name: "쌈짓돈 입금" })
        await expect(sheet).toBeVisible({ timeout: 10_000 })

        // ── 금액·메모 입력 후 저장 ──
        await sheet.getByLabel("금액").fill(String(BOX_DEPOSIT_AMOUNT))
        await sheet.getByLabel("메모").fill(BOX_DEPOSIT_MEMO)
        await sheet
            .getByRole("button", { name: "입금 기록", exact: true })
            .click()

        await expect(sheet).toBeHidden({ timeout: 10_000 })

        // ── "입출금 내역 보기" 로 내역 시트 열기 ──
        await page.getByRole("button", { name: "입출금 내역 보기" }).click()

        const detailSheet = page.getByRole("dialog", {
            name: "쌈짓돈 내역",
        })
        await expect(detailSheet).toBeVisible({ timeout: 10_000 })

        // ── 방금 입금한 건이 내역에 반영됐는지 확인 ──
        // (잔액·금액은 볼트당 누적값이라 이전 실행에서 같은 금액(55,000)의
        // 다른 건이 남아 있을 수 있다. 고유 메모가 같은 행에 금액과 함께
        // 있는지로 좁혀 검증해야 strict-mode 충돌 없이 결정적으로 확인된다.)
        await expect(
            detailSheet.getByText(BOX_DEPOSIT_MEMO, { exact: true }),
        ).toBeVisible({ timeout: 10_000 })
        const depositRow = detailSheet
            .locator("div")
            .filter({ hasText: BOX_DEPOSIT_MEMO })
            .filter({ hasText: BOX_DEPOSIT_AMOUNT_FORMATTED })
            .last()
        await expect(depositRow).toBeVisible({ timeout: 10_000 })
    })

    // 회귀: 적금 총액이 "이번 달" 적립만 반영해 매달 리셋되던 버그.
    // 지난 달 적립분이 이번 달 화면에서 사라지면 목표 진행률도 매달 0%로 되돌아간다.
    test("지난 달 적립분이 이번 달 저축 총액에 누적된다", async ({ page }) => {
        test.setTimeout(180_000)
        await page.setViewportSize(TALL_VIEWPORT)

        // ── base=0 인 적금 계좌 생성(총액이 적립분에서만 나오도록) ──
        await enterVaultAt(page, "/asset")
        await waitForAssetDashboard(page)
        await page.getByRole("button", { name: "저축·투자" }).click()
        await expect(
            page.getByText("저축·투자 순자산", { exact: true }),
        ).toBeVisible({ timeout: 20_000 })

        await page.getByRole("button", { name: "+ 적금 추가" }).click()
        const sheet = page.getByRole("dialog", { name: "적금 추가" })
        await expect(sheet).toBeVisible({ timeout: 10_000 })
        await sheet.getByLabel("적금 이름").fill(CARRY_ACCOUNT)
        await sheet.getByLabel("현재 저축액").fill("0")
        await sheet.getByLabel("목표 금액").fill(String(CARRY_GOAL))
        await sheet.getByRole("button", { name: "적금 추가" }).click()
        await expect(sheet).toBeHidden({ timeout: 10_000 })

        // ── 지난 달·이번 달에 저축 지출 1건씩(item = 계좌명이 연동 앵커) ──
        await addExpense(page, {
            amount: PREV_SAVE,
            item: CARRY_ACCOUNT,
            date: midOfMonth(1),
            category: "저축",
        })
        await addExpense(page, {
            amount: CURR_SAVE,
            item: CARRY_ACCOUNT,
            date: midOfMonth(0),
            category: "저축",
        })

        // ── 이번 달 화면에서 두 달치가 합산돼 보여야 한다 ──
        await enterVaultAt(page, "/asset")
        await waitForAssetDashboard(page)
        await page.getByRole("button", { name: "저축·투자" }).click()
        await expect(
            page.getByText("저축·투자 순자산", { exact: true }),
        ).toBeVisible({ timeout: 20_000 })

        const card = page.getByRole("button", {
            name: new RegExp(CARRY_ACCOUNT),
        })
        await expect(card).toBeVisible({ timeout: 10_000 })

        // 총액 = 지난 달 + 이번 달 (버그 시절엔 이번 달치만 잡혔다).
        await expect(card).toContainText(
            `₩${CARRY_TOTAL.toLocaleString("ko-KR")}`,
        )
        // 목표 진행률도 누적 기준 (300,000 / 1,000,000 = 30%).
        await expect(card).toContainText("30%")
        // "+금액" 배지도 누적 적립분이다(base=0 이라 총액과 같은 값).
        await expect(card).toContainText(
            `+₩${CARRY_TOTAL.toLocaleString("ko-KR")}`,
        )
    })
})
