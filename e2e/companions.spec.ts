import { expect, test, type Page } from '@playwright/test'
import { getEnemyDefinition } from '../src/game/content'
import { advanceGame, createInitialState, recruitCompanion } from '../src/game/engine'
import { deriveLegacyExpeditionMilestoneMask } from '../src/game/expedition'
import { SAVE_FORMAT_VERSION, SAVE_SLOT_A_KEY } from '../src/game/persistence'

const STARTED_AT = new Date('2026-07-18T06:00:00.000Z')

function collectBrowserErrors(page: Page, errors: string[]) {
  page.on('pageerror', (error) => errors.push(`page: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`)
  })
}

test.use({ viewport: { width: 360, height: 800 } })

test('첫 보스 뒤 동료를 영입·훈련하고 협공과 저장을 확인한다', async ({
  context,
  page,
}) => {
  const browserErrors: string[] = []
  collectBrowserErrors(page, browserErrors)
  await context.clock.setFixedTime(STARTED_AT)

  const seeded = createInitialState(STARTED_AT.getTime(), 0x108108)
  seeded.player.gold = 300
  seeded.battle.stage = 11
  seeded.battle.highestStage = 11
  seeded.battle.enemyHp = getEnemyDefinition(11).maxHp
  seeded.expeditionEvents = {
    ...seeded.expeditionEvents,
    milestoneMask: deriveLegacyExpeditionMilestoneMask(seeded.battle.highestStage),
  }
  const serialized = JSON.stringify({
    formatVersion: SAVE_FORMAT_VERSION,
    revision: 1,
    savedAt: seeded.lastSavedAt,
    state: seeded,
  })
  await page.addInitScript(
    ({ key, value }) => window.localStorage.setItem(key, value),
    { key: SAVE_SLOT_A_KEY, value: serialized },
  )
  await page.goto('/')
  await expect(page.getByText('● 자동 저장 정상', { exact: true })).toBeVisible()

  const panel = page.getByRole('region', { name: '동료 원정대' })
  const recruit = panel.getByRole('button', { name: '불씨 여우 루미 영입, 무료' })
  await expect(recruit).toBeEnabled()
  await recruit.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByText('불씨 여우 루미가 원정에 합류했습니다.', { exact: true })).toBeVisible()

  const trainRankOne = panel.getByRole('button', {
    name: '불씨 여우 루미 훈련, 비용 100 골드',
  })
  await expect(trainRankOne).toBeFocused()
  const battleCompanion = page.locator('.tactical-companion')
  await expect(battleCompanion).toContainText('불씨 여우 루미')
  await expect(battleCompanion).toContainText('Rank 1')
  await expect(battleCompanion).toContainText('협공 2')

  const recruited = recruitCompanion(seeded, 'emberFox')
  expect(recruited.success).toBe(true)
  const afterOneRound = advanceGame(recruited.state, 1_000).state
  await context.clock.setFixedTime(new Date(STARTED_AT.getTime() + 1_000))
  await page.waitForTimeout(300)
  await expect(page.getByRole('progressbar', { name: '적 체력' })).toHaveAttribute(
    'aria-valuenow',
    String(afterOneRound.battle.enemyHp),
  )

  await trainRankOne.click()
  await expect(page.getByText('불씨 여우 루미 랭크 상승', { exact: true })).toBeVisible()
  await expect(battleCompanion).toContainText('Rank 2')
  await expect(battleCompanion).toContainText('협공 3')
  await expect(
    page.getByLabel('보유 자원').locator('div').filter({ hasText: '골드' }).locator('strong'),
  ).toHaveText('200')

  await page.reload()
  await expect(page.locator('.tactical-companion')).toContainText('Rank 2')
  await expect(page.locator('.tactical-companion')).toContainText('협공 3')
  const writerTrain = page.getByRole('region', { name: '동료 원정대' }).getByRole('button', {
    name: '불씨 여우 루미 훈련, 비용 180 골드',
  })
  await expect(writerTrain).toBeEnabled()

  const reader = await context.newPage()
  collectBrowserErrors(reader, browserErrors)
  await reader.goto('/')
  await expect(reader.getByText('● 읽기 전용', { exact: true })).toBeVisible()
  await expect(
    reader.getByRole('region', { name: '동료 원정대' }).getByRole('button', {
      name: '불씨 여우 루미 훈련, 비용 180 골드',
    }),
  ).toBeDisabled()

  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth)
  expect(browserErrors).toEqual([])
})

test('오프라인 협공 보고를 한 번만 표시한다', async ({ context, page }) => {
  const browserErrors: string[] = []
  collectBrowserErrors(page, browserErrors)
  await context.clock.setFixedTime(STARTED_AT)

  const savedAt = STARTED_AT.getTime() - 60_000
  const seeded = createInitialState(savedAt, 0x108109)
  seeded.player.companion = { id: 'emberFox', rank: 1 }
  const serialized = JSON.stringify({
    formatVersion: SAVE_FORMAT_VERSION,
    revision: 1,
    savedAt,
    state: seeded,
  })
  await page.addInitScript(
    ({ key, value }) => window.localStorage.setItem(key, value),
    { key: SAVE_SLOT_A_KEY, value: serialized },
  )
  await page.goto('/')

  const report = page.getByRole('dialog', {
    name: '쉬는 동안에도 검은 멈추지 않았습니다',
  })
  await expect(report).toBeVisible()
  await expect(
    report.locator('dl > div').filter({ hasText: '동료 협공' }).locator('dd'),
  ).not.toHaveText('0')
  await expect(
    report.locator('dl > div').filter({ hasText: '동료 피해' }).locator('dd'),
  ).not.toHaveText('0')

  await report.getByRole('button', { name: '보상 확인' }).click()
  await page.reload()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.locator('.tactical-companion')).toContainText('불씨 여우 루미')
  expect(browserErrors).toEqual([])
})
