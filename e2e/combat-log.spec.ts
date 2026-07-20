import { expect, test, type Page } from '@playwright/test'

const FIXED_NOW = new Date('2026-07-19T00:00:00.000Z')

async function acceptNextConfirmation(page: Page) {
  page.once('dialog', (dialog) => void dialog.accept())
}

async function enterDebugSession(page: Page) {
  await page.goto('/')
  await expect(page.getByText('● 자동 저장 정상', { exact: true })).toBeVisible()
  await acceptNextConfirmation(page)
  await page.getByRole('button', { name: '개발자 패널' }).click()
  await expect(page.getByTestId('debug-panel')).toBeVisible()
}

async function applyCombatLogFixture(page: Page) {
  const panel = page.getByTestId('debug-panel')
  await panel.getByLabel('시각 회귀 fixture').selectOption('visual.combat.event-log')
  await panel.getByRole('button', { name: 'fixture 적용' }).click()
  await expect(page.getByTestId('visual-fixture-root')).toHaveAttribute(
    'data-canonical-event-hash',
    'fnv1a32-v1:e0a7de25',
  )
}

async function openCombatLogTool(page: Page) {
  await page.getByRole('button', { name: '전투 로그' }).click()
  await expect(page.getByTestId('tactical-utility-panel')).toHaveAttribute(
    'data-utility-panel',
    'log',
  )
}

test.describe('IRPG-411 recent combat log', () => {
  test.use({ viewport: { width: 360, height: 800 } })

  test('bounds six event types, filters after the bound, and preserves keyboard focus', async ({
    context,
    page,
  }) => {
    await context.clock.setFixedTime(FIXED_NOW)
    await enterDebugSession(page)
    await applyCombatLogFixture(page)
    await openCombatLogTool(page)

    const openToggle = page.getByRole('button', { name: '전투 로그 펼치기' })
    await expect(openToggle).toHaveAttribute('aria-expanded', 'false')
    expect((await openToggle.boundingBox())?.height).toBeGreaterThanOrEqual(44)
    await openToggle.focus()
    await page.keyboard.press('Enter')
    const closeToggle = page.getByRole('button', { name: '전투 로그 접기' })
    await expect(closeToggle).toHaveAttribute('aria-expanded', 'true')
    await expect(closeToggle).toBeFocused()

    const list = page.getByTestId('combat-log-list')
    const entries = list.getByRole('listitem')
    await expect(entries).toHaveCount(20)
    await expect(entries.first()).toHaveAttribute('data-combat-event-type', 'skill')
    await expect(entries.last()).toHaveAttribute('data-combat-event-type', 'defeat')
    await expect(page.getByText('최근 20건 · 이전 4건 요약')).toBeVisible()
    for (const type of ['skill', 'critical', 'companionAssist', 'kill', 'bossVictory', 'defeat']) {
      await expect(list.locator(`[data-combat-event-type="${type}"]`).first()).toBeVisible()
    }

    await page.getByLabel('모두').uncheck()
    await expect(page.getByText('선택한 필터에 해당하는 최근 이벤트가 없습니다.'))
      .toBeVisible()
    await page.getByLabel('협공').check()
    await expect(list.getByRole('listitem')).toHaveCount(5)
    await expect(list.getByRole('listitem').first()).toContainText('불씨 여우 루미')

    const geometry = await page.evaluate(() => ({
      viewport: window.innerWidth,
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }))
    expect(geometry.client).toBe(geometry.viewport)
    expect(geometry.scroll).toBeLessThanOrEqual(geometry.client)
  })

  test('does not replay fixture events after reload or offline reconciliation', async ({
    context,
    page,
  }) => {
    await context.clock.setFixedTime(FIXED_NOW)
    await enterDebugSession(page)
    await applyCombatLogFixture(page)
    await openCombatLogTool(page)
    await page.getByRole('button', { name: '전투 로그 펼치기' }).click()
    await expect(page.getByTestId('combat-log-list').getByRole('listitem')).toHaveCount(20)

    await page.reload()
    await expect(page.getByTestId('debug-panel')).toBeVisible()
    await openCombatLogTool(page)
    await page.getByRole('button', { name: '전투 로그 펼치기' }).click()
    await expect(page.getByText('아직 기록된 전투 이벤트가 없습니다.')).toBeVisible()

    const panel = page.getByTestId('debug-panel')
    await panel.getByLabel('오프라인 시간 (0–480분)').fill('1')
    await panel.getByRole('button', { name: '진행 적용' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: '보상 확인' }).click()
    await openCombatLogTool(page)
    await page.getByRole('button', { name: '전투 로그 펼치기' }).click()
    await expect(page.getByText('아직 기록된 전투 이벤트가 없습니다.')).toBeVisible()
  })
})

test.describe('IRPG-411 zoom and reduced motion', () => {
  test.use({ viewport: { width: 720, height: 900 } })

  test('keeps the expanded log usable at a 360px effective width and 200% zoom', async ({
    context,
    page,
  }) => {
    await context.clock.setFixedTime(FIXED_NOW)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await enterDebugSession(page)
    await applyCombatLogFixture(page)
    await openCombatLogTool(page)
    await page.evaluate(() => {
      document.documentElement.style.zoom = '2'
    })
    await page.getByRole('button', { name: '전투 로그 펼치기' }).click()

    const audit = await page.evaluate(() => {
      const panel = document.querySelector<HTMLElement>('.combat-log-panel')!
      const commands = Array.from(panel.querySelectorAll<HTMLElement>('button, label'))
        .filter((element) => {
          const rect = element.getBoundingClientRect()
          return rect.width > 0 && rect.height > 0
        })
        .map((element) => {
          const rect = element.getBoundingClientRect()
          return { left: rect.left, right: rect.right, height: rect.height }
        })
      return {
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        clipped: commands.filter(({ left, right }) => left < -0.5 || right > window.innerWidth + 0.5),
        undersized: commands.filter(({ height }) => height < 44),
        transition: getComputedStyle(panel.querySelector('.combat-log-panel__toggle')!).transitionDuration,
      }
    })
    expect(audit.scrollWidth).toBeLessThanOrEqual(audit.clientWidth)
    expect(audit.clipped).toEqual([])
    expect(audit.undersized).toEqual([])
    expect(audit.transition).toBe('0s')
  })
})
