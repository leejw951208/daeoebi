// 정기 지출 [id] 라우트 시각 회귀. 백엔드 데이터가 없으면 404 fallback 으로 안정.
import { test, expect } from '@playwright/test';

test('expenses detail route renders (missing/loaded)', async ({ page }) => {
  await page.goto('/expenses/missing-id');
  await page.waitForLoadState('networkidle');
  await expect(page).toHaveScreenshot('expenses-detail.png');
});
