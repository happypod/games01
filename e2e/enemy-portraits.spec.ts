import { expect, test, type Locator, type Page } from '@playwright/test'

const STARTED_AT = new Date('2026-07-18T06:00:00.000Z')

test.describe.configure({ mode: 'serial', timeout: 60_000 })

const ENCOUNTERS = [
  { stage: 1, name: '잿빛 슬라임', assetId: 'enemy.ash-slime', artifact: 'ash-slime', boss: false },
  { stage: 2, name: '황혼 늑대', assetId: 'enemy.twilight-wolf', artifact: 'twilight-wolf', boss: false },
  { stage: 3, name: '버려진 갑주', assetId: 'enemy.abandoned-armor', artifact: 'abandoned-armor', boss: false },
  { stage: 4, name: '그을린 주술사', assetId: 'enemy.charred-shaman', artifact: 'charred-shaman', boss: false },
  { stage: 5, name: '심연의 파수꾼', assetId: 'enemy.abyss-sentinel', artifact: 'abyss-sentinel', boss: false },
  { stage: 10, name: '재의 거인', assetId: 'boss.ash-giant', artifact: 'ash-giant', boss: true },
  { stage: 20, name: '월식의 기사', assetId: 'boss.eclipse-knight', artifact: 'eclipse-knight', boss: true },
  { stage: 30, name: '잊힌 용', assetId: 'boss.forgotten-dragon', artifact: 'forgotten-dragon', boss: true },
] as const

async function openDebugSession(page: Page) {
  await page.goto('/')
  await expect(page.getByText('● 자동 저장 정상', { exact: true })).toBeVisible()
  page.once('dialog', (dialog) => void dialog.accept())
  await page.getByRole('button', { name: '개발자 패널' }).click()
  const panel = page.getByTestId('debug-panel')
  await expect(panel).toBeVisible()
  await expect(page.getByTestId('debug-save-isolation-status')).toHaveText('● DEBUG · 저장 격리')
  return panel
}

async function selectDebugStage(panel: Locator, stage: number) {
  await panel.getByLabel('스테이지 (1–300)').fill(String(stage))
  await panel.getByRole('button', { name: '이동' }).click({ force: true })
  await expect(panel.getByRole('status')).toContainText(`${stage} 스테이지 상태를 재현했습니다.`)
}

async function expectLoadedEnemy(page: Page, assetId: string) {
  const asset = page.locator('.tactical-actor__asset--enemy')
  await expect(asset).toHaveAttribute('data-asset-id', assetId)
  await expect(asset).toHaveAttribute('data-resolved-asset-id', assetId)
  await expect(asset).toHaveAttribute('data-state', 'loaded')
  await expect(asset).toHaveAttribute('aria-hidden', 'true')
  await expect(asset).not.toHaveAttribute('role', 'img')
  const image = asset.locator('img')
  await expect(image).toHaveAttribute('alt', '')
  await expect(image).toHaveAttribute('aria-hidden', 'true')
  expect(await image.evaluate((element) => ({
    width: (element as HTMLImageElement).naturalWidth,
    height: (element as HTMLImageElement).naturalHeight,
  }))).toEqual({ width: 768, height: 768 })
  return asset
}

async function expectEncounterGeometry(page: Page, panel: Locator, stage: number) {
  const encounter = ENCOUNTERS.find((candidate) => candidate.stage === stage)!
  await selectDebugStage(panel, stage)
  const asset = await expectLoadedEnemy(page, encounter.assetId)
  await expect(page.locator('.tactical-actor--enemy h3')).toHaveText(encounter.name)
  await expect(page.locator('.tactical-canvas__header .boss-tag'))
    .toHaveCount(encounter.boss ? 1 : 0)
  const geometry = await page.evaluate(() => {
    const box = (selector: string) => {
      const rect = document.querySelector<HTMLElement>(selector)!.getBoundingClientRect()
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }
    }
    return {
      canvas: box('.tactical-canvas'),
      asset: box('.tactical-actor__asset--enemy'),
      copy: box('.tactical-actor--enemy .tactical-actor__copy'),
      hp: box('.tactical-actor--enemy [role="progressbar"][aria-label="적 체력"]'),
      timeline: box('.tactical-timeline'),
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }
  })
  await expect(asset).toBeVisible()
  await expect(page.getByRole('progressbar', { name: '적 체력' })).toBeVisible()
  for (const candidate of [geometry.asset, geometry.copy, geometry.hp, geometry.timeline]) {
    expect(candidate.left).toBeGreaterThanOrEqual(geometry.canvas.left - 1)
    expect(candidate.right).toBeLessThanOrEqual(geometry.canvas.right + 1)
    expect(candidate.top).toBeGreaterThanOrEqual(geometry.canvas.top - 1)
    expect(candidate.bottom).toBeLessThanOrEqual(geometry.canvas.bottom + 1)
  }
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth)
}

test('maps five enemies and three bosses to unique tactical battlefield portraits', async ({
  context,
  page,
}, testInfo) => {
  await context.clock.setFixedTime(STARTED_AT)
  await page.setViewportSize({ width: 1_440, height: 900 })
  const panel = await openDebugSession(page)
  const imageSources = new Set<string>()

  for (const encounter of ENCOUNTERS) {
    await selectDebugStage(panel, encounter.stage)
    await expect(page.locator('.tactical-actor--enemy h3')).toHaveText(encounter.name)
    await expect(page.locator('.tactical-canvas__header .boss-tag'))
      .toHaveCount(encounter.boss ? 1 : 0)
    const asset = await expectLoadedEnemy(page, encounter.assetId)
    imageSources.add(await asset.locator('img').getAttribute('src') ?? '')
    await asset.screenshot({
      path: testInfo.outputPath(
        `irpg-422-stage-${String(encounter.stage).padStart(2, '0')}-${encounter.artifact}.png`,
      ),
      animations: 'disabled',
    })
  }
  expect(imageSources.size).toBe(ENCOUNTERS.length)
})

test('keeps a representative enemy and boss inside the 360px canvas', async ({
  context,
  page,
}, testInfo) => {
  await context.clock.setFixedTime(STARTED_AT)
  await page.setViewportSize({ width: 360, height: 800 })
  const panel = await openDebugSession(page)
  await expectEncounterGeometry(page, panel, 1)
  await expectEncounterGeometry(page, panel, 10)
  await page.getByTestId('tactical-canvas').screenshot({
    path: testInfo.outputPath('irpg-422-enemy-boss-360.png'),
    animations: 'disabled',
  })
})

test('preserves enemy and boss geometry at 200% zoom with reduced motion', async ({
  context,
  page,
}) => {
  await context.clock.setFixedTime(STARTED_AT)
  await page.setViewportSize({ width: 720, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const panel = await openDebugSession(page)
  await page.evaluate(() => {
    document.documentElement.style.zoom = '2'
  })

  for (const stage of [1, 10]) {
    await expectEncounterGeometry(page, panel, stage)
    expect(await page.locator('.tactical-actor__asset--enemy').evaluate((element) => ({
      animationName: getComputedStyle(element).animationName,
      transitionDuration: getComputedStyle(element).transitionDuration,
    }))).toEqual({ animationName: 'none', transitionDuration: '0s' })
  }
})

test('falls back after corrupt ash slime art while combat and autosave continue', async ({
  context,
  page,
}, testInfo) => {
  await context.clock.setFixedTime(STARTED_AT)
  await page.route('**/*ash-slime*.webp*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'image/webp', body: 'not-a-webp' })
  })
  await page.goto('/')

  const asset = page.locator('.tactical-actor__asset--enemy')
  await expect(asset).toHaveAttribute('data-asset-id', 'enemy.ash-slime')
  await expect(asset).toHaveAttribute('data-resolved-asset-id', 'fallback.character')
  await expect(asset).toHaveAttribute('data-state', 'fallback')
  await expect(page.locator('.tactical-actor--enemy h3')).toHaveText('잿빛 슬라임')
  await expect(page.getByRole('progressbar', { name: '적 체력' })).toBeVisible()
  await expect(page.getByText('● 자동 저장 정상', { exact: true })).toBeVisible()

  await context.clock.setFixedTime(new Date(STARTED_AT.getTime() + 6_000))
  await expect(page.locator('footer')).toContainText(/처치 [1-9]/)
  await page.waitForTimeout(5_250)
  const savedBattle = await page.evaluate(() => {
    const saves = ['emberwatch.save.v2.a', 'emberwatch.save.v2.b']
      .map((key) => window.localStorage.getItem(key))
      .filter((raw): raw is string => raw !== null)
      .map((raw) => JSON.parse(raw) as { revision: number; state: { battle: { kills: number } } })
      .sort((left, right) => right.revision - left.revision)
    return saves[0]?.state.battle ?? null
  })
  expect(savedBattle?.kills).toBeGreaterThan(0)
  await asset.screenshot({
    path: testInfo.outputPath('irpg-422-ash-slime-fallback.png'),
    animations: 'disabled',
  })
})
