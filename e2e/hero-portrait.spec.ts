import { expect, test, type Page } from '@playwright/test'

const STARTED_AT = new Date('2026-07-18T05:00:00.000Z')

async function expectPortraitInsideViewport(page: Page) {
  const portrait = page.locator('.hero-portrait')
  await expect(portrait).toHaveAttribute('data-state', 'loaded')
  const geometry = await portrait.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    const image = element.querySelector('img')
    return {
      left: rect.left,
      right: rect.right,
      width: rect.width,
      height: rect.height,
      viewportWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      naturalWidth: image?.naturalWidth ?? 0,
      naturalHeight: image?.naturalHeight ?? 0,
    }
  })

  expect(geometry.left).toBeGreaterThanOrEqual(0)
  expect(geometry.right).toBeLessThanOrEqual(geometry.viewportWidth)
  expect(Math.abs(geometry.width - geometry.height)).toBeLessThanOrEqual(1)
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth)
  expect(geometry.naturalWidth).toBe(768)
  expect(geometry.naturalHeight).toBe(768)
}

test('shows Aren in the desktop hero card without duplicating accessible text', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1_440, height: 900 })
  await page.goto('/')

  await expectPortraitInsideViewport(page)
  await expect(page.getByRole('heading', { name: '방랑 기사 아렌' })).toBeVisible()
  await expect(page.getByRole('progressbar', { name: '생명력' })).toBeVisible()
  await expect(page.locator('.hero-portrait img')).toHaveAttribute('alt', '')
  await expect(page.locator('.hero-portrait img')).toHaveAttribute('aria-hidden', 'true')
  await expect(page.getByRole('img', { name: '방랑 기사 아렌' })).toHaveCount(0)

  await page.screenshot({ path: testInfo.outputPath('irpg-407-hero-1440.png'), fullPage: true })
})

test('keeps the hero portrait, title, and HP clear at 360px', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 360, height: 800 })
  await page.goto('/')

  await expectPortraitInsideViewport(page)
  const portrait = page.locator('.hero-portrait')
  const title = page.getByRole('heading', { name: '방랑 기사 아렌' })
  const hp = page.getByRole('progressbar', { name: '생명력' })
  await expect(title).toBeVisible()
  await expect(hp).toBeVisible()
  const boxes = await Promise.all([portrait.boundingBox(), title.boundingBox(), hp.boundingBox()])
  expect(boxes.every((box) => box !== null)).toBe(true)
  expect(boxes[0]!.y).toBeGreaterThanOrEqual(boxes[1]!.y + boxes[1]!.height)
  expect(boxes[2]!.y).toBeGreaterThanOrEqual(boxes[0]!.y + boxes[0]!.height)

  await page.screenshot({ path: testInfo.outputPath('irpg-407-hero-360.png'), fullPage: true })
})

test('preserves the portrait layout at 200% zoom with reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 720, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await expect(page.locator('.hero-portrait')).toHaveAttribute('data-state', 'loaded')
  await page.evaluate(() => {
    document.documentElement.style.zoom = '2'
  })

  const portrait = page.locator('.hero-portrait')
  const title = page.getByRole('heading', { name: '방랑 기사 아렌' })
  const hp = page.getByRole('progressbar', { name: '생명력' })
  await expect(title).toBeVisible()
  await expect(hp).toBeVisible()
  const boxes = await Promise.all([portrait.boundingBox(), title.boundingBox(), hp.boundingBox()])
  expect(boxes.every((box) => box !== null)).toBe(true)
  expect(boxes[0]!.y).toBeGreaterThanOrEqual(boxes[1]!.y + boxes[1]!.height)
  expect(boxes[2]!.y).toBeGreaterThanOrEqual(boxes[0]!.y + boxes[0]!.height)

  const audit = await portrait.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    const image = element.querySelector('img')!
    return {
      left: rect.left,
      right: rect.right,
      viewportWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      animationName: getComputedStyle(image).animationName,
      transitionDuration: getComputedStyle(image).transitionDuration,
    }
  })
  expect(audit.left).toBeGreaterThanOrEqual(0)
  expect(audit.right).toBeLessThanOrEqual(audit.viewportWidth)
  expect(audit.scrollWidth).toBeLessThanOrEqual(audit.clientWidth)
  expect(audit.animationName).toBe('none')
  expect(audit.transitionDuration).toBe('0s')
})

test('falls back after a corrupt hero decode while combat and saving continue', async ({
  context,
  page,
}, testInfo) => {
  await context.clock.setFixedTime(STARTED_AT)
  await page.route('**/*ashen-knight-default*.webp*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'image/webp', body: 'not-a-webp' })
  })
  await page.goto('/')

  const portrait = page.locator('.hero-portrait')
  await expect(portrait).toHaveAttribute('data-state', 'fallback')
  await expect(portrait).toHaveAttribute('data-resolved-asset-id', 'fallback.character')
  await expect(page.getByRole('heading', { name: '방랑 기사 아렌' })).toBeVisible()
  await expect(page.getByRole('progressbar', { name: '생명력' })).toBeVisible()
  await expect(page.getByText('● 자동 저장 정상', { exact: true })).toBeVisible()

  await context.clock.setFixedTime(new Date(STARTED_AT.getTime() + 6_000))
  await expect(page.locator('footer')).toContainText(/처치 [1-9]/)
  await expect(portrait).toHaveAttribute('data-state', 'fallback')

  await page.screenshot({ path: testInfo.outputPath('irpg-407-hero-fallback.png'), fullPage: true })
})
