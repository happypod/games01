import { expect, test, type Page } from '@playwright/test'

const STARTED_AT = new Date('2026-07-18T03:00:00.000Z')

function collectBrowserErrors(page: Page, errors: string[]) {
  page.on('pageerror', (error) => errors.push(`page: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`)
  })
}

async function spendEnabledButtons(page: Page, panelId: string) {
  const tabName = panelId === 'upgrade-title' ? /^장비/ : panelId === 'skill-title' ? /^스킬/ : null
  if (tabName !== null) {
    const tab = page.getByRole('tab', { name: tabName })
    if (await tab.isVisible()) await tab.click()
  }
  const enabled = page.locator(`section[aria-labelledby="${panelId}"] button:enabled`)
  for (let purchase = 0; purchase < 30 && (await enabled.count()) > 0; purchase += 1) {
    await enabled.first().click()
  }
}

test('representative active play keeps browser UI and progression in sync', async ({
  context,
  page,
}, testInfo) => {
  test.setTimeout(60_000)
  const browserErrors: string[] = []
  collectBrowserErrors(page, browserErrors)
  await context.clock.setFixedTime(STARTED_AT)
  await page.goto('/')
  await expect(page.getByText('● 자동 저장 정상', { exact: true })).toBeVisible()

  for (let second = 5; second <= 60; second += 5) {
    await context.clock.setFixedTime(new Date(STARTED_AT.getTime() + second * 1_000))
    await page.waitForTimeout(300)
    await spendEnabledButtons(page, 'upgrade-title')
    await spendEnabledButtons(page, 'skill-title')
  }

  await expect(page.getByRole('heading', { name: /스테이지 10/ })).toBeVisible()
  await expect(page.locator('.stage-nav span')).toHaveText('최고 10')
  await expect(page.locator('.level-seal')).toHaveText('Lv.3')

  const goldResource = page.locator('.resource-rack > div').filter({ hasText: '골드' })
  await expect(goldResource.locator('strong')).toHaveText('13')

  await page.getByRole('tab', { name: /^장비/ }).click()
  const upgrades = page.getByRole('region', { name: '성장 장비' })
  await expect(upgrades.locator('article').filter({ hasText: '불씨 검' })).toContainText('Lv.3')
  await expect(upgrades.locator('article').filter({ hasText: '수호 갑옷' })).toContainText('Lv.2')
  await expect(upgrades.locator('article').filter({ hasText: '행운 부적' })).toContainText('Lv.0')

  await page.getByRole('tab', { name: /^스킬/ }).click()
  const skills = page.getByRole('region', { name: '스킬 각인' })
  await expect(skills.locator('article').filter({ hasText: '화염 강타' })).toContainText('Rank 3')
  await expect(skills.locator('article').filter({ hasText: '강철 의지' })).toContainText('Rank 0')
  await expect(skills.locator('article').filter({ hasText: '전리품 감각' })).toContainText('Rank 0')
  await expect(page.locator('footer')).toContainText('처치 10 · 패배 1 · 환생 0')
  await expect(page.getByText('● 자동 저장 정상', { exact: true })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('irpg-204-browser.png'), fullPage: true })
  expect(browserErrors).toEqual([])
})
