// 정기 지출 신규 라우트 시각 회귀.
import { test, expect } from '@playwright/test';

test('expenses new route renders empty form', async ({ page }) => {
  await page.goto('/expenses/new');
  await page.waitForLoadState('networkidle');
  await expect(page).toHaveScreenshot('expenses-new.png');
});
