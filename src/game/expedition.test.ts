import { describe, expect, it } from 'vitest'
import { EXPEDITION_EVENT_DEFINITIONS_V1 } from './content'
import {
  advanceGame,
  chooseExpeditionEvent,
  createInitialState,
  performPrestige,
  selectStage,
} from './engine'
import {
  MAX_EXPEDITION_MILESTONE_MASK,
  createInitialExpeditionEventState,
  getExpeditionDefinitionForMilestone,
  isValidExpeditionEventState,
  resolveReachedExpeditionMilestones,
} from './expedition'
import { getHeroStats } from './formulas'
import { nextRandom } from './rng'
import {
  EXPEDITION_DEFINITION_IDS,
  EXPEDITION_DEFINITION_IDS_V1,
  type ExpeditionEventState,
  type GameState,
} from './types'

function createStageNineVictory(seed = 0x0000_0123): GameState {
  const state = createInitialState(0, seed)
  return {
    ...state,
    player: {
      ...state.player,
      upgrades: { ...state.player.upgrades, weapon: 100 },
      skills: { ...state.player.skills, powerStrike: 0 },
    },
    battle: {
      ...state.battle,
      stage: 9,
      highestStage: 9,
      enemyHp: 1,
    },
  }
}

function createPendingState(seed = 0x0000_0123): GameState {
  return advanceGame(createStageNineVictory(seed), 1_000).state
}

function hashDefinitionSequence(sequence: readonly string[]): string {
  let hash = 0x811c9dc5
  for (const character of JSON.stringify(sequence)) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

describe('IRPG-107 deterministic expedition events', () => {
  it('starts schema 5 with an empty current-run event ledger', () => {
    const state = createInitialState(1_234, 0x1234_5678)

    expect(state.schemaVersion).toBe(5)
    expect(state.expeditionEvents).toEqual({
      definitionVersion: 1,
      runPrestige: 0,
      milestoneMask: 0,
      pending: [],
      overflowCount: 0,
    })
  })

  it('uses a repeatable three-definition shuffle-bag for every block', () => {
    expect(EXPEDITION_DEFINITION_IDS_V1).toEqual(EXPEDITION_DEFINITION_IDS)
    expect(EXPEDITION_DEFINITION_IDS_V1).not.toBe(EXPEDITION_DEFINITION_IDS)
    expect(Object.isFrozen(EXPEDITION_DEFINITION_IDS_V1)).toBe(true)
    expect(Object.isFrozen(EXPEDITION_EVENT_DEFINITIONS_V1)).toBe(true)
    for (const definition of Object.values(EXPEDITION_EVENT_DEFINITIONS_V1)) {
      expect(definition.version).toBe(1)
      expect(Object.isFrozen(definition)).toBe(true)
      expect(Object.isFrozen(definition.choices)).toBe(true)
      expect(definition.choices.every((choice) => Object.isFrozen(choice))).toBe(true)
    }

    const seed = 0x1234_5678
    for (let blockIndex = 0; blockIndex < 10; blockIndex += 1) {
      const start = blockIndex * 3
      const first = [0, 1, 2].map((offset) =>
        getExpeditionDefinitionForMilestone(seed, 7, start + offset),
      )
      const repeated = [0, 1, 2].map((offset) =>
        getExpeditionDefinitionForMilestone(seed, 7, start + offset),
      )

      expect(new Set(first)).toEqual(new Set([
        'event.ember-shrine',
        'event.wandering-smith',
        'event.ash-camp',
      ]))
      expect(repeated).toEqual(first)
    }

    expect([
      [0x1234_5678, 7, '5e8a7989'],
      [0x0107_0005, 0, 'c9f5b1cd'],
      [0x0107_0005, 1, '755a7e0f'],
    ].map(([goldenSeed, run, expectedHash]) => ({
      expectedHash,
      actualHash: hashDefinitionSequence(
        Array.from({ length: 30 }, (_, index) =>
          getExpeditionDefinitionForMilestone(goldenSeed as number, run as number, index)),
      ),
    }))).toEqual([
      { expectedHash: '5e8a7989', actualHash: '5e8a7989' },
      { expectedHash: 'c9f5b1cd', actualHash: 'c9f5b1cd' },
      { expectedHash: '755a7e0f', actualHash: '755a7e0f' },
    ])
  })

  it('queues stage 10 exactly once without consuming a combat RNG draw', () => {
    const input = createStageNineVictory()
    const expectedCombatRng = nextRandom(input.rng).rng
    const first = advanceGame(input, 1_000)
    const pending = first.state.expeditionEvents.pending[0]

    expect(first.state.rng).toEqual(expectedCombatRng)
    expect(first.state.expeditionEvents.milestoneMask).toBe(1)
    expect(first.state.expeditionEvents.pending).toHaveLength(1)
    expect(pending).toMatchObject({
      eventId: expect.stringMatching(
        /^expedition-v1:00000123:0:0:event\.(ember-shrine|wandering-smith|ash-camp)$/,
      ),
      definitionVersion: 1,
      milestoneIndex: 0,
      milestoneStage: 10,
      maxHpAtOffer: getHeroStats(first.state).maxHp,
      resolvedChoices: [
        { choiceId: 'gold', effect: { type: 'grantGold' } },
        { choiceId: 'recovery', effect: { type: 'restoreHp' } },
      ],
    })

    const replayReady = selectStage(first.state, 9).state
    const replay = advanceGame(
      {
        ...replayReady,
        battle: { ...replayReady.battle, enemyHp: 1 },
      },
      1_000,
    )
    expect(replay.state.expeditionEvents).toEqual(first.state.expeditionEvents)
  })

  it('keeps a split stage 10 transition byte-identical to one foreground advance', () => {
    const input = createStageNineVictory(0x55aa_1070)
    const single = advanceGame(input, 1_000)
    const firstHalf = advanceGame(input, 500)
    const secondHalf = advanceGame(firstHalf.state, 500, firstHalf.nextCursor)

    expect(secondHalf.state).toEqual(single.state)
    expect(secondHalf.state.rng).toEqual(single.state.rng)
    expect(secondHalf.state.expeditionEvents).toEqual(single.state.expeditionEvents)
    expect(secondHalf.events).toEqual(single.events)
  })

  it('resolves the approved gold and offer-time recovery amounts for all definitions', () => {
    const maxHpAtOffer = 101
    const state = resolveReachedExpeditionMilestones(
      createInitialExpeditionEventState(),
      0x1020_3040,
      0,
      30,
      maxHpAtOffer,
    )

    const approvedEffects = {
      'event.ember-shrine': { goldCoefficient: 3, recoveryPercent: 5 },
      'event.wandering-smith': { goldCoefficient: 5, recoveryPercent: 5 },
      'event.ash-camp': { goldCoefficient: 2, recoveryPercent: 5 },
    } as const
    expect(Object.fromEntries(
      Object.entries(EXPEDITION_EVENT_DEFINITIONS_V1).map(([id, definition]) => [
        id,
        {
          goldCoefficient: definition.goldCoefficient,
          recoveryPercent: definition.recoveryPercent,
        },
      ]),
    )).toEqual(approvedEffects)
    expect(state.pending).toHaveLength(3)
    for (const pending of state.pending) {
      const approved = approvedEffects[pending.definitionId]
      expect(pending.resolvedChoices).toEqual([
        {
          choiceId: 'gold',
          effect: {
            type: 'grantGold',
            amount: approved.goldCoefficient * (pending.milestoneStage / 10),
          },
        },
        {
          choiceId: 'recovery',
          effect: {
            type: 'restoreHp',
            amount: Math.round(maxHpAtOffer * approved.recoveryPercent / 100),
          },
        },
      ])
    }
  })

  it('consumes a full-queue milestone as overflow and never reopens it', () => {
    const seed = 0x99aa_bbcc
    const full = resolveReachedExpeditionMilestones(
      createInitialExpeditionEventState(2),
      seed,
      0,
      40,
      100,
    )

    expect(full.milestoneMask).toBe(15)
    expect(full.pending).toHaveLength(3)
    expect(full.overflowCount).toBe(1)

    const pruned: ExpeditionEventState = { ...full, pending: full.pending.slice(1) }
    const revisited = resolveReachedExpeditionMilestones(pruned, seed, 39, 40, 100)
    expect(revisited).toBe(pruned)
    expect(revisited.pending.map(({ milestoneIndex }) => milestoneIndex)).toEqual([1, 2])
    expect(revisited.overflowCount).toBe(1)

    const nextMilestone = resolveReachedExpeditionMilestones(revisited, seed, 49, 50, 100)
    expect(nextMilestone.pending.map(({ milestoneIndex }) => milestoneIndex)).toEqual([1, 2, 4])
    expect(nextMilestone.overflowCount).toBe(1)
  })

  it('bounds all thirty milestones and overflow counters', () => {
    const state = resolveReachedExpeditionMilestones(
      createInitialExpeditionEventState(),
      1,
      0,
      300,
      Number.MAX_SAFE_INTEGER,
    )

    expect(state.milestoneMask).toBe(MAX_EXPEDITION_MILESTONE_MASK)
    expect(state.pending).toHaveLength(3)
    expect(state.overflowCount).toBe(27)
    expect(isValidExpeditionEventState(state, 1, 0, 300)).toBe(true)
    expect(isValidExpeditionEventState({
      ...state,
      milestoneMask: 1,
      pending: state.pending.slice(0, 1),
      overflowCount: 1,
    }, 1, 0, 10)).toBe(false)

    const stageForty = resolveReachedExpeditionMilestones(
      createInitialExpeditionEventState(),
      1,
      0,
      40,
      100,
    )
    expect(stageForty.pending.map(({ milestoneIndex }) => milestoneIndex)).toEqual([0, 1, 2])
    expect(stageForty.overflowCount).toBe(1)
    expect(isValidExpeditionEventState({
      ...stageForty,
      overflowCount: 0,
    }, 1, 0, 40)).toBe(false)
  })

  it('opens stage 300 once and never reopens it after replaying stage 299', () => {
    const input = createInitialState(0, 0x3000_0107)
    input.player.upgrades.weapon = 100
    input.player.skills.powerStrike = 0
    input.battle.stage = 299
    input.battle.highestStage = 299
    input.battle.enemyHp = 1
    input.expeditionEvents = {
      ...input.expeditionEvents,
      milestoneMask: 2 ** 29 - 1,
    }

    const first = advanceGame(input, 1_000)
    const stageThreeHundred = first.state.expeditionEvents.pending.find(
      ({ milestoneIndex }) => milestoneIndex === 29,
    )
    expect(first.state.expeditionEvents.milestoneMask).toBe(
      MAX_EXPEDITION_MILESTONE_MASK,
    )
    expect(stageThreeHundred).toBeDefined()
    if (stageThreeHundred === undefined) return

    const chosen = chooseExpeditionEvent(first.state, stageThreeHundred.eventId, 'gold')
    expect(chosen.success).toBe(true)
    const replayReady = selectStage(chosen.state, 299)
    expect(replayReady.success).toBe(true)
    replayReady.state.battle.enemyHp = 1
    const replay = advanceGame(replayReady.state, 1_000)

    expect(replay.state.expeditionEvents.milestoneMask).toBe(
      MAX_EXPEDITION_MILESTONE_MASK,
    )
    expect(replay.state.expeditionEvents.pending).toEqual([])
  })

  it('applies a gold choice and removes pending in one immutable transaction', () => {
    const input = createPendingState()
    const event = input.expeditionEvents.pending[0]
    if (event === undefined) throw new Error('missing fixture event')
    const goldChoice = event.resolvedChoices[0]
    if (goldChoice === undefined) throw new Error('missing fixture choice')
    const result = chooseExpeditionEvent(input, event.eventId, goldChoice.choiceId)

    expect(result.success).toBe(true)
    expect(result.state.player.gold - input.player.gold).toBe(goldChoice.effect.amount)
    expect(result.state.stats.goldEarned - input.stats.goldEarned).toBe(
      goldChoice.effect.amount,
    )
    expect(result.state.expeditionEvents.pending).toHaveLength(0)
    expect(result.state.expeditionEvents.definitionVersion).toBe(1)
    expect(result.state.expeditionEvents.milestoneMask).toBe(1)
    expect(result.state.rng).toEqual(input.rng)
    expect(input.expeditionEvents.pending).toHaveLength(1)

    const duplicate = chooseExpeditionEvent(result.state, event.eventId, goldChoice.choiceId)
    expect(duplicate.success).toBe(false)
    expect(duplicate.state).toBe(result.state)
  })

  it('only records the actually applied gold at the safe-integer boundary', () => {
    const base = createPendingState()
    const event = base.expeditionEvents.pending[0]
    if (event === undefined) throw new Error('missing fixture event')
    const input: GameState = {
      ...base,
      player: { ...base.player, gold: Number.MAX_SAFE_INTEGER - 1 },
      stats: { ...base.stats, goldEarned: 10 },
    }
    const result = chooseExpeditionEvent(input, event.eventId, 'gold')

    expect(result.state.player.gold).toBe(Number.MAX_SAFE_INTEGER)
    expect(result.state.stats.goldEarned).toBe(11)
  })

  it('caps recovery at the current maximum HP', () => {
    const base = createPendingState()
    const event = base.expeditionEvents.pending[0]
    if (event === undefined) throw new Error('missing fixture event')
    const maxHp = getHeroStats(base).maxHp
    const input: GameState = {
      ...base,
      player: { ...base.player, currentHp: maxHp - 1 },
    }
    const result = chooseExpeditionEvent(input, event.eventId, 'recovery')

    expect(result.success).toBe(true)
    expect(result.state.player.currentHp).toBe(maxHp)
    expect(result.state.player.gold).toBe(input.player.gold)
    expect(result.state.rng).toEqual(input.rng)
  })

  it('rejects unknown choices and tampered resolved effects by reference', () => {
    const input = createPendingState()
    const event = input.expeditionEvents.pending[0]
    if (event === undefined) throw new Error('missing fixture event')
    const unknown = chooseExpeditionEvent(input, event.eventId, 'unknown')
    expect(unknown.success).toBe(false)
    expect(unknown.state).toBe(input)

    const missing = chooseExpeditionEvent(input, 'missing-event', 'gold')
    expect(missing.success).toBe(false)
    expect(missing.state).toBe(input)

    for (const invalidEffect of [
      { type: 'grantGold', amount: Number.NaN },
      { type: 'grantGold', amount: -1 },
      { type: 'unsupported', amount: 1 },
    ]) {
      const tampered = structuredClone(input)
      const mutableChoice = tampered.expeditionEvents.pending[0]?.resolvedChoices[0]
      if (mutableChoice === undefined) throw new Error('missing fixture choice')
      ;(mutableChoice as { effect: unknown }).effect = invalidEffect
      const invalid = chooseExpeditionEvent(tampered, event.eventId, 'gold')
      expect(invalid.success).toBe(false)
      expect(invalid.state).toBe(tampered)
      expect(tampered.player.gold).toBe(input.player.gold)
    }
  })

  it('discards pending on prestige and rejects a saturated prestige run', () => {
    const pending = createPendingState()
    const eligible: GameState = {
      ...pending,
      battle: { ...pending.battle, stage: 30, highestStage: 30 },
    }
    const prestiged = performPrestige(eligible)

    expect(prestiged.success).toBe(true)
    expect(prestiged.state.expeditionEvents).toEqual({
      definitionVersion: 1,
      runPrestige: 1,
      milestoneMask: 0,
      pending: [],
      overflowCount: 0,
    })
    expect(prestiged.message).toContain('대기 이벤트 1개를 보상 없이 폐기했습니다.')

    const saturated: GameState = {
      ...eligible,
      stats: { ...eligible.stats, prestiges: Number.MAX_SAFE_INTEGER },
      expeditionEvents: {
        ...eligible.expeditionEvents,
        runPrestige: Number.MAX_SAFE_INTEGER,
      },
    }
    const rejected = performPrestige(saturated)
    expect(rejected.success).toBe(false)
    expect(rejected.state).toBe(saturated)
  })
})
