import { expect, test, type Locator, type Page } from '@playwright/test'

const STARTED_AT = new Date('2026-07-18T08:00:00.000Z')

test.describe.configure({ mode: 'serial', timeout: 60_000 })

async function acceptNextConfirmation(page: Page) {
  page.once('dialog', (dialog) => void dialog.accept())
}

async function openDebugSessionAtStage(page: Page, stage: number) {
  await page.goto('/')
  await expect(page.getByText('● 자동 저장 정상', { exact: true })).toBeVisible()
  await acceptNextConfirmation(page)
  await page.getByRole('button', { name: '개발자 패널' }).click()

  const panel = page.getByTestId('debug-panel')
  await expect(panel).toBeVisible()
  await expect(page.getByTestId('debug-save-isolation-status')).toHaveText(
    '● DEBUG · 저장 격리',
  )
  await panel.getByLabel('스테이지 (1–300)').fill(String(stage))
  await panel.getByRole('button', { name: '이동' }).click()
  await expect(panel.getByRole('status')).toContainText(
    `${stage} 스테이지 상태를 재현했습니다.`,
  )
  await expectDebugStage(panel, stage)
  return panel
}

async function openStageMap(page: Page) {
  const mapTab = page.getByRole('tab', { name: '지도' })
  if (await mapTab.getAttribute('aria-selected') !== 'true') await mapTab.click()
  const intelPanel = page.locator('[data-intel-panel="map"]')
  await expect(intelPanel).toBeVisible()
  const toggle = intelPanel.locator('.stage-map-disclosure__toggle')
  await expect(toggle).toHaveAccessibleName('원정 지도 열기')
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await expect(toggle).toHaveAccessibleName('원정 지도 접기')

  const map = intelPanel.locator('.stage-map-panel')
  await expect(map).toBeVisible()
  return map
}

function debugStageValue(panel: Locator) {
  return panel.locator('.debug-panel__summary span').filter({ hasText: '스테이지' }).locator('strong')
}

async function expectDebugStage(panel: Locator, stage: number) {
  await expect(debugStageValue(panel)).toHaveText(String(stage))
}

async function expectOneRovingNode(map: Locator, expectedStage: number) {
  const rovingNodes = map.locator('.stage-map-node[tabindex="0"]')
  await expect(rovingNodes).toHaveCount(1)
  await expect(rovingNodes).toHaveAttribute('data-testid', `stage-map-node-${expectedStage}`)
}

test.describe('IRPG-408 stage map browser contract', () => {
  test.use({ viewport: { width: 360, height: 800 } })

  test('renders the stage-105 frontier at 360px without clipped or undersized commands', async ({
    context,
    page,
  }, testInfo) => {
    await context.clock.setFixedTime(STARTED_AT)
    await openDebugSessionAtStage(page, 105)
    const map = await openStageMap(page)

    await expect(page.getByRole('tab', { name: /월락 고개/ })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    await expect(map.locator('.stage-map-node')).toHaveCount(100)
    await expect(page.getByTestId('stage-map-node-104')).toHaveAttribute(
      'data-stage-state',
      'completed',
    )
    await expect(page.getByTestId('stage-map-node-105')).toHaveAttribute(
      'data-stage-state',
      'frontier',
    )
    await expect(page.getByTestId('stage-map-node-105')).toHaveAttribute(
      'aria-current',
      'step',
    )
    await expect(page.getByTestId('stage-map-node-106')).toHaveAttribute(
      'data-stage-state',
      'locked',
    )
    await expect(page.getByTestId('stage-map-node-106')).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    await expect(page.getByTestId('stage-map-node-110')).toHaveAttribute(
      'data-boss',
      'true',
    )
    await expectOneRovingNode(map, 105)

    const geometry = await page.evaluate(() => {
      const controls = Array.from(
        document.querySelectorAll<HTMLElement>('.stage-map-disclosure button'),
      )
        .filter((element) => {
          const style = getComputedStyle(element)
          const rect = element.getBoundingClientRect()
          return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0
        })
        .map((element) => {
          const rect = element.getBoundingClientRect()
          return {
            label: element.getAttribute('aria-label') ?? element.textContent?.trim() ?? '',
            left: rect.left,
            right: rect.right,
            width: rect.width,
            height: rect.height,
          }
        })
      return {
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
        undersized: controls.filter(({ width, height }) => width < 44 || height < 44),
        clipped: controls.filter(
          ({ left, right }) => left < -0.5 || right > window.innerWidth + 0.5,
        ),
      }
    })

    expect(geometry.clientWidth).toBe(360)
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth)
    expect(geometry.viewportWidth).toBe(360)
    expect(geometry.undersized).toEqual([])
    expect(geometry.clipped).toEqual([])

    await map.screenshot({
      path: testInfo.outputPath('irpg-408-stage-map-105-360.png'),
      animations: 'disabled',
    })
  })
})

test('preserves all-region keyboard navigation at 200% zoom without horizontal overflow', async ({
  context,
  page,
}) => {
  await page.setViewportSize({ width: 720, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await context.clock.setFixedTime(STARTED_AT)
  await openDebugSessionAtStage(page, 105)
  await page.evaluate(() => {
    document.documentElement.style.zoom = '2'
  })

  const map = await openStageMap(page)
  const expectNoHorizontalOverflow = async () => {
    const geometry = await page.evaluate(() => {
      const controls = Array.from(
        document.querySelectorAll<HTMLElement>('.stage-map-disclosure button'),
      )
        .filter((element) => {
          const rect = element.getBoundingClientRect()
          const style = getComputedStyle(element)
          return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden'
        })
        .map((element) => {
          const rect = element.getBoundingClientRect()
          return { left: rect.left, right: rect.right }
        })
      return {
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
        clipped: controls.filter(
          ({ left, right }) => left < -0.5 || right > window.innerWidth + 0.5,
        ),
      }
    })
    expect(geometry.viewportWidth).toBe(720)
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth)
    expect(geometry.clipped).toEqual([])
  }

  const moonfall = page.getByRole('tab', { name: /월락 고개/ })
  await moonfall.focus()
  await expect(moonfall).toBeFocused()
  await expectNoHorizontalOverflow()

  await moonfall.press('ArrowRight')
  const caldera = page.getByRole('tab', { name: /잊힌 칼데라/ })
  await expect(caldera).toBeFocused()
  await expect(caldera).toHaveAttribute('aria-selected', 'true')
  await expectOneRovingNode(map, 205)
  await expectNoHorizontalOverflow()

  await caldera.press('ArrowRight')
  const border = page.getByRole('tab', { name: /재의 변경/ })
  await expect(border).toBeFocused()
  await expect(border).toHaveAttribute('aria-selected', 'true')
  await expectOneRovingNode(map, 5)
  await expectNoHorizontalOverflow()

  await border.press('ArrowRight')
  await expect(moonfall).toBeFocused()
  await expect(moonfall).toHaveAttribute('aria-selected', 'true')
  await expectOneRovingNode(map, 105)
  await expect(page.getByTestId('stage-map-node-106')).toHaveAccessibleName(
    /스테이지 106.*잠김.*현재 최고 105/,
  )

  await page.getByTestId('stage-map-node-105').focus()
  await page.keyboard.press('PageDown')
  await expect(page.getByTestId('stage-map-node-205')).toBeFocused()
  await expect(caldera).toHaveAttribute('aria-selected', 'true')
  await expectOneRovingNode(map, 205)
  await expectNoHorizontalOverflow()
})

test('blocks locked stage commands and selects an unlocked stage through the debug fixture', async ({
  context,
  page,
}) => {
  await context.clock.setFixedTime(STARTED_AT)
  const panel = await openDebugSessionAtStage(page, 105)
  const map = await openStageMap(page)
  const locked = page.getByTestId('stage-map-node-106')

  await locked.dispatchEvent('click')
  await expectDebugStage(panel, 105)
  await locked.focus()
  await page.keyboard.press('Enter')
  await expectDebugStage(panel, 105)
  await page.keyboard.press('Space')
  await expectDebugStage(panel, 105)
  await expect(locked).toHaveAttribute('aria-disabled', 'true')

  const completed = page.getByTestId('stage-map-node-104')
  await completed.click()
  await expectDebugStage(panel, 104)
  await expect(completed).toHaveAttribute('aria-current', 'step')
  await expect(completed).toHaveAttribute('data-stage-state', 'completed')
  await expectOneRovingNode(map, 104)
})

test('supports wrapped region tabs and one-node roving navigation across region pages', async ({
  context,
  page,
}) => {
  await context.clock.setFixedTime(STARTED_AT)
  await openDebugSessionAtStage(page, 105)
  const map = await openStageMap(page)

  const moonfall = page.getByRole('tab', { name: /월락 고개/ })
  await moonfall.focus()
  await moonfall.press('ArrowRight')
  const caldera = page.getByRole('tab', { name: /잊힌 칼데라/ })
  await expect(caldera).toBeFocused()
  await expect(caldera).toHaveAttribute('aria-selected', 'true')
  await expectOneRovingNode(map, 205)

  await caldera.press('ArrowRight')
  const border = page.getByRole('tab', { name: /재의 변경/ })
  await expect(border).toBeFocused()
  await expect(border).toHaveAttribute('aria-selected', 'true')
  await expectOneRovingNode(map, 5)

  await border.press('ArrowLeft')
  await expect(caldera).toBeFocused()
  await caldera.press('ArrowLeft')
  await expect(moonfall).toBeFocused()
  await expectOneRovingNode(map, 105)

  const stage105 = page.getByTestId('stage-map-node-105')
  await stage105.focus()
  await stage105.press('ArrowRight')
  await expect(page.getByTestId('stage-map-node-106')).toBeFocused()
  await expectOneRovingNode(map, 106)

  await page.keyboard.press('Home')
  await expect(page.getByTestId('stage-map-node-101')).toBeFocused()
  await page.keyboard.press('End')
  await expect(page.getByTestId('stage-map-node-200')).toBeFocused()

  await page.keyboard.press('PageDown')
  await expect(page.getByTestId('stage-map-node-300')).toBeFocused()
  await expect(caldera).toHaveAttribute('aria-selected', 'true')
  await expectOneRovingNode(map, 300)
  await page.keyboard.press('PageDown')
  await expect(page.getByTestId('stage-map-node-300')).toBeFocused()

  await page.keyboard.press('PageUp')
  await expect(page.getByTestId('stage-map-node-200')).toBeFocused()
  await expect(moonfall).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('PageUp')
  await expect(page.getByTestId('stage-map-node-100')).toBeFocused()
  await expect(border).toHaveAttribute('aria-selected', 'true')
  await expectOneRovingNode(map, 100)
  await page.keyboard.press('PageUp')
  await expect(page.getByTestId('stage-map-node-100')).toBeFocused()
})

test('uses the region fallback after corrupt image decode while map commands keep working', async ({
  context,
  page,
}) => {
  await context.clock.setFixedTime(STARTED_AT)
  await page.route(/\/moonfall-pass[^/]*\.webp(?:\?.*)?$/, async (route) => {
    if (route.request().resourceType() !== 'image') {
      await route.continue()
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'image/webp',
      body: 'irpg-408-corrupt-region',
    })
  })

  const panel = await openDebugSessionAtStage(page, 105)
  await openStageMap(page)
  const art = page.locator('.stage-map-scene__art')
  await expect(art).toHaveAttribute('data-asset-id', 'region.moonfall-pass')
  await expect(art).toHaveAttribute('data-resolved-asset-id', 'fallback.region')
  await expect(art).toHaveAttribute('data-state', 'fallback')

  await page.getByTestId('stage-map-node-104').click()
  await expectDebugStage(panel, 104)
  await expect(page.getByTestId('stage-map-node-104')).toHaveAttribute(
    'aria-current',
    'step',
  )
})

test('does not move the selected tab or roving focus when automatic combat advances', async ({
  context,
  page,
}) => {
  await context.clock.setFixedTime(STARTED_AT)
  const panel = await openDebugSessionAtStage(page, 1)
  await panel.getByRole('radio', { name: '10x' }).check()
  await expect(panel.getByRole('radio', { name: '10x' })).toBeChecked()

  const map = await openStageMap(page)
  const stage1 = page.getByTestId('stage-map-node-1')
  await stage1.focus()
  for (let step = 0; step < 4; step += 1) await page.keyboard.press('ArrowRight')
  const chosenFocus = page.getByTestId('stage-map-node-5')
  await expect(chosenFocus).toBeFocused()
  await expectOneRovingNode(map, 5)
  await expect(stage1).toHaveAttribute('aria-current', 'step')

  await context.clock.setFixedTime(new Date(STARTED_AT.getTime() + 6_000))
  await expect.poll(async () => Number(await debugStageValue(panel).textContent())).toBeGreaterThan(1)

  await expect(page.getByRole('tab', { name: /재의 변경/ })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await expect(chosenFocus).toBeFocused()
  await expectOneRovingNode(map, 5)
  await expect(stage1).not.toHaveAttribute('aria-current', 'step')
  await expect(map.locator('.stage-map-node[aria-current="step"]')).toHaveCount(1)
})
