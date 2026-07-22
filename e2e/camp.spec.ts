import { expect, test, type Page } from '@playwright/test'

const STARTED_AT = new Date('2026-07-20T00:00:00.000Z')

function collectBrowserErrors(page: Page, errors: string[]) {
  page.on('pageerror', (error) => errors.push(`page: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`)
  })
}

function goldValue(page: Page) {
  return page
    .getByLabel('보유 자원')
    .locator('div')
    .filter({ hasText: '골드' })
    .locator('strong')
}

test.describe('IRPG-418 battle and camp activity mode', () => {
  test('pauses foreground combat and reconciles a closed camp exactly once', async ({
    context,
  }) => {
    const browserErrors: string[] = []
    await context.clock.setFixedTime(STARTED_AT)
    let page = await context.newPage()
    collectBrowserErrors(page, browserErrors)
    await page.goto('/')
    await expect(page.getByText('● 자동 저장 정상', { exact: true })).toBeVisible()

    const stageBefore = await page.locator('.topbar__stage').innerText()
    const footerBefore = await page.locator('.dashboard-footer').innerText()
    let gold = goldValue(page)
    const goldBefore = await gold.innerText()

    await page.getByRole('radio', { name: '캠프 · 관리' }).click()
    await expect(page.getByTestId('camp-dashboard')).toBeVisible()
    await expect(page.getByTestId('tactical-layout')).toHaveCount(0)
    await expect(page.getByText('전경 전투 일시 정지')).toBeVisible()

    await context.clock.setFixedTime(new Date(STARTED_AT.getTime() + 6_000))
    await expect(page.getByText(/캠프에서 휴식 중|캠프에 진입했습니다/)).toBeVisible()
    await expect(page.locator('.topbar__stage')).toHaveText(stageBefore.replace(/\s+/g, ' '), {
      useInnerText: true,
    })
    expect((await page.locator('.dashboard-footer').innerText()).replace(/\s+/g, ' '))
      .toBe(footerBefore.replace(/\s+/g, ' '))
    await expect(gold).toHaveText(goldBefore)

    await page.close()
    await context.clock.setFixedTime(new Date(STARTED_AT.getTime() + 66_000))
    page = await context.newPage()
    collectBrowserErrors(page, browserErrors)
    await page.goto('/')
    gold = goldValue(page)

    const offlineDialog = page.getByRole('dialog', {
      name: '쉬는 동안에도 검은 멈추지 않았습니다',
    })
    await expect(offlineDialog).toBeVisible()
    await expect(offlineDialog).toContainText('1분 0초 동안의 자동 전투 결과입니다.')
    await expect(page.getByTestId('camp-dashboard')).toBeVisible()
    await expect(page.getByRole('radio', { name: '캠프 · 관리' }))
      .toHaveAttribute('aria-checked', 'true')

    await offlineDialog.getByRole('button', { name: '보상 확인' }).click()
    const goldAfterOffline = await gold.innerText()
    await page.reload()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.getByTestId('camp-dashboard')).toBeVisible()
    await expect(gold).toHaveText(goldAfterOffline)

    await page.getByRole('radio', { name: '전투 · 전술 전장' }).click()
    await expect(page.getByTestId('tactical-layout')).toBeVisible()
    await expect(page.getByTestId('camp-dashboard')).toHaveCount(0)
    expect(browserErrors).toEqual([])
  })

  test('supports keyboard switching without mobile overflow or motion', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    await expect(page.getByText('● 자동 저장 정상', { exact: true })).toBeVisible()

    const tactical = page.getByRole('radio', { name: '전투 · 전술 전장' })
    const camp = page.getByRole('radio', { name: '캠프 · 관리' })
    await tactical.focus()
    await tactical.press('ArrowRight')
    await expect(camp).toBeFocused()
    await expect(page.getByTestId('camp-dashboard')).toBeVisible()
    await camp.press('ArrowLeft')
    await expect(tactical).toBeFocused()
    await expect(page.getByTestId('tactical-layout')).toBeVisible()

    const geometry = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      controls: [...document.querySelectorAll<HTMLElement>('.game-mode-selector [role="radio"]')]
        .map((element) => {
          const rect = element.getBoundingClientRect()
          return { width: rect.width, height: rect.height }
        }),
      animations: [...document.querySelectorAll<HTMLElement>('.tactical-layout *')]
        .some((element) => getComputedStyle(element).animationName !== 'none'),
    }))
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth)
    expect(geometry.controls.every(({ height }) => height >= 44)).toBe(true)
    expect(geometry.animations).toBe(false)
  })

  test('reflows the 1440×900 desktop surface at a 200% equivalent viewport', async ({ page }) => {
    await page.setViewportSize({ width: 720, height: 450 })
    await page.goto('/')
    await page.getByRole('radio', { name: '캠프 · 관리' }).click()
    await expect(page.getByTestId('camp-dashboard')).toBeVisible()

    const geometry = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      modeControls: [...document.querySelectorAll<HTMLElement>('.game-mode-selector [role="radio"]')]
        .map((element) => {
          const rect = element.getBoundingClientRect()
          return { width: rect.width, height: rect.height }
        }),
    }))

    expect(geometry.clientWidth).toBe(720)
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth)
    expect(geometry.modeControls.every(({ height }) => height >= 44)).toBe(true)
    await expect(page.getByRole('heading', { name: '캠프 조감도' })).toBeVisible()
    await expect(page.getByRole('heading', { name: '관리 준비' })).toBeVisible()
  })
})
