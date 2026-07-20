import { expect, test, type Page } from '@playwright/test'

const STARTED_AT = new Date('2026-07-18T05:00:00.000Z')

async function expectHeroInsideCanvas(page: Page) {
  const canvas = page.getByTestId('tactical-canvas')
  const portrait = page.locator('.tactical-actor__asset--hero')
  await expect(portrait).toHaveAttribute('data-asset-id', 'hero.ashen-knight.default')
  await expect(portrait).toHaveAttribute('data-state', 'loaded')
  const geometry = await page.evaluate(() => {
    const canvas = document.querySelector<HTMLElement>('.tactical-canvas')!
    const portrait = document.querySelector<HTMLElement>('.tactical-actor__asset--hero')!
    const canvasRect = canvas.getBoundingClientRect()
    const portraitRect = portrait.getBoundingClientRect()
    const image = portrait.querySelector<HTMLImageElement>('img')
    return {
      canvas: { left: canvasRect.left, right: canvasRect.right, top: canvasRect.top, bottom: canvasRect.bottom },
      portrait: { left: portraitRect.left, right: portraitRect.right, top: portraitRect.top, bottom: portraitRect.bottom },
      naturalWidth: image?.naturalWidth ?? 0,
      naturalHeight: image?.naturalHeight ?? 0,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }
  })
  expect(geometry.portrait.left).toBeGreaterThanOrEqual(geometry.canvas.left - 1)
  expect(geometry.portrait.right).toBeLessThanOrEqual(geometry.canvas.right + 1)
  expect(geometry.portrait.top).toBeGreaterThanOrEqual(geometry.canvas.top - 1)
  expect(geometry.portrait.bottom).toBeLessThanOrEqual(geometry.canvas.bottom + 1)
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth)
  expect(geometry.naturalWidth).toBe(768)
  expect(geometry.naturalHeight).toBe(768)
  return { canvas, portrait }
}

test('shows Aren in the desktop tactical battlefield without duplicate accessible art', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1_440, height: 900 })
  await page.goto('/')

  const { portrait } = await expectHeroInsideCanvas(page)
  await expect(page.getByRole('heading', { name: '아렌' })).toBeVisible()
  await expect(page.getByRole('progressbar', { name: '영웅 체력' })).toBeVisible()
  await expect(portrait.locator('img')).toHaveAttribute('alt', '')
  await expect(portrait.locator('img')).toHaveAttribute('aria-hidden', 'true')
  await expect(page.getByRole('img', { name: /아렌/ })).toHaveCount(0)

  await page.screenshot({ path: testInfo.outputPath('irpg-422-hero-1440.png') })
})

test('keeps hero art, identity and HP inside the 360px battlefield', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 360, height: 800 })
  await page.goto('/')

  const { canvas, portrait } = await expectHeroInsideCanvas(page)
  const title = page.getByRole('heading', { name: '아렌' })
  const hp = page.getByRole('progressbar', { name: '영웅 체력' })
  await expect(title).toBeVisible()
  await expect(hp).toBeVisible()
  for (const locator of [portrait, title, hp]) {
    const box = await locator.boundingBox()
    const canvasBox = await canvas.boundingBox()
    expect(box).not.toBeNull()
    expect(canvasBox).not.toBeNull()
    expect(box!.x).toBeGreaterThanOrEqual(canvasBox!.x - 1)
    expect(box!.x + box!.width).toBeLessThanOrEqual(canvasBox!.x + canvasBox!.width + 1)
  }

  await canvas.screenshot({ path: testInfo.outputPath('irpg-422-hero-360.png'), animations: 'disabled' })
})

test('preserves the tactical hero at 200% zoom with reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 720, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.evaluate(() => {
    document.documentElement.style.zoom = '2'
  })

  const { portrait } = await expectHeroInsideCanvas(page)
  const audit = await portrait.evaluate((element) => ({
    animationName: getComputedStyle(element).animationName,
    transitionDuration: getComputedStyle(element).transitionDuration,
  }))
  expect(audit.animationName).toBe('none')
  expect(audit.transitionDuration).toBe('0s')
})

test('falls back after corrupt hero art while combat and saving continue', async ({
  context,
  page,
}, testInfo) => {
  await context.clock.setFixedTime(STARTED_AT)
  await page.route('**/*ashen-knight-default*.webp*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'image/webp', body: 'not-a-webp' })
  })
  await page.goto('/')

  const portrait = page.locator('.tactical-actor__asset--hero')
  await expect(portrait).toHaveAttribute('data-state', 'fallback')
  await expect(portrait).toHaveAttribute('data-resolved-asset-id', 'fallback.character')
  await expect(page.getByRole('heading', { name: '아렌' })).toBeVisible()
  await expect(page.getByRole('progressbar', { name: '영웅 체력' })).toBeVisible()
  await expect(page.getByText('● 자동 저장 정상', { exact: true })).toBeVisible()

  await context.clock.setFixedTime(new Date(STARTED_AT.getTime() + 6_000))
  await expect(page.locator('footer')).toContainText(/처치 [1-9]/)
  await expect(portrait).toHaveAttribute('data-state', 'fallback')
  await page.getByTestId('tactical-canvas').screenshot({
    path: testInfo.outputPath('irpg-422-hero-fallback.png'),
    animations: 'disabled',
  })
})
