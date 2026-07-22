import { expect, test, type Locator, type Page } from '@playwright/test'

const STARTED_AT = new Date('2026-07-19T03:00:00.000Z')
const EVENT_FILE_PATTERN = /\/event-(?:ember-shrine|wandering-smith|ash-camp)[^/]*\.webp(?:\?.*)?$/

test.describe.configure({ mode: 'serial', timeout: 60_000 })

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

async function reachFirstExpeditionEvent(page: Page, startedAt: Date): Promise<Locator> {
  const cards = page.locator('.expedition-event-card')
  for (let second = 5; second <= 60 && (await cards.count()) === 0; second += 5) {
    await page.context().clock.setFixedTime(
      new Date(startedAt.getTime() + second * 1_000),
    )
    await page.waitForTimeout(300)
    await spendAvailableSlots(page, ['weapon', 'armor', 'charm'])
    await spendAvailableSlots(page, ['powerStrike', 'ironWill', 'fortune'])
    const eventToggle = page.getByRole('button', { name: /원정 이벤트 \d+건 보기/ })
    if (await eventToggle.isVisible()) await eventToggle.click()
  }
  await expect(cards).toHaveCount(1)
  return cards.first()
}

function goldValue(page: Page) {
  return page.locator('.resource-rack > div').filter({ hasText: '골드' }).locator('strong')
}

async function readInteger(locator: Locator): Promise<number> {
  const text = (await locator.textContent()) ?? ''
  const value = Number(text.replaceAll(',', '').match(/\d+/)?.[0])
  expect(Number.isSafeInteger(value)).toBe(true)
  return value
}

async function enterDebugSession(page: Page) {
  await page.goto('/')
  await expect(page.getByText('● 자동 저장 정상', { exact: true })).toBeVisible()
  page.once('dialog', (dialog) => void dialog.accept())
  await page.getByRole('button', { name: '개발자 패널' }).click()
  await expect(page.getByTestId('debug-panel')).toBeVisible()
}

test('public flow commits a rapid duplicate choice once and preserves it after reload', async ({
  context,
  page,
}) => {
  const browserErrors: string[] = []
  page.on('pageerror', (error) => browserErrors.push(`page: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(`console: ${message.text()}`)
  })

  await context.clock.setFixedTime(STARTED_AT)
  await page.goto('/')
  await expect(page.getByText('● 자동 저장 정상', { exact: true })).toBeVisible()

  const firstCard = await reachFirstExpeditionEvent(page, STARTED_AT)
  const eventId = await firstCard.getAttribute('data-expedition-event-id')
  expect(eventId).toBeTruthy()
  const choice = firstCard.getByRole('button').filter({ hasText: '골드 최대 +' }).first()
  const preview = await readInteger(choice.locator('small'))
  const beforeGold = await readInteger(goldValue(page))

  await choice.evaluate((button: HTMLButtonElement) => {
    button.click()
    button.click()
  })

  await expect(page.locator(`[data-expedition-event-id="${eventId}"]`)).toHaveCount(0)
  await expect(page.locator('.tactical-canvas__status')).toHaveText(
    '원정 이벤트 선택을 적용했습니다.',
  )
  await expect(page.locator('#tactical-stage-title')).toBeFocused()
  expect(await readInteger(goldValue(page))).toBe(beforeGold + preview)

  const committedGold = await readInteger(goldValue(page))
  await page.reload()
  await expect(page.getByText('● 자동 저장 정상', { exact: true })).toBeVisible()
  await expect(page.locator(`[data-expedition-event-id="${eventId}"]`)).toHaveCount(0)
  await expect(page.locator('.expedition-event-card')).toHaveCount(0)
  expect(await readInteger(goldValue(page))).toBe(committedGold)
  expect(browserErrors).toEqual([])
})

test('lazy event art falls back safely and keyboard focus advances at 200% zoom', async ({
  context,
  page,
}) => {
  await page.setViewportSize({ width: 720, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await context.clock.setFixedTime(STARTED_AT)

  const requests: string[] = []
  page.on('request', (request) => {
    if (request.resourceType() === 'image' && EVENT_FILE_PATTERN.test(request.url())) {
      requests.push(new URL(request.url()).pathname)
    }
  })
  await page.route(EVENT_FILE_PATTERN, async (route) => {
    if (route.request().resourceType() !== 'image') {
      await route.continue()
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'image/webp',
      body: 'irpg-412-corrupt-event-card',
    })
  })

  await enterDebugSession(page)
  const panel = page.getByTestId('debug-panel')
  await panel.getByLabel('시각 회귀 fixture').selectOption('visual.events.fallback')
  await panel.getByRole('button', { name: 'fixture 적용' }).click()
  await expect(page.getByTestId('visual-fixture-root')).toHaveAttribute(
    'data-visual-fixture-id',
    'visual.events.fallback',
  )
  expect(requests).toEqual([])

  await page.evaluate(() => {
    document.documentElement.style.zoom = '2'
  })
  await page.getByRole('button', { name: '원정 이벤트 3건 보기' }).click()
  const slots = page.locator('[data-event-asset-id]')
  await expect(slots).toHaveCount(3)

  for (let index = 0; index < 3; index += 1) {
    const slot = slots.nth(index)
    await slot.scrollIntoViewIfNeeded()
    await expect(slot).toHaveAttribute('data-art-active', 'true')
    const art = slot.locator('.expedition-event-card__asset')
    await expect(art).toHaveAttribute('data-state', 'fallback')
    await expect(art).toHaveAttribute('data-resolved-asset-id', 'fallback.card')
  }
  await expect.poll(() => requests.length).toBe(3)
  expect(new Set(requests).size).toBe(3)

  const cards = page.locator('.expedition-event-card')
  const firstChoice = cards.first().getByRole('button').first()
  await firstChoice.focus()
  await page.keyboard.press('Enter')
  await expect(cards).toHaveCount(2)
  await expect(cards.first().getByRole('button').first()).toBeFocused()

  const geometry = await page.evaluate(() => {
    const buttons = Array.from(
      document.querySelectorAll<HTMLButtonElement>('.expedition-event-card button'),
    )
    return {
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      clipped: buttons.filter((button) => {
        const rect = button.getBoundingClientRect()
        return rect.left < -0.5 || rect.right > window.innerWidth + 0.5
      }).length,
      undersized: buttons.filter((button) => {
        const rect = button.getBoundingClientRect()
        return rect.width < 44 || rect.height < 44
      }).length,
    }
  })
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth)
  expect(geometry.clipped).toBe(0)
  expect(geometry.undersized).toBe(0)
})
