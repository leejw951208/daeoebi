// 대시보드 페이지 시각 회귀.
import { test, expect } from '@playwright/test';

test('dashboard renders', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await expect(page).toHaveScreenshot('dashboard.png');
});
