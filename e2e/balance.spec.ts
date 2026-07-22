import { expect, test, type Page } from '@playwright/test'

const STARTED_AT = new Date('2026-07-18T03:00:00.000Z')

function collectBrowserErrors(page: Page, errors: string[]) {
  page.on('pageerror', (error) => errors.push(`page: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`)
  })
}

async function spendAvailableSlots(page: Page, slotIds: readonly string[]) {
  const actionBar = page.getByRole('region', { name: '전술 명령 빠른 슬롯' })

  for (let purchase = 0; purchase < 30; purchase += 1) {
    let spent = false

    for (const slotId of slotIds) {
      const detail = actionBar.locator(`[data-action-detail="${slotId}"]`)
      if (!(await detail.isVisible())) {
        await actionBar.locator(`[data-action-slot="${slotId}"]`).click()
      }

      const action = detail.locator('.tactical-action-bar__detail-action')
      if (await action.isEnabled()) {
        await action.click()
        spent = true
        break
      }

      await detail.getByRole('button', { name: /상세 닫기$/ }).click()
    }

    if (!spent) break
  }

  const openDetail = actionBar.locator('[data-action-detail]')
  if (await openDetail.isVisible()) {
    await openDetail.getByRole('button', { name: /상세 닫기$/ }).click()
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
    await spendAvailableSlots(page, ['weapon', 'armor', 'charm'])
    await spendAvailableSlots(page, ['powerStrike', 'ironWill', 'fortune'])
  }

  await expect(page.getByRole('heading', { name: /스테이지 10/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /스테이지 10.*현재 위치/ }))
    .toHaveAttribute('aria-current', 'step')
  await expect(page.locator('.tactical-actor--hero .tactical-actor__copy > span'))
    .toContainText('Lv. 3')

  const goldResource = page.locator('.resource-rack > div').filter({ hasText: '골드' })
  await expect(goldResource.locator('strong')).toHaveText('13')

  await page.getByRole('tab', { name: '가방' }).click()
  const upgrades = page.locator('[data-intel-panel="inventory"]')
  await expect(upgrades.locator('article').filter({ hasText: '불씨 검' })).toContainText('Lv.3')
  await expect(upgrades.locator('article').filter({ hasText: '수호 갑옷' })).toContainText('Lv.2')
  await expect(upgrades.locator('article').filter({ hasText: '행운 부적' })).toContainText('Lv.0')

  await page.getByRole('tab', { name: '스킬' }).click()
  const skills = page.locator('[data-intel-panel="skills"]')
  await expect(skills.locator('[data-skill-id="powerStrike"]')).toContainText('Rank 3')
  await expect(skills.locator('[data-skill-id="ironWill"]')).toContainText('Rank 0')
  await expect(skills.locator('[data-skill-id="fortune"]')).toContainText('Lv.5 해금')
  await expect(page.locator('footer')).toContainText('처치 10 · 패배 1 · 환생 0')
  await expect(page.getByText('● 자동 저장 정상', { exact: true })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('irpg-204-browser.png'), fullPage: true })
  expect(browserErrors).toEqual([])
})
