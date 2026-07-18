// @vitest-environment node

import { describe, expect, it } from 'vitest'
import {
  COMBAT_ROUND_MS,
  MAX_OFFLINE_MS,
  MAX_STAGE,
  SKILL_DEFINITIONS,
  UPGRADE_DEFINITIONS,
  getEnemyDefinition,
} from './content'
import { MAX_BOSS_MILESTONE_MASK } from './bossMilestones'
import { runDebugSimulation, DEBUG_SPEEDS } from './debugSimulator'
import { advanceGame, createInitialState } from './engine'
import debugSoakFixture from './fixtures/debug-soak-v1.json'
import { addSafeIntegers, getHeroStats } from './formulas'
import { isGameState } from './persistence'
import type { AdvanceReport, GameState } from './types'

const SOAK_SEED = 0x1a2b3c4d
const SOAK_DURATION_MS = 24 * 60 * 60 * 1_000

function addReport(total: AdvanceReport, next: AdvanceReport): AdvanceReport {
  return {
    elapsedMs: addSafeIntegers(total.elapsedMs, next.elapsedMs),
    rounds: addSafeIntegers(total.rounds, next.rounds),
    criticalHits: addSafeIntegers(total.criticalHits, next.criticalHits),
    companionAttacks: addSafeIntegers(total.companionAttacks, next.companionAttacks),
    companionDamage: addSafeIntegers(total.companionDamage, next.companionDamage),
    kills: addSafeIntegers(total.kills, next.kills),
    defeats: addSafeIntegers(total.defeats, next.defeats),
    goldEarned: addSafeIntegers(total.goldEarned, next.goldEarned),
    xpEarned: addSafeIntegers(total.xpEarned, next.xpEarned),
    levelsGained: addSafeIntegers(total.levelsGained, next.levelsGained),
    stagesGained: addSafeIntegers(total.stagesGained, next.stagesGained),
  }
}

function emptyReport(): AdvanceReport {
  return {
    elapsedMs: 0,
    rounds: 0,
    criticalHits: 0,
    companionAttacks: 0,
    companionDamage: 0,
    kills: 0,
    defeats: 0,
    goldEarned: 0,
    xpEarned: 0,
    levelsGained: 0,
    stagesGained: 0,
  }
}

function expectStateInvariants(state: GameState) {
  const numericValues = [
    state.schemaVersion,
    state.lastSavedAt,
    state.claimedBossMilestoneMask,
    state.rng.seed,
    state.rng.state,
    state.rng.draws,
    state.player.level,
    state.player.xp,
    state.player.gold,
    state.player.essence,
    state.player.currentHp,
    state.player.skillPoints,
    ...Object.values(state.player.upgrades),
    ...Object.values(state.player.skills),
    state.player.companion.rank,
    state.battle.stage,
    state.battle.highestStage,
    state.battle.enemyHp,
    state.battle.roundRemainderMs,
    state.battle.powerStrikeCooldownMs,
    state.battle.companionCooldownMs,
    state.battle.kills,
    state.battle.defeats,
    state.stats.goldEarned,
    state.stats.enemiesDefeated,
    state.stats.prestiges,
  ]
  expect(numericValues.every((value) => Number.isSafeInteger(value) && value >= 0)).toBe(true)
  expect(state.rng.algorithm).toBe('xorshift32-v1')
  expect(state.rng.seed).toBeGreaterThan(0)
  expect(state.rng.seed).toBeLessThanOrEqual(0xffffffff)
  expect(state.rng.state).toBeGreaterThan(0)
  expect(state.rng.state).toBeLessThanOrEqual(0xffffffff)
  expect(state.claimedBossMilestoneMask).toBeLessThanOrEqual(MAX_BOSS_MILESTONE_MASK)
  expect(state.player.level).toBeGreaterThanOrEqual(1)
  expect(state.player.level).toBeLessThanOrEqual(999)
  expect(state.player.currentHp).toBeGreaterThanOrEqual(1)
  expect(state.player.currentHp).toBeLessThanOrEqual(getHeroStats(state).maxHp)
  expect(state.battle.stage).toBeGreaterThanOrEqual(1)
  expect(state.battle.stage).toBeLessThanOrEqual(state.battle.highestStage)
  expect(state.battle.highestStage).toBeLessThanOrEqual(MAX_STAGE)
  expect(state.battle.enemyHp).toBeGreaterThanOrEqual(1)
  expect(state.battle.enemyHp).toBeLessThanOrEqual(getEnemyDefinition(state.battle.stage).maxHp)
  expect(state.battle.roundRemainderMs).toBeGreaterThanOrEqual(0)
  expect(state.battle.roundRemainderMs).toBeLessThan(COMBAT_ROUND_MS)
  expect(state.battle.powerStrikeCooldownMs).toBeGreaterThanOrEqual(0)
  expect(state.battle.powerStrikeCooldownMs).toBeLessThanOrEqual(5_000)
  expect(state.battle.companionCooldownMs).toBeGreaterThanOrEqual(0)
  expect(state.battle.companionCooldownMs).toBeLessThanOrEqual(3_000)
  if (state.player.companion.id === null) {
    expect(state.player.companion.rank).toBe(0)
  } else {
    expect(state.player.companion.id).toBe('emberFox')
    expect(state.player.companion.rank).toBeGreaterThanOrEqual(1)
    expect(state.player.companion.rank).toBeLessThanOrEqual(5)
  }
  for (const [id, level] of Object.entries(state.player.upgrades)) {
    expect(level).toBeLessThanOrEqual(UPGRADE_DEFINITIONS[id as keyof typeof UPGRADE_DEFINITIONS].maxLevel)
  }
  for (const [id, rank] of Object.entries(state.player.skills)) {
    expect(rank).toBeLessThanOrEqual(SKILL_DEFINITIONS[id as keyof typeof SKILL_DEFINITIONS].maxRank)
  }
}

function expectReportInvariants(report: AdvanceReport) {
  const values = Object.values(report)
  expect(values.every((value) => Number.isSafeInteger(value) && value >= 0)).toBe(true)
  expect(report.rounds).toBe(report.elapsedMs / COMBAT_ROUND_MS)
  expect(report.criticalHits).toBeLessThanOrEqual(report.rounds)
  expect(report.companionAttacks).toBeLessThanOrEqual(report.rounds)
  if (report.companionAttacks === 0) expect(report.companionDamage).toBe(0)
  expect(report.kills + report.defeats).toBeLessThanOrEqual(report.rounds)
}

function createUpperBoundaryState(): GameState {
  const state = createInitialState(0, SOAK_SEED)
  return {
    ...state,
    rng: { ...state.rng, draws: Number.MAX_SAFE_INTEGER },
    player: {
      level: 999,
      xp: Number.MAX_SAFE_INTEGER,
      gold: Number.MAX_SAFE_INTEGER,
      essence: Number.MAX_SAFE_INTEGER,
      currentHp: Number.MAX_SAFE_INTEGER,
      skillPoints: Number.MAX_SAFE_INTEGER,
      upgrades: {
        weapon: UPGRADE_DEFINITIONS.weapon.maxLevel,
        armor: UPGRADE_DEFINITIONS.armor.maxLevel,
        charm: UPGRADE_DEFINITIONS.charm.maxLevel,
      },
      skills: {
        powerStrike: SKILL_DEFINITIONS.powerStrike.maxRank,
        ironWill: SKILL_DEFINITIONS.ironWill.maxRank,
        fortune: SKILL_DEFINITIONS.fortune.maxRank,
      },
      companion: { id: 'emberFox', rank: 5 },
    },
    battle: {
      stage: MAX_STAGE,
      highestStage: MAX_STAGE,
      enemyHp: 1,
      roundRemainderMs: 0,
      powerStrikeCooldownMs: 5_000,
      companionCooldownMs: 3_000,
      kills: Number.MAX_SAFE_INTEGER,
      defeats: Number.MAX_SAFE_INTEGER,
    },
    stats: {
      goldEarned: Number.MAX_SAFE_INTEGER,
      enemiesDefeated: Number.MAX_SAFE_INTEGER,
      prestiges: Number.MAX_SAFE_INTEGER,
    },
  }
}

describe('debug simulator soak', () => {
  it('produces identical 8h, 16h, and 24h snapshots at 1x, 10x, and 100x', () => {
    const initial = createInitialState(0, SOAK_SEED)
    const initialCopy = structuredClone(initial)
    const results = DEBUG_SPEEDS.map((speed) =>
      runDebugSimulation(initial, {
        speed,
        durationMs: SOAK_DURATION_MS,
        snapshotIntervalMs: MAX_OFFLINE_MS,
      }),
    )

    expect(initial).toEqual(initialCopy)
    expect(results.map(({ elapsedMs }) => elapsedMs)).toEqual([
      SOAK_DURATION_MS,
      SOAK_DURATION_MS,
      SOAK_DURATION_MS,
    ])
    expect(results[1]?.snapshots).toEqual(results[0]?.snapshots)
    expect(results[2]?.snapshots).toEqual(results[0]?.snapshots)
    expect(results[1]?.state).toEqual(results[0]?.state)
    expect(results[2]?.state).toEqual(results[0]?.state)
    expect(results[1]?.report).toEqual(results[0]?.report)
    expect(results[2]?.report).toEqual(results[0]?.report)
    expect(results[0]?.snapshots.map(({ elapsedMs }) => elapsedMs)).toEqual([
      MAX_OFFLINE_MS,
      MAX_OFFLINE_MS * 2,
      MAX_OFFLINE_MS * 3,
    ])
    expect(results[0]?.snapshots.map(({ state }) =>
      state.claimedBossMilestoneMask)).toEqual([1, 3, 3])
    expect(results[0]?.snapshots.map(({ report }) => report.goldEarned)).toEqual([
      77_249,
      184_246,
      348_439,
    ])
    expect(results[0]?.report.rounds).toBe(86_400)
    expect(results[0]?.state.rng.draws).toBe(86_400)

    for (const snapshot of results[0]?.snapshots ?? []) {
      expectStateInvariants(snapshot.state)
      expectReportInvariants(snapshot.report)
      expect(snapshot.state.rng.draws).toBe(snapshot.report.rounds)
      expect(snapshot.state.battle.kills).toBe(snapshot.report.kills)
      expect(snapshot.state.battle.defeats).toBe(snapshot.report.defeats)
      expect(snapshot.state.stats.enemiesDefeated).toBe(snapshot.report.kills)
      expect(snapshot.state.stats.goldEarned).toBe(snapshot.report.goldEarned)
    }

    const snapshots = results[0]?.snapshots ?? []
    for (let index = 0; index < snapshots.length; index += 1) {
      const current = snapshots[index]!
      const previous = snapshots[index - 1]
      const previousDraws = previous?.state.rng.draws ?? initial.rng.draws
      const previousKills = previous?.report.kills ?? 0
      const previousDefeats = previous?.report.defeats ?? 0
      expect(current.state.rng.draws - previousDraws).toBe(28_800)
      expect(
        current.report.kills - previousKills + current.report.defeats - previousDefeats,
      ).toBeGreaterThan(0)
    }
  })

  it('matches three canonical 8-hour engine advances', () => {
    const initial = createInitialState(0, SOAK_SEED)
    const simulated = runDebugSimulation(initial, {
      speed: 100,
      durationMs: SOAK_DURATION_MS,
      snapshotIntervalMs: MAX_OFFLINE_MS,
    })
    let state = initial
    let report = emptyReport()
    const snapshots = []

    for (let interval = 1; interval <= 3; interval += 1) {
      const advanced = advanceGame(state, MAX_OFFLINE_MS)
      state = advanced.state
      report = addReport(report, advanced.report)
      snapshots.push({
        elapsedMs: interval * MAX_OFFLINE_MS,
        state,
        report,
      })
    }

    expect(simulated.snapshots).toEqual(snapshots)
  })

  it('keeps an active max-rank companion identical at 1x, 10x, and 100x', () => {
    const initial = createInitialState(0, SOAK_SEED)
    initial.player.companion = { id: 'emberFox', rank: 5 }
    initial.battle.companionCooldownMs = 0
    const initialCopy = structuredClone(initial)
    const results = DEBUG_SPEEDS.map((speed) =>
      runDebugSimulation(initial, {
        speed,
        durationMs: MAX_OFFLINE_MS,
        snapshotIntervalMs: MAX_OFFLINE_MS,
      }),
    )
    const canonical = results[0]!

    expect(initial).toEqual(initialCopy)
    expect(results[1]?.snapshots).toEqual(canonical.snapshots)
    expect(results[2]?.snapshots).toEqual(canonical.snapshots)
    expect(results[1]?.report).toEqual(canonical.report)
    expect(results[2]?.report).toEqual(canonical.report)
    expect(canonical.report.companionAttacks).toBeGreaterThan(0)
    expect(canonical.report.companionDamage).toBeGreaterThan(0)
    expect(canonical.state.rng.draws).toBe(canonical.report.rounds)
    expectStateInvariants(canonical.state)
    expectReportInvariants(canonical.report)
  })

  it('keeps a valid upper-bound save serializable throughout an 8-hour soak', () => {
    const initial = createUpperBoundaryState()
    const initialCopy = structuredClone(initial)
    expect(isGameState(initial)).toBe(true)

    const results = DEBUG_SPEEDS.map((speed) =>
      runDebugSimulation(initial, {
        speed,
        durationMs: MAX_OFFLINE_MS,
        snapshotIntervalMs: MAX_OFFLINE_MS,
      }),
    )
    const result = results[0]!

    expect(initial).toEqual(initialCopy)
    expect(results[1]?.snapshots).toEqual(result.snapshots)
    expect(results[2]?.snapshots).toEqual(result.snapshots)
    expect(results[1]?.report).toEqual(result.report)
    expect(results[2]?.report).toEqual(result.report)
    expect(result.snapshots).toHaveLength(1)
    expectStateInvariants(result.state)
    expectReportInvariants(result.report)
    expect(isGameState(result.state)).toBe(true)
    expect(result.state.player.gold).toBe(Number.MAX_SAFE_INTEGER)
    expect(result.state.player.xp).toBe(Number.MAX_SAFE_INTEGER)
    expect(result.state.battle.kills).toBe(Number.MAX_SAFE_INTEGER)
    expect(result.state.stats.enemiesDefeated).toBe(Number.MAX_SAFE_INTEGER)
    expect(result.report.goldEarned).toBe(Number.MAX_SAFE_INTEGER)
    expect(result.report.xpEarned).toBe(Number.MAX_SAFE_INTEGER)
  })

  it('rejects unsafe debug timing options', () => {
    const initial = createInitialState(0, SOAK_SEED)
    expect(() =>
      runDebugSimulation(initial, { speed: 1, durationMs: Number.NaN }),
    ).toThrow(RangeError)
    expect(() =>
      runDebugSimulation(initial, {
        speed: 1,
        durationMs: 1_000,
        snapshotIntervalMs: MAX_OFFLINE_MS + 1,
      }),
    ).toThrow(RangeError)
  })

  it('matches the checked-in 24-hour snapshot fixture', () => {
    const result = runDebugSimulation(createInitialState(0, SOAK_SEED), {
      speed: 100,
      durationMs: SOAK_DURATION_MS,
      snapshotIntervalMs: MAX_OFFLINE_MS,
    })
    const fixture = {
      contractVersion: 1,
      seed: SOAK_SEED,
      durationMs: SOAK_DURATION_MS,
      snapshotIntervalMs: MAX_OFFLINE_MS,
      snapshots: result.snapshots,
    }
    expect(fixture).toEqual(debugSoakFixture)
  })
})
