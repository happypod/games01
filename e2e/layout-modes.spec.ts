import { expect, test, type Page } from '@playwright/test'

const DASHBOARD_OPTION = '유형 1 · 대시보드'
const TACTICAL_OPTION = '유형 2 · 전술 전장'

async function expectReady(page: Page) {
  await page.goto('/')
  await expect(page.getByText('● 자동 저장 정상', { exact: true })).toBeVisible()
}

async function enterDebugSession(page: Page) {
  await page.clock.setFixedTime(new Date('2026-07-19T00:00:00.000Z'))
  await expectReady(page)
  page.once('dialog', (dialog) => void dialog.accept())
  await page.getByRole('button', { name: '개발자 패널' }).click()
  await expect(page.getByTestId('debug-panel')).toBeVisible()
}

async function applyFixture(page: Page, id: string) {
  const panel = page.getByTestId('debug-panel')
  const fixtureSelect = panel.getByLabel('시각 회귀 fixture')
  await fixtureSelect.selectOption(id)
  await expect(fixtureSelect).toHaveValue(id)
  await panel.getByRole('button', { name: 'fixture 적용' }).click()
  await expect(page.getByTestId('visual-fixture-root')).toHaveAttribute(
    'data-visual-fixture-id',
    id,
  )
}

async function settleImagePaint(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      }),
  )
}

test.describe('IRPG-415 selectable layouts', () => {
  test('defaults safely to type 1 and restores only a valid type 2 preference', async ({ page }) => {
    await expectReady(page)

    const dashboard = page.getByRole('radio', { name: DASHBOARD_OPTION, exact: true })
    const tactical = page.getByRole('radio', { name: TACTICAL_OPTION, exact: true })
    await expect(dashboard).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByTestId('game-dashboard')).toHaveCount(1)
    await expect(page.getByTestId('tactical-layout')).toHaveCount(0)

    await tactical.click()
    await expect(tactical).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByTestId('game-dashboard')).toHaveCount(0)
    await expect(page.getByTestId('tactical-layout')).toHaveCount(1)

    await page.reload()
    await expect(page.getByText('● 자동 저장 정상', { exact: true })).toBeVisible()
    await expect(page.getByRole('radio', { name: TACTICAL_OPTION })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    await expect(page.getByTestId('tactical-layout')).toHaveCount(1)
  })

  test('falls back to type 1 for an invalid preference', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('emberwatch.ui.layout.v1', 'unknown-layout')
    })
    await expectReady(page)
    await expect(page.getByRole('radio', { name: DASHBOARD_OPTION })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    await expect(page.getByTestId('game-dashboard')).toHaveCount(1)
  })

  test('supports keyboard switching while preserving a single active renderer', async ({ page }) => {
    await expectReady(page)
    const dashboard = page.getByRole('radio', { name: DASHBOARD_OPTION })
    const tactical = page.getByRole('radio', { name: TACTICAL_OPTION })

    await dashboard.focus()
    await dashboard.press('ArrowRight')
    await expect(tactical).toBeFocused()
    await expect(tactical).toHaveAttribute('aria-checked', 'true')
    await expect(page.locator('#tactical-stage-title')).toHaveCount(1)
    await expect(page.locator('#battle-title')).toHaveCount(0)

    await tactical.press('Home')
    await expect(dashboard).toBeFocused()
    await expect(page.locator('#tactical-stage-title')).toHaveCount(0)
    await expect(page.locator('#battle-title')).toHaveCount(1)
    await expect(page.locator('[aria-live="polite"] #tactical-stage-title')).toHaveCount(0)
  })

  for (const viewport of [
    { width: 1_440, height: 900 },
    { width: 1_024, height: 768 },
  ]) {
    test(`keeps the tactical canvas and command dock in one view at ${viewport.width}×${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await enterDebugSession(page)
      await applyFixture(page, 'visual.dashboard.tactical-canvas')
      await page.getByRole('radio', { name: TACTICAL_OPTION }).click()

      const canvas = page.getByTestId('tactical-canvas')
      const dock = page.getByRole('complementary', { name: '성장과 원정 관리' })
      await expect(canvas).toBeVisible()
      await expect(dock).toBeVisible()
      await expect(canvas.locator('[data-asset-id="region.ashen-border"]')).toHaveAttribute(
        'data-state',
        'loaded',
      )
      for (const assetId of [
        'hero.ashen-knight.default',
        'boss.ash-giant',
        'companion.ember-fox.default',
      ]) {
        const asset = canvas.locator(`[data-asset-id="${assetId}"]`)
        await expect(asset).toBeVisible()
        await expect(asset).toHaveAttribute('data-state', 'loaded')
      }
      await settleImagePaint(page)

      const geometry = await page.evaluate(() => {
        const canvasElement = document.querySelector('.tactical-canvas')
        const dockElement = document.querySelector('.tactical-command-dock')
        if (!(canvasElement instanceof HTMLElement) || !(dockElement instanceof HTMLElement)) {
          throw new Error('tactical surfaces missing')
        }
        const canvasRect = canvasElement.getBoundingClientRect()
        const dockRect = dockElement.getBoundingClientRect()
        return {
          clientWidth: document.documentElement.clientWidth,
          clientHeight: document.documentElement.clientHeight,
          scrollWidth: document.documentElement.scrollWidth,
          scrollHeight: document.documentElement.scrollHeight,
          canvas: { top: canvasRect.top, right: canvasRect.right, bottom: canvasRect.bottom },
          dock: { top: dockRect.top, right: dockRect.right, bottom: dockRect.bottom },
        }
      })
      expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth)
      expect(geometry.scrollHeight).toBeLessThanOrEqual(geometry.clientHeight)
      expect(geometry.canvas.top).toBeGreaterThanOrEqual(0)
      expect(geometry.canvas.bottom).toBeLessThanOrEqual(geometry.clientHeight)
      expect(geometry.dock.top).toBe(geometry.canvas.top)
      expect(geometry.dock.right).toBeLessThanOrEqual(geometry.clientWidth)
      expect(geometry.dock.bottom).toBeLessThanOrEqual(geometry.clientHeight)

      if (viewport.width === 1_440) {
        await page.screenshot({
          path: 'tmp/irpg-415-tactical-1440.png',
          animations: 'disabled',
          fullPage: false,
        })
        await canvas.screenshot({
          path: 'tmp/irpg-415-tactical-canvas-1440.png',
          animations: 'disabled',
        })
      }
    })
  }

  test('uses a scroll-safe 360px flow and removes motion when requested', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await enterDebugSession(page)
    await applyFixture(page, 'visual.dashboard.tactical-canvas')
    await page.getByRole('radio', { name: TACTICAL_OPTION }).click()

    const geometry = await page.evaluate(() => {
      const canvas = document.querySelector('.tactical-canvas')?.getBoundingClientRect()
      const dock = document.querySelector('.tactical-command-dock')?.getBoundingClientRect()
      const cue = document.querySelector('.tactical-cue')
      const cueStyle = cue === null ? null : getComputedStyle(cue)
      return {
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight,
        canvasBottom: canvas?.bottom ?? 0,
        dockTop: dock?.top ?? 0,
        cueAnimation: cueStyle?.animationName ?? '',
        cueTransition: cueStyle?.transitionDuration ?? '',
      }
    })
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth)
    expect(geometry.scrollHeight).toBeGreaterThan(800)
    expect(geometry.dockTop).toBeGreaterThanOrEqual(geometry.canvasBottom)
    expect(geometry.cueAnimation).toBe('none')
    expect(geometry.cueTransition).toBe('0s')

    const undersized = await page.getByRole('button').evaluateAll((buttons) =>
      buttons
        .filter((button) => {
          const style = getComputedStyle(button)
          return style.display !== 'none' && style.visibility !== 'hidden'
        })
        .filter((button) => {
          const rect = button.getBoundingClientRect()
          return rect.width > 0 && rect.height > 0 && rect.height < 44
        })
        .map((button) => button.getAttribute('aria-label') ?? button.textContent?.trim()),
    )
    expect(undersized).toEqual([])
  })

  test('renders saved expedition choices over the battlefield and accepts one rapid choice once', async ({ page }) => {
    await page.setViewportSize({ width: 1_440, height: 900 })
    await enterDebugSession(page)
    await applyFixture(page, 'visual.events.tactical-overlay')
    await page.getByRole('radio', { name: TACTICAL_OPTION }).click()

    const canvas = page.getByTestId('tactical-canvas')
    const cards = canvas.locator('.expedition-event-card')
    await expect(cards).toHaveCount(3)
    await expect(canvas.locator('.expedition-event-card__choices button')).toHaveCount(6)
    for (const assetId of [
      'event.ember-shrine',
      'event.wandering-smith',
      'event.ash-camp',
    ]) {
      await expect(canvas.locator(`[data-asset-id="${assetId}"]`)).toHaveAttribute(
        'data-state',
        'loaded',
      )
    }
    await settleImagePaint(page)
    await page.screenshot({
      path: 'tmp/irpg-415-tactical-overlay-1440.png',
      animations: 'disabled',
      fullPage: false,
    })
    const firstChoice = canvas.locator('.expedition-event-card__choices button').first()
    await firstChoice.evaluate((button) => {
      if (!(button instanceof HTMLButtonElement)) throw new Error('choice missing')
      button.click()
      button.click()
    })
    await expect(cards).toHaveCount(2)
    await expect(canvas.locator('.expedition-event-card__choices button')).toHaveCount(4)
    await canvas.locator('.expedition-event-card__choices button').first().click()
    await expect(cards).toHaveCount(1)
    await canvas.locator('.expedition-event-card__choices button').first().click()
    await expect(cards).toHaveCount(0)
    await expect(page.locator('#tactical-stage-title')).toBeFocused()
    await expect(canvas.locator('.tactical-canvas__base')).not.toHaveAttribute('inert')
  })

  test('plays only newly arriving combat cues and does not replay them after a layout round trip', async ({ page }) => {
    await enterDebugSession(page)
    await applyFixture(page, 'visual.dashboard.tactical-canvas')
    await page.getByRole('radio', { name: TACTICAL_OPTION }).click()

    const canvas = page.getByTestId('tactical-canvas')
    await expect(canvas).not.toHaveAttribute('data-scene-id', /.+/)
    await page.clock.setFixedTime(new Date('2026-07-19T00:00:01.000Z'))
    await expect(canvas).toHaveAttribute('data-scene-id', /.+/)
    await expect(canvas.locator('.tactical-cue')).toHaveClass(/tactical-cue--active/)

    await page.getByRole('radio', { name: DASHBOARD_OPTION }).click()
    await page.getByRole('radio', { name: TACTICAL_OPTION }).click()
    await expect(page.getByTestId('tactical-canvas')).not.toHaveAttribute(
      'data-scene-id',
      /.+/,
    )
  })
})
