import { expect, test, type Page } from '@playwright/test'

const STARTED_AT = new Date('2026-07-19T09:00:00.000Z')

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
  test(`IRPG-414 keeps a ${viewport.width}x${viewport.height} one-view dashboard`, async ({
    context,
    page,
  }, testInfo) => {
    const browserErrors: string[] = []
    collectBrowserErrors(page, browserErrors)
    await page.setViewportSize(viewport)
    await context.clock.setFixedTime(STARTED_AT)
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('● 자동 저장 정상', { exact: true })).toBeVisible()
    await expect(page.locator('.enemy-portrait__asset')).toHaveAttribute('data-state', 'loaded')
    await testInfo.attach(`irpg-414-dashboard-${viewport.width}x${viewport.height}.png`, {
      body: await page.screenshot({ animations: 'disabled' }),
      contentType: 'image/png',
    })

    const geometry = await page.evaluate(() => {
      const dashboard = document.querySelector<HTMLElement>('.game-dashboard')!
      const columns = [
        document.querySelector<HTMLElement>('.dashboard-column--battle')!,
        document.querySelector<HTMLElement>('.dashboard-column--journey')!,
        document.querySelector<HTMLElement>('.dashboard-column--growth')!,
      ]
      const toRect = (element: HTMLElement) => {
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
      return {
        clientWidth: document.documentElement.clientWidth,
        clientHeight: document.documentElement.clientHeight,
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight,
        bodyScrollWidth: document.body.scrollWidth,
        bodyScrollHeight: document.body.scrollHeight,
        scrollX: window.scrollX,
        scrollY: window.scrollY,
        dashboard: toRect(dashboard),
        columns: columns.map(toRect),
      }
    })

    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth)
    expect(geometry.bodyScrollWidth).toBeLessThanOrEqual(geometry.clientWidth)
    expect(geometry.scrollHeight).toBeLessThanOrEqual(geometry.clientHeight)
    expect(geometry.bodyScrollHeight).toBeLessThanOrEqual(geometry.clientHeight)
    expect(geometry.scrollX).toBe(0)
    expect(geometry.scrollY).toBe(0)

    const [battle, journey, growth] = geometry.columns
    expect(battle).toBeDefined()
    expect(journey).toBeDefined()
    expect(growth).toBeDefined()
    expect(battle!.left).toBeGreaterThanOrEqual(geometry.dashboard.left - 1)
    expect(battle!.right).toBeLessThanOrEqual(journey!.left + 1)
    expect(journey!.right).toBeLessThanOrEqual(growth!.left + 1)
    expect(growth!.right).toBeLessThanOrEqual(geometry.dashboard.right + 1)
    for (const column of geometry.columns) {
      expect(column.top).toBeGreaterThanOrEqual(geometry.dashboard.top - 1)
      expect(column.bottom).toBeLessThanOrEqual(geometry.dashboard.bottom + 1)
      expect(column.height).toBeGreaterThan(0)
    }

    const columnWidth = geometry.columns.reduce((total, column) => total + column.width, 0)
    expect(battle!.width / columnWidth).toBeGreaterThan(0.33)
    expect(battle!.width / columnWidth).toBeLessThan(0.37)
    expect(journey!.width / columnWidth).toBeGreaterThan(0.38)
    expect(journey!.width / columnWidth).toBeLessThan(0.42)
    expect(growth!.width / columnWidth).toBeGreaterThan(0.23)
    expect(growth!.width / columnWidth).toBeLessThan(0.27)

    await expect(page.locator('.battle')).toBeVisible()
    await expect(page.locator('.stage-map-compact__stage')).toHaveCount(10)
    await expect(page.locator('.stage-map-compact__stage[aria-current="step"]')).toBeVisible()
    await expect(page.locator('.combat-log-panel')).toBeVisible()

    const growthTabs = page.getByRole('tablist', { name: '성장 메뉴' })
    const equipmentTab = growthTabs.getByRole('tab', { name: /장비/ })
    const skillTab = growthTabs.getByRole('tab', { name: '스킬', exact: true })
    const companionTab = growthTabs.getByRole('tab', { name: '동료', exact: true })
    const equipmentPanel = page.locator('#growth-tabpanel-equipment')
    const skillPanel = page.locator('#growth-tabpanel-skill')
    const companionPanel = page.locator('#growth-tabpanel-companion')

    await expect(growthTabs).toBeVisible()
    await expect(equipmentTab).toHaveAttribute('aria-selected', 'true')
    await expect(equipmentTab).toHaveAttribute('tabindex', '0')
    await expect(skillTab).toHaveAttribute('aria-selected', 'false')
    await expect(skillTab).toHaveAttribute('tabindex', '-1')
    await expect(companionTab).toHaveAttribute('aria-selected', 'false')
    await expect(equipmentPanel).toBeVisible()
    await expect(skillPanel).not.toBeVisible()
    await expect(companionPanel).not.toBeVisible()

    await equipmentTab.focus()
    await page.keyboard.press('ArrowRight')
    await expect(skillTab).toBeFocused()
    await expect(skillTab).toHaveAttribute('aria-selected', 'true')
    await expect(equipmentPanel).not.toBeVisible()
    await expect(skillPanel).toBeVisible()
    await expect(companionPanel).not.toBeVisible()

    await page.keyboard.press('End')
    await expect(companionTab).toBeFocused()
    await expect(companionTab).toHaveAttribute('aria-selected', 'true')
    await expect(skillPanel).not.toBeVisible()
    await expect(companionPanel).toBeVisible()

    await page.keyboard.press('Home')
    await expect(equipmentTab).toBeFocused()
    await expect(equipmentTab).toHaveAttribute('aria-selected', 'true')
    await expect(equipmentPanel).toBeVisible()

    for (const control of [
      page.locator('.prestige-panel button'),
      page.locator('.save-transfer__actions button'),
      page.locator('.save-transfer__actions .file-button'),
    ]) {
      await control.scrollIntoViewIfNeeded()
      await expect(control).toBeAttached()
      const insidePane = await control.evaluate((element) => {
        const controlRect = element.getBoundingClientRect()
        const paneRect = element.closest<HTMLElement>('.dashboard-pane--management')!
          .getBoundingClientRect()
        return controlRect.top >= paneRect.top - 1 && controlRect.bottom <= paneRect.bottom + 1
      })
      expect(insidePane).toBe(true)
      expect(await page.evaluate(() => window.scrollY)).toBe(0)
    }

    const campaignPane = page.locator('.dashboard-pane--campaign')
    await page.getByRole('button', { name: '원정 지도 열기' }).click()
    const paneBeforeScroll = await campaignPane.evaluate((element) => ({
      overflowY: getComputedStyle(element).overflowY,
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      scrollTop: element.scrollTop,
    }))
    expect(['auto', 'scroll']).toContain(paneBeforeScroll.overflowY)
    expect(paneBeforeScroll.scrollHeight).toBeGreaterThan(paneBeforeScroll.clientHeight)
    expect(paneBeforeScroll.scrollTop).toBe(0)

    await campaignPane.evaluate((element) => {
      element.scrollTop = element.scrollHeight
    })
    await expect.poll(() => campaignPane.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
    expect(await page.evaluate(() => window.scrollY)).toBe(0)
    expect(browserErrors).toEqual([])
  })
}

test.describe('IRPG-414 mobile flow', () => {
  test.use({ viewport: { width: 360, height: 800 } })

  test('keeps the vertical document flow and exposes every growth panel', async ({
    context,
    page,
  }, testInfo) => {
    const browserErrors: string[] = []
    collectBrowserErrors(page, browserErrors)
    await context.clock.setFixedTime(STARTED_AT)
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('● 자동 저장 정상', { exact: true })).toBeVisible()
    await expect(page.locator('.enemy-portrait__asset')).toHaveAttribute('data-state', 'loaded')
    await testInfo.attach('irpg-414-dashboard-360x800.png', {
      body: await page.screenshot({ animations: 'disabled' }),
      contentType: 'image/png',
    })

    const geometry = await page.evaluate(() => {
      const columns = [
        document.querySelector<HTMLElement>('.dashboard-column--battle')!,
        document.querySelector<HTMLElement>('.dashboard-column--journey')!,
        document.querySelector<HTMLElement>('.dashboard-column--growth')!,
      ].map((element) => {
        const rect = element.getBoundingClientRect()
        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }
      })
      return {
        clientWidth: document.documentElement.clientWidth,
        clientHeight: document.documentElement.clientHeight,
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight,
        bodyScrollWidth: document.body.scrollWidth,
        columns,
      }
    })

    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth)
    expect(geometry.bodyScrollWidth).toBeLessThanOrEqual(geometry.clientWidth)
    expect(geometry.scrollHeight).toBeGreaterThan(geometry.clientHeight)
    expect(geometry.columns[0]!.bottom).toBeLessThanOrEqual(geometry.columns[1]!.top + 1)
    expect(geometry.columns[1]!.bottom).toBeLessThanOrEqual(geometry.columns[2]!.top + 1)
    for (const column of geometry.columns) {
      expect(column.left).toBeGreaterThanOrEqual(0)
      expect(column.right).toBeLessThanOrEqual(geometry.clientWidth)
    }

    const mobileTablist = page.locator('.growth-tabs__tablist')
    await expect(mobileTablist).toHaveCount(0)
    await expect(page.getByRole('tab')).toHaveCount(0)
    await expect(page.getByRole('tabpanel')).toHaveCount(0)
    await expect(page.locator('#growth-tabpanel-equipment')).toBeVisible()
    await expect(page.locator('#growth-tabpanel-skill')).toBeVisible()
    await expect(page.locator('#growth-tabpanel-companion')).toBeVisible()
    await expect(page.getByRole('region', { name: '성장 장비' })).toBeVisible()
    await expect(page.getByRole('region', { name: '스킬 각인' })).toBeVisible()
    await expect(page.getByRole('region', { name: '동료 원정대' })).toBeVisible()
    expect(browserErrors).toEqual([])
  })
})
