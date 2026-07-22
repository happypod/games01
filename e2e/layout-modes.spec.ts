import { expect, test, type Page } from '@playwright/test'
import { setDebugStage } from '../src/debug/debugSession'
import { getEnemyDefinition } from '../src/game/content'
import { createInitialState } from '../src/game/engine'
import { SAVE_FORMAT_VERSION, SAVE_SLOT_A_KEY } from '../src/game/persistence'

const TACTICAL_OPTION = '전투 · 전술 전장'

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
  await panel.getByRole('button', { name: 'fixture 적용' }).press('Enter')
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

test.describe('IRPG-422 tactical-only battle surface and tactical motion', () => {
  for (const damageFixture of [
    {
      id: 'visual.dashboard.tactical-damaged',
      assetId: 'boss.eclipse-knight.damaged',
    },
    {
      id: 'visual.dashboard.tactical-severe',
      assetId: 'boss.eclipse-knight.severe',
    },
  ] as const) {
    test(`uses ${damageFixture.assetId} in the tactical battle surface`, async ({ page }) => {
      await enterDebugSession(page)
      await applyFixture(page, damageFixture.id)

      const root = page.getByTestId('visual-fixture-root')
      const expectedDamageState = damageFixture.id.endsWith('damaged')
        ? 'damaged'
        : 'severe'
      const expectedDamageLabel = damageFixture.id.endsWith('damaged')
        ? '갑옷 균열'
        : '갑옷 붕괴 직전'
      const canvas = page.getByTestId('tactical-canvas')
      await expect(canvas).toHaveAttribute('data-enemy-asset-id', damageFixture.assetId)
      await expect(canvas).toHaveAttribute(
        'data-enemy-damage-state',
        expectedDamageState,
      )
      await expect(canvas.getByText(expectedDamageLabel)).toBeVisible()
      await expect(canvas.locator('.tactical-actor__asset--enemy'))
        .toHaveAttribute('data-asset-id', damageFixture.assetId)
      await expect(canvas.locator('.tactical-actor__asset--enemy'))
        .toHaveAttribute('data-state', 'loaded')
      await expect(root).toHaveAttribute(
        'data-canonical-state-hash',
        damageFixture.id.endsWith('damaged')
          ? 'fnv1a32-v1:8ab5609d'
          : 'fnv1a32-v1:007bd4fd',
      )
    })
  }

  test('uses one tactical renderer and ignores every retired layout preference value', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('emberwatch.ui.layout.v1', 'dashboard')
    })
    await expectReady(page)

    const tactical = page.getByRole('radio', { name: TACTICAL_OPTION, exact: true })
    await expect(tactical).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByTestId('game-dashboard')).toHaveCount(0)
    await expect(page.getByTestId('tactical-layout')).toHaveCount(1)
    await expect(page.getByText('유형 1 · 대시보드')).toHaveCount(0)

    await page.reload()
    await expect(page.getByText('● 자동 저장 정상', { exact: true })).toBeVisible()
    await expect(page.getByRole('radio', { name: TACTICAL_OPTION })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    await expect(page.getByTestId('tactical-layout')).toHaveCount(1)
  })

  test('ignores an invalid retired preference without rewriting it', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('emberwatch.ui.layout.v1', 'unknown-layout')
    })
    await expectReady(page)
    await expect(page.getByRole('radio', { name: TACTICAL_OPTION })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    await expect(page.getByTestId('tactical-layout')).toHaveCount(1)
    expect(await page.evaluate(() => localStorage.getItem('emberwatch.ui.layout.v1')))
      .toBe('unknown-layout')
  })

  test('supports keyboard battle and camp switching with a single active renderer', async ({ page }) => {
    await expectReady(page)
    const tactical = page.getByRole('radio', { name: TACTICAL_OPTION })
    const camp = page.getByRole('radio', { name: '캠프 · 관리' })
    const resultAnnouncement = page.getByTestId('tactical-utility-result-announcement')

    await expect(resultAnnouncement).toHaveCount(1)

    await tactical.focus()
    await tactical.press('ArrowRight')
    await expect(camp).toBeFocused()
    await expect(camp).toHaveAttribute('aria-checked', 'true')
    await expect(page.locator('#tactical-stage-title')).toHaveCount(0)
    await expect(page.getByTestId('camp-dashboard')).toHaveCount(1)

    await camp.press('Home')
    await expect(tactical).toBeFocused()
    await expect(tactical).toHaveAttribute('aria-checked', 'true')
    await expect(page.locator('#tactical-stage-title')).toHaveCount(1)
    await expect(page.getByTestId('camp-dashboard')).toHaveCount(0)
  })

  test('uses roving slot focus and restores focus after entering camp from supplies', async ({ page }) => {
    await expectReady(page)
    const weapon = page.locator('[data-action-slot="weapon"]')
    const armor = page.locator('[data-action-slot="armor"]')
    const focusTonic = page.locator('[data-action-slot="focusTonic"]')

    await expect(weapon).toHaveAttribute('tabindex', '0')
    await expect(armor).toHaveAttribute('tabindex', '-1')
    await weapon.focus()
    await weapon.press('ArrowRight')
    await expect(armor).toBeFocused()
    await expect(armor).toHaveAttribute('tabindex', '0')
    await armor.press('End')
    await expect(focusTonic).toBeFocused()
    await focusTonic.press('Home')
    await expect(weapon).toBeFocused()

    await page.locator('[data-action-slot="goldStew"]').click()
    const detail = page.getByRole('dialog', { name: '황금 스튜' })
    await expect(detail).toBeVisible()
    await detail.getByRole('button', { name: '캠프에서 준비' }).click()

    await expect(page.getByTestId('camp-dashboard')).toBeVisible()
    await expect(page.getByRole('radio', { name: '캠프 · 관리' })).toBeFocused()
  })

  test('keeps game, event, and A/B save state unchanged across slot and utility disclosures', async ({ page }) => {
    await enterDebugSession(page)
    await applyFixture(page, 'visual.dashboard.tactical-canvas')

    const capture = () => page.evaluate(() => {
      const root = document.querySelector<HTMLElement>('[data-testid="visual-fixture-root"]')!
      const storage = Object.fromEntries(
        Object.entries(localStorage)
          .filter(([key]) => key !== 'emberwatch.ui.layout.v1')
          .sort(([left], [right]) => left.localeCompare(right)),
      )
      return {
        stateHash: root.dataset.canonicalStateHash,
        eventHash: root.dataset.canonicalEventHash,
        notice: document.querySelector<HTMLElement>('.tactical-canvas__status')?.textContent,
        storage,
      }
    })
    const before = await capture()

    const slot = page.locator('[data-action-slot="armor"]')
    await slot.click()
    await expect(page.locator('[data-action-detail="armor"]')).toBeVisible()
    await slot.click()
    const log = page.locator('[data-utility-id="log"]')
    await log.click()
    await expect(page.getByTestId('tactical-utility-panel')).toBeVisible()
    await log.click()

    expect(await capture()).toEqual(before)
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
      const status = document.querySelector('.tactical-canvas__status')?.getBoundingClientRect()
      const timeline = document.querySelector('.tactical-timeline')?.getBoundingClientRect()
      const companion = document.querySelector('.tactical-companion')?.getBoundingClientRect()
      const cue = document.querySelector('.tactical-cue')
      const cueStyle = cue === null ? null : getComputedStyle(cue)
      return {
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight,
        canvasBottom: canvas?.bottom ?? 0,
        dockTop: dock?.top ?? 0,
        statusBottom: status?.bottom ?? 0,
        statusTop: status?.top ?? 0,
        timelineTop: timeline?.top ?? 0,
        companionBottom: companion?.bottom ?? 0,
        cueAnimation: cueStyle?.animationName ?? '',
        cueTransition: cueStyle?.transitionDuration ?? '',
      }
    })
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth)
    expect(geometry.scrollHeight).toBeGreaterThan(800)
    expect(geometry.dockTop).toBeGreaterThanOrEqual(geometry.canvasBottom)
    expect(geometry.statusBottom).toBeLessThanOrEqual(geometry.timelineTop)
    expect(geometry.companionBottom).toBeLessThanOrEqual(geometry.statusTop)
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

  test('stacks canvas and dock without clipped controls at 200% zoom', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 720, height: 900 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await enterDebugSession(page)
    await applyFixture(page, 'visual.dashboard.tactical-canvas')
    await page.getByRole('radio', { name: TACTICAL_OPTION }).click()
    await page.evaluate(() => {
      document.documentElement.style.zoom = '2'
    })

    const audit = await page.evaluate(() => {
      const canvas = document.querySelector<HTMLElement>('.tactical-canvas')!
      const dock = document.querySelector<HTMLElement>('.tactical-command-dock')!
      const status = document.querySelector<HTMLElement>('.tactical-canvas__status')!
      const timeline = document.querySelector<HTMLElement>('.tactical-timeline')!
      const companion = document.querySelector<HTMLElement>('.tactical-companion')!
      const clientWidth = document.documentElement.clientWidth
      const targets = Array.from(document.querySelectorAll<HTMLElement>(
        '.game-mode-selector [role="radio"], .tactical-canvas button, .tactical-command-dock button',
      ))
        .filter((element) => {
          const style = getComputedStyle(element)
          const rect = element.getBoundingClientRect()
          return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden'
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
        clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        canvasBottom: canvas.getBoundingClientRect().bottom,
        dockTop: dock.getBoundingClientRect().top,
        statusBottom: status.getBoundingClientRect().bottom,
        statusTop: status.getBoundingClientRect().top,
        timelineTop: timeline.getBoundingClientRect().top,
        companionBottom: companion.getBoundingClientRect().bottom,
        invalidTargets: targets.filter(({ left, right, width, height }) =>
          left < -0.5 || right > clientWidth + 0.5 || width < 44 || height < 44),
        cueAnimation: getComputedStyle(
          document.querySelector<HTMLElement>('.tactical-cue')!,
        ).animationName,
      }
    })

    expect(audit.scrollWidth).toBeLessThanOrEqual(audit.clientWidth)
    expect(audit.dockTop).toBeGreaterThanOrEqual(audit.canvasBottom - 1)
    expect(audit.statusBottom).toBeLessThanOrEqual(audit.timelineTop)
    expect(audit.companionBottom).toBeLessThanOrEqual(audit.statusTop)
    expect(audit.invalidTargets).toEqual([])
    expect(audit.cueAnimation).toBe('none')
    await testInfo.attach('irpg-415-tactical-200-percent.png', {
      body: await page.getByTestId('tactical-canvas').screenshot({ animations: 'disabled' }),
      contentType: 'image/png',
    })
  })

  test('keeps the battlefield visible until saved expedition choices are opened and accepts one rapid choice once', async ({ page }) => {
    await page.setViewportSize({ width: 1_440, height: 900 })
    await enterDebugSession(page)
    await applyFixture(page, 'visual.events.tactical-overlay')
    await page.getByRole('radio', { name: TACTICAL_OPTION }).click()

    const canvas = page.getByTestId('tactical-canvas')
    const base = canvas.locator('.tactical-canvas__base')
    const fixtureRoot = page.getByTestId('visual-fixture-root')
    const stateHash = await fixtureRoot.getAttribute('data-canonical-state-hash')
    await expect(canvas).toHaveAttribute('data-event-overlay-state', 'closed')
    await expect(base).not.toHaveAttribute('inert')
    await expect(canvas.locator('.tactical-actor__asset--hero')).toBeVisible()
    await expect(canvas.locator('.tactical-actor__asset--enemy')).toBeVisible()
    await expect(canvas.locator('.tactical-event-overlay')).toHaveCount(0)
    const eventToggle = canvas.getByRole('button', {
      name: '원정 이벤트 3건 보기',
    })
    await expect(eventToggle).toBeVisible()
    await expect(eventToggle).toHaveAttribute('aria-expanded', 'false')
    await expect(eventToggle).toHaveAttribute('aria-controls', 'tactical-event-overlay')
    await expect(canvas.getByTestId('tactical-event-count-status'))
      .toHaveText('원정 이벤트 3건 대기 중')
    await settleImagePaint(page)
    await canvas.screenshot({
      path: 'tmp/irpg-417-tactical-pending-collapsed-1440.png',
      animations: 'disabled',
    })
    await eventToggle.click()
    await expect(canvas).toHaveAttribute('data-event-overlay-state', 'open')
    await expect(base).toHaveAttribute('inert')
    await expect(canvas.getByRole('button', { name: '전투 화면 보기' }))
      .toHaveAttribute('aria-expanded', 'true')

    const cards = canvas.locator('.expedition-event-card')
    await expect(cards).toHaveCount(3)
    await expect(canvas.locator('.expedition-event-card__choices button')).toHaveCount(6)
    await expect(canvas.locator('.expedition-event-card__choices button').first())
      .toBeFocused()
    await expect(fixtureRoot).toHaveAttribute(
      'data-canonical-state-hash',
      stateHash ?? '',
    )
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
    await expect(base).not.toHaveAttribute('inert')
    await expect(canvas).toHaveAttribute('data-event-overlay-state', 'none')
    await expect(canvas.locator('.tactical-event-toggle')).toHaveCount(0)
  })

  test('keeps the pending-event control usable without covering the 360px battlefield', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 })
    await enterDebugSession(page)
    await applyFixture(page, 'visual.events.tactical-overlay')
    await page.getByRole('radio', { name: TACTICAL_OPTION }).click()

    const canvas = page.getByTestId('tactical-canvas')
    const toggle = canvas.getByRole('button', { name: '원정 이벤트 3건 보기' })
    await expect(canvas).toHaveAttribute('data-event-overlay-state', 'closed')
    await expect(canvas.locator('.tactical-actor__asset--hero')).toBeVisible()
    await expect(canvas.locator('.tactical-actor__asset--enemy')).toBeVisible()
    const collapsedGeometry = await canvas.evaluate((element) => {
      const toggleElement = element.querySelector<HTMLElement>('.tactical-event-toggle')
      if (toggleElement === null) throw new Error('event toggle missing')
      const canvasRect = element.getBoundingClientRect()
      const toggleRect = toggleElement.getBoundingClientRect()
      return {
        clientWidth: element.clientWidth,
        toggleWidth: toggleRect.width,
        toggleHeight: toggleRect.height,
        toggleLeft: toggleRect.left - canvasRect.left,
        toggleRight: toggleRect.right - canvasRect.left,
      }
    })
    const pageGeometry = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }))
    expect(pageGeometry.scrollWidth).toBeLessThanOrEqual(pageGeometry.clientWidth)
    expect(collapsedGeometry.toggleWidth).toBeGreaterThanOrEqual(44)
    expect(collapsedGeometry.toggleHeight).toBeGreaterThanOrEqual(44)
    expect(collapsedGeometry.toggleLeft).toBeGreaterThanOrEqual(0)
    expect(collapsedGeometry.toggleRight).toBeLessThanOrEqual(
      collapsedGeometry.clientWidth,
    )
    await settleImagePaint(page)
    await canvas.screenshot({
      path: 'tmp/irpg-417-tactical-pending-collapsed-360.png',
      animations: 'disabled',
    })

    await toggle.click()
    const overlay = canvas.locator('.tactical-event-overlay')
    await expect(overlay).toBeVisible()
    await expect(canvas.locator('.tactical-canvas__base')).toHaveAttribute('inert')
    const choiceButtons = overlay.locator('.expedition-event-card__choices button')
    await expect(choiceButtons).toHaveCount(6)
    const expandedGeometry = await overlay.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      choiceHeights: [...element.querySelectorAll<HTMLElement>(
        '.expedition-event-card__choices button',
      )].map((button) => button.getBoundingClientRect().height),
    }))
    expect(expandedGeometry.scrollWidth).toBeLessThanOrEqual(
      expandedGeometry.clientWidth,
    )
    expect(expandedGeometry.choiceHeights.every((height) => height >= 44)).toBe(true)

    await choiceButtons.first().press('Escape')
    await expect(canvas).toHaveAttribute('data-event-overlay-state', 'closed')
    await expect(toggle).toBeFocused()
    await expect(canvas.locator('.tactical-canvas__base')).not.toHaveAttribute('inert')
  })

  test('captures a newly arriving writer VFX inside the desktop one-view canvas', async ({ page }, testInfo) => {
    const startedAt = new Date('2026-07-19T00:00:00.000Z')
    const seeded = createInitialState(startedAt.getTime(), 0x415_0106)
    seeded.player.skills.powerStrike = 1
    seeded.player.companion = { id: 'emberFox', rank: 1 }
    seeded.battle.stage = 10
    seeded.battle.highestStage = 11
    seeded.battle.enemyHp = getEnemyDefinition(10).maxHp
    seeded.battle.powerStrikeCooldownMs = 0
    seeded.battle.companionCooldownMs = 0
    seeded.claimedBossMilestoneMask = 1
    seeded.expeditionEvents = {
      ...seeded.expeditionEvents,
      milestoneMask: 1,
    }
    const serialized = JSON.stringify({
      formatVersion: SAVE_FORMAT_VERSION,
      revision: 1,
      savedAt: seeded.lastSavedAt,
      state: seeded,
    })

    await page.setViewportSize({ width: 1_440, height: 900 })
    await page.clock.setFixedTime(startedAt)
    await page.addInitScript(
      ({ key, value }) => window.localStorage.setItem(key, value),
      { key: SAVE_SLOT_A_KEY, value: serialized },
    )
    await expectReady(page)
    await expect(page.locator('.topbar__stage')).toContainText('STAGE 10')
    await page.getByRole('radio', { name: TACTICAL_OPTION }).click()

    const canvas = page.getByTestId('tactical-canvas')
    await expect(canvas).not.toHaveAttribute('data-scene-id', /.+/)
    await page.clock.setFixedTime(new Date(startedAt.getTime() + 1_000))
    await expect(canvas).toHaveAttribute('data-scene-id', /.+/)
    await expect(canvas.locator('.tactical-cue')).toHaveClass(/tactical-cue--active/)
    await expect(canvas.locator('.tactical-actor__asset--hero'))
      .toHaveClass(/tactical-motion--hero-attack/)
    await expect(canvas.locator('.tactical-actor__asset--enemy'))
      .toHaveClass(/tactical-motion--enemy-hit/)
    await expect(canvas.locator('.tactical-companion__asset'))
      .toHaveClass(/tactical-motion--companion-assist/)
    const damageLayer = canvas.getByTestId('tactical-damage-layer')
    await expect(damageLayer).toHaveAttribute('aria-hidden', 'true')
    await expect(damageLayer.locator('.tactical-damage-popup')).toHaveCount(2)
    await expect(damageLayer.locator('[data-popup-source="hero"]')).toHaveCount(1)
    await expect(damageLayer.locator('[data-popup-source="companion"]')).toHaveCount(1)
    await expect(damageLayer.locator('[aria-live], [role="status"]')).toHaveCount(0)
    await expect(canvas.getByTestId('tactical-ultimate-flash'))
      .toHaveAttribute('aria-hidden', 'true')
    await settleImagePaint(page)

    const geometry = await page.evaluate(() => {
      const canvasRect = document.querySelector<HTMLElement>('.tactical-canvas')!
        .getBoundingClientRect()
      const dockRect = document.querySelector<HTMLElement>('.tactical-command-dock')!
        .getBoundingClientRect()
      return {
        viewportHeight: window.innerHeight,
        canvasBottom: canvasRect.bottom,
        dockBottom: dockRect.bottom,
      }
    })
    expect(geometry.canvasBottom).toBeLessThanOrEqual(geometry.viewportHeight)
    expect(geometry.dockBottom).toBeLessThanOrEqual(geometry.viewportHeight)
    await testInfo.attach('irpg-415-active-tactical-vfx.png', {
      body: await canvas.screenshot(),
      contentType: 'image/png',
    })
  })

  test('keeps a damaged portrait and active cues static at effective 360px and 200% zoom', async ({ page }, testInfo) => {
    const startedAt = new Date('2026-07-19T01:00:00.000Z')
    const seeded = setDebugStage(
      createInitialState(startedAt.getTime(), 0x416_0403),
      20,
    )
    seeded.player.skills.powerStrike = 1
    seeded.player.companion = { id: 'emberFox', rank: 1 }
    seeded.battle.enemyHp = Math.floor(getEnemyDefinition(20).maxHp * 0.5)
    seeded.battle.powerStrikeCooldownMs = 0
    seeded.battle.companionCooldownMs = 0
    seeded.claimedBossMilestoneMask = 1
    const serialized = JSON.stringify({
      formatVersion: SAVE_FORMAT_VERSION,
      revision: 1,
      savedAt: seeded.lastSavedAt,
      state: seeded,
    })

    await page.setViewportSize({ width: 720, height: 900 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.clock.setFixedTime(startedAt)
    await page.addInitScript(
      ({ key, value }) => window.localStorage.setItem(key, value),
      { key: SAVE_SLOT_A_KEY, value: serialized },
    )
    await expectReady(page)
    await page.getByRole('radio', { name: TACTICAL_OPTION }).click()
    await page.evaluate(() => {
      document.documentElement.style.zoom = '2'
    })

    const canvas = page.getByTestId('tactical-canvas')
    await page.clock.setFixedTime(new Date(startedAt.getTime() + 1_000))
    await expect(canvas).toHaveAttribute('data-scene-id', /.+/)
    await expect(canvas).toHaveAttribute(
      'data-enemy-asset-id',
      'boss.eclipse-knight.damaged',
    )
    const damageLayer = canvas.getByTestId('tactical-damage-layer')
    await expect(damageLayer.locator('.tactical-damage-popup')).toHaveCount(2)
    const audit = await page.evaluate(() => {
      const canvasElement = document.querySelector<HTMLElement>('.tactical-canvas')!
      const canvasRect = canvasElement.getBoundingClientRect()
      const popupRects = [...document.querySelectorAll<HTMLElement>('.tactical-damage-popup')]
        .map((popup) => {
          const style = getComputedStyle(popup)
          const rect = popup.getBoundingClientRect()
          return {
            left: rect.left,
            right: rect.right,
            opacity: style.opacity,
            animationName: style.animationName,
          }
        })
      const heroStyle = getComputedStyle(
        document.querySelector<HTMLElement>('.tactical-actor__asset--hero')!,
      )
      const flashStyle = getComputedStyle(
        document.querySelector<HTMLElement>('.tactical-ultimate-flash')!,
      )
      return {
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        canvasLeft: canvasRect.left,
        canvasRight: canvasRect.right,
        popupRects,
        heroAnimationName: heroStyle.animationName,
        flashDisplay: flashStyle.display,
      }
    })

    expect(audit.scrollWidth).toBeLessThanOrEqual(audit.clientWidth)
    expect(audit.heroAnimationName).toBe('none')
    expect(audit.flashDisplay).toBe('none')
    expect(audit.popupRects).toHaveLength(2)
    for (const popup of audit.popupRects) {
      expect(popup.animationName).toBe('none')
      expect(popup.opacity).toBe('1')
      expect(popup.left).toBeGreaterThanOrEqual(audit.canvasLeft - 1)
      expect(popup.right).toBeLessThanOrEqual(audit.canvasRight + 1)
    }
    await testInfo.attach('irpg-416-damaged-vfx-200-percent.png', {
      body: await canvas.screenshot({ animations: 'disabled' }),
      contentType: 'image/png',
    })
  })

  test('keeps a newly arriving combat cue mounted across a utility disclosure', async ({ page }) => {
    await enterDebugSession(page)
    await applyFixture(page, 'visual.dashboard.tactical-canvas')
    await page.getByRole('radio', { name: TACTICAL_OPTION }).click()

    const canvas = page.getByTestId('tactical-canvas')
    await expect(canvas).not.toHaveAttribute('data-scene-id', /.+/)
    await page.clock.setFixedTime(new Date('2026-07-19T00:00:01.000Z'))
    await expect(canvas).toHaveAttribute('data-scene-id', /.+/)
    await expect(canvas.locator('.tactical-cue')).toHaveClass(/tactical-cue--active/)

    const sceneId = await canvas.getAttribute('data-scene-id')
    await page.locator('[data-utility-id="log"]').click()
    await expect(page.getByTestId('tactical-utility-panel')).toBeVisible()
    await page.locator('[data-utility-id="log"]').click()
    await expect(canvas).toHaveAttribute('data-scene-id', sceneId ?? '')
  })
})
