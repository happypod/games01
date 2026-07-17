import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'

const STARTED_AT = new Date('2026-07-17T02:00:00.000Z')

test('저장을 내보내고 잘못된 파일은 거부한 뒤 검증된 백업만 복원한다', async ({
  context,
  page,
}) => {
  const browserErrors: string[] = []
  page.on('pageerror', (error) => browserErrors.push(`page: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(`console: ${message.text()}`)
  })
  await context.clock.setFixedTime(STARTED_AT)
  await page.goto('/')
  await expect(page.getByText('● 자동 저장 정상', { exact: true })).toBeVisible()

  await context.clock.setFixedTime(new Date(STARTED_AT.getTime() + 6_000))
  const weaponButton = page.getByRole('button', { name: /불씨 검 강화/ })
  await expect(weaponButton).toBeEnabled()
  await weaponButton.click()
  await expect(
    page.getByRole('article').filter({ hasText: '불씨 검' }).getByText('Lv.1', { exact: true }),
  ).toBeVisible()

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: '저장 내보내기' }).click()
  const download = await downloadPromise
  const downloadPath = await download.path()
  expect(downloadPath).not.toBeNull()
  const exported = await readFile(downloadPath!, 'utf8')
  expect(exported).toContain('emberwatch-portable-save')

  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: '진행 초기화' }).click()
  await expect(
    page.getByRole('article').filter({ hasText: '불씨 검' }).getByText('Lv.0', { exact: true }),
  ).toBeVisible()

  const fileInput = page.getByLabel('저장 파일 선택')
  await fileInput.setInputFiles({
    name: 'broken.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{broken'),
  })
  await expect(page.getByText('JSON 형식이 올바르지 않습니다.', { exact: true })).toBeVisible()
  await page.reload()
  await expect(
    page.getByRole('article').filter({ hasText: '불씨 검' }).getByText('Lv.0', { exact: true }),
  ).toBeVisible()

  await page.getByLabel('저장 파일 선택').setInputFiles({
    name: 'emberwatch-save.json',
    mimeType: 'application/json',
    buffer: Buffer.from(exported),
  })
  let preview = page.getByRole('dialog', { name: '이 진행으로 복원할까요?' })
  await expect(preview).toBeVisible()
  await preview.getByRole('button', { name: '취소' }).click()
  await expect(preview).toHaveCount(0)
  await page.reload()
  await expect(
    page.getByRole('article').filter({ hasText: '불씨 검' }).getByText('Lv.0', { exact: true }),
  ).toBeVisible()

  await page.getByLabel('저장 파일 선택').setInputFiles({
    name: 'emberwatch-save.json',
    mimeType: 'application/json',
    buffer: Buffer.from(exported),
  })
  preview = page.getByRole('dialog', { name: '이 진행으로 복원할까요?' })
  await expect(preview).toBeVisible()
  await preview.getByRole('button', { name: '검증된 저장 복원' }).click()
  expect(browserErrors).toEqual([])
  await expect(preview).toHaveCount(0)
  await expect(
    page.getByRole('article').filter({ hasText: '불씨 검' }).getByText('Lv.1', { exact: true }),
  ).toBeVisible()

  await page.reload()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(
    page.getByRole('article').filter({ hasText: '불씨 검' }).getByText('Lv.1', { exact: true }),
  ).toBeVisible()
})
