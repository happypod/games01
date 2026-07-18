import { expect, test, type Locator, type Page } from '@playwright/test'

const STARTED_AT = new Date('2026-07-18T08:00:00.000Z')
const CARD_FILE_PATTERN = /\/(?:equipment-(?:ember-blade|guard-armor|fortune-charm)|skill-(?:power-strike|iron-will|loot-sense))[^/]*\.webp(?:\?.*)?$/

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
  await expect(page.locator('.progression-panels')).toBeVisible()
  return page.getByTestId('debug-panel')
}

async function activateAllCardArt(page: Page) {
  const slots = page.locator('[data-card-asset-id]')
  await expect(slots).toHaveCount(6)
  for (let index = 0; index < 6; index += 1) {
    const slot = slots.nth(index)
    await slot.scrollIntoViewIfNeeded()
    await expect(slot).toHaveAttribute('data-art-active', 'true')
    await expect(slot.locator('.growth-card__asset')).toHaveAttribute('data-state', 'loaded')
  }
}

function card(page: Page, id: string) {
  return page.locator(`[data-growth-card="${id}"]`)
}

function summaryValue(panel: Locator, label: string) {
  return panel.locator('.debug-panel__summary span').filter({ hasText: label }).locator('strong')
}

test.describe('IRPG-409 illustrated card browser contract', () => {
  test.use({ viewport: { width: 360, height: 800 } })

  test('lazy-loads six unique cards and preserves cost+1, exact, one-short, locked, and MAX commands', async ({
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
    expect(cardRequests).toEqual([])

    const weapon = card(page, 'upgrade-weapon')
    const armor = card(page, 'upgrade-armor')
    const charm = card(page, 'upgrade-charm')
    const powerStrike = card(page, 'skill-powerStrike')
    const ironWill = card(page, 'skill-ironWill')
    const fortune = card(page, 'skill-fortune')

    await expect(weapon).toHaveAttribute('data-growth-status', 'insufficient')
    await expect(weapon.getByText('골드가 1 부족합니다.')).toBeVisible()
    await expect(weapon.getByRole('button')).toHaveAccessibleName(
      '불씨 검 강화 불가, 비용 36 골드, 골드 1 부족',
    )
    await expect(armor).toHaveAttribute('data-growth-status', 'available')
    await expect(charm).toHaveAttribute('data-growth-status', 'max')
    await expect(powerStrike).toHaveAttribute('data-growth-status', 'available')
    await expect(ironWill).toHaveAttribute('data-growth-status', 'max')
    await expect(fortune).toHaveAttribute('data-growth-status', 'locked')
    await expect(fortune.getByRole('button')).toContainText('1 SP')
    await expect(fortune.getByRole('button')).toHaveAccessibleName(
      '전리품 감각 잠김, 영웅 레벨 5 필요, 비용 1 스킬 포인트',
    )

    await activateAllCardArt(page)
    expect(cardRequests).toHaveLength(6)
    expect(new Set(cardRequests).size).toBe(6)

    const armorButton = armor.getByRole('button', { name: '수호 갑옷 강화, 비용 35 골드' })
    await armorButton.focus()
    await page.keyboard.press('Enter')
    await expect(armor.getByText('Lv.2')).toBeVisible()
    await expect(summaryValue(panel, '골드')).toHaveText('0')

    await panel.getByLabel('골드').fill('37')
    await panel.getByLabel('스킬 포인트').fill('1')
    await panel.getByRole('button', { name: '자원 적용' }).click()
    await expect(summaryValue(panel, '골드')).toHaveText('37')
    await weapon.getByRole('button', { name: '불씨 검 강화, 비용 36 골드' }).click()
    await expect(weapon.getByText('Lv.3')).toBeVisible()
    await expect(summaryValue(panel, '골드')).toHaveText('1')

    const skillButton = powerStrike.getByRole('button', {
      name: '화염 강타 각인, 비용 1 스킬 포인트',
    })
    await skillButton.focus()
    await page.keyboard.press('Space')
    await expect(powerStrike.getByText('Rank 4')).toBeVisible()
    await expect(summaryValue(panel, 'SP')).toHaveText('0')

    await charm.getByRole('button').evaluate((button: HTMLButtonElement) => button.click())
    await ironWill.getByRole('button').evaluate((button: HTMLButtonElement) => button.click())
    await fortune.getByRole('button').evaluate((button: HTMLButtonElement) => button.click())
    await expect(charm.getByText('Lv.50')).toBeVisible()
    await expect(ironWill.getByText('Rank 10')).toBeVisible()
    await expect(fortune.getByText('Rank 0')).toBeVisible()
    await expect(summaryValue(panel, '골드')).toHaveText('1')
    await expect(summaryValue(panel, 'SP')).toHaveText('0')

    const geometry = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll<HTMLElement>('.growth-card'))
      const buttons = cards.map((entry) => entry.querySelector('button')).filter(Boolean) as HTMLButtonElement[]
      return {
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        undersized: buttons.map((button) => button.getBoundingClientRect())
          .filter(({ width, height }) => width < 44 || height < 44).length,
      }
    })
    expect(geometry).toEqual({ clientWidth: 360, scrollWidth: 360, undersized: 0 })

    await page.locator('.progression-panels').screenshot({
      path: testInfo.outputPath('irpg-409-cards-mixed-360.png'),
      animations: 'disabled',
    })
  })
})

test('uses fallback.card after corrupt decode and keeps the purchase command alive', async ({
  context,
  page,
}) => {
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
  const armor = card(page, 'upgrade-armor')
  await armor.locator('[data-card-asset-id]').scrollIntoViewIfNeeded()
  const art = armor.locator('.growth-card__asset')
  await expect(art).toHaveAttribute('data-state', 'fallback')
  await expect(art).toHaveAttribute('data-resolved-asset-id', 'fallback.card')

  await armor.getByRole('button', { name: '수호 갑옷 강화, 비용 35 골드' }).click()
  await expect(armor.getByText('Lv.2')).toBeVisible()
  await expect(summaryValue(panel, '골드')).toHaveText('0')
})

test('keeps reading order, focus order, and geometry at 200% zoom', async ({
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

  await activateAllCardArt(page)
  const assetOrder = await page.locator('[data-card-asset-id]').evaluateAll((slots) =>
    slots.map((slot) => slot.getAttribute('data-card-asset-id')),
  )
  expect(assetOrder).toEqual([
    'equipment.ember-blade',
    'equipment.guard-armor',
    'equipment.fortune-charm',
    'skill.power-strike',
    'skill.iron-will',
    'skill.loot-sense',
  ])
  for (const name of ['불씨 검', '수호 갑옷', '행운 부적', '화염 강타', '강철 의지', '전리품 감각']) {
    const article = page.getByRole('article', { name })
    await expect(article).toHaveAttribute('aria-describedby', /-effects/)
    await expect(article.getByRole('img')).toHaveCount(0)
  }

  const armorButton = card(page, 'upgrade-armor').getByRole('button')
  const powerStrikeButton = card(page, 'skill-powerStrike').getByRole('button')
  await armorButton.focus()
  await expect(armorButton).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(powerStrikeButton).toBeFocused()

  const geometry = await page.evaluate(() => {
    const visible = Array.from(
      document.querySelectorAll<HTMLElement>(
        '.progression-panels button, .growth-card__art, .growth-card__body, .growth-card__effects, .growth-card__status',
      ),
    ).filter((element) => {
      const rect = element.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0 && getComputedStyle(element).visibility !== 'hidden'
    })
    return {
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      clipped: visible.filter((element) => {
        const rect = element.getBoundingClientRect()
        return rect.left < -0.5 || rect.right > window.innerWidth + 0.5
      }).length,
      undersizedButtons: visible.filter((element) => element.tagName === 'BUTTON')
        .filter((element) => {
          const rect = element.getBoundingClientRect()
          return rect.width < 44 || rect.height < 44
        }).length,
      undersizedArt: visible.filter((element) => element.classList.contains('growth-card__art'))
        .filter((element) => {
          const rect = element.getBoundingClientRect()
          return rect.width < 64 || rect.height < 64
        }).length,
      internallyClippedText: visible
        .filter((element) =>
          element.matches('.growth-card__body, .growth-card__effects, .growth-card__status'),
        )
        .filter((element) =>
          element.scrollWidth > element.clientWidth + 1 ||
          element.scrollHeight > element.clientHeight + 1,
        ).length,
    }
  })
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth)
  expect(geometry.clipped).toBe(0)
  expect(geometry.undersizedButtons).toBe(0)
  expect(geometry.undersizedArt).toBe(0)
  expect(geometry.internallyClippedText).toBe(0)
})
