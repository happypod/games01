import { expect, type BrowserContext, type Locator, type Page, type TestInfo } from '@playwright/test'
import {
  VISUAL_FIXTURE_NOW,
  type VisualFixtureDefinition,
  type VisualFixtureVariant,
} from '../src/debug/visualFixtures'

interface BrowserErrors {
  readonly console: string[]
  readonly page: string[]
}

export function observeBrowserErrors(page: Page): BrowserErrors {
  const errors: BrowserErrors = { console: [], page: [] }
  page.on('console', (message) => {
    if (message.type() === 'error') errors.console.push(message.text())
  })
  page.on('pageerror', (error) => errors.page.push(error.message))
  return errors
}

async function installFailureRoute(page: Page, fixture: VisualFixtureDefinition) {
  const pattern = fixture.failureRoute === 'hero-and-enemy-corrupt'
    ? /\/(?:ashen-knight-default|ash-slime)[^/]*\.webp(?:\?.*)?$/
    : fixture.failureRoute === 'cards-corrupt'
      ? /\/(?:equipment-(?:ember-blade|guard-armor|fortune-charm)|skill-(?:power-strike|iron-will|loot-sense))[^/]*\.webp(?:\?.*)?$/
      : fixture.failureRoute === 'events-corrupt'
        ? /\/event-(?:ember-shrine|wandering-smith|ash-camp)[^/]*\.webp(?:\?.*)?$/
      : null
  if (pattern === null) return
  await page.route(pattern, async (route) => {
    if (route.request().resourceType() !== 'image') {
      await route.continue()
      return
    }
    await route.fulfill({ status: 200, contentType: 'image/webp', body: 'irpg-506-corrupt' })
  })
}

async function enterDebugSession(page: Page) {
  await page.goto('/')
  await expect(page.getByText('● 자동 저장 정상', { exact: true })).toBeVisible()
  page.once('dialog', (dialog) => void dialog.accept())
  await page.getByRole('button', { name: '개발자 패널' }).click()
  await expect(page.getByTestId('debug-panel')).toBeVisible()
  await expect(page.getByTestId('debug-save-isolation-status')).toHaveText(
    '● DEBUG · 저장 격리',
  )
}

async function waitForVisualResources(page: Page, target: Locator) {
  await page.waitForFunction(async () => {
    await document.fonts.ready
    return document.fonts.check('16px "Emberwatch Sans"', '한글 Emberwatch 123')
  })

  await expect.poll(async () => target.locator('img').evaluateAll((images) =>
    images.every((element) => {
      const image = element as HTMLImageElement
      return image.complete && image.naturalWidth > 0 && image.naturalHeight > 0
    }),
  )).toBe(true)
}

export async function openVisualFixture(
  context: BrowserContext,
  page: Page,
  fixture: VisualFixtureDefinition,
  variant: VisualFixtureVariant,
  testInfo: TestInfo,
): Promise<Locator> {
  await context.clock.setFixedTime(new Date(VISUAL_FIXTURE_NOW))
  await page.setViewportSize(variant.viewport)
  await page.emulateMedia({
    colorScheme: variant.colorScheme,
    reducedMotion: variant.motion === 'reduced' ? 'reduce' : 'no-preference',
  })
  await installFailureRoute(page, fixture)
  await enterDebugSession(page)

  const panel = page.getByTestId('debug-panel')
  await panel.getByLabel('시각 회귀 fixture').selectOption(fixture.id)
  await panel.getByRole('button', { name: 'fixture 적용' }).click()

  const root = page.getByTestId('visual-fixture-root')
  await expect(root).toHaveAttribute('data-visual-fixture-id', fixture.id)
  await expect(root).toHaveAttribute('data-canonical-state-hash', fixture.canonicalHash)
  await expect(root).toHaveAttribute(
    'data-expected-canonical-state-hash',
    fixture.canonicalHash,
  )
  if (fixture.canonicalEventHash !== undefined) {
    await expect(root).toHaveAttribute('data-canonical-event-hash', fixture.canonicalEventHash)
    await expect(root).toHaveAttribute(
      'data-expected-canonical-event-hash',
      fixture.canonicalEventHash,
    )
  }

  if (fixture.setupAction === 'open-stage-map') {
    await page.getByRole('button', { name: '원정 지도 열기' }).click()
    await expect(page.getByRole('tab', { name: /월락 고개/ })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    await expect(page.getByTestId('stage-map-node-105')).toHaveAttribute('tabindex', '0')
    await expect(page.getByTestId('stage-map-node-105')).toHaveAttribute(
      'aria-current',
      'step',
    )
  }

  if (fixture.setupAction === 'open-growth-cards') {
    const artSlots = page.locator('[data-card-asset-id]')
    await expect(artSlots).toHaveCount(6)
    for (let index = 0; index < 6; index += 1) {
      const slot = artSlots.nth(index)
      await slot.scrollIntoViewIfNeeded()
      await expect(slot).toHaveAttribute('data-art-active', 'true')
      await expect(slot.locator('.growth-card__asset')).toHaveAttribute(
        'data-state',
        fixture.failureRoute === 'cards-corrupt' ? 'fallback' : 'loaded',
      )
    }
  }

  if (fixture.setupAction === 'open-expedition-events') {
    const eventSlots = page.locator('[data-event-asset-id]')
    await expect(eventSlots).toHaveCount(3)
    for (let index = 0; index < 3; index += 1) {
      const slot = eventSlots.nth(index)
      await slot.scrollIntoViewIfNeeded()
      await expect(slot).toHaveAttribute('data-art-active', 'true')
      await expect(slot.locator('.expedition-event-card__asset')).toHaveAttribute(
        'data-state',
        fixture.failureRoute === 'events-corrupt' ? 'fallback' : 'loaded',
      )
    }
  }

  if (fixture.setupAction === 'open-combat-log') {
    await page.getByRole('button', { name: '전투 로그 펼치기' }).click()
    const list = page.getByTestId('combat-log-list')
    await expect(list.getByRole('listitem')).toHaveCount(20)
    await expect(page.getByText('최근 20건 · 이전 4건 요약')).toBeVisible()
    for (const type of ['skill', 'critical', 'companionAssist', 'kill', 'bossVictory', 'defeat']) {
      await expect(list.locator(`[data-combat-event-type="${type}"]`).first()).toBeVisible()
    }
  }

  if (
    fixture.setupAction === 'open-boss-victory-result' ||
    fixture.setupAction === 'open-defeat-result'
  ) {
    const victory = fixture.setupAction === 'open-boss-victory-result'
    const buttonName = victory
      ? '스테이지 10 보스 승리 상세 보기'
      : '스테이지 10 패배 · 스테이지 9 복귀 상세 보기'
    const resultType = victory ? 'bossVictory' : 'defeat'
    const assetId = victory ? 'result.boss-victory' : 'result.defeat'

    const detailButton = page.getByRole('button', { name: buttonName, exact: true })
    await expect(detailButton).toBeVisible()
    await detailButton.click()

    const dialog = page.getByTestId('combat-result-dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog).toHaveAttribute('data-result-type', resultType)
    const art = dialog.locator('.combat-result-dialog__art')
    await expect(art).toHaveAttribute('data-asset-id', assetId)
    await expect(art).toHaveAttribute('data-resolved-asset-id', assetId)
    await expect(art).toHaveAttribute('data-state', 'loaded')
  }

  const target = page.locator(fixture.captureTarget)
  await expect(target).toBeVisible()
  if (fixture.failureRoute === 'hero-and-enemy-corrupt') {
    for (const selector of ['.hero-portrait', '.enemy-portrait__asset']) {
      await expect(page.locator(selector)).toHaveAttribute('data-state', 'fallback')
      await expect(page.locator(selector)).toHaveAttribute(
        'data-resolved-asset-id',
        'fallback.character',
      )
    }
  }
  if (fixture.failureRoute === 'cards-corrupt') {
    const cardAssets = target.locator('.growth-card__asset')
    await expect(cardAssets).toHaveCount(6)
    for (let index = 0; index < 6; index += 1) {
      await expect(cardAssets.nth(index)).toHaveAttribute('data-state', 'fallback')
      await expect(cardAssets.nth(index)).toHaveAttribute(
        'data-resolved-asset-id',
        'fallback.card',
      )
    }
  }
  if (fixture.failureRoute === 'events-corrupt') {
    const eventAssets = target.locator('.expedition-event-card__asset')
    await expect(eventAssets).toHaveCount(3)
    for (let index = 0; index < 3; index += 1) {
      await expect(eventAssets.nth(index)).toHaveAttribute('data-state', 'fallback')
      await expect(eventAssets.nth(index)).toHaveAttribute(
        'data-resolved-asset-id',
        'fallback.card',
      )
    }
  }
  await waitForVisualResources(page, target)

  // Tall locator screenshots otherwise inherit the last lazy-load scroll and can
  // capture a following sibling instead of the start of the requested surface.
  await target.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    window.scrollTo({
      top: window.scrollY + rect.top,
      left: window.scrollX + rect.left,
      behavior: 'instant',
    })
  })
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  }))

  await testInfo.attach('visual-fixture-metadata.json', {
    body: JSON.stringify({
      fixtureId: fixture.id,
      ownerTicket: fixture.ownerTicket,
      seedKey: fixture.seedKey,
      canonicalHash: fixture.canonicalHash,
      canonicalEventHash: fixture.canonicalEventHash,
      captureTarget: fixture.captureTarget,
      failureRoute: fixture.failureRoute,
      setupAction: fixture.setupAction,
      variant,
    }, null, 2),
    contentType: 'application/json',
  })
  return target
}

export async function verifyResponsiveVisualSurface(
  page: Page,
  target: Locator,
  variant: VisualFixtureVariant,
) {
  const geometry = await target.evaluate((element) => ({
    viewportWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    targetTop: element.getBoundingClientRect().top,
  }))
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth)
  expect(geometry.clientWidth).toBe(geometry.viewportWidth)
  expect(geometry.targetTop).toBeGreaterThanOrEqual(-1)

  const clippedCommands = await target.getByRole('button').evaluateAll((buttons) =>
    buttons
      .filter((button) => {
        const style = getComputedStyle(button)
        return style.display !== 'none' && style.visibility !== 'hidden'
      })
      .map((button) => {
        const rect = button.getBoundingClientRect()
        return {
          label: button.getAttribute('aria-label') ?? button.textContent?.trim() ?? '',
          left: rect.left,
          right: rect.right,
          width: rect.width,
          height: rect.height,
        }
      })
      .filter((rect) => rect.left < 0 || rect.right > window.innerWidth || rect.width <= 0 || rect.height <= 0),
  )
  expect(clippedCommands).toEqual([])

  if (variant.motion === 'reduced') {
    const movingElements = await target.evaluate((element) =>
      [element, ...element.querySelectorAll('*')]
        .map((node) => {
          const html = node as HTMLElement
          const style = getComputedStyle(html)
          return {
            tag: html.tagName,
            className: html.className,
            animationName: style.animationName,
            animationDuration: style.animationDuration,
            transitionDuration: style.transitionDuration,
          }
        })
        .filter((item) =>
          (item.animationName !== 'none' && item.animationDuration !== '0s') ||
          item.transitionDuration.split(',').some((duration) => duration.trim() !== '0s'),
        ),
    )
    expect(movingElements).toEqual([])
  }
}
