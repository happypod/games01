import { expect, test, type Page } from '@playwright/test'
import { createInitialState } from '../src/game/engine'
import { SAVE_FORMAT_VERSION, SAVE_SLOT_A_KEY } from '../src/game/persistence'

const STARTED_AT = new Date('2026-07-20T03:00:00.000Z')

function collectBrowserErrors(page: Page, errors: string[]) {
  page.on('pageerror', (error) => errors.push(`page: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`)
  })
}

test('IRPG-419/420/421 manages facilities, crafting, supplies, and a voluntary contract', async ({
  context,
  page,
}, testInfo) => {
  test.setTimeout(60_000)
  const browserErrors: string[] = []
  collectBrowserErrors(page, browserErrors)
  await context.clock.setFixedTime(STARTED_AT)

  const seeded = createInitialState(STARTED_AT.getTime(), 0x4194_2042)
  seeded.currentMode = 'CAMP'
  seeded.player.gold = 10_000
  seeded.camp.structures.tent = 4
  seeded.camp.materials = { ashShard: 100, beastHide: 100, emberCore: 10 }
  const serialized = JSON.stringify({
    formatVersion: SAVE_FORMAT_VERSION,
    revision: 1,
    savedAt: seeded.lastSavedAt,
    state: seeded,
  })
  await page.addInitScript(
    ({ key, value }) => window.localStorage.setItem(key, value),
    { key: SAVE_SLOT_A_KEY, value: serialized },
  )

  await page.goto('/')
  await expect(page.getByText('● 자동 저장 정상', { exact: true })).toBeVisible()
  await expect(page.getByTestId('camp-dashboard')).toBeVisible()

  const tentUpgrade = page.getByRole('button', { name: /원정 텐트 확장 · 8\.00K 골드/ })
  await expect(tentUpgrade).toBeEnabled()
  await tentUpgrade.click()
  await expect(page.getByText('오프라인 상한 12시간 · 최고 레벨')).toBeVisible()

  const attackTraining = page.getByRole('button', { name: '공격 훈련 · 140 골드' })
  await attackTraining.click()
  await expect(page.getByText('Rank 1/5', { exact: true })).toBeVisible()
  await expect(page.getByText(/공격력 \d+ → \d+ · 환생 후 유지/)).toBeVisible()

  const stewRecipe = page.locator('.camp-recipe-card').filter({ hasText: '황금 스튜' })
  await stewRecipe.getByRole('button', { name: '황금 스튜 제작' }).click()
  await expect(page.getByText('황금 스튜 제작 중')).toBeVisible()

  const rescue = page.getByRole('button', { name: '세라 구조 지원 · 800 골드' })
  await rescue.click()
  await expect(page.getByText(/어떤 계약도 자동으로 체결되지 않습니다|세라는 안전하게 회복 중입니다/)).toBeVisible()
  await page.getByRole('button', { name: '자발적 상점 조언 계약 제안' }).click()
  await expect(page.getByText(/전투 동료가 아니며 신뢰 0\/5/)).toBeVisible()
  await page.getByRole('button', { name: '세라 신뢰 활동 · 250 골드' }).click()
  await expect(page.getByText(/신뢰 1\/5에 따라 가격이 2% 할인/)).toBeVisible()
  await expect(page.getByText('세라의 시세 조언 · 모든 제안 2% 할인')).toBeVisible()

  await context.clock.setFixedTime(new Date(STARTED_AT.getTime() + 5 * 60_000))
  await page.waitForTimeout(300)
  await expect(page.getByText('황금 스튜 제작 중')).toHaveCount(0)
  const stewSupply = page.getByRole('button', { name: /황금 스튜 ×1/ })
  await expect(stewSupply).toBeEnabled()
  await stewSupply.click()
  await expect(page.getByText('남은 1800 라운드')).toBeVisible()

  await context.clock.setFixedTime(new Date(STARTED_AT.getTime() + 30 * 60_000))
  await page.waitForTimeout(300)
  await expect(page.getByRole('heading', { name: '떠돌이 상인 · 회차 2' })).toBeVisible()
  await expect(page.getByText('남은 1800 라운드')).toBeVisible()

  await page.reload()
  await expect(page.getByTestId('camp-dashboard')).toBeVisible()
  await expect(page.getByRole('heading', { name: '떠돌이 상인 · 회차 2' })).toBeVisible()
  await expect(page.getByText(/신뢰 1\/5에 따라 가격이 2% 할인/)).toBeVisible()
  await expect(page.getByText('남은 1800 라운드')).toBeVisible()

  await page.screenshot({
    path: testInfo.outputPath('irpg-421-camp-management.png'),
    fullPage: true,
  })
  expect(browserErrors).toEqual([])
})

test('IRPG-420 completes a saved camp craft exactly once while the app is closed', async ({
  context,
}) => {
  test.setTimeout(60_000)
  const browserErrors: string[] = []
  await context.clock.setFixedTime(STARTED_AT)
  const seeded = createInitialState(STARTED_AT.getTime(), 0x4200_0042)
  seeded.currentMode = 'CAMP'
  seeded.camp.craftJob = { recipeId: 'goldStew', remainingMs: 60_000 }
  const serialized = JSON.stringify({
    formatVersion: SAVE_FORMAT_VERSION,
    revision: 1,
    savedAt: seeded.lastSavedAt,
    state: seeded,
  })

  let page = await context.newPage()
  collectBrowserErrors(page, browserErrors)
  await page.addInitScript(
    ({ key, value }) => window.localStorage.setItem(key, value),
    { key: SAVE_SLOT_A_KEY, value: serialized },
  )
  await page.goto('/')
  await expect(page.getByText('황금 스튜 제작 중')).toBeVisible()
  await page.close()

  await context.clock.setFixedTime(new Date(STARTED_AT.getTime() + 60_000))
  page = await context.newPage()
  collectBrowserErrors(page, browserErrors)
  await page.goto('/')
  const offlineDialog = page.getByRole('dialog', {
    name: '쉬는 동안에도 검은 멈추지 않았습니다',
  })
  await expect(offlineDialog).toBeVisible()
  await offlineDialog.getByRole('button', { name: '보상 확인' }).click()
  await expect(page.getByText('황금 스튜 제작 중')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /황금 스튜 ×1/ })).toBeEnabled()

  await page.reload()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /황금 스튜 ×1/ })).toBeEnabled()
  expect(browserErrors).toEqual([])
})
