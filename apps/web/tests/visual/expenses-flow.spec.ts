// 정기 지출 라우트 분리 흐름 회귀 테스트. /expenses 목록 → /expenses/new 폼 진입.
import { test, expect } from '@playwright/test';

test('expenses list does not render inline form and links to /expenses/new', async ({ page }) => {
  await page.goto('/expenses');
  await page.waitForLoadState('networkidle');

  await expect(page.getByRole('heading', { name: '새 정기 지출' })).toHaveCount(0);

  const addLink = page.getByRole('link', { name: /추가/ }).first();
  await expect(addLink).toBeVisible();
  await addLink.click();

  await expect(page).toHaveURL(/\/expenses\/new$/);
  await expect(page.getByRole('heading', { name: '새 정기 지출' })).toBeVisible();
});
