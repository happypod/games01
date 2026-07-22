import { StrictMode, type ReactNode } from 'react'
import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CombatEvent, CombatEventBatch, CombatEventSnapshot } from '../game/types'
import {
  TACTICAL_STAGE_SCENE_LIMIT,
  TACTICAL_STAGE_SCENE_MS,
  useTacticalStageEffects,
} from './useTacticalStageEffects'

const EMPTY_BATCH: CombatEventBatch = {
  nextCursor: '0',
  totalEvents: 0,
  events: [],
}

function snapshot(round: number): CombatEventSnapshot {
  return {
    stage: round,
    highestStage: round,
    playerHp: 100 - round,
    enemyHp: 50 - round,
    gold: round * 10,
    xp: round * 2,
  }
}

function event(
  round: number,
  type: CombatEvent['type'],
  idSuffix = '',
): CombatEvent {
  const base = {
    id: `${round}:${type}${idSuffix}`,
    roundSequence: String(round),
    rngState: round,
    stage: round,
    snapshot: snapshot(round),
  }
  if (type === 'skill') {
    return { ...base, type, ordinal: 10, skillId: 'powerStrike', damage: round + 10 }
  }
  if (type === 'critical') {
    return { ...base, type, ordinal: 20, damage: round + 20 }
  }
  if (type === 'companionAssist') {
    return {
      ...base,
      type,
      ordinal: 25,
      companionId: 'emberFox',
      damage: round + 5,
    }
  }
  if (type === 'kill') {
    return {
      ...base,
      type,
      ordinal: 30,
      defeatedStage: round,
      nextStage: round + 1,
      gold: round * 10,
      xp: round * 2,
    }
  }
  if (type === 'bossVictory') {
    return {
      ...base,
      type,
      ordinal: 30,
      defeatedStage: round,
      nextStage: round + 1,
      gold: round * 10,
      xp: round * 2,
      milestoneReward: null,
    }
  }
  return {
    ...base,
    type,
    ordinal: 30,
    damage: round,
    defeatedAtStage: round,
    returnStage: Math.max(1, round - 1),
    highestStage: round,
  }
}

function batch(events: readonly CombatEvent[], nextCursor?: string): CombatEventBatch {
  return {
    nextCursor: nextCursor ?? events.at(-1)?.roundSequence ?? '0',
    totalEvents: events.length,
    events,
  }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('useTacticalStageEffects', () => {
  it('seeds an initial batch, then groups and orders only new same-round events', () => {
    vi.useFakeTimers()
    const seeded = [event(1, 'critical')]
    const { result, rerender } = renderHook(
      ({ source, generation, active }) =>
        useTacticalStageEffects(source, generation, active),
      { initialProps: { source: batch(seeded), generation: 3, active: true } },
    )

    expect(result.current.scene).toBeNull()
    expect(vi.getTimerCount()).toBe(0)

    const newRound = [
      event(2, 'bossVictory'),
      event(2, 'companionAssist'),
      event(2, 'skill'),
      event(2, 'critical'),
    ]
    rerender({ source: batch([...seeded, ...newRound], '2'), generation: 3, active: true })

    expect(result.current.scene).toMatchObject({
      id: '3:2',
      roundSequence: '2',
      snapshot: snapshot(2),
      priorityOutcome: { type: 'bossVictory' },
    })
    expect(result.current.scene?.events.map(({ type }) => type)).toEqual([
      'skill',
      'critical',
      'companionAssist',
      'bossVictory',
    ])
    expect(result.current.queuedSceneCount).toBe(0)
    expect(vi.getTimerCount()).toBe(1)
  })

  it('deduplicates overlapping batches and bounds scenes while preserving outcomes', () => {
    vi.useFakeTimers()
    const { result, rerender } = renderHook(
      ({ source }) => useTacticalStageEffects(source, 1, true),
      { initialProps: { source: EMPTY_BATCH } },
    )
    const ordinary = Array.from({ length: 7 }, (_, index) => event(index + 1, 'critical'))
    const allEvents = [
      ...ordinary,
      event(8, 'bossVictory'),
      event(9, 'defeat'),
    ]
    rerender({ source: batch(allEvents) })

    expect(result.current.scene?.roundSequence).toBe('1')
    expect(result.current.queuedSceneCount + 1).toBe(TACTICAL_STAGE_SCENE_LIMIT)
    expect(result.current.skippedSceneCount).toBe(3)

    rerender({ source: batch([...allEvents, ...allEvents], '9') })
    expect(result.current.queuedSceneCount + 1).toBe(TACTICAL_STAGE_SCENE_LIMIT)
    expect(result.current.skippedSceneCount).toBe(3)

    const played: string[] = []
    while (result.current.scene !== null) {
      played.push(result.current.scene.roundSequence)
      act(() => vi.advanceTimersByTime(TACTICAL_STAGE_SCENE_MS))
    }
    expect(played).toContain('8')
    expect(played).toContain('9')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('clears playback and seeds the replacement batch when generation changes', () => {
    vi.useFakeTimers()
    const { result, rerender } = renderHook(
      ({ source, generation }) => useTacticalStageEffects(source, generation, true),
      { initialProps: { source: EMPTY_BATCH, generation: 1 } },
    )
    rerender({ source: batch([event(5, 'skill')], '5'), generation: 1 })
    expect(result.current.scene?.roundSequence).toBe('5')
    expect(vi.getTimerCount()).toBe(1)

    const replacement = batch([event(1, 'critical')], '1')
    rerender({ source: replacement, generation: 2 })
    expect(result.current.scene).toBeNull()
    expect(result.current.skippedSceneCount).toBe(0)
    expect(vi.getTimerCount()).toBe(0)

    rerender({
      source: batch([...replacement.events, event(2, 'companionAssist')], '2'),
      generation: 2,
    })
    expect(result.current.scene?.roundSequence).toBe('2')
  })

  it('consumes events while inactive without replaying them after activation', () => {
    vi.useFakeTimers()
    const { result, rerender } = renderHook(
      ({ source, active }) => useTacticalStageEffects(source, 1, active),
      { initialProps: { source: EMPTY_BATCH, active: true } },
    )
    const first = batch([event(1, 'critical')], '1')
    rerender({ source: first, active: true })
    expect(result.current.scene?.roundSequence).toBe('1')

    const inactiveBatch = batch([...first.events, event(2, 'bossVictory')], '2')
    rerender({ source: inactiveBatch, active: false })
    expect(result.current.scene).toBeNull()
    expect(vi.getTimerCount()).toBe(0)

    rerender({ source: inactiveBatch, active: true })
    expect(result.current.scene).toBeNull()
    expect(vi.getTimerCount()).toBe(0)

    rerender({
      source: batch([...inactiveBatch.events, event(3, 'skill')], '3'),
      active: true,
    })
    expect(result.current.scene?.roundSequence).toBe('3')
  })

  it('keeps one timer in StrictMode and clears it on overlap and unmount', () => {
    vi.useFakeTimers()
    const view = renderHook(
      ({ source }) => useTacticalStageEffects(source, 4, true),
      {
        initialProps: { source: EMPTY_BATCH },
        wrapper: ({ children }: { children: ReactNode }) => (
          <StrictMode>{children}</StrictMode>
        ),
      },
    )

    const first = batch([event(1, 'skill'), event(1, 'critical')], '1')
    view.rerender({ source: first })
    expect(view.result.current.scene?.events).toHaveLength(2)
    expect(vi.getTimerCount()).toBe(1)

    view.rerender({ source: batch([...first.events, event(2, 'companionAssist')], '2') })
    expect(view.result.current.scene?.roundSequence).toBe('1')
    expect(view.result.current.queuedSceneCount).toBe(1)
    expect(vi.getTimerCount()).toBe(1)

    view.unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
