import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { getEnemyDefinition } from '../game/content'
import { createInitialState } from '../game/engine'
import { formatNumber } from '../game/format'
import type { CombatEventBatch, GameState, KillCombatEvent } from '../game/types'
import { LivingCardConsole } from './LivingCardConsole'

vi.mock('./GameAsset', () => ({
  GameAsset: ({ assetId }: { assetId: string }) => (
    <span data-testid="living-console-game-asset" data-asset-id={assetId} aria-hidden="true" />
  ),
}))

const EMPTY_BATCH: CombatEventBatch = { nextCursor: '0', totalEvents: 0, events: [] }

function createConsoleState(): GameState {
  return createInitialState(0, 0x99)
}

function buildKillEvent(overrides: Partial<KillCombatEvent> = {}): KillCombatEvent {
  return {
    id: 'fixture-kill-1',
    type: 'kill',
    roundSequence: '1',
    ordinal: 30,
    rngState: 0,
    stage: 3,
    defeatedStage: 3,
    nextStage: 4,
    gold: 42,
    xp: 7,
    snapshot: {
      stage: 4,
      highestStage: 4,
      playerHp: 100,
      enemyHp: 0,
      gold: 42,
      xp: 7,
    },
    ...overrides,
  }
}

describe('IRPG-802 LivingCardConsole', () => {
  it('shows an explicit empty state instead of inventing capture/corruption numbers when no living card exists', () => {
    const state = createConsoleState()
    expect(state.livingCards).toEqual({})

    render(<LivingCardConsole state={state} batch={EMPTY_BATCH} />)

    expect(screen.getByTestId('living-card-empty-state')).toHaveTextContent(
      '포획 진행 중인 대상이 없습니다.',
    )
    expect(screen.queryByText(/충성도/)).not.toBeInTheDocument()
    expect(screen.queryByText(/타락 농도/)).not.toBeInTheDocument()
    expect(screen.queryByText('포획됨')).not.toBeInTheDocument()
  })

  it('renders the real engine livingCards values verbatim, without recomputing them', () => {
    const state = createConsoleState()
    const enemy = getEnemyDefinition(state.battle.stage)
    state.livingCards = {
      [enemy.assetId]: {
        cardId: enemy.assetId,
        hStage: 1,
        captureLoyalty: 64,
        corruptionLevel: 12,
        isCaptured: false,
      },
    }

    render(<LivingCardConsole state={state} batch={EMPTY_BATCH} />)

    expect(screen.queryByTestId('living-card-empty-state')).not.toBeInTheDocument()
    expect(screen.getByText('64%')).toBeInTheDocument()
    expect(screen.getByText('12%')).toBeInTheDocument()
    expect(screen.getByText(/H-Stage 1: Damaged/)).toBeInTheDocument()
    expect(screen.queryByText('포획됨')).not.toBeInTheDocument()
  })

  it('shows the captured badge once isCaptured is true', () => {
    const state = createConsoleState()
    const enemy = getEnemyDefinition(state.battle.stage)
    state.livingCards = {
      [enemy.assetId]: {
        cardId: enemy.assetId,
        hStage: 2,
        captureLoyalty: 100,
        corruptionLevel: 30,
        isCaptured: true,
      },
    }

    render(<LivingCardConsole state={state} batch={EMPTY_BATCH} />)

    expect(screen.getByText('포획됨')).toBeInTheDocument()
  })

  it('renders real combat events with the same copy CombatLogPanel uses, not a hardcoded fake log', () => {
    const state = createConsoleState()
    const batch: CombatEventBatch = {
      nextCursor: '1',
      totalEvents: 1,
      events: [buildKillEvent()],
    }

    render(<LivingCardConsole state={state} batch={batch} />)

    expect(screen.queryByTestId('living-console-log-empty-state')).not.toBeInTheDocument()
    expect(
      screen.getByText(`스테이지 3 승리 · 골드 ${formatNumber(42)} · 경험치 ${formatNumber(7)}`),
    ).toBeInTheDocument()
  })

  it('shows an explicit empty state for the log when the batch has no events', () => {
    const state = createConsoleState()
    render(<LivingCardConsole state={state} batch={EMPTY_BATCH} />)

    expect(screen.getByTestId('living-console-log-empty-state')).toHaveTextContent(
      '아직 기록된 전투 이벤트가 없습니다.',
    )
  })

  it('never renders the old hardcoded fake log lines or the wrong schema label', () => {
    const state = createConsoleState()
    render(<LivingCardConsole state={state} batch={EMPTY_BATCH} />)

    expect(screen.queryByText(/Schema 5/)).not.toBeInTheDocument()
    expect(screen.queryByText(/루미가 협공 사격을 지원했습니다/)).not.toBeInTheDocument()
    expect(screen.queryByText(/전투 세션 진행 중/)).not.toBeInTheDocument()
  })
})
