import { expect, test, type Page } from '@playwright/test'

const STARTED_AT = new Date('2026-07-17T00:00:00.000Z')

function collectBrowserErrors(page: Page, errors: string[]) {
  page.on('pageerror', (error) => errors.push(`page: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`)
  })
}

test('신규 원정에서 강화하고 재접속·오프라인 정산을 한 번만 적용한다', async ({ context }) => {
  const browserErrors: string[] = []
  await context.clock.setFixedTime(STARTED_AT)

  let page = await context.newPage()
  collectBrowserErrors(page, browserErrors)
  await page.goto('/')

  await expect(page.getByRole('heading', { name: '꺼지지 않는 원정' })).toBeVisible()
  await expect(page.getByText('자동 원정 중', { exact: true })).toBeVisible()
  await expect(page.getByText('● 자동 저장 정상', { exact: true })).toBeVisible()

  let weaponCard = page.getByRole('article').filter({ hasText: '불씨 검' })
  const weaponButton = page.getByRole('button', { name: /불씨 검 강화/ })
  await expect(weaponCard.getByText('Lv.0', { exact: true })).toBeVisible()
  await expect(weaponButton).toBeDisabled()

  await context.clock.setFixedTime(new Date(STARTED_AT.getTime() + 6_000))
  await expect(weaponButton).toBeEnabled()
  await weaponButton.click()
  await expect(weaponCard.getByText('Lv.1', { exact: true })).toBeVisible()
  await expect(page.getByText('불씨 검 강화 완료', { exact: true })).toBeVisible()

  await page.reload()
  weaponCard = page.getByRole('article').filter({ hasText: '불씨 검' })
  await expect(weaponCard.getByText('Lv.1', { exact: true })).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)

  await page.close()
  await context.clock.setFixedTime(new Date(STARTED_AT.getTime() + 66_000))
  page = await context.newPage()
  collectBrowserErrors(page, browserErrors)
  await page.goto('/')

  const offlineDialog = page.getByRole('dialog', {
    name: '쉬는 동안에도 검은 멈추지 않았습니다',
  })
  await expect(offlineDialog).toBeVisible()
  await expect(offlineDialog).toContainText('1분 0초 동안의 자동 전투 결과입니다.')
  await expect(
    offlineDialog.locator('dl > div').filter({ hasText: '획득 골드' }).locator('dd'),
  ).not.toHaveText('0')
  await expect(
    page.getByRole('article').filter({ hasText: '불씨 검' }).getByText('Lv.1', { exact: true }),
  ).toBeVisible()

  await offlineDialog.getByRole('button', { name: '보상 확인' }).click()
  await expect(offlineDialog).toHaveCount(0)
  const goldValue = page
    .getByLabel('보유 자원')
    .locator('div')
    .filter({ hasText: '골드' })
    .locator('strong')
  const goldAfterOffline = await goldValue.innerText()
  await page.reload()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(goldValue).toHaveText(goldAfterOffline)
  expect(browserErrors).toEqual([])
})
