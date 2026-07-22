import { expect, test, type Page } from '@playwright/test'
import { createInitialState } from '../src/game/engine'
import {
  SAVE_FORMAT_VERSION,
  SAVE_SLOT_A_KEY,
  SAVE_SLOT_B_KEY,
} from '../src/game/persistence'
import type { GameState } from '../src/game/types'

const STARTED_AT = new Date('2026-07-22T10:00:00.000Z')

interface StoredEnvelope {
  revision: number
  state: GameState
}

function collectBrowserErrors(page: Page, errors: string[]) {
  page.on('pageerror', (error) => errors.push(`page: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`)
  })
}

function createBondFixture(): GameState {
  const state = createInitialState(STARTED_AT.getTime(), 0x4254_2842)
  state.currentMode = 'CAMP'
  state.player.gold = 3_000
  state.camp.materials = { ashShard: 20, beastHide: 10, emberCore: 2 }
  state.camp.residents.sera = { status: 'contracted', trust: 2 }
  return state
}

async function seedState(page: Page, state: GameState) {
  const serialized = JSON.stringify({
    formatVersion: SAVE_FORMAT_VERSION,
    revision: 1,
    savedAt: state.lastSavedAt,
    state,
  })
  await page.addInitScript(
    ({ key, value }) => window.localStorage.setItem(key, value),
    { key: SAVE_SLOT_A_KEY, value: serialized },
  )
}

async function readLatestStoredState(page: Page): Promise<GameState> {
  return page.evaluate(([slotA, slotB]) => {
    const latest = [slotA, slotB]
      .map((key) => window.localStorage.getItem(key))
      .filter((raw): raw is string => raw !== null)
      .map((raw) => JSON.parse(raw) as StoredEnvelope)
      .sort((left, right) => right.revision - left.revision)[0]
    if (latest === undefined) throw new Error('저장된 게임 상태가 없습니다.')
    return latest.state
  }, [SAVE_SLOT_A_KEY, SAVE_SLOT_B_KEY] as const)
}

test('IRPG-425/426/427/428 keeps consent, costume and synthesis exact-once across reload', async ({
  context,
  page,
}) => {
  test.setTimeout(60_000)
  const browserErrors: string[] = []
  collectBrowserErrors(page, browserErrors)
  await context.clock.setFixedTime(STARTED_AT)
  await page.setViewportSize({ width: 360, height: 800 })
  await seedState(page, createBondFixture())

  await page.goto('/')
  await expect(page.getByText('● 자동 저장 정상', { exact: true })).toBeVisible()
  const tablist = page.getByRole('tablist', { name: '캠프 중앙 시설' })
  const overviewTab = tablist.getByRole('tab', { name: '캠프 관리', exact: true })
  const costumeTab = tablist.getByRole('tab', { name: '의상실', exact: true })
  const synthesisTab = tablist.getByRole('tab', { name: '합동 연성실', exact: true })

  await overviewTab.focus()
  await overviewTab.press('End')
  await expect(synthesisTab).toBeFocused()
  await expect(synthesisTab).toHaveAttribute('aria-selected', 'true')
  await synthesisTab.press('Home')
  await expect(overviewTab).toBeFocused()
  await overviewTab.press('ArrowRight')
  await expect(tablist.getByRole('tab', { name: '유대 훈련실', exact: true }))
    .toBeFocused()

  await costumeTab.click()
  const facilities = page.getByTestId('camp-special-facilities')
  await expect(facilities.locator('[data-bond-room="costume-locked"]')).toBeVisible()
  await expect(facilities.locator('[data-asset-id="costume.chapter1.sera.ember-bond"]'))
    .toHaveCount(0)

  await page.getByRole('checkbox', {
    name: /나는 18세 이상이며, 등장인물은 모두 성인이고 상호 동의는 언제든 철회 가능한 원칙/,
  }).check()
  await page.getByRole('button', { name: '성인 콘텐츠 접근 확인', exact: true }).click()
  await page.getByRole('button', { name: '세라의 자율 동의 확인', exact: true }).click()
  await expect(facilities).toHaveAttribute('data-consent-status', 'granted')
  const costumePreview = facilities.locator(
    '[data-asset-id="costume.chapter1.sera.ember-bond"]',
  )
  await expect(costumePreview).toHaveAttribute('data-state', 'loaded')
  await expect(page.getByRole('radio', { name: /세라의 잿불 정찰복/ }))
    .toBeChecked()

  await page.reload()
  await expect(page.getByTestId('camp-dashboard')).toBeVisible()
  await page.getByRole('tab', { name: '의상실', exact: true }).click()
  await expect(page.getByTestId('camp-special-facilities'))
    .toHaveAttribute('data-consent-status', 'granted')
  let stored = await readLatestStoredState(page)
  expect(stored.camp.bond).toMatchObject({
    adultAccessConfirmed: true,
    seraConsent: 'granted',
    currentCostumeId: 'chapter1.sera.field',
    unlockedCostumeMask: 1,
    claimedSynthesisRewardMask: 0,
  })

  await page.getByRole('tab', { name: '합동 연성실', exact: true }).click()
  const synthesis = page.getByTestId('joint-synthesis')
  const synthesisButton = synthesis.getByRole('button', {
    name: '합동 연성 시작',
    exact: true,
  })
  await synthesisButton.click()
  const rewardDialog = page.getByTestId('synthesis-reward-dialog')
  await expect(rewardDialog).toBeVisible()
  await expect(rewardDialog).toHaveAttribute(
    'data-reward-id',
    'chapter1.weapon.ember-vow-card',
  )
  await expect(rewardDialog.getByRole('button', { name: '보상 확인', exact: true }))
    .toBeFocused()
  await rewardDialog.getByRole('button', { name: '보상 확인', exact: true }).click()
  await expect(synthesis).toBeFocused()

  stored = await readLatestStoredState(page)
  expect(stored.player.gold).toBe(2_100)
  expect(stored.camp.materials).toEqual({ ashShard: 8, beastHide: 4, emberCore: 1 })
  expect(stored.camp.bond.claimedSynthesisRewardMask).toBe(1)

  await page.reload()
  await page.getByRole('tab', { name: '합동 연성실', exact: true }).click()
  const paidState = await readLatestStoredState(page)
  const paidButton = page.getByTestId('joint-synthesis').getByRole('button', {
    name: '보상 지급 완료',
    exact: true,
  })
  await expect(paidButton).toBeDisabled()
  expect(await readLatestStoredState(page)).toEqual(paidState)

  await page.getByRole('button', { name: '동의 철회', exact: true }).click()
  await expect(page.locator('[data-bond-room="synthesis-locked"]')).toBeVisible()
  stored = await readLatestStoredState(page)
  expect(stored.camp.bond).toMatchObject({
    adultAccessConfirmed: true,
    seraConsent: 'withdrawn',
    unlockedCostumeMask: 1,
    claimedSynthesisRewardMask: 1,
  })
  await page.getByRole('button', { name: '성인 콘텐츠 접근 끄기', exact: true }).click()
  stored = await readLatestStoredState(page)
  expect(stored.camp.bond).toMatchObject({
    adultAccessConfirmed: false,
    seraConsent: 'withdrawn',
    unlockedCostumeMask: 1,
    claimedSynthesisRewardMask: 1,
  })

  const geometry = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    smallButtons: [...document.querySelectorAll('button')]
      .filter((button) => {
        const style = getComputedStyle(button)
        const rect = button.getBoundingClientRect()
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0
      })
      .map((button) => {
        const rect = button.getBoundingClientRect()
        return { text: button.textContent?.trim() ?? '', width: rect.width, height: rect.height }
      })
      .filter(({ width, height }) => width < 44 || height < 44),
  }))
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth)
  expect(geometry.smallButtons).toEqual([])
  expect(browserErrors).toEqual([])
})

test('IRPG-428 reduced motion opens the committed reward without a fusing animation', async ({
  context,
  page,
}) => {
  const browserErrors: string[] = []
  collectBrowserErrors(page, browserErrors)
  await context.clock.setFixedTime(STARTED_AT)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const state = createBondFixture()
  state.camp.bond.adultAccessConfirmed = true
  state.camp.bond.seraConsent = 'granted'
  await seedState(page, state)

  await page.goto('/')
  await page.getByRole('tab', { name: '합동 연성실', exact: true }).click()
  const synthesis = page.getByTestId('joint-synthesis')
  await synthesis.getByRole('button', { name: '합동 연성 시작', exact: true }).click()
  await expect(synthesis).toHaveAttribute('data-synthesis-phase', 'reward')
  await expect(page.getByTestId('synthesis-reward-dialog')).toBeVisible()
  const moving = await synthesis.evaluate((element) =>
    [...element.querySelectorAll('*')].filter((node) => {
      const style = getComputedStyle(node)
      return (style.animationName !== 'none' && style.animationDuration !== '0s') ||
        style.transitionDuration.split(',').some((duration) => duration.trim() !== '0s')
    }).length,
  )
  expect(moving).toBe(0)
  expect(browserErrors).toEqual([])
})

test('IRPG-425 keeps adult access reversible before Sera signs a contract', async ({
  context,
  page,
}) => {
  const browserErrors: string[] = []
  collectBrowserErrors(page, browserErrors)
  await context.clock.setFixedTime(STARTED_AT)
  const state = createBondFixture()
  state.camp.residents.sera = { status: 'rescued', trust: 0 }
  state.camp.bond.adultAccessConfirmed = true
  await seedState(page, state)

  await page.goto('/')
  await page.getByRole('tab', { name: '유대 훈련실', exact: true }).click()
  await expect(page.getByText(/자발적 캠프 계약을 먼저 완료/)).toBeVisible()
  await page.getByRole('button', { name: '성인 콘텐츠 접근 끄기', exact: true }).click()

  const stored = await readLatestStoredState(page)
  expect(stored.camp.bond).toMatchObject({
    adultAccessConfirmed: false,
    seraConsent: 'notGranted',
  })
  expect(browserErrors).toEqual([])
})
