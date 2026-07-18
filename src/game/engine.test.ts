import { describe, expect, it } from 'vitest'
import { MAX_OFFLINE_MS } from './content'
import {
  advanceGame,
  createInitialState,
  performPrestige,
  purchaseUpgrade,
  selectStage,
  upgradeSkill,
} from './engine'
import { getHeroStats, getUpgradeCost } from './formulas'

describe('game engine', () => {
  it('creates a valid first battle', () => {
    const state = createInitialState(1234)

    expect(state.schemaVersion).toBe(2)
    expect(state.lastSavedAt).toBe(1234)
    expect(state.rng).toMatchObject({ algorithm: 'xorshift32-v1', draws: 0 })
    expect(state.player.currentHp).toBe(getHeroStats(state).maxHp)
    expect(state.battle.stage).toBe(1)
    expect(state.battle.enemyHp).toBeGreaterThan(0)
  })

  it('advances combat and grants each kill reward once', () => {
    const initial = createInitialState(0)
    const result = advanceGame(initial, 2_000)

    expect(result.report.rounds).toBe(2)
    expect(result.report.kills).toBe(1)
    expect(result.state.battle.stage).toBe(2)
    expect(result.state.player.gold).toBe(result.report.goldEarned)
    expect(result.state.stats.enemiesDefeated).toBe(1)
    expect(initial.player.gold).toBe(0)
  })

  it('is deterministic regardless of elapsed-time chunking', () => {
    const initial = createInitialState(0, 0x12345678)
    const once = advanceGame(initial, 20_000)
    let chunked = initial
    let chunkedCriticalHits = 0
    for (let index = 0; index < 20; index += 1) {
      const result = advanceGame(chunked, 1_000)
      chunked = result.state
      chunkedCriticalHits += result.report.criticalHits
    }

    expect(chunked).toEqual(once.state)
    expect(chunkedCriticalHits).toBe(once.report.criticalHits)
  })

  it('consumes one draw per complete round and applies critical damage once after skill damage', () => {
    const initial = createInitialState(0, 1)
    const stageThree = {
      ...initial,
      battle: {
        ...initial.battle,
        stage: 3,
        highestStage: 3,
        enemyHp: 45,
      },
    }

    const partial = advanceGame(stageThree, 999)
    expect(partial.state.rng.draws).toBe(0)
    expect(partial.report.criticalHits).toBe(0)

    const result = advanceGame(partial.state, 1)
    expect(result.state.rng.draws).toBe(1)
    expect(result.report.criticalHits).toBe(1)
    expect(result.state.battle.enemyHp).toBe(1)
  })

  it('replays the same critical sequence from the same seed', () => {
    const left = advanceGame(createInitialState(0, 0xdeadbeef), 30_000)
    const right = advanceGame(createInitialState(0, 0xdeadbeef), 30_000)

    expect(right.report.criticalHits).toBe(left.report.criticalHits)
    expect(right.state).toEqual(left.state)
    expect(left.state.rng.draws).toBe(left.report.rounds)
  })

  it('clamps invalid and oversized elapsed time', () => {
    const initial = createInitialState(0)

    expect(advanceGame(initial, -1).report.elapsedMs).toBe(0)
    expect(advanceGame(initial, Number.NaN).report.elapsedMs).toBe(0)
    expect(advanceGame(initial, MAX_OFFLINE_MS * 2).report.elapsedMs).toBe(MAX_OFFLINE_MS)
  })

  it('purchases an upgrade atomically', () => {
    const initial = createInitialState(0)
    const cost = getUpgradeCost('weapon', 0)
    const funded = {
      ...initial,
      player: { ...initial.player, gold: cost },
    }

    const purchased = purchaseUpgrade(funded, 'weapon')
    expect(purchased.success).toBe(true)
    expect(purchased.state.player.gold).toBe(0)
    expect(purchased.state.player.upgrades.weapon).toBe(1)
    expect(purchased.state.rng).toEqual(funded.rng)

    const rejected = purchaseUpgrade(initial, 'weapon')
    expect(rejected.success).toBe(false)
    expect(rejected.state).toBe(initial)
    expect(rejected.state.rng).toEqual(initial.rng)
  })

  it('enforces skill unlocks and point costs', () => {
    const initial = createInitialState(0)
    const locked = upgradeSkill(initial, 'fortune')
    expect(locked.success).toBe(false)
    expect(locked.state.rng).toEqual(initial.rng)

    const eligible = {
      ...initial,
      player: { ...initial.player, level: 5, skillPoints: 1 },
    }
    const result = upgradeSkill(eligible, 'fortune')
    expect(result.success).toBe(true)
    expect(result.state.player.skills.fortune).toBe(1)
    expect(result.state.player.skillPoints).toBe(0)
    expect(result.state.rng).toEqual(eligible.rng)
  })

  it('only allows unlocked stages to be selected', () => {
    const initial = createInitialState(0)
    const locked = selectStage(initial, 2)
    expect(locked.success).toBe(false)
    expect(locked.state.rng).toEqual(initial.rng)

    const unlocked = {
      ...initial,
      battle: { ...initial.battle, highestStage: 5 },
    }
    const result = selectStage(unlocked, 4)
    expect(result.success).toBe(true)
    expect(result.state.battle.stage).toBe(4)
    expect(result.state.battle.enemyHp).toBeGreaterThan(0)
    expect(result.state.rng).toEqual(unlocked.rng)
  })

  it('resets temporary progress while retaining prestige rewards and lifetime stats', () => {
    const initial = createInitialState(100)
    const eligible = {
      ...initial,
      player: { ...initial.player, gold: 999 },
      battle: { ...initial.battle, stage: 30, highestStage: 30 },
      stats: { goldEarned: 999, enemiesDefeated: 42, prestiges: 0 },
    }

    const result = performPrestige(eligible)
    expect(result.success).toBe(true)
    expect(result.state.player.gold).toBe(0)
    expect(result.state.player.essence).toBeGreaterThan(0)
    expect(result.state.battle.stage).toBe(1)
    expect(result.state.stats.enemiesDefeated).toBe(42)
    expect(result.state.stats.prestiges).toBe(1)
    expect(result.state.rng).toEqual(eligible.rng)
  })

  it('keeps core numeric invariants during a long offline simulation', () => {
    const result = advanceGame(createInitialState(0), MAX_OFFLINE_MS)
    const values = [
      result.state.player.gold,
      result.state.player.xp,
      result.state.player.currentHp,
      result.state.battle.enemyHp,
      result.state.battle.stage,
    ]
    expect(values.every((value) => Number.isFinite(value) && value >= 0)).toBe(true)
    expect(result.report.criticalHits).toBeLessThanOrEqual(result.report.rounds)
    expect(result.state.rng.draws).toBe(result.report.rounds)
  })
})
