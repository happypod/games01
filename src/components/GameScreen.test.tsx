import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createInitialState } from '../game/engine'
import { EXPEDITION_EVENT_DEFINITIONS_V1 } from '../game/content'
import { createExpeditionPendingEvent } from '../game/expedition'
import type { GameController } from '../hooks/useGame'
import { GameScreen } from './GameScreen'

afterEach(() => {
  vi.restoreAllMocks()
  window.localStorage.clear()
})

function createController(): GameController {
  const state = createInitialState(100, 0x0107_0410)
  const pending = createExpeditionPendingEvent(state.rng.seed, 0, 0, 100)
  state.battle.highestStage = 30
  state.expeditionEvents = {
    definitionVersion: 1,
    runPrestige: 0,
    milestoneMask: 7,
    pending: [pending],
    overflowCount: 0,
  }

  return {
    state,
    offlineReport: null,
    combatEventBatch: { nextCursor: '0', totalEvents: 0, events: [] },
    combatEventGeneration: 0,
    recoveredFromInvalidSave: false,
    notice: '자동 원정 중',
    saveHealthy: true,
    ready: true,
    readOnly: false,
    lockSupported: true,
    changeMode: vi.fn(),
    upgradeCampStructure: vi.fn(),
    trainAtCamp: vi.fn(),
    startCampCraft: vi.fn(),
    useCampConsumable: vi.fn(),
    healAtCamp: vi.fn(),
    equipQuickConsumable: vi.fn(),
    useEquippedConsumable: vi.fn(),
    purchaseCampMerchantOffer: vi.fn(),
    acceptSeraContract: vi.fn(),
    increaseSeraTrust: vi.fn(),
    buyUpgrade: vi.fn(),
    buySkill: vi.fn(),
    recruitCompanion: vi.fn(),
    trainCompanion: vi.fn(),
    chooseStage: vi.fn(),
    chooseExpeditionEvent: vi.fn(() => ({
      success: false,
      message: 'unused',
      reason: 'rejected' as const,
    })),
    prestige: vi.fn(),
    reset: vi.fn(),
    restoreSave: vi.fn(() => ({ success: false, message: 'unused' })),
    dismissOfflineReport: vi.fn(),
  }
}

describe('GameScreen expedition prestige warning', () => {
  it('always renders the tactical battle surface and ignores the retired layout preference', () => {
    window.localStorage.setItem('emberwatch.ui.layout.v1', 'dashboard')
    const game = createController()
    render(
      <GameScreen game={game} showReadOnlyWarning={false} showSaveTransfer={false} />,
    )

    expect(screen.getByTestId('tactical-layout')).toBeVisible()
    expect(screen.queryByTestId('game-dashboard')).not.toBeInTheDocument()
    expect(screen.queryByText('유형 1 · 대시보드')).not.toBeInTheDocument()
    expect(screen.getByRole('radio', { name: '전투 · 전술 전장' }))
      .toHaveAttribute('aria-checked', 'true')

    const actionBar = screen.getByRole('region', { name: '전술 명령 빠른 슬롯' })
    for (const assetId of [
      'equipment.ember-blade',
      'equipment.guard-armor',
      'equipment.fortune-charm',
      'skill.power-strike',
      'skill.iron-will',
      'skill.loot-sense',
    ]) {
      expect(actionBar.querySelector(`[data-asset-id="${assetId}"]`))
        .toBeInTheDocument()
    }
  })

  it('renders one camp surface and no battle renderer for a persisted camp mode', () => {
    const game = createController()
    game.state.currentMode = 'CAMP'
    render(
      <GameScreen game={game} showReadOnlyWarning={false} showSaveTransfer={false} />,
    )

    expect(screen.getByTestId('camp-dashboard')).toBeVisible()
    expect(screen.queryByTestId('game-dashboard')).not.toBeInTheDocument()
    expect(screen.queryByTestId('tactical-layout')).not.toBeInTheDocument()
    expect(screen.getByText('전경 전투 일시 정지')).toBeVisible()
  })

  it('keeps save export available for a read-only camp save', () => {
    const game = createController()
    game.state.currentMode = 'CAMP'
    game.readOnly = true
    game.lockSupported = false
    render(<GameScreen game={game} showReadOnlyWarning={false} />)

    expect(screen.getByRole('heading', { name: '저장 백업' })).toBeVisible()
    expect(screen.getByRole('button', { name: '저장 내보내기' })).toBeEnabled()
    expect(screen.getByLabelText('저장 파일 선택')).toBeDisabled()
    expect(screen.getByRole('radio', { name: '전투 · 전술 전장' }))
      .toHaveAttribute('aria-disabled', 'true')
  })

  it('opens the inventory intel tab from an unmounted quick-consumable slot', () => {
    const game = createController()
    render(
      <GameScreen game={game} showReadOnlyWarning={false} showSaveTransfer={false} />,
    )

    fireEvent.click(screen.getByRole('button', { name: /^빠른 소모품, 미장착,/ }))
    fireEvent.click(
      within(screen.getByRole('dialog', { name: '빠른 소모품' }))
        .getByRole('button', { name: '인벤토리 열기' }),
    )

    expect(screen.getByRole('tab', { name: '가방' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.getByRole('tabpanel', { name: '가방' })).toBeVisible()
  })

  it('routes the camp choice through the persisted game command', () => {
    const game = createController()
    render(
      <GameScreen game={game} showReadOnlyWarning={false} showSaveTransfer={false} />,
    )

    fireEvent.click(screen.getByRole('radio', { name: '캠프 · 관리' }))
    expect(game.changeMode).toHaveBeenCalledTimes(1)
    expect(game.changeMode).toHaveBeenCalledWith('CAMP')
  })

  it('connects the stored expedition offer to the public command', () => {
    const game = createController()
    const pending = game.state.expeditionEvents.pending[0]!
    const definition = EXPEDITION_EVENT_DEFINITIONS_V1[pending.definitionId]
    const choice = pending.resolvedChoices[0]!
    const label = definition.choices.find(({ id }) => id === choice.choiceId)!.label
    const preview = choice.effect.type === 'grantGold'
      ? `골드 최대 +${choice.effect.amount}`
      : `체력 최대 +${choice.effect.amount}`
    render(
      <GameScreen
        game={game}
        showReadOnlyWarning={false}
        showSaveTransfer={false}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '원정 이벤트 1건 보기' }))
    expect(screen.getByRole('heading', { name: '원정 선택 이벤트' })).toBeVisible()
    fireEvent.click(screen.getByRole('button', {
      name: `${definition.name}, ${label}, ${preview}`,
    }))
    expect(game.chooseExpeditionEvent).toHaveBeenCalledTimes(1)
    expect(game.chooseExpeditionEvent).toHaveBeenCalledWith(
      pending.eventId,
      choice.choiceId,
    )
  })

  it('discloses the exact pending discard count before running prestige', () => {
    const game = createController()
    const confirm = vi.spyOn(window, 'confirm')
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true)
    render(
      <GameScreen
        game={game}
        showReadOnlyWarning={false}
        showSaveTransfer={false}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '불씨의 계승' }))
    const utilityPanel = screen.getByTestId('tactical-utility-panel')
    const prestige = within(utilityPanel).getByRole('button', { name: '환생하기' })
    fireEvent.click(prestige)
    expect(confirm).toHaveBeenLastCalledWith(
      '골드, 레벨, 장비, 스테이지를 초기화하고 환생할까요?\n' +
        '환생하면 대기 중인 원정 이벤트 1개가 보상 없이 사라집니다.',
    )
    expect(game.prestige).not.toHaveBeenCalled()

    fireEvent.click(prestige)
    expect(game.prestige).toHaveBeenCalledTimes(1)
  })
})
