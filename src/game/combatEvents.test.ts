import { describe, expect, it } from 'vitest'
import {
  COMPANION_ATTACK_INTERVAL_MS,
  CRITICAL_CHANCE,
  getEnemyDefinition,
} from './content'
import {
  MAX_COMBAT_EVENTS,
  advanceGame,
  createInitialState,
  mergeCombatEventBatches,
} from './engine'
import { getCompanionDamage, getHeroStats } from './formulas'
import { nextRandom } from './rng'
import type {
  AdvanceReport,
  CombatEvent,
  CombatEventBatch,
  CompanionAssistCombatEvent,
  GameState,
} from './types'

const REPORT_FIELDS = [
  'elapsedMs',
  'rounds',
  'criticalHits',
  'companionAttacks',
  'companionDamage',
  'kills',
  'defeats',
  'goldEarned',
  'xpEarned',
  'levelsGained',
  'stagesGained',
] as const satisfies readonly (keyof AdvanceReport)[]

function addReports(reports: readonly AdvanceReport[]): AdvanceReport {
  return Object.fromEntries(
    REPORT_FIELDS.map((field) => [
      field,
      reports.reduce((total, report) => total + report[field], 0),
    ]),
  ) as unknown as AdvanceReport
}

function toBatch(
  nextCursor: string,
  totalEvents: number,
  events: readonly CombatEvent[],
): CombatEventBatch {
  return { nextCursor, totalEvents, events }
}

describe('combat event stream', () => {
  it('emits applied skill, critical, and regular kill values in fixed order', () => {
    const initial = createInitialState(0, 1)
    const state: GameState = {
      ...initial,
      battle: { ...initial.battle, enemyHp: 1 },
    }

    const result = advanceGame(state, 1_000, '41')

    expect(result.nextCursor).toBe('42')
    expect(result.totalEvents).toBe(3)
    expect(result.events.map(({ type }) => type)).toEqual(['skill', 'critical', 'kill'])
    expect(result.events.map(({ ordinal }) => ordinal)).toEqual([10, 20, 30])
    expect(result.events.every(({ roundSequence }) => roundSequence === '42')).toBe(true)
    expect(result.events.every(({ rngState }) => rngState === result.state.rng.state)).toBe(true)

    const [skill, critical, kill] = result.events
    expect(skill).toMatchObject({
      type: 'skill',
      skillId: 'powerStrike',
      damage: 1,
      stage: 1,
      snapshot: { stage: 1, enemyHp: 0, gold: 0 },
    })
    expect(critical).toMatchObject({
      type: 'critical',
      damage: 1,
      stage: 1,
      snapshot: { stage: 1, enemyHp: 0, gold: 0 },
    })
    expect(kill).toMatchObject({
      type: 'kill',
      defeatedStage: 1,
      nextStage: 2,
      gold: getEnemyDefinition(1).goldReward,
      xp: getEnemyDefinition(1).xpReward,
      snapshot: {
        stage: 2,
        highestStage: 2,
        gold: getEnemyDefinition(1).goldReward,
      },
    })
    expect(new Set(result.events.map(({ id }) => id)).size).toBe(3)
  })

  it('emits bossVictory instead of kill and preserves its immediate reward snapshot', () => {
    const initial = createInitialState(0, 0x1234_5678)
    const state: GameState = {
      ...initial,
      player: {
        ...initial.player,
        gold: 123,
        upgrades: { ...initial.player.upgrades, weapon: 100 },
        skills: { ...initial.player.skills, powerStrike: 0 },
      },
      battle: {
        ...initial.battle,
        stage: 10,
        highestStage: 10,
        enemyHp: 1,
      },
    }

    const result = advanceGame(state, 2_000, '9')
    const victory = result.events.find(({ type }) => type === 'bossVictory')

    expect(victory).toMatchObject({
      type: 'bossVictory',
      defeatedStage: 10,
      nextStage: 11,
      gold: getEnemyDefinition(10).goldReward,
      xp: getEnemyDefinition(10).xpReward,
      milestoneReward: {
        tableId: 'boss-milestone-v1',
        kind: 'gold',
        milestoneStage: 10,
        configuredGold: 15,
        appliedGold: 15,
      },
      snapshot: {
        stage: 11,
        highestStage: 11,
        gold: 123 + getEnemyDefinition(10).goldReward + 15,
      },
    })
    expect(result.events.some((event) => event.type === 'kill' && event.stage === 10)).toBe(false)
    expect(result.state.battle.stage).toBe(12)
    expect(result.state.player.gold).toBeGreaterThan(victory?.snapshot.gold ?? 0)
  })

  it('emits applied defeat damage and the immediate return-stage snapshot', () => {
    const initial = createInitialState(0, 0x5566_7788)
    const state: GameState = {
      ...initial,
      player: {
        ...initial.player,
        currentHp: 1,
        skills: { ...initial.player.skills, powerStrike: 0 },
      },
      battle: {
        ...initial.battle,
        stage: 5,
        highestStage: 9,
        enemyHp: getEnemyDefinition(5).maxHp,
      },
    }

    const result = advanceGame(state, 2_000, '100')
    const defeat = result.events.find(({ type }) => type === 'defeat')

    expect(defeat).toMatchObject({
      type: 'defeat',
      damage: 1,
      defeatedAtStage: 5,
      returnStage: 4,
      highestStage: 9,
      snapshot: {
        stage: 4,
        highestStage: 9,
        enemyHp: getEnemyDefinition(4).maxHp,
      },
    })
    expect(defeat?.snapshot.playerHp).toBeGreaterThan(result.state.player.currentHp)
  })

  it('emits one applied companion assist without changing RNG, rewards, or combat state', () => {
    const initial = createInitialState(0, 0x1234_5678)
    const state: GameState = {
      ...initial,
      player: {
        ...initial.player,
        skills: { ...initial.player.skills, powerStrike: 0 },
        companion: { id: 'emberFox', rank: 5 },
      },
      battle: {
        ...initial.battle,
        enemyHp: getEnemyDefinition(1).maxHp,
        companionCooldownMs: 0,
      },
    }
    const stateBefore = structuredClone(state)
    const enemy = getEnemyDefinition(1)
    const hero = getHeroStats(state)
    const companionDamage = getCompanionDamage(state)
    const draw = nextRandom(state.rng)
    expect(draw.value).toBeGreaterThanOrEqual(CRITICAL_CHANCE)

    const result = advanceGame(state, 1_000, '8')
    const assists = result.events.filter(
      (event): event is CompanionAssistCombatEvent => event.type === 'companionAssist',
    )
    const expectedEnemyHp = state.battle.enemyHp - hero.attack - companionDamage
    const expectedEnemyDamage = Math.max(1, enemy.attack - hero.defense)
    const expectedState: GameState = {
      ...state,
      camp: {
        ...state.camp,
        merchant: {
          ...state.camp.merchant,
          refreshRemainingMs: state.camp.merchant.refreshRemainingMs - 1_000,
        },
      },
      rng: draw.rng,
      player: {
        ...state.player,
        currentHp: state.player.currentHp - expectedEnemyDamage,
      },
      battle: {
        ...state.battle,
        enemyHp: expectedEnemyHp,
        companionCooldownMs: COMPANION_ATTACK_INTERVAL_MS,
      },
    }

    expect(assists).toHaveLength(1)
    expect(assists[0]).toMatchObject({
      type: 'companionAssist',
      roundSequence: '9',
      ordinal: 25,
      rngState: draw.rng.state,
      stage: 1,
      companionId: 'emberFox',
      damage: companionDamage,
      snapshot: {
        stage: 1,
        enemyHp: expectedEnemyHp,
        playerHp: state.player.currentHp,
        gold: state.player.gold,
        xp: state.player.xp,
      },
    })
    expect(result.report).toMatchObject({
      companionAttacks: 1,
      companionDamage,
      kills: 0,
      goldEarned: 0,
      xpEarned: 0,
    })
    expect(result.state).toEqual(expectedState)
    expect(result.state.rng.draws).toBe(state.rng.draws + 1)
    expect(state).toEqual(stateBefore)
  })

  it('uses the common outcome branch once when a companion lands the finishing blow', () => {
    const initial = createInitialState(0, 0x1234_5678)
    const state: GameState = {
      ...initial,
      player: {
        ...initial.player,
        skills: { ...initial.player.skills, powerStrike: 0 },
        companion: { id: 'emberFox', rank: 5 },
      },
      battle: {
        ...initial.battle,
        enemyHp: 1,
        companionCooldownMs: 0,
      },
    }
    const heroDamage = getHeroStats(state).attack
    const companionDamage = getCompanionDamage(state)
    state.battle.enemyHp = heroDamage + companionDamage

    const result = advanceGame(state, 1_000, '5')
    const assists = result.events.filter(
      (event): event is CompanionAssistCombatEvent => event.type === 'companionAssist',
    )
    const outcomes = result.events.filter(
      ({ type }) => type === 'kill' || type === 'bossVictory',
    )

    expect(result.report).toMatchObject({ companionAttacks: 1, kills: 1 })
    expect(result.state.rng.draws).toBe(state.rng.draws + 1)
    expect(assists).toHaveLength(1)
    expect(assists[0]).toMatchObject({
      type: 'companionAssist',
      ordinal: 25,
      companionId: 'emberFox',
      damage: companionDamage,
      snapshot: { stage: 1, enemyHp: 0, gold: 0 },
    })
    expect(outcomes).toHaveLength(1)
    expect(outcomes[0]).toMatchObject({
      type: 'kill',
      ordinal: 30,
      defeatedStage: 1,
      nextStage: 2,
    })
    expect(result.events.indexOf(assists[0]!)).toBeLessThan(result.events.indexOf(outcomes[0]!))
    expect(result.state.player.gold).toBe(getEnemyDefinition(1).goldReward)
    expect(result.report.goldEarned).toBe(getEnemyDefinition(1).goldReward)
  })

  it('does not emit or consume a companion assist when the hero finishes first', () => {
    const initial = createInitialState(0, 1)
    const state: GameState = {
      ...initial,
      player: {
        ...initial.player,
        skills: { ...initial.player.skills, powerStrike: 0 },
        companion: { id: 'emberFox', rank: 5 },
      },
      battle: {
        ...initial.battle,
        enemyHp: 1,
        companionCooldownMs: 0,
      },
    }

    const result = advanceGame(state, 1_000, '12')

    expect(result.events.some(({ type }) => type === 'companionAssist')).toBe(false)
    expect(result.report).toMatchObject({ companionAttacks: 0, companionDamage: 0, kills: 1 })
    expect(result.state.battle.companionCooldownMs).toBe(0)
    expect(result.state.rng.draws).toBe(state.rng.draws + 1)
  })

  it('keeps a stage-one defeat at stage one and aligns event counts with the report', () => {
    const initial = createInitialState(0, 0x5566_7788)
    const state: GameState = {
      ...initial,
      player: {
        ...initial.player,
        currentHp: 1,
        skills: { ...initial.player.skills, powerStrike: 0 },
      },
      battle: {
        ...initial.battle,
        enemyHp: getEnemyDefinition(1).maxHp,
      },
    }

    const result = advanceGame(state, 1_000, '0')
    const defeatEvents = result.events.filter(({ type }) => type === 'defeat')

    expect(defeatEvents).toHaveLength(result.report.defeats)
    expect(defeatEvents[0]).toMatchObject({
      defeatedAtStage: 1,
      returnStage: 1,
      highestStage: 1,
    })
  })

  it('matches bounded event type counts and rewards to the aggregate report', () => {
    const initial = createInitialState(0, 0xdead_beef)
    initial.player.companion = { id: 'emberFox', rank: 3 }
    const result = advanceGame(initial, 20_000, '10')
    const criticals = result.events.filter(({ type }) => type === 'critical')
    const assists = result.events.filter(
      (event): event is CompanionAssistCombatEvent => event.type === 'companionAssist',
    )
    const outcomes = result.events.filter(
      ({ type }) => type === 'kill' || type === 'bossVictory',
    )
    const defeats = result.events.filter(({ type }) => type === 'defeat')
    const rewardTotals = outcomes.reduce(
      (total, event) => ({
        gold: total.gold + ('gold' in event ? event.gold : 0) +
          (event.type === 'bossVictory' ? event.milestoneReward?.appliedGold ?? 0 : 0),
        xp: total.xp + ('xp' in event ? event.xp : 0),
      }),
      { gold: 0, xp: 0 },
    )

    expect(result.totalEvents).toBe(result.events.length)
    expect(criticals).toHaveLength(result.report.criticalHits)
    expect(assists).toHaveLength(result.report.companionAttacks)
    expect(assists.reduce((total, event) => total + event.damage, 0))
      .toBe(result.report.companionDamage)
    expect(outcomes).toHaveLength(result.report.kills)
    expect(defeats).toHaveLength(result.report.defeats)
    expect(rewardTotals).toEqual({
      gold: result.report.goldEarned,
      xp: result.report.xpEarned,
    })
  })

  it('keeps state, reports, IDs, ordering, and overflow equal across split execution', () => {
    const initial = createInitialState(0, 0xdead_beef)
    initial.player.companion = { id: 'emberFox', rank: 3 }
    initial.rng.draws = Number.MAX_SAFE_INTEGER - 1
    const startCursor = (BigInt(Number.MAX_SAFE_INTEGER) - 1n).toString()
    const once = advanceGame(initial, 300_000, startCursor)

    let state = initial
    let cursor = startCursor
    let merged: CombatEventBatch | null = null
    const reports: AdvanceReport[] = []
    for (let elapsed = 0; elapsed < 300_000; elapsed += 10_000) {
      const next = advanceGame(state, 10_000, cursor)
      state = next.state
      cursor = next.nextCursor
      reports.push(next.report)
      merged = merged === null ? next : mergeCombatEventBatches(merged, next)
    }

    expect(state).toEqual(once.state)
    expect(addReports(reports)).toEqual(once.report)
    expect(merged).toEqual({
      nextCursor: once.nextCursor,
      totalEvents: once.totalEvents,
      events: once.events,
    })
    expect(BigInt(once.nextCursor)).toBeGreaterThan(BigInt(Number.MAX_SAFE_INTEGER))
    expect(once.state.rng.draws).toBe(Number.MAX_SAFE_INTEGER)
    expect(once.totalEvents).toBeGreaterThan(MAX_COMBAT_EVENTS)
    expect(once.events).toHaveLength(MAX_COMBAT_EVENTS)
    expect(once.totalEvents - once.events.length).toBeGreaterThan(0)
    expect(new Set(once.events.map(({ id }) => id)).size).toBe(once.events.length)
  })

  it('keeps a first boss reward snapshot deterministic across a split boundary', () => {
    const initial = createInitialState(0, 0x1234_5678)
    const ready: GameState = {
      ...initial,
      player: {
        ...initial.player,
        upgrades: { ...initial.player.upgrades, weapon: 100 },
        skills: { ...initial.player.skills, powerStrike: 0 },
      },
      battle: {
        ...initial.battle,
        stage: 10,
        highestStage: 10,
        enemyHp: 1,
      },
    }

    const once = advanceGame(ready, 2_000, '700')
    const first = advanceGame(ready, 1_000, '700')
    const second = advanceGame(first.state, 1_000, first.nextCursor)
    const merged = mergeCombatEventBatches(first, second)

    expect(second.state).toEqual(once.state)
    expect(addReports([first.report, second.report])).toEqual(once.report)
    expect(merged).toEqual({
      nextCursor: once.nextCursor,
      totalEvents: once.totalEvents,
      events: once.events,
    })
    const victory = once.events.find((event) => event.type === 'bossVictory')
    expect(victory?.milestoneReward).toEqual({
      tableId: 'boss-milestone-v1',
      kind: 'gold',
      milestoneStage: 10,
      configuredGold: 15,
      appliedGold: 15,
    })
  })

  it('increments the cursor for every complete round, including rounds without events', () => {
    const initial = createInitialState(0, 0x1234_5678)
    const state: GameState = {
      ...initial,
      player: {
        ...initial.player,
        skills: { ...initial.player.skills, powerStrike: 0 },
      },
      battle: {
        ...initial.battle,
        enemyHp: getEnemyDefinition(1).maxHp,
      },
    }

    const partial = advanceGame(state, 999, '7')
    const complete = advanceGame(state, 1_000, '7')

    expect(partial).toMatchObject({ nextCursor: '7', totalEvents: 0, events: [] })
    expect(complete).toMatchObject({ nextCursor: '8', totalEvents: 0, events: [] })
  })

  it.each(['', '00', '01', '-1', '1.0', '1e2', ' 1']) (
    'rejects non-canonical cursor %j',
    (cursor) => {
      expect(() => advanceGame(createInitialState(0), 0, cursor)).toThrow(RangeError)
    },
  )

  it('sorts rounds numerically and rejects coordinate or duplicate-payload collisions', () => {
    const state = {
      ...createInitialState(0, 1),
      battle: { ...createInitialState(0, 1).battle, enemyHp: 1 },
    }
    const roundNine = advanceGame(state, 1_000, '8')
    const roundTen = advanceGame(state, 1_000, '9')
    const merged = mergeCombatEventBatches(roundTen, roundNine)

    expect(merged.events.map(({ roundSequence }) => roundSequence)).toEqual([
      '9',
      '9',
      '9',
      '10',
      '10',
      '10',
    ])

    const source = roundNine.events[0]
    expect(source).toBeDefined()
    if (source === undefined) return

    const coordinateCollision = { ...source, id: `${source.id}:other` }
    expect(() =>
      mergeCombatEventBatches(
        toBatch('9', 1, [source]),
        toBatch('9', 1, [coordinateCollision]),
      ),
    ).toThrow(/coordinate collision/)

    if (source.type !== 'skill') throw new Error('expected the first event to be a skill event')
    const payloadCollision = { ...source, damage: source.damage + 1 }
    expect(() =>
      mergeCombatEventBatches(
        toBatch('9', 1, [source]),
        toBatch('9', 1, [payloadCollision]),
      ),
    ).toThrow(/payload collision/)

    expect(() =>
      mergeCombatEventBatches(toBatch('01', 0, []), toBatch('0', 0, [])),
    ).toThrow(RangeError)
    expect(() =>
      mergeCombatEventBatches(toBatch('9', 0, [source]), toBatch('0', 0, [])),
    ).toThrow(/total/)
    expect(() =>
      mergeCombatEventBatches(toBatch('8', 1, [source]), toBatch('0', 0, [])),
    ).toThrow(/exceed/)
  })
})
