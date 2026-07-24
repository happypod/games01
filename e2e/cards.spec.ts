import { expect, test, type Locator, type Page } from '@playwright/test'

const STARTED_AT = new Date('2026-07-18T08:00:00.000Z')
const CARD_FILE_PATTERN = /\/(?:equipment-(?:ember-blade|guard-armor|fortune-charm)|skill-(?:power-strike|iron-will|loot-sense))[^/]*\.webp(?:\?.*)?$/
const PROGRESSION_SLOT_IDS = [
  'weapon',
  'armor',
  'charm',
  'powerStrike',
  'ironWill',
  'fortune',
] as const
const CARD_ASSET_IDS = [
  'equipment.ember-blade',
  'equipment.guard-armor',
  'equipment.fortune-charm',
  'skill.power-strike',
  'skill.iron-will',
  'skill.loot-sense',
] as const

test.describe.configure({ mode: 'serial', timeout: 60_000 })

async function openMixedCardFixture(page: Page): Promise<Locator> {
  await page.goto('/')
  await expect(page.getByText('● 자동 저장 정상', { exact: true })).toBeVisible()
  page.once('dialog', (dialog) => void dialog.accept())
  await page.getByRole('button', { name: '개발자 패널' }).click()

  const panel = page.getByTestId('debug-panel')
  await expect(panel).toBeVisible()
  await panel.getByLabel('시각 회귀 fixture').selectOption('visual.cards.mixed-states')
  await panel.getByRole('button', { name: 'fixture 적용' }).click()
  await expect(page.getByTestId('visual-fixture-root')).toHaveAttribute(
    'data-visual-fixture-id',
    'visual.cards.mixed-states',
  )
  await expect(page.getByRole('region', { name: '전술 명령 빠른 슬롯' })).toBeVisible()
  return panel
}

function actionBar(page: Page) {
  return page.getByRole('region', { name: '전술 명령 빠른 슬롯' })
}

function slot(page: Page, id: string) {
  return actionBar(page).locator(`[data-action-slot="${id}"]`)
}

async function openDetail(page: Page, id: string) {
  const detail = actionBar(page).locator(`[data-action-detail="${id}"]`)
  if (!(await detail.isVisible())) await slot(page, id).click()
  await expect(detail).toBeVisible()
  return detail
}

async function expectAllQuickSlotArt(page: Page, state: 'loaded' | 'fallback' = 'loaded') {
  const assets = actionBar(page).locator(
    '[data-action-kind="equipment"] .tactical-action-bar__slot-asset, '
    + '[data-action-kind="skill"] .tactical-action-bar__slot-asset',
  )
  await expect(assets).toHaveCount(6)
  expect(await assets.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-asset-id'))))
    .toEqual(CARD_ASSET_IDS)

  for (let index = 0; index < 6; index += 1) {
    const asset = assets.nth(index)
    await asset.scrollIntoViewIfNeeded()
    await expect(asset).toHaveAttribute('data-state', state)
  }
}

function summaryValue(panel: Locator, label: string) {
  return panel.locator('.debug-panel__summary span').filter({ hasText: label }).locator('strong')
}

test.describe('IRPG-409 illustrated tactical-slot browser contract', () => {
  test.use({ viewport: { width: 360, height: 800 } })

  test('reuses six illustrated slots and preserves cost+1, exact, one-short, locked, and MAX commands', async ({
    context,
    page,
  }, testInfo) => {
    await context.clock.setFixedTime(STARTED_AT)
    const cardRequests: string[] = []
    page.on('request', (request) => {
      if (request.resourceType() === 'image' && CARD_FILE_PATTERN.test(request.url())) {
        cardRequests.push(new URL(request.url()).pathname)
      }
    })

    const panel = await openMixedCardFixture(page)
    await expect.poll(() => cardRequests.length).toBe(6)
    expect(new Set(cardRequests).size).toBe(6)
    await expectAllQuickSlotArt(page)

    const weapon = await openDetail(page, 'weapon')
    await expect(weapon).toHaveAttribute('data-action-status', 'insufficient')
    await expect(weapon.getByRole('status')).toHaveText('골드가 1 부족합니다.')
    await expect(weapon.getByRole('button', { name: /불씨 검 강화.*36 G/ })).toBeDisabled()

    const armor = await openDetail(page, 'armor')
    await expect(armor).toHaveAttribute('data-action-status', 'available')
    const armorButton = armor.getByRole('button', { name: /수호 갑옷 강화.*35 G/ })
    await armorButton.focus()
    await page.keyboard.press('Enter')
    await expect(slot(page, 'armor')).toContainText('Lv.2')
    await expect(summaryValue(panel, '골드')).toHaveText('0')

    const charm = await openDetail(page, 'charm')
    await expect(charm).toHaveAttribute('data-action-status', 'max')
    await expect(charm.getByRole('button', { name: 'MAX' })).toBeDisabled()

    const powerStrike = await openDetail(page, 'powerStrike')
    await expect(powerStrike).toHaveAttribute('data-action-status', 'available')
    const skillButton = powerStrike.getByRole('button', { name: /화염 강타 각인.*1 SP/ })
    await skillButton.focus()
    await page.keyboard.press('Space')
    await expect(slot(page, 'powerStrike')).toContainText('AUTO')
    await expect(summaryValue(panel, 'SP')).toHaveText('0')

    const ironWill = await openDetail(page, 'ironWill')
    await expect(ironWill).toHaveAttribute('data-action-status', 'max')
    await expect(ironWill.getByRole('button', { name: 'MAX' })).toBeDisabled()

    const fortune = await openDetail(page, 'fortune')
    await expect(fortune).toHaveAttribute('data-action-status', 'locked')
    await expect(fortune.getByRole('status')).toHaveText('영웅 레벨 5에 해금됩니다.')
    await expect(fortune.getByRole('button', { name: /잠김.*1 SP/ })).toBeDisabled()

    await panel.getByLabel('골드').fill('37')
    await panel.getByLabel('스킬 포인트').fill('1')
    await panel.getByRole('button', { name: '자원 적용' }).click()
    await expect(summaryValue(panel, '골드')).toHaveText('37')
    const refreshedWeapon = await openDetail(page, 'weapon')
    await refreshedWeapon.getByRole('button', { name: /불씨 검 강화.*36 G/ }).click()
    await expect(slot(page, 'weapon')).toContainText('Lv.3')
    await expect(summaryValue(panel, '골드')).toHaveText('1')

    for (const id of ['charm', 'ironWill', 'fortune'] as const) {
      const detail = await openDetail(page, id)
      await detail.locator('.tactical-action-bar__detail-action')
        .evaluate((button: HTMLButtonElement) => button.click())
    }
    await expect(slot(page, 'charm')).toContainText('Lv.50')
    await expect(slot(page, 'ironWill')).toContainText('PASSIVE')
    await expect(slot(page, 'fortune')).toContainText('PASSIVE')
    await expect(summaryValue(panel, '골드')).toHaveText('1')
    await expect(summaryValue(panel, 'SP')).toHaveText('1')

    const slots = actionBar(page).locator('[data-action-slot]')
    for (let index = 0; index < await slots.count(); index += 1) {
      const command = slots.nth(index)
      await command.scrollIntoViewIfNeeded()
      const box = await command.boundingBox()
      expect(box).not.toBeNull()
      expect(box!.x).toBeGreaterThanOrEqual(0)
      expect(box!.x + box!.width).toBeLessThanOrEqual(360)
      expect(box!.width).toBeGreaterThanOrEqual(44)
      expect(box!.height).toBeGreaterThanOrEqual(44)
    }

    await actionBar(page).screenshot({
      path: testInfo.outputPath('irpg-409-tactical-slots-mixed-360.png'),
      animations: 'disabled',
    })
  })
})

test('uses fallback.card after corrupt decode and keeps the slot command alive', async ({
  context,
  page,
}) => {
  await page.setViewportSize({ width: 900, height: 900 })
  await context.clock.setFixedTime(STARTED_AT)
  await page.route(/\/equipment-guard-armor[^/]*\.webp(?:\?.*)?$/, async (route) => {
    if (route.request().resourceType() !== 'image') {
      await route.continue()
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'image/webp',
      body: 'irpg-409-corrupt-card',
    })
  })

  const panel = await openMixedCardFixture(page)
  const art = slot(page, 'armor').locator('.tactical-action-bar__slot-asset')
  await art.scrollIntoViewIfNeeded()
  await expect(art).toHaveAttribute('data-state', 'fallback')
  await expect(art).toHaveAttribute('data-resolved-asset-id', 'fallback.card')

  const armor = await openDetail(page, 'armor')
  await armor.getByRole('button', { name: /수호 갑옷 강화.*35 G/ }).click()
  await expect(slot(page, 'armor')).toContainText('Lv.2')
  await expect(summaryValue(panel, '골드')).toHaveText('0')
})

test('keeps roving focus, asset order, and slot geometry at 200% zoom', async ({
  context,
  page,
}) => {
  await page.setViewportSize({ width: 720, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await context.clock.setFixedTime(STARTED_AT)
  await openMixedCardFixture(page)
  await page.evaluate(() => {
    document.documentElement.style.zoom = '2'
  })

  await expectAllQuickSlotArt(page)
  const weapon = slot(page, 'weapon')
  const armor = slot(page, 'armor')
  const fortune = slot(page, 'fortune')
  await weapon.focus()
  await expect(weapon).toBeFocused()
  await weapon.press('ArrowRight')
  await expect(armor).toBeFocused()
  await armor.press('End')
  await expect(page.locator('[data-action-slot="quickConsumable"]')).toBeFocused()
  await page.keyboard.press('Home')
  await expect(weapon).toBeFocused()

  for (const id of PROGRESSION_SLOT_IDS) {
    const command = slot(page, id)
    await command.scrollIntoViewIfNeeded()
    const box = await command.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(720)
    expect(box!.width).toBeGreaterThanOrEqual(44)
    expect(box!.height).toBeGreaterThanOrEqual(44)
  }

  await fortune.click()
  const detail = actionBar(page).locator('[data-action-detail="fortune"]')
  await expect(detail).toBeVisible()
  expect(await detail.evaluate((element) => (
    element.scrollWidth <= element.clientWidth + 1
    && element.scrollHeight <= element.clientHeight + 1
  ))).toBe(true)

  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth)
})
