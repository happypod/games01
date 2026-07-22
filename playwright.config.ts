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
  // Keep local full-suite runs deterministic on developer machines while CI
  // remains serialized for the canonical visual and accessibility gates.
  workers: isCi ? 1 : 2,
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
