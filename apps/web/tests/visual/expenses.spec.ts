// 정기 지출 페이지 시각 회귀.
import { test, expect } from '@playwright/test';

test('expenses renders', async ({ page }) => {
  await page.goto('/expenses');
  await page.waitForLoadState('networkidle');
  await expect(page).toHaveScreenshot('expenses.png');
});
