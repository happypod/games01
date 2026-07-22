import { expect, test, type Page } from '@playwright/test'
import { getEnemyDefinition } from '../src/game/content'
import { createInitialState } from '../src/game/engine'
import { deriveLegacyExpeditionMilestoneMask } from '../src/game/expedition'
import { getHeroStats } from '../src/game/formulas'
import {
  SAVE_FORMAT_VERSION,
  SAVE_SLOT_A_KEY,
  SAVE_SLOT_B_KEY,
} from '../src/game/persistence'
import type { GameState } from '../src/game/types'

const STARTED_AT = new Date('2026-07-22T01:00:00.000Z')
const HEALING_POTION_CRAFT_MS = 2 * 60_000

interface StoredEnvelope {
  revision: number
  state: GameState
}

function collectBrowserErrors(page: Page, errors: string[]) {
  page.on('pageerror', (error) => errors.push(`page: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`)
  })
}

async function readLatestStoredState(page: Page): Promise<GameState> {
  return page.evaluate(([slotA, slotB]) => {
    const envelopes = [slotA, slotB]
      .map((key) => window.localStorage.getItem(key))
      .filter((raw): raw is string => raw !== null)
      .map((raw) => JSON.parse(raw) as StoredEnvelope)
      .sort((left, right) => right.revision - left.revision)
    const latest = envelopes[0]
    if (latest === undefined) throw new Error('저장된 게임 상태가 없습니다.')
    return latest.state
  }, [SAVE_SLOT_A_KEY, SAVE_SLOT_B_KEY] as const)
}

test('IRPG-423/424 heals, crafts and equips a potion, then consumes it from the tactical slot', async ({
  context,
  page,
}) => {
  test.setTimeout(60_000)
  const browserErrors: string[] = []
  collectBrowserErrors(page, browserErrors)
  await context.clock.setFixedTime(STARTED_AT)

  const seeded = createInitialState(STARTED_AT.getTime(), 0x4234_2424)
  const enemy = getEnemyDefinition(10)
  const maximumHp = getHeroStats(seeded).maxHp
  seeded.currentMode = 'CAMP'
  seeded.player.currentHp = 40
  seeded.battle.stage = enemy.stage
  seeded.battle.highestStage = enemy.stage
  seeded.battle.enemyHp = enemy.maxHp
  seeded.expeditionEvents = {
    ...seeded.expeditionEvents,
    milestoneMask: deriveLegacyExpeditionMilestoneMask(enemy.stage),
  }
  seeded.camp.materials = { ashShard: 10, beastHide: 10, emberCore: 0 }
  seeded.camp.consumables.healingPotion = 0
  seeded.camp.quickConsumable = null

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
  await expect(page.getByTestId('camp-dashboard')).toBeVisible()

  const heroHealth = page.getByRole('progressbar', { name: '영웅 체력' })
  await expect(heroHealth).toHaveAttribute('aria-valuenow', '40')
  const healingButton = page.getByRole('button', {
    name: '치유 화로 · 재의 파편 3개로 완전 회복',
  })
  await healingButton.click()
  await expect(heroHealth).toHaveAttribute('aria-valuenow', String(maximumHp))
  await expect(page.locator('.notice-strip'))
    .toContainText('재의 파편 3개로 체력을 완전히 회복했습니다.')

  const materials = page.getByLabel('보유 제작 재료')
  await expect(materials.locator('div').filter({ hasText: '재의 파편' }).locator('dd'))
    .toHaveText('7')

  const potionRecipe = page.locator('.camp-recipe-card').filter({ hasText: '회복 물약' })
  await potionRecipe.getByRole('button', { name: '회복 물약 제작' }).click()
  await expect(page.getByText('회복 물약 제작 중', { exact: true })).toBeVisible()
  await context.clock.setFixedTime(
    new Date(STARTED_AT.getTime() + HEALING_POTION_CRAFT_MS),
  )
  await expect(page.getByText('회복 물약 제작 중', { exact: true })).toHaveCount(0)
  await expect(page.getByText('회복 물약 ×1', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: '회복 물약 빠른 슬롯 장착' }).click()
  await expect(page.getByRole('button', { name: '회복 물약 빠른 슬롯 장착 해제' }))
    .toHaveAttribute('aria-pressed', 'true')
  let stored = await readLatestStoredState(page)
  expect(stored.camp.quickConsumable).toBe('healingPotion')
  expect(stored.camp.consumables.healingPotion).toBe(1)
  expect(stored.camp.materials).toEqual({ ashShard: 3, beastHide: 8, emberCore: 0 })

  await page.getByRole('radio', { name: '전투 · 전술 전장' }).click()
  await expect(page.getByTestId('tactical-layout')).toBeVisible()

  await page.getByRole('tab', { name: '가방' }).click()
  const inventoryPanel = page.locator('[data-intel-panel="inventory"]')
  await expect(inventoryPanel).toBeVisible()
  await expect(inventoryPanel.getByText('회복 물약 ×1', { exact: true })).toBeVisible()
  const potionInventoryItem = inventoryPanel.locator('[data-consumable-id="healingPotion"]')
  const equipToggle = potionInventoryItem.getByRole('button')
  await expect(equipToggle).toHaveAttribute('aria-pressed', 'true')
  await equipToggle.click()
  await expect(equipToggle).toHaveAttribute('aria-pressed', 'false')
  await expect(page.locator('[data-action-slot="quickConsumable"]')).toContainText('미장착')
  await equipToggle.click()
  await expect(equipToggle).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('[data-action-slot="quickConsumable"]')).toContainText('보유 1')

  await context.clock.setFixedTime(
    new Date(STARTED_AT.getTime() + HEALING_POTION_CRAFT_MS + 1_000),
  )
  await expect(heroHealth).toHaveAttribute('aria-valuenow', String(maximumHp - enemy.attack))

  await page.locator('[data-action-slot="quickConsumable"]').click()
  await page.getByRole('button', { name: '회복 물약 사용' }).click()
  await expect(heroHealth).toHaveAttribute('aria-valuenow', String(maximumHp))
  await expect(page.locator('[data-action-slot="quickConsumable"]')).toContainText('보유 0')
  await expect(page.locator('.tactical-canvas__status'))
    .toContainText(`회복 물약으로 체력을 ${enemy.attack} 회복했습니다.`)

  stored = await readLatestStoredState(page)
  expect(stored.player.currentHp).toBe(maximumHp)
  expect(stored.camp.quickConsumable).toBe('healingPotion')
  expect(stored.camp.consumables.healingPotion).toBe(0)
  expect(browserErrors).toEqual([])
})
