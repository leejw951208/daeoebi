// Playwright visual regression 설정. 5페이지 × 3 viewport 의 스크린샷 baseline 비교.
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/visual',
  fullyParallel: true,
  retries: 0,
  reporter: 'list',
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.01,
      animations: 'disabled'
    }
  },
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'off'
  },
  projects: [
    {
      name: 'mobile-375',
      use: { ...devices['iPhone SE'], viewport: { width: 375, height: 667 } }
    },
    {
      name: 'tablet-768',
      use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 } }
    },
    {
      name: 'desktop-1280',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } }
    }
  ],
  webServer: {
    command: 'pnpm start',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000
  }
});
