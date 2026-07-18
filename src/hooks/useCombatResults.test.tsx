import { act, renderHook } from '@testing-library/react'
import { StrictMode, type ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import type {
  BossVictoryCombatEvent,
  CombatEvent,
  CombatEventBatch,
  CombatEventSnapshot,
  DefeatCombatEvent,
} from '../game/types'
import { useCombatResults } from './useCombatResults'

const SNAPSHOT: CombatEventSnapshot = {
  stage: 11,
  highestStage: 11,
  playerHp: 100,
  enemyHp: 34,
  gold: 1_255,
  xp: 50,
}

const EMPTY_BATCH: CombatEventBatch = {
  nextCursor: '0',
  totalEvents: 0,
  events: [],
}

function victory(round: string): BossVictoryCombatEvent {
  return {
    id: `victory-${round}`,
    type: 'bossVictory',
    roundSequence: round,
    ordinal: 30,
    rngState: 123,
    stage: 10,
    defeatedStage: 10,
    nextStage: 11,
    gold: 240,
    xp: 120,
    milestoneReward: null,
    snapshot: SNAPSHOT,
  }
}

function defeat(round: string): DefeatCombatEvent {
  return {
    id: `defeat-${round}`,
    type: 'defeat',
    roundSequence: round,
    ordinal: 30,
    rngState: 456,
    stage: 10,
    damage: 96,
    defeatedAtStage: 10,
    returnStage: 9,
    highestStage: 11,
    snapshot: { ...SNAPSHOT, stage: 9 },
  }
}

function batch(events: readonly CombatEvent[]): CombatEventBatch {
  const last = events.at(-1)
  return {
    nextCursor: last?.roundSequence ?? '0',
    totalEvents: events.length,
    events,
  }
}

describe('useCombatResults', () => {
  it('consumes an initial nonempty batch and does not duplicate it in StrictMode effects', () => {
    const initial = batch([victory('1')])
    const { result, rerender } = renderHook(
      ({ events, generation }) => useCombatResults(events, generation),
      {
        initialProps: { events: initial, generation: 3 },
        wrapper: ({ children }: { children: ReactNode }) => (
          <StrictMode>{children}</StrictMode>
        ),
      },
    )

    expect(result.current.queue.map(({ id }) => id)).toEqual(['victory-1'])
    expect(result.current.overflowCount).toBe(0)
    rerender({ events: initial, generation: 3 })
    expect(result.current.queue.map(({ id }) => id)).toEqual(['victory-1'])
  })

  it('consumes the first nonempty update in the mounted generation', () => {
    const { result, rerender } = renderHook(
      ({ events, generation }) => useCombatResults(events, generation),
      { initialProps: { events: EMPTY_BATCH, generation: 8 } },
    )
    expect(result.current.queue).toEqual([])

    rerender({ events: batch([victory('1'), defeat('2')]), generation: 8 })

    expect(result.current.queue.map(({ id }) => id)).toEqual(['victory-1', 'defeat-2'])
    expect(result.current.announcement).toContain('보스 승리 1건, 패배 1건')
  })

  it('pins independently of queue eviction and clears all memory on generation change', () => {
    const firstGeneration = batch([
      victory('1'),
      defeat('2'),
      victory('3'),
      defeat('4'),
    ])
    const { result, rerender } = renderHook(
      ({ events, generation }) => useCombatResults(events, generation),
      { initialProps: { events: firstGeneration, generation: 10 } },
    )
    expect(result.current.queue.map(({ id }) => id)).toEqual([
      'defeat-2',
      'victory-3',
      'defeat-4',
    ])
    expect(result.current.overflowCount).toBe(1)

    act(() => result.current.openResult('defeat-2'))
    expect(result.current.pinnedResult?.id).toBe('defeat-2')

    rerender({ events: EMPTY_BATCH, generation: 11 })
    expect(result.current.queue).toEqual([])
    expect(result.current.overflowCount).toBe(0)
    expect(result.current.announcement).toBe('')
    expect(result.current.pinnedResult).toBeNull()
    expect(result.current.lastConsumedCoordinate).toBeNull()

    rerender({ events: batch([defeat('1')]), generation: 11 })
    expect(result.current.queue.map(({ id }) => id)).toEqual(['defeat-1'])
    act(() => result.current.openResult('defeat-1'))
    expect(result.current.pinnedResult?.id).toBe('defeat-1')
    act(() => result.current.closeResult())
    expect(result.current.pinnedResult).toBeNull()
  })
})
