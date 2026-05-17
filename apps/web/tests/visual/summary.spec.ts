// 합계 페이지 시각 회귀.
import { test, expect } from '@playwright/test';

test('summary renders', async ({ page }) => {
  await page.goto('/summary');
  await page.waitForLoadState('networkidle');
  await expect(page).toHaveScreenshot('summary.png');
});
