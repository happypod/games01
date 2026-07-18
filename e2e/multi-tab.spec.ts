import { expect, test } from '@playwright/test'

const STARTED_AT = new Date('2026-07-17T01:00:00.000Z')

test('두 번째 탭은 읽기 전용이며 writer 종료 뒤 저장권을 이어받는다', async ({ context }) => {
  await context.clock.setFixedTime(STARTED_AT)

  const writer = await context.newPage()
  await writer.goto('/')
  await expect(writer.getByText('● 자동 저장 정상', { exact: true })).toBeVisible()

  const reader = await context.newPage()
  await reader.goto('/')
  await expect(reader.getByText('● 읽기 전용', { exact: true })).toBeVisible()
  await expect(reader.getByText(/다른 탭이 진행을 저장하고 있습니다/)).toBeVisible()
  await expect(reader.getByRole('button', { name: /불씨 검 강화/ })).toBeDisabled()
  await expect(reader.getByRole('button', { name: '진행 초기화' })).toBeDisabled()

  await context.clock.setFixedTime(new Date(STARTED_AT.getTime() + 6_000))
  const writerWeaponButton = writer.getByRole('button', { name: /불씨 검 강화/ })
  await expect(writerWeaponButton).toBeEnabled()
  await writerWeaponButton.click()
  await expect(
    reader.getByRole('article').filter({ hasText: '불씨 검' }).getByText('Lv.1', { exact: true }),
  ).toBeVisible()
  await expect(reader.getByText('● 읽기 전용', { exact: true })).toBeVisible()

  await writer.close()
  await expect(reader.getByText('● 자동 저장 정상', { exact: true })).toBeVisible({
    timeout: 5_000,
  })

  const nextReader = await context.newPage()
  await nextReader.goto('/')
  await expect(nextReader.getByText('● 읽기 전용', { exact: true })).toBeVisible()
  await expect(
    nextReader
      .getByRole('article')
      .filter({ hasText: '불씨 검' })
      .getByText('Lv.1', { exact: true }),
  ).toBeVisible()

  await reader.close()
  await expect(nextReader.getByText('● 자동 저장 정상', { exact: true })).toBeVisible({
    timeout: 5_000,
  })
})
