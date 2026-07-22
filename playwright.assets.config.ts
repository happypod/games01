import { defineConfig, devices } from '@playwright/test'

const isCi = Boolean(globalThis.process.env.CI)

export default defineConfig({
  testDir: './e2e',
  testMatch: 'assets-cold-load.spec.ts',
  outputDir: 'test-results/assets-cold-load',
  fullyParallel: false,
  forbidOnly: isCi,
  failOnFlakyTests: isCi,
  retries: isCi ? 1 : 0,
  workers: 1,
  reporter: isCi
    ? [['line'], ['html', { open: 'never', outputFolder: 'playwright-report/assets-cold-load' }]]
    : [['list'], ['html', { open: 'never', outputFolder: 'playwright-report/assets-cold-load' }]],
  expect: {
    timeout: 5_000,
  },
  use: {
    baseURL: 'http://127.0.0.1:4174',
    ...devices['Desktop Chrome'],
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    serviceWorkers: 'block',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium-cold-load',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'node tools/assets/serve-dist.mjs',
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: false,
    timeout: 30_000,
  },
})
