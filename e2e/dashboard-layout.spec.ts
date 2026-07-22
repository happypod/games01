import { expect, test, type Page } from '@playwright/test'

const STARTED_AT = new Date('2026-07-20T09:00:00.000Z')
const SLOT_ASSET_IDS = [
  'equipment.ember-blade',
  'equipment.guard-armor',
  'equipment.fortune-charm',
  'skill.power-strike',
  'skill.iron-will',
  'skill.loot-sense',
] as const

function collectBrowserErrors(page: Page, errors: string[]) {
  page.on('pageerror', (error) => errors.push(`page: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`)
  })
}

for (const viewport of [
  { width: 1_440, height: 900 },
  { width: 1_024, height: 768 },
] as const) {
  test(`IRPG-422 keeps the tactical command surface in one view at ${viewport.width}x${viewport.height}`, async ({
    context,
    page,
  }, testInfo) => {
    const browserErrors: string[] = []
    collectBrowserErrors(page, browserErrors)
    await page.setViewportSize(viewport)
    await context.clock.setFixedTime(STARTED_AT)
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('● 자동 저장 정상', { exact: true })).toBeVisible()

    const layout = page.getByTestId('tactical-layout')
    const canvas = page.getByTestId('tactical-canvas')
    const actionBar = page.getByRole('region', { name: '전술 명령 빠른 슬롯' })
    const dock = page.getByTestId('tactical-utility-dock')
    await expect(layout).toBeVisible()
    await expect(canvas).toBeVisible()
    await expect(actionBar).toBeVisible()
    await expect(dock).toBeVisible()
    await expect(page.getByTestId('game-dashboard')).toHaveCount(0)

    for (const assetId of SLOT_ASSET_IDS) {
      const asset = actionBar.locator(`[data-asset-id="${assetId}"]`)
      await expect(asset).toHaveCount(1)
      await expect(asset).toHaveAttribute('data-state', 'loaded')
    }
    await expect(actionBar.locator('[data-action-slot]')).toHaveCount(8)
    await expect(dock.locator('[data-utility-id]')).toHaveCount(4)

    const geometry = await page.evaluate(() => {
      const toRect = (selector: string) => {
        const element = document.querySelector<HTMLElement>(selector)
        if (element === null) throw new Error(`${selector} missing`)
        const rect = element.getBoundingClientRect()
        return {
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height,
        }
      }
      const controls = [...document.querySelectorAll<HTMLElement>(
        '.tactical-action-bar__slot, .tactical-utility-dock__trigger',
      )].map((element) => {
        const rect = element.getBoundingClientRect()
        return { width: rect.width, height: rect.height }
      })
      return {
        clientWidth: document.documentElement.clientWidth,
        clientHeight: document.documentElement.clientHeight,
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight,
        layout: toRect('.tactical-layout'),
        canvas: toRect('.tactical-canvas'),
        actionBar: toRect('.tactical-action-bar'),
        dock: toRect('.tactical-command-dock'),
        controls,
      }
    })

    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth)
    expect(geometry.scrollHeight).toBeLessThanOrEqual(geometry.clientHeight)
    expect(geometry.canvas.bottom).toBeLessThanOrEqual(geometry.actionBar.top + 1)
    expect(geometry.actionBar.bottom).toBeLessThanOrEqual(geometry.clientHeight)
    expect(geometry.dock.left).toBeGreaterThanOrEqual(geometry.canvas.right - 1)
    expect(geometry.dock.bottom).toBeLessThanOrEqual(geometry.clientHeight)
    expect(geometry.controls.every(({ width, height }) => width >= 44 && height >= 44))
      .toBe(true)

    const intelTabs = page.getByRole('tablist', { name: '전술 정보 메뉴' })
    const map = intelTabs.getByRole('tab', { name: '지도' })
    const character = intelTabs.getByRole('tab', { name: '캐릭터' })
    const bestiary = intelTabs.getByRole('tab', { name: '도감' })
    await map.focus()
    await page.keyboard.press('ArrowRight')
    await expect(character).toBeFocused()
    await page.keyboard.press('End')
    await expect(bestiary).toBeFocused()
    await page.keyboard.press('Home')
    await expect(map).toBeFocused()

    await dock.getByRole('button', { name: '전투 로그' }).hover()
    await expect(page.getByRole('tooltip', { name: '전투 로그' })).toBeVisible()
    await dock.getByRole('button', { name: '전투 로그' }).click()
    await expect(page.getByTestId('tactical-utility-panel')).toBeVisible()
    await page.getByRole('button', { name: '전투 로그 닫기' }).click()
    await expect(page.getByTestId('tactical-utility-panel')).toHaveCount(0)

    await testInfo.attach(`irpg-422-tactical-${viewport.width}x${viewport.height}.png`, {
      body: await page.screenshot({ animations: 'disabled' }),
      contentType: 'image/png',
    })
    expect(browserErrors).toEqual([])
  })
}

test.describe('IRPG-422 mobile tactical flow', () => {
  test.use({ viewport: { width: 360, height: 800 } })

  test('keeps slots, utilities, tactical intel and reduced motion usable without page overflow', async ({
    context,
    page,
  }, testInfo) => {
    const browserErrors: string[] = []
    collectBrowserErrors(page, browserErrors)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await context.clock.setFixedTime(STARTED_AT)
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('● 자동 저장 정상', { exact: true })).toBeVisible()

    const canvas = page.getByTestId('tactical-canvas')
    const actionBar = page.getByRole('region', { name: '전술 명령 빠른 슬롯' })
    const dock = page.getByTestId('tactical-utility-dock')
    await expect(canvas).toBeVisible()
    await expect(actionBar).toBeVisible()
    await expect(actionBar.locator('[data-action-slot]')).toHaveCount(8)

    await actionBar.locator('[data-action-slot="armor"]').click()
    const detail = actionBar.locator('[data-action-detail="armor"]')
    await expect(detail).toBeVisible()
    await expect(detail.getByRole('heading', { name: '수호 갑옷' })).toBeVisible()
    await detail.getByRole('button', { name: '수호 갑옷 상세 닫기' }).click()
    await expect(detail).toHaveCount(0)

    await dock.getByRole('button', { name: '승패 결과' }).click()
    await expect(page.getByTestId('tactical-utility-panel')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dock.getByRole('button', { name: '승패 결과' })).toBeFocused()

    const geometry = await page.evaluate(() => {
      const slots = document.querySelector<HTMLElement>('.tactical-action-bar__slots')!
      const controls = [...document.querySelectorAll<HTMLElement>(
        '.game-mode-selector [role="radio"], .tactical-action-bar button, .tactical-intel-panel button, .tactical-utility-dock button',
      )].filter((element) => {
        const rect = element.getBoundingClientRect()
        const style = getComputedStyle(element)
        return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden'
      }).map((element) => {
        const rect = element.getBoundingClientRect()
        return { width: rect.width, height: rect.height }
      })
      return {
        clientWidth: document.documentElement.clientWidth,
        clientHeight: document.documentElement.clientHeight,
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight,
        slotsClientWidth: slots.clientWidth,
        slotsScrollWidth: slots.scrollWidth,
        invalidControls: controls.filter(({ width, height }) => width < 44 || height < 44),
        animations: [...document.querySelectorAll<HTMLElement>('.tactical-layout *')]
          .some((element) => getComputedStyle(element).animationName !== 'none'),
      }
    })

    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth)
    expect(geometry.scrollHeight).toBeGreaterThan(geometry.clientHeight)
    expect(geometry.slotsScrollWidth).toBeGreaterThan(geometry.slotsClientWidth)
    expect(geometry.invalidControls).toEqual([])
    expect(geometry.animations).toBe(false)

    const intelTabs = page.getByRole('tablist', { name: '전술 정보 메뉴' })
    await expect(intelTabs).toBeVisible()
    await expect(intelTabs.getByRole('tab')).toHaveCount(5)
    await expect(page.locator('[data-intel-panel="map"]')).toBeVisible()
    await intelTabs.getByRole('tab', { name: '가방' }).click()
    await expect(page.locator('[data-intel-panel="inventory"]')).toBeVisible()
    await testInfo.attach('irpg-422-tactical-360x800.png', {
      body: await page.screenshot({ animations: 'disabled', fullPage: true }),
      contentType: 'image/png',
    })
    expect(browserErrors).toEqual([])
  })
})
