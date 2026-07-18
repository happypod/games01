import { defineConfig, devices } from '@playwright/test'

const isCi = Boolean(globalThis.process.env.CI)
const snapshotRoot = globalThis.process.env.IRPG_VISUAL_SNAPSHOT_ROOT
  ?? '{testDir}/__screenshots__/irpg-506'

export default defineConfig({
  testDir: './e2e',
  testMatch: 'visual-regression.spec.ts',
  outputDir: 'test-results/visual',
  snapshotPathTemplate: `${snapshotRoot}/{arg}{ext}`,
  fullyParallel: false,
  forbidOnly: isCi,
  failOnFlakyTests: isCi,
  retries: isCi ? 1 : 0,
  workers: 1,
  reporter: isCi
    ? [['line'], ['html', { open: 'never', outputFolder: 'playwright-report/visual' }]]
    : [['list'], ['html', { open: 'never', outputFolder: 'playwright-report/visual' }]],
  expect: {
    timeout: 5_000,
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
      threshold: 0.15,
      maxDiffPixelRatio: 0.001,
    },
  },
  use: {
    baseURL: 'http://127.0.0.1:4175',
    ...devices['Desktop Chrome'],
    deviceScaleFactor: 1,
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    colorScheme: 'dark',
    serviceWorkers: 'block',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium-visual-ubuntu-24-04',
      use: { ...devices['Desktop Chrome'], deviceScaleFactor: 1 },
    },
  ],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4175 --strictPort',
    url: 'http://127.0.0.1:4175',
    reuseExistingServer: !isCi,
    timeout: 120_000,
  },
})
