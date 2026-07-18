import { expect, test, type Page } from '@playwright/test'

const SAVE_KEYS = [
  'emberwatch.save.v1',
  'emberwatch.save.v2.a',
  'emberwatch.save.v2.b',
] as const

type SaveSnapshot = Record<(typeof SAVE_KEYS)[number], string | null>

async function readRawSaves(page: Page): Promise<SaveSnapshot> {
  return page.evaluate((keys) => {
    const entries = keys.map((key) => [key, window.localStorage.getItem(key)] as const)
    return Object.fromEntries(entries) as SaveSnapshot
  }, SAVE_KEYS)
}

async function acceptNextConfirmation(page: Page) {
  page.once('dialog', (dialog) => void dialog.accept())
}

test('개발자 패널은 배속·fixture·reload·pagehide 동안 A/B 저장과 격리된다', async ({
  page,
}) => {
  test.setTimeout(60_000)
  await page.goto('/')
  await expect(page.getByText('● 자동 저장 정상', { exact: true })).toBeVisible()

  await acceptNextConfirmation(page)
  await page.getByRole('button', { name: '개발자 패널' }).click()
  const panel = page.getByTestId('debug-panel')
  await expect(panel).toBeVisible()
  await expect(page.getByTestId('debug-save-isolation-status')).toHaveText('● DEBUG · 저장 격리')
  await expect(page.getByRole('region', { name: '저장 백업' })).toHaveCount(0)

  const originalSaves = await readRawSaves(page)

  await panel.getByLabel('스테이지 (1–300)').fill('300')
  await panel.getByRole('button', { name: '이동' }).click()
  await expect(panel.getByRole('status')).toContainText('300 스테이지 상태를 재현했습니다.')
  await expect(page.getByText('300 스테이지 fixture를 적용했습니다.')).toBeVisible()

  await panel.getByRole('radio', { name: '100x' }).check()
  await page.waitForTimeout(350)
  await panel.getByRole('radio', { name: '1x' }).check()

  await panel.getByLabel('오프라인 시간 (0–480분)').fill('1')
  await panel.getByRole('button', { name: '진행 적용' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: '보상 확인' }).click()

  await panel.getByLabel('골드').fill('123456')
  await panel.getByLabel('스킬 포인트').fill('456')
  await panel.getByLabel('불씨 정수').fill('789')
  await panel.getByRole('button', { name: '자원 적용' }).click()
  await expect(panel.getByText('SP 456', { exact: false })).toBeVisible()
  await expect(panel.getByText('정수 789', { exact: false })).toBeVisible()

  for (const invalidStage of ['0', '301', '1.5', 'NaN']) {
    await panel.getByLabel('스테이지 (1–300)').fill(invalidStage)
    await panel.getByRole('button', { name: '이동' }).click()
    await expect(panel.getByRole('alert')).toContainText('stage must be a safe integer')
  }
  await panel.getByLabel('골드').fill('-1')
  await panel.getByRole('button', { name: '자원 적용' }).click()
  await expect(panel.getByRole('alert')).toContainText('gold must be a safe integer')
  await panel.getByLabel('골드').fill('9007199254740992')
  await panel.getByRole('button', { name: '자원 적용' }).click()
  await expect(panel.getByRole('alert')).toContainText('gold must be a safe integer')
  await panel.getByLabel('오프라인 시간 (0–480분)').fill('481')
  await panel.getByRole('button', { name: '진행 적용' }).click()
  await expect(panel.getByRole('alert')).toContainText('offline minutes must be a safe integer')

  await page.waitForTimeout(5_250)
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')))
  expect(await readRawSaves(page)).toEqual(originalSaves)

  await page.reload()
  await expect(page.getByTestId('debug-panel')).toBeVisible()
  expect(await readRawSaves(page)).toEqual(originalSaves)
  await expect(page.getByTestId('debug-panel').getByText('SP 0', { exact: false })).toBeVisible()
  await expect(page.getByTestId('debug-panel').getByText('정수 0', { exact: false })).toBeVisible()

  await acceptNextConfirmation(page)
  await page.getByTestId('debug-panel').getByRole('button', { name: '세션 초기화' }).click()
  expect(await readRawSaves(page)).toEqual(originalSaves)

  await acceptNextConfirmation(page)
  await page.getByTestId('debug-panel').getByRole('button', { name: '정상 게임으로 종료' }).click()
  await expect(page.getByTestId('debug-panel')).toHaveCount(0)
  await expect(page.getByText('● 자동 저장 정상', { exact: true })).toBeVisible()

  const savedAfterExit = await readRawSaves(page)
  for (const raw of [savedAfterExit['emberwatch.save.v2.a'], savedAfterExit['emberwatch.save.v2.b']]) {
    if (raw === null) continue
    const envelope = JSON.parse(raw) as {
      state: { player: { gold: number; skillPoints: number; essence: number }; battle: { stage: number } }
    }
    expect(envelope.state.player.skillPoints).not.toBe(456)
    expect(envelope.state.player.essence).not.toBe(789)
    expect(envelope.state.battle.stage).not.toBe(300)
  }
})
