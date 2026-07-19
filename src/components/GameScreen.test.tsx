import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createInitialState } from '../game/engine'
import { EXPEDITION_EVENT_DEFINITIONS_V1 } from '../game/content'
import { createExpeditionPendingEvent } from '../game/expedition'
import type { GameController } from '../hooks/useGame'
import { GameScreen } from './GameScreen'

afterEach(() => vi.restoreAllMocks())

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

    const prestige = screen.getByRole('button', { name: '환생하기' })
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
