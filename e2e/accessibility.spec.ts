import { expect, test, type Locator, type Page } from '@playwright/test'
import { createInitialState } from '../src/game/engine'
import { createPortableSave } from '../src/game/saveTransfer'

const STARTED_AT = new Date('2026-07-17T03:00:00.000Z')

function collectBrowserErrors(page: Page, errors: string[]) {
  page.on('pageerror', (error) => errors.push(`page: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`)
  })
}

async function tabTo(page: Page, target: Locator, maximumTabs = 40) {
  for (let index = 0; index < maximumTabs; index += 1) {
    await page.keyboard.press('Tab')
    if (await target.evaluate((element) => document.activeElement === element)) return
  }
  throw new Error(`Could not reach ${await target.getAttribute('aria-label')} with Tab`)
}

async function expectMinimumTarget(target: Locator, viewportWidth: number) {
  const box = await target.boundingBox()
  expect(box).not.toBeNull()
  expect(box!.width).toBeGreaterThanOrEqual(44)
  expect(box!.height).toBeGreaterThanOrEqual(44)
  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewportWidth)
}

test.describe('360px keyboard and screenreader semantics', () => {
  test.use({ viewport: { width: 360, height: 800 } })

  test('keeps controls in view and completes the core flow by keyboard', async ({
    context,
    page,
  }, testInfo) => {
    test.setTimeout(180_000)
    const browserErrors: string[] = []
    collectBrowserErrors(page, browserErrors)
    await context.clock.setFixedTime(STARTED_AT)
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('● 자동 저장 정상', { exact: true })).toBeVisible()

    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }))
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth)

    const targets = page.locator('button:visible, a.brand:visible, label.file-button:visible')
    for (let index = 0; index < (await targets.count()); index += 1) {
      await targets.nth(index).scrollIntoViewIfNeeded()
      await expectMinimumTarget(targets.nth(index), 360)
    }

    await expect(page.getByRole('banner')).toBeVisible()
    await expect(page.getByRole('main')).toBeVisible()
    await expect(page.getByRole('group', { name: '보유 자원' })).toBeVisible()
    for (const name of [
      /스테이지 1/,
      '전술 명령 빠른 슬롯',
      '전술 정보실',
    ]) {
      await expect(page.getByRole('region', { name })).toBeVisible()
    }
    await expect(page.getByRole('radiogroup', { name: '전투 및 캠프 화면' }))
      .toBeVisible()
    await expect(page.getByRole('toolbar', { name: '전술 슬롯바' })).toBeVisible()
    await expect(page.getByRole('group', { name: '원정 보조 기능' })).toBeVisible()
    for (const name of ['전투 로그', '승패 결과', '불씨의 계승', '저장 백업']) {
      await expect(page.getByRole('button', { name })).toHaveAttribute(
        'aria-expanded',
        'false',
      )
    }
    await expect(page.locator('.ambient[aria-hidden="true"]')).toHaveCount(2)
    await expect(page.locator('.tactical-actor__asset[aria-hidden="true"]')).toHaveCount(2)
    await expect(page.locator(
      '[data-action-kind="equipment"] .tactical-action-bar__slot-asset[aria-hidden="true"], '
      + '[data-action-kind="skill"] .tactical-action-bar__slot-asset[aria-hidden="true"]',
    )).toHaveCount(6)
    await expect(page.locator(
      '[data-action-slot="companion"] .tactical-action-bar__slot-asset[aria-hidden="true"]',
    )).toHaveCount(1)
    await expect(page.getByRole('tablist', { name: '전술 정보 메뉴' })).toBeVisible()
    await expect(page.getByRole('tab')).toHaveCount(5)

    await page.keyboard.press('Tab')
    const skipLink = page.getByRole('link', { name: '본문 바로가기' })
    await expect(skipLink).toBeFocused()
    await expectMinimumTarget(skipLink, 360)
    await expect(skipLink).toHaveCSS('outline-style', 'solid')
    await page.keyboard.press('Enter')
    const main = page.locator('#main-content')
    await expect(main).toBeFocused()
    await expect(main).toHaveCSS('outline-style', 'solid')

    await expect(
      page.getByTestId('tactical-canvas').getByRole('progressbar', { name: '적 체력' }),
    ).toHaveAttribute('aria-valuetext', /34 \/ 34, 100%/)
    await expect(page.getByRole('progressbar', { name: '영웅 체력' }))
      .toHaveAttribute('aria-valuemax', '100')

    await context.clock.setFixedTime(new Date(STARTED_AT.getTime() + 6_000))
    const weaponSlot = page.locator('[data-action-slot="weapon"]')
    await tabTo(page, weaponSlot)
    await expect(weaponSlot).toHaveCSS('outline-style', 'solid')
    await page.keyboard.press('Enter')
    const weaponDetail = page.locator('[data-action-detail="weapon"]')
    const weaponButton = weaponDetail.getByRole('button', { name: /불씨 검 강화/ })
    await expect(weaponButton).toBeEnabled()
    await tabTo(page, weaponButton, 10)
    await page.keyboard.press('Enter')
    await expect(weaponSlot).toContainText('Lv.1')

    const backup = createPortableSave(createInitialState(STARTED_AT.getTime()), STARTED_AT.getTime())!
    const backupTrigger = page.getByRole('button', { name: '저장 백업' })
    await tabTo(page, backupTrigger, 80)
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('tactical-utility-panel')).toHaveAttribute(
      'data-utility-panel',
      'backup',
    )
    const fileInput = page.getByLabel('저장 파일 선택')
    await tabTo(page, fileInput)
    await expect(page.locator('label.file-button')).toHaveCSS('outline-style', 'solid')
    await fileInput.setInputFiles({
      name: 'a11y-backup.json',
      mimeType: 'application/json',
      buffer: Buffer.from(backup),
    })
    const dialog = page.getByRole('dialog', { name: '이 진행으로 복원할까요?' })
    const cancel = dialog.getByRole('button', { name: '취소' })
    const restore = dialog.getByRole('button', { name: '검증된 저장 복원' })
    await expect(cancel).toBeFocused()
    await expectMinimumTarget(cancel, 360)
    await expectMinimumTarget(restore, 360)

    await dialog.focus()
    await page.keyboard.press('Shift+Tab')
    await expect(restore).toBeFocused()
    await main.focus()
    await expect(cancel).toBeFocused()
    await page.keyboard.press('Shift+Tab')
    await expect(restore).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(cancel).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(fileInput).toBeFocused()

    await page.screenshot({ path: testInfo.outputPath('irpg-403-360.png'), fullPage: true })
    expect(browserErrors).toEqual([])
  })
})

test.describe('zoom and reduced motion', () => {
  test.use({ viewport: { width: 720, height: 900 } })

  test('removes continuous motion and preserves a 360px effective layout at 200%', async ({
    page,
  }) => {
    const browserErrors: string[] = []
    collectBrowserErrors(page, browserErrors)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: '꺼지지 않는 원정' })).toBeVisible()
    await page.evaluate(() => {
      document.documentElement.style.zoom = '2'
    })

    const audit = await page.evaluate(() => {
      const liveDot = document.querySelector<HTMLElement>('.live-badge i')!
      const hero = document.querySelector<HTMLElement>('.tactical-actor__asset--hero')!
      const enemy = document.querySelector<HTMLElement>('.tactical-actor__asset--enemy')!
      const progress = document.querySelector<HTMLElement>('.stat-bar__fill')!
      const targets = Array.from(
        document.querySelectorAll<HTMLElement>('button, a.brand, label.file-button'),
      )
        .filter((element) => {
          const rect = element.getBoundingClientRect()
          const style = getComputedStyle(element)
          return rect.width > 0
            && rect.height > 0
            && style.visibility !== 'hidden'
            && element.closest('.tactical-action-bar__slots') === null
        })
        .map((element) => {
          const rect = element.getBoundingClientRect()
          return { left: rect.left, right: rect.right, text: element.textContent?.trim() ?? '' }
        })
      return {
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
        clippedTargets: targets.filter(
          ({ left, right }) => left < -0.5 || right > window.innerWidth + 0.5,
        ),
        liveAnimation: getComputedStyle(liveDot).animationName,
        heroAnimation: getComputedStyle(hero).animationName,
        enemyAnimation: getComputedStyle(enemy).animationName,
        progressTransition: getComputedStyle(progress).transitionDuration,
      }
    })

    expect(audit.scrollWidth).toBeLessThanOrEqual(audit.clientWidth)
    expect(audit.clippedTargets).toEqual([])
    expect(audit.liveAnimation).toBe('none')
    expect(audit.heroAnimation).toBe('none')
    expect(audit.enemyAnimation).toBe('none')
    expect(audit.progressTransition).toBe('0s')
    expect(browserErrors).toEqual([])
  })
})
