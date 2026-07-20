import { expect, test, type Locator, type Page } from '@playwright/test'

const FIXED_NOW = new Date('2026-01-01T00:00:00.000Z')
const FOREGROUND_NOW = new Date('2026-07-19T00:00:00.000Z')

function observeBrowserErrors(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(`page: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`)
  })
  return errors
}

async function acceptNextConfirmation(page: Page) {
  page.once('dialog', (dialog) => void dialog.accept())
}

async function enterDebugSession(page: Page) {
  await page.goto('/')
  await expect(page.getByText('● 자동 저장 정상', { exact: true })).toBeVisible()
  await acceptNextConfirmation(page)
  await page.getByRole('button', { name: '개발자 패널' }).click()
  await expect(page.getByTestId('debug-panel')).toBeVisible()
  await expect(page.getByTestId('debug-save-isolation-status')).toHaveText(
    '● DEBUG · 저장 격리',
  )
}

async function applyResultFixture(
  page: Page,
  fixtureId: 'visual.result.boss-victory' | 'visual.result.defeat',
) {
  const expected = fixtureId === 'visual.result.boss-victory'
    ? {
        stateHash: 'fnv1a32-v1:4646250d',
        eventHash: 'fnv1a32-v1:b6a6c062',
      }
    : {
        stateHash: 'fnv1a32-v1:9590030d',
        eventHash: 'fnv1a32-v1:492c61f7',
      }
  const panel = page.getByTestId('debug-panel')
  await panel.getByLabel('시각 회귀 fixture').selectOption(fixtureId)
  await panel.getByRole('button', { name: 'fixture 적용' }).click()
  const root = page.getByTestId('visual-fixture-root')
  await expect(root).toHaveAttribute('data-visual-fixture-id', fixtureId)
  await expect(root).toHaveAttribute('data-canonical-state-hash', expected.stateHash)
  await expect(root).toHaveAttribute('data-canonical-event-hash', expected.eventHash)
  return root
}

async function openResultsTool(page: Page) {
  const trigger = page.getByRole('button', { name: '승패 결과' })
  if (await trigger.getAttribute('aria-expanded') !== 'true') await trigger.click()
  await expect(page.getByTestId('tactical-utility-panel')).toHaveAttribute(
    'data-utility-panel',
    'results',
  )
}

function resultFact(dialog: Locator, label: string) {
  return dialog.locator('.combat-result-dialog__facts > div').filter({
    hasText: label,
  }).locator('dd')
}

test.describe('IRPG-410 foreground result status', () => {
  test.use({ viewport: { width: 360, height: 800 } })

  test('does not steal focus or open a dialog when a deterministic defeat arrives', async ({
    context,
    page,
  }) => {
    const browserErrors = observeBrowserErrors(page)
    await context.clock.setFixedTime(FOREGROUND_NOW)
    await page.goto('/')
    await expect(page.getByText('● 자동 저장 정상', { exact: true })).toBeVisible()

    const stageMapToggle = page.getByRole('button', { name: '3지역 원정 지도 열기' })
    await stageMapToggle.focus()
    await expect(stageMapToggle).toBeFocused()
    await context.clock.setFixedTime(new Date(FOREGROUND_NOW.getTime() + 50_000))

    await expect(stageMapToggle).toBeFocused()
    await expect(page.getByTestId('combat-result-dialog')).toHaveCount(0)
    await expect(page.getByTestId('tactical-utility-result-announcement')).toContainText(
      '새 전투 결과: 스테이지 10 패배, 스테이지 9 복귀',
    )
    await openResultsTool(page)
    const detailButton = page.getByRole('button', {
      name: '스테이지 10 패배 · 스테이지 9 복귀 상세 보기',
    })
    await expect(detailButton).toBeVisible()
    await expect(page.getByTestId('combat-result-list').getByRole('listitem')).toHaveCount(1)
    expect(browserErrors).toEqual([])
  })
})

test.describe('IRPG-410 deterministic result details', () => {
  test('shows the paid boss snapshot without mutating state and restores the opener', async ({
    context,
    page,
  }) => {
    const browserErrors = observeBrowserErrors(page)
    await context.clock.setFixedTime(FIXED_NOW)
    await enterDebugSession(page)
    const root = await applyResultFixture(page, 'visual.result.boss-victory')
    await openResultsTool(page)
    const canonicalHash = await root.getAttribute('data-canonical-state-hash')
    expect(canonicalHash).not.toBeNull()

    await expect(page.getByTestId('combat-result-dialog')).toHaveCount(0)
    await expect(page.locator('[data-asset-id^="result."]')).toHaveCount(0)
    await expect(page.getByTestId('tactical-utility-result-announcement')).toHaveText(
      '새 전투 결과: 스테이지 10 보스 승리. 라운드 51.',
    )

    const opener = page.getByRole('button', {
      name: '스테이지 10 보스 승리 상세 보기',
    })
    await opener.click()
    const dialog = page.getByTestId('combat-result-dialog')
    await expect(dialog).toHaveAttribute('data-result-type', 'bossVictory')
    await expect(dialog).toHaveAccessibleName('스테이지 10 보스 승리')
    await expect(dialog.locator('[data-asset-id="result.boss-victory"]'))
      .toHaveAttribute('data-state', 'loaded')
    await expect(resultFact(dialog, '기본 골드 정산값')).toHaveText('+240')
    await expect(resultFact(dialog, '기본 경험치 정산값')).toHaveText('+120 XP')
    await expect(resultFact(dialog, '원정 진행')).toHaveText('다음 스테이지 11')
    await expect(resultFact(dialog, '정산 뒤 보유 골드')).toHaveText('1,495')
    await expect(dialog.getByText(/실제 지급/)).toContainText('+15 골드')
    await expect(root).toHaveAttribute('data-canonical-state-hash', canonicalHash!)

    const close = dialog.getByRole('button', { name: '결과 닫기' })
    await expect(close).toBeFocused()
    await dialog.focus()
    await page.keyboard.press('Shift+Tab')
    await expect(close).toBeFocused()
    await page.locator('#main-content').focus()
    await expect(close).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(opener).toBeFocused()
    await expect(root).toHaveAttribute('data-canonical-state-hash', canonicalHash!)
    expect(browserErrors).toEqual([])
  })

  test('shows the immutable defeat, return, and highest-stage snapshot', async ({
    context,
    page,
  }) => {
    const browserErrors = observeBrowserErrors(page)
    await context.clock.setFixedTime(FIXED_NOW)
    await enterDebugSession(page)
    const root = await applyResultFixture(page, 'visual.result.defeat')
    await openResultsTool(page)
    const canonicalHash = await root.getAttribute('data-canonical-state-hash')
    expect(canonicalHash).not.toBeNull()

    await page.getByRole('button', {
      name: '스테이지 10 패배 · 스테이지 9 복귀 상세 보기',
    }).click()
    const dialog = page.getByTestId('combat-result-dialog')
    await expect(dialog).toHaveAttribute('data-result-type', 'defeat')
    await expect(dialog).toHaveAccessibleName('스테이지 10 패배')
    await expect(dialog.locator('[data-asset-id="result.defeat"]'))
      .toHaveAttribute('data-state', 'loaded')
    await expect(resultFact(dialog, '패배 스테이지')).toHaveText('10')
    await expect(resultFact(dialog, '복귀 스테이지')).toHaveText('9')
    await expect(resultFact(dialog, '유지된 최고 기록')).toHaveText('11')
    await expect(resultFact(dialog, '마지막 피해')).toHaveText('96')
    await expect(root).toHaveAttribute('data-canonical-state-hash', canonicalHash!)
    await dialog.getByRole('button', { name: '결과 닫기' }).click()
    await expect(root).toHaveAttribute('data-canonical-state-hash', canonicalHash!)
    expect(browserErrors).toEqual([])
  })

  test('keeps a pinned result open while foreground combat continues', async ({
    context,
    page,
  }) => {
    await context.clock.setFixedTime(FIXED_NOW)
    await enterDebugSession(page)
    const root = await applyResultFixture(page, 'visual.result.defeat')
    await openResultsTool(page)
    await page.getByRole('button', {
      name: '스테이지 10 패배 · 스테이지 9 복귀 상세 보기',
    }).click()
    const dialog = page.getByTestId('combat-result-dialog')
    const before = await root.getAttribute('data-canonical-state-hash')

    await context.clock.setFixedTime(new Date(FIXED_NOW.getTime() + 1_000))

    await expect(root).not.toHaveAttribute('data-canonical-state-hash', before!)
    await expect(dialog).toBeVisible()
    await expect(dialog).toHaveAccessibleName('스테이지 10 패배')
  })

  test('does not replay individual results after reload or offline reconciliation', async ({
    context,
    page,
  }) => {
    await context.clock.setFixedTime(FIXED_NOW)
    await enterDebugSession(page)
    await applyResultFixture(page, 'visual.result.boss-victory')
    await openResultsTool(page)
    await expect(page.getByTestId('combat-result-list').getByRole('listitem')).toHaveCount(1)

    await page.reload()
    await expect(page.getByTestId('debug-panel')).toBeVisible()
    await openResultsTool(page)
    await expect(page.getByText(/아직 보스 승리 또는 패배 결과가 없습니다/)).toBeVisible()
    await expect(page.getByTestId('tactical-utility-result-announcement')).toBeEmpty()

    const panel = page.getByTestId('debug-panel')
    await panel.getByLabel('오프라인 시간 (0–480분)').fill('1')
    await panel.getByRole('button', { name: '진행 적용' }).click()
    const offlineDialog = page.getByRole('dialog', { name: /쉬는 동안에도/ })
    await expect(offlineDialog).toBeVisible()
    await offlineDialog.getByRole('button', { name: '보상 확인' }).click()
    await openResultsTool(page)
    await expect(page.getByText(/아직 보스 승리 또는 패배 결과가 없습니다/)).toBeVisible()
    await expect(page.getByTestId('combat-result-list')).toHaveCount(0)
  })
})

test.describe('IRPG-410 fallback, zoom, and reduced motion', () => {
  test.use({ viewport: { width: 720, height: 900 } })

  test('keeps result HTML usable when the primary art is corrupt at 200% zoom', async ({
    context,
    page,
  }) => {
    const browserErrors = observeBrowserErrors(page)
    await context.clock.setFixedTime(FIXED_NOW)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.route(/\/boss-victory(?:-[^/]*)?\.webp(?:\?.*)?$/, async (route) => {
      if (route.request().resourceType() !== 'image') {
        await route.continue()
        return
      }
      await route.fulfill({
        status: 200,
        contentType: 'image/webp',
        body: 'irpg-410-corrupt-result',
      })
    })
    await enterDebugSession(page)
    await applyResultFixture(page, 'visual.result.boss-victory')
    await openResultsTool(page)
    await page.evaluate(() => {
      document.documentElement.style.zoom = '2'
    })
    await page.getByRole('button', {
      name: '스테이지 10 보스 승리 상세 보기',
    }).click()

    const dialog = page.getByTestId('combat-result-dialog')
    const art = dialog.locator('[data-asset-id="result.boss-victory"]')
    await expect(art).toHaveAttribute('data-state', 'fallback')
    await expect(art).toHaveAttribute('data-resolved-asset-id', 'fallback.result')
    await expect(resultFact(dialog, '기본 골드 정산값')).toHaveText('+240')
    await expect(dialog.getByText(/실제 지급/)).toContainText('+15 골드')

    const close = dialog.getByRole('button', { name: '결과 닫기' })
    await close.scrollIntoViewIfNeeded()
    const audit = await page.evaluate(() => {
      const surfaces = [
        document.querySelector<HTMLElement>('.combat-result-region')!,
        document.querySelector<HTMLElement>('.combat-result-dialog')!,
      ]
      const buttons = surfaces.flatMap((surface) =>
        [...surface.querySelectorAll<HTMLButtonElement>('button')]
          .filter((button) => {
            const rect = button.getBoundingClientRect()
            return rect.width > 0 && rect.height > 0
          })
          .map((button) => {
            const rect = button.getBoundingClientRect()
            return {
              name: button.textContent?.trim() ?? '',
              left: rect.left,
              right: rect.right,
              width: rect.width,
              height: rect.height,
            }
          }),
      )
      const moving = surfaces.flatMap((surface) =>
        [surface, ...surface.querySelectorAll<HTMLElement>('*')]
          .map((element) => {
            const style = getComputedStyle(element)
            return {
              className: element.className,
              animationName: style.animationName,
              animationDuration: style.animationDuration,
              transitionDuration: style.transitionDuration,
            }
          })
          .filter((entry) =>
            (entry.animationName !== 'none' && entry.animationDuration !== '0s') ||
            entry.transitionDuration.split(',').some((duration) => duration.trim() !== '0s'),
          ),
      )
      return {
        viewportWidth: window.innerWidth,
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        clippedButtons: buttons.filter(({ left, right }) => left < -0.5 || right > window.innerWidth + 0.5),
        undersizedButtons: buttons.filter(({ width, height }) => width < 44 || height < 44),
        moving,
      }
    })

    expect(audit.scrollWidth).toBeLessThanOrEqual(audit.clientWidth)
    expect(audit.clientWidth).toBe(audit.viewportWidth)
    expect(audit.clippedButtons).toEqual([])
    expect(audit.undersizedButtons).toEqual([])
    expect(audit.moving).toEqual([])
    expect(browserErrors).toEqual([])
  })
})
