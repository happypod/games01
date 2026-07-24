import { expect, test } from '@playwright/test'

const STARTED_AT = new Date('2026-07-17T01:00:00.000Z')

test('두 번째 탭은 읽기 전용이며 writer 종료 뒤 저장권을 이어받는다', async ({ context }) => {
  await context.clock.setFixedTime(STARTED_AT)

  const writer = await context.newPage()
  await writer.goto('/')
  await expect(writer.getByText('● 자동 저장 정상', { exact: true })).toBeVisible()
  await writer.getByRole('radio', { name: '캠프 · 관리' }).click()
  await expect(writer.getByTestId('camp-dashboard')).toBeVisible()

  const reader = await context.newPage()
  await reader.goto('/')
  await expect(reader.getByText('● 읽기 전용', { exact: true })).toBeVisible()
  await expect(reader.getByText(/다른 탭이 진행을 저장하고 있습니다/)).toBeVisible()
  await expect(reader.getByTestId('camp-dashboard')).toBeVisible()
  await expect(reader.getByRole('button', { name: '저장 내보내기' })).toBeEnabled()
  await expect(reader.getByLabel('저장 파일 선택')).toBeDisabled()
  await expect(reader.getByRole('radio', { name: '전투 · 전술 전장' }))
    .toHaveAttribute('aria-disabled', 'true')
  const downloadPromise = reader.waitForEvent('download')
  await reader.getByRole('button', { name: '저장 내보내기' }).click()
  expect(await (await downloadPromise).path()).not.toBeNull()

  await writer.getByRole('radio', { name: '전투 · 전술 전장' }).click()
  await expect(reader.getByTestId('tactical-layout')).toBeVisible()
  await reader.locator('[data-action-slot="weapon"]').click()
  await expect(reader.locator('[data-action-detail="weapon"]')
    .getByRole('button', { name: /불씨 검 강화/ })).toBeDisabled()
  await expect(reader.getByRole('button', { name: '진행 초기화' })).toBeDisabled()

  await context.clock.setFixedTime(new Date(STARTED_AT.getTime() + 6_000))
  await writer.locator('[data-action-slot="weapon"]').click()
  const writerWeaponButton = writer.locator('[data-action-detail="weapon"]')
    .getByRole('button', { name: /불씨 검 강화/ })
  await expect(writerWeaponButton).toBeEnabled()
  await writerWeaponButton.click()
  await expect(reader.locator('[data-action-slot="weapon"]')).toContainText('Lv.1')
  await expect(reader.getByText('● 읽기 전용', { exact: true })).toBeVisible()

  await writer.close()
  await expect(reader.getByText('● 자동 저장 정상', { exact: true })).toBeVisible({
    timeout: 5_000,
  })

  const nextReader = await context.newPage()
  await nextReader.goto('/')
  await expect(nextReader.getByText('● 읽기 전용', { exact: true })).toBeVisible()
  await expect(nextReader.locator('[data-action-slot="weapon"]')).toContainText('Lv.1')

  await reader.close()
  await expect(nextReader.getByText('● 자동 저장 정상', { exact: true })).toBeVisible({
    timeout: 5_000,
  })
})
