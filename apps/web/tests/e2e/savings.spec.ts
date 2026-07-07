/**
 * E2E QA: 저축·투자 탭
 * 세그먼트 전환 → 저축·투자 순자산 노출 → 저축 목표 설정 → 진행률/목표 반영.
 *
 * Auth bypass: dev 환경에서 "패스키로 잠금해제" 클릭 → devUnlock() 호출.
 * `category-crud.spec.ts` 의 enterVaultAt·waitForAssetDashboard·tall viewport
 * 패턴을 그대로 재사용한다.
 *
 * 저축 목표는 볼트당 단일 레코드(덮어쓰기)이므로, 매 실행마다 Date.now() 로
 * 파생된 고유 이름을 사용해 이전 실행과 구분한다. 금액도 새로 저장하므로
 * "목표 ₩<금액>" 텍스트로 정확히 검증할 수 있다(누적 저축액은 이전 테스트
 * 실행에 따라 달라질 수 있어 진행률 % 값 자체는 정확한 수치 대신 존재만 검증한다).
 */

import { test, expect, type Page } from "@playwright/test"

// Unique goal name fixed at module load time.
const GOAL_NAME = `QA저축목표-${Date.now()}`
const GOAL_AMOUNT = 1_000_000
const GOAL_AMOUNT_FORMATTED = `₩${GOAL_AMOUNT.toLocaleString("ko-KR")}`

// Unique 적금 계좌 이름(이름이 계좌 식별 앵커라 실행마다 고유해야 함).
const ACCOUNT_NAME = `QA적금-${Date.now()}`
const ACCOUNT_BASE = 200_000
const ACCOUNT_GOAL = 2_000_000
const ACCOUNT_GOAL_FORMATTED = `₩${ACCOUNT_GOAL.toLocaleString("ko-KR")}`

// 투자 포지션은 볼트당 단일 레코드(덮어쓰기)이므로 이전 실행 상태에 기대지 않는다.
// 프리셋(3/5/8/10%)과 겹치지 않는 소수 값을 써서 "저장 전 우연히 같은 값" 가능성을 배제한다.
const RETURN_RATE = "7.3"
const RETURN_RATE_FORMATTED = `+${RETURN_RATE}%`

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

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe.serial("저축·투자 탭", () => {
    test("세그먼트 전환 → 순자산 노출 → 저축 목표 설정 → 진행률/목표 반영", async ({
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

        // ── 저축 목표 카드 열기 (설정 전엔 "설정하기" 라벨) ──
        const goalCardBefore = page.getByRole("button", {
            name: /저축 목표/,
        })
        await expect(goalCardBefore).toBeVisible({ timeout: 10_000 })

        await goalCardBefore.click()

        const sheet = page.getByRole("dialog", { name: "저축 목표 설정" })
        await expect(sheet).toBeVisible({ timeout: 10_000 })

        // ── 이름·금액 입력 후 저장 ──
        await sheet.getByLabel("저축 목표 이름").fill(GOAL_NAME)
        await sheet.getByLabel("저축 목표 금액").fill(String(GOAL_AMOUNT))
        await sheet.getByRole("button", { name: "저장" }).click()

        await expect(sheet).toBeHidden({ timeout: 10_000 })

        // ── 진행률/목표 반영 확인 ──
        const goalCardAfter = page.getByRole("button", {
            name: new RegExp(`저축 목표 · ${GOAL_NAME}`),
        })
        await expect(goalCardAfter).toBeVisible({ timeout: 10_000 })
        await expect(
            goalCardAfter.getByText(`목표 ${GOAL_AMOUNT_FORMATTED}`),
        ).toBeVisible()
        // 설정 완료 후엔 "설정하기" 대신 진행률(%) 이 노출된다.
        await expect(goalCardAfter.getByText("설정하기")).toBeHidden()
        await expect(goalCardAfter.getByText(/^\d+%$/)).toBeVisible()
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

    test("투자 수익률 입력 → 저장 → 카드에 수익률 반영", async ({ page }) => {
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

        // ── 수익률 입력 후 저장 ──
        await sheet.getByLabel("투자 수익률(%)").fill(RETURN_RATE)
        await sheet.getByRole("button", { name: "저장" }).click()

        await expect(sheet).toBeHidden({ timeout: 10_000 })

        // ── 카드에 반영된 수익률(%) 확인(포지션은 볼트당 단일 레코드이므로
        // 이전 실행 값이 아닌, 방금 저장한 값이 정확히 표시되는지로 검증한다) ──
        await expect(
            investCard.getByText(RETURN_RATE_FORMATTED, { exact: true }),
        ).toBeVisible({ timeout: 10_000 })
    })
})
