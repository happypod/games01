import { defineConfig, devices } from '@playwright/test'

const isCi = Boolean(process.env.CI)
const browserChannel = process.env.PLAYWRIGHT_CHANNEL as 'chrome' | 'msedge' | undefined

export default defineConfig({
  testDir: './e2e',
  testIgnore: ['assets-cold-load.spec.ts', 'visual-regression.spec.ts'],
  outputDir: 'test-results',
  fullyParallel: true,
  forbidOnly: isCi,
  failOnFlakyTests: isCi,
  retries: isCi ? 1 : 0,
  // Serialize the stateful clock, storage, and accessibility flows locally and
  // in CI so browser startup contention cannot consume per-test timeouts.
  workers: 1,
  reporter: isCi
    ? [['line'], ['html', { open: 'never', outputFolder: 'playwright-report' }]]
    : [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  expect: {
    timeout: 5_000,
  },
  use: {
    baseURL: 'http://127.0.0.1:4173',
    ...devices['Desktop Chrome'],
    ...(browserChannel ? { channel: browserChannel } : {}),
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !isCi,
    timeout: 120_000,
  },
})
