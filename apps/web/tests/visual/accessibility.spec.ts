// axe-core 로 5개 페이지의 WCAG AA 위반을 1회 검출한다.
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const PAGES = [
  { name: 'dashboard', url: '/' },
  { name: 'expenses', url: '/expenses' },
  { name: 'expenses-new', url: '/expenses/new' },
  { name: 'expenses-detail-missing', url: '/expenses/missing-id' },
  { name: 'calendar', url: '/calendar' },
  { name: 'summary', url: '/summary' },
  { name: 'vault', url: '/vault' },
  { name: 'vault-new', url: '/vault/new' },
  { name: 'vault-detail-missing', url: '/vault/missing-id' },
  { name: 'vault-categories', url: '/vault/categories' },
  { name: 'vault-backup', url: '/vault/backup' }
];

for (const p of PAGES) {
  test(`${p.name} has no WCAG AA violations`, async ({ page }) => {
    await page.goto(p.url);
    await page.waitForLoadState('networkidle');
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze();
    expect(results.violations).toEqual([]);
  });
}
