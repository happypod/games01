import { describe, expect, it } from 'vitest'
import type {
  BossVictoryCombatEvent,
  CombatEvent,
  CombatEventBatch,
  CombatEventSnapshot,
  DefeatCombatEvent,
} from '../game/types'
import {
  closePinnedCombatResult,
  compareCombatResultCoordinates,
  consumeCombatResultBatch,
  createCombatResultConsumerState,
  createCombatResultSnapshot,
  pinCombatResult,
} from './combatResultView'

const EMPTY_BATCH: CombatEventBatch = {
  nextCursor: '0',
  totalEvents: 0,
  events: [],
}

function eventSnapshot(stage: number): CombatEventSnapshot {
  return {
    stage,
    highestStage: Math.max(11, stage),
    playerHp: 100,
    enemyHp: 34,
    gold: 1_000,
    xp: 50,
  }
}

function victory(
  round: string,
  stage = 10,
  milestone = true,
): BossVictoryCombatEvent {
  return {
    id: `victory-${round}`,
    type: 'bossVictory',
    roundSequence: round,
    ordinal: 30,
    rngState: 0x4100_0000,
    stage,
    defeatedStage: stage,
    nextStage: stage + 1,
    gold: 240,
    xp: 120,
    milestoneReward: milestone
      ? {
          tableId: 'boss-milestone-v1',
          kind: 'gold',
          milestoneStage: stage,
          configuredGold: 15,
          appliedGold: 15,
        }
      : null,
    snapshot: eventSnapshot(stage + 1),
  }
}

function defeat(round: string, stage = 10): DefeatCombatEvent {
  return {
    id: `defeat-${round}`,
    type: 'defeat',
    roundSequence: round,
    ordinal: 30,
    rngState: 0x4100_0001,
    stage,
    damage: 96,
    defeatedAtStage: stage,
    returnStage: Math.max(1, stage - 1),
    highestStage: stage + 1,
    snapshot: eventSnapshot(Math.max(1, stage - 1)),
  }
}

function critical(round: string): CombatEvent {
  return {
    id: `critical-${round}`,
    type: 'critical',
    roundSequence: round,
    ordinal: 20,
    rngState: 0x4100_0002,
    stage: 1,
    damage: 20,
    snapshot: eventSnapshot(1),
  }
}

function batch(
  nextCursor: string,
  totalEvents: number,
  events: readonly CombatEvent[],
): CombatEventBatch {
  return { nextCursor, totalEvents, events }
}

describe('combat result snapshots', () => {
  it('copies only the boss victory and defeat payloads into frozen snapshots', () => {
    const bossEvent = victory('12')
    const boss = createCombatResultSnapshot(bossEvent)
    const loss = createCombatResultSnapshot(defeat('13'))

    expect(boss).toEqual({
      id: 'victory-12',
      type: 'bossVictory',
      roundSequence: '12',
      ordinal: 30,
      stage: 10,
      defeatedStage: 10,
      nextStage: 11,
      gold: 240,
      xp: 120,
      balanceGold: 1_000,
      milestoneReward: {
        tableId: 'boss-milestone-v1',
        kind: 'gold',
        milestoneStage: 10,
        configuredGold: 15,
        appliedGold: 15,
      },
    })
    expect(loss).toMatchObject({
      id: 'defeat-13',
      type: 'defeat',
      defeatedAtStage: 10,
      returnStage: 9,
      highestStage: 11,
    })
    expect(Object.isFrozen(boss)).toBe(true)
    expect(Object.isFrozen(boss?.type === 'bossVictory' && boss.milestoneReward)).toBe(true)
    expect(Object.isFrozen(loss)).toBe(true)
    expect(createCombatResultSnapshot(critical('14'))).toBeNull()

    if (bossEvent.milestoneReward !== null) {
      ;(bossEvent.milestoneReward as { appliedGold: number }).appliedGold = 0
    }
    expect(boss?.type === 'bossVictory' && boss.milestoneReward?.appliedGold).toBe(15)
  })

  it('orders coordinates numerically beyond Number.MAX_SAFE_INTEGER', () => {
    expect(compareCombatResultCoordinates(
      { roundSequence: '9007199254740993', ordinal: 10 },
      { roundSequence: '9007199254740992', ordinal: 30 },
    )).toBeGreaterThan(0)
    expect(compareCombatResultCoordinates(
      { roundSequence: '9007199254740993', ordinal: 20 },
      { roundSequence: '9007199254740993', ordinal: 30 },
    )).toBeLessThan(0)
  })

  it('ignores a runtime event with a malformed coordinate', () => {
    const malformed = { ...victory('1'), roundSequence: '01' } as BossVictoryCombatEvent
    const consumed = createCombatResultConsumerState(
      batch('2', 2, [malformed, victory('2')]),
      1,
    )

    expect(consumed.queue.map(({ id }) => id)).toEqual(['victory-2'])
  })
})

describe('combat result consumer', () => {
  it('consumes the first nonempty update in the same stream generation once', () => {
    const initial = createCombatResultConsumerState(EMPTY_BATCH, 7)
    const incoming = batch('3', 3, [critical('1'), victory('2'), defeat('3')])
    const consumed = consumeCombatResultBatch(initial, incoming, 7)

    expect(consumed.queue.map(({ id }) => id)).toEqual(['victory-2', 'defeat-3'])
    expect(consumed.overflowCount).toBe(0)
    expect(consumed.lastConsumedCoordinate).toEqual({
      roundSequence: '3',
      ordinal: 30,
    })
    expect(consumed.announcement).toBe(
      '새 전투 결과 2건: 보스 승리 1건, 패배 1건. 마지막 라운드 3.',
    )
    expect(consumeCombatResultBatch(consumed, incoming, 7)).toBe(consumed)
  })

  it('retains the latest three results and counts only actual result evictions', () => {
    const events = [
      victory('1'),
      defeat('2'),
      victory('3'),
      defeat('4'),
      victory('5'),
    ]
    const consumed = createCombatResultConsumerState(batch('5', 5, events), 1)

    expect(consumed.queue.map(({ id }) => id)).toEqual([
      'victory-3',
      'defeat-4',
      'victory-5',
    ])
    expect(consumed.overflowCount).toBe(2)

    const pinned = pinCombatResult(consumed, 'victory-3')
    const advanced = consumeCombatResultBatch(
      pinned,
      batch('6', 6, [victory('1'), defeat('6')]),
      1,
    )
    expect(advanced.queue.map(({ id }) => id)).toEqual([
      'defeat-4',
      'victory-5',
      'defeat-6',
    ])
    expect(advanced.overflowCount).toBe(3)
    expect(advanced.pinnedResult?.id).toBe('victory-3')
    expect(closePinnedCombatResult(advanced).pinnedResult).toBeNull()
  })

  it('does not derive result overflow from total combat event count', () => {
    const nonResults = Array.from({ length: 10 }, (_, index) => critical(String(index + 1)))
    const consumed = createCombatResultConsumerState(
      batch('11', 11, [...nonResults, victory('11')]),
      1,
    )

    expect(consumed.queue.map(({ id }) => id)).toEqual(['victory-11'])
    expect(consumed.overflowCount).toBe(0)
  })

  it('sorts an unsorted retained batch with BigInt coordinates before bounding it', () => {
    const consumed = createCombatResultConsumerState(
      batch('9007199254740995', 4, [
        defeat('9007199254740995'),
        victory('9007199254740992'),
        defeat('9007199254740994'),
        victory('9007199254740993'),
      ]),
      1,
    )

    expect(consumed.queue.map(({ id }) => id)).toEqual([
      'victory-9007199254740993',
      'defeat-9007199254740994',
      'defeat-9007199254740995',
    ])
    expect(consumed.overflowCount).toBe(1)
  })

  it('ignores a regressed batch in one generation and resets all memory in the next', () => {
    const current = createCombatResultConsumerState(
      batch('4', 4, [victory('1'), defeat('2'), victory('3'), defeat('4')]),
      20,
    )
    const pinned = pinCombatResult(current, 'defeat-2')
    const stale = batch('1', 1, [victory('1')])

    expect(consumeCombatResultBatch(pinned, stale, 20)).toBe(pinned)

    const reset = consumeCombatResultBatch(pinned, stale, 21)
    expect(reset.streamGeneration).toBe(21)
    expect(reset.queue.map(({ id }) => id)).toEqual(['victory-1'])
    expect(reset.overflowCount).toBe(0)
    expect(reset.pinnedResult).toBeNull()
    expect(reset.lastConsumedCoordinate).toEqual({
      roundSequence: '1',
      ordinal: 30,
    })
  })
})
