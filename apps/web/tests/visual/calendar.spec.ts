// 캘린더 페이지 시각 회귀.
import { test, expect } from '@playwright/test';

test('calendar renders', async ({ page }) => {
  await page.goto('/calendar');
  await page.waitForLoadState('networkidle');
  await expect(page).toHaveScreenshot('calendar.png');
});
