import { describe, expect, it } from 'vitest'
import {
  COMPANION_ATTACK_INTERVAL_MS,
  COMPANION_DEFINITIONS,
  MAX_OFFLINE_MS,
  MAX_STAGE,
  SKILL_DEFINITIONS,
  UPGRADE_DEFINITIONS,
  getEnemyDefinition,
} from './content'
import {
  advanceGame,
  createInitialState,
  performPrestige,
  purchaseUpgrade,
  recruitCompanion,
  selectStage,
  trainCompanion,
  upgradeSkill,
} from './engine'
import {
  getCompanionDamage,
  getCompanionTrainingCost,
  getHeroStats,
  getUpgradeCost,
  getXpToNextLevel,
} from './formulas'
import { isGameState } from './persistence'
import type { GameState } from './types'

function createUpperBoundaryState(): GameState {
  const state = createInitialState(0, 0x1a2b3c4d)
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
      companion: {
        id: 'emberFox',
        rank: COMPANION_DEFINITIONS.emberFox.maxRank,
      },
    },
    battle: {
      stage: MAX_STAGE,
      highestStage: MAX_STAGE,
      enemyHp: 1,
      roundRemainderMs: 0,
      powerStrikeCooldownMs: 0,
      companionCooldownMs: 0,
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

function collectNumbers(value: unknown): number[] {
  if (typeof value === 'number') return [value]
  if (typeof value !== 'object' || value === null) return []
  return Object.values(value).flatMap(collectNumbers)
}

describe('game engine', () => {
  it('creates a valid first battle', () => {
    const state = createInitialState(1234)

    expect(state.schemaVersion).toBe(3)
    expect(state.lastSavedAt).toBe(1234)
    expect(state.rng).toMatchObject({ algorithm: 'xorshift32-v1', draws: 0 })
    expect(state.player.currentHp).toBe(getHeroStats(state).maxHp)
    expect(state.battle.stage).toBe(1)
    expect(state.battle.enemyHp).toBeGreaterThan(0)
    expect(state.player.companion).toEqual({ id: null, rank: 0 })
    expect(state.battle.companionCooldownMs).toBe(0)
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

  it('recruits the first companion only after the first boss victory', () => {
    const initial = createInitialState(0)
    const locked = recruitCompanion(initial, 'emberFox')
    expect(locked.success).toBe(false)
    expect(locked.state).toBe(initial)
    expect(locked.state.rng).toEqual(initial.rng)

    const eligible = {
      ...initial,
      battle: { ...initial.battle, highestStage: 11 },
    }
    const eligibleCopy = structuredClone(eligible)
    const recruited = recruitCompanion(eligible, 'emberFox')
    expect(recruited.success).toBe(true)
    expect(recruited.state.player.companion).toEqual({ id: 'emberFox', rank: 1 })
    expect(recruited.state.battle.companionCooldownMs).toBe(0)
    expect(recruited.state.rng).toEqual(eligible.rng)
    expect(eligible).toEqual(eligibleCopy)

    const repeated = recruitCompanion(recruited.state, 'emberFox')
    expect(repeated.success).toBe(false)
    expect(repeated.state).toBe(recruited.state)
  })

  it('trains a recruited companion atomically up to the maximum rank', () => {
    const initial = createInitialState(0)
    const cost = getCompanionTrainingCost('emberFox', 1)
    const funded = {
      ...initial,
      player: {
        ...initial.player,
        gold: cost,
        companion: { id: 'emberFox' as const, rank: 1 },
      },
    }
    const fundedCopy = structuredClone(funded)
    const trained = trainCompanion(funded)
    expect(trained.success).toBe(true)
    expect(trained.state.player.gold).toBe(0)
    expect(trained.state.player.companion.rank).toBe(2)
    expect(trained.state.rng).toEqual(funded.rng)
    expect(funded).toEqual(fundedCopy)

    const insufficient = trainCompanion({
      ...funded,
      player: { ...funded.player, gold: cost - 1 },
    })
    expect(insufficient.success).toBe(false)
    expect(insufficient.state.player.companion.rank).toBe(1)

    const maximum = {
      ...funded,
      player: {
        ...funded.player,
        companion: {
          id: 'emberFox' as const,
          rank: COMPANION_DEFINITIONS.emberFox.maxRank,
        },
      },
    }
    const capped = trainCompanion(maximum)
    expect(capped.success).toBe(false)
    expect(capped.state).toBe(maximum)
  })

  it('adds deterministic companion damage without consuming another RNG draw', () => {
    const initial = createInitialState(0, 0x12345678)
    const assisted: GameState = {
      ...initial,
      player: {
        ...initial.player,
        companion: { id: 'emberFox', rank: 1 },
      },
      battle: {
        ...initial.battle,
        enemyHp: 100,
        powerStrikeCooldownMs: 5_000,
      },
    }
    const expectedDamage = getCompanionDamage(assisted)
    const result = advanceGame(assisted, 1_000)

    expect(result.report.companionAttacks).toBe(1)
    expect(result.report.companionDamage).toBe(expectedDamage)
    expect(result.state.battle.companionCooldownMs).toBe(COMPANION_ATTACK_INTERVAL_MS)
    expect(result.state.rng.draws).toBe(1)
  })

  it('resolves a companion finishing blow through the single reward branch', () => {
    const initial = createInitialState(0, 1)
    const assisted: GameState = {
      ...initial,
      player: {
        ...initial.player,
        companion: { id: 'emberFox', rank: 1 },
      },
      battle: {
        ...initial.battle,
        enemyHp: 20,
        powerStrikeCooldownMs: 5_000,
      },
    }
    const result = advanceGame(assisted, 1_000)

    expect(result.report).toMatchObject({
      rounds: 1,
      criticalHits: 1,
      companionAttacks: 1,
      companionDamage: 2,
      kills: 1,
    })
    expect(result.state.battle.stage).toBe(2)
    expect(result.state.battle.kills).toBe(1)
    expect(result.state.stats.enemiesDefeated).toBe(1)
    expect(result.state.player.gold).toBe(result.report.goldEarned)
  })

  it('does not consume a companion attack when the hero defeats the enemy first', () => {
    const initial = createInitialState(0, 0x13572468)
    const assisted: GameState = {
      ...initial,
      player: {
        ...initial.player,
        companion: { id: 'emberFox', rank: 1 },
      },
      battle: {
        ...initial.battle,
        enemyHp: 1,
        companionCooldownMs: 2_000,
      },
    }
    const inputCopy = structuredClone(assisted)
    const result = advanceGame(assisted, 1_000)

    expect(result.report.companionAttacks).toBe(0)
    expect(result.report.companionDamage).toBe(0)
    expect(result.state.battle.companionCooldownMs).toBe(1_000)
    expect(assisted).toEqual(inputCopy)
  })

  it('keeps companion combat deterministic across elapsed-time chunking', () => {
    const initial = createInitialState(0, 0x87654321)
    const assisted: GameState = {
      ...initial,
      player: {
        ...initial.player,
        companion: { id: 'emberFox', rank: 3 },
      },
    }
    const once = advanceGame(assisted, 3_000)
    let chunked = assisted
    let companionAttacks = 0
    let companionDamage = 0
    for (let index = 0; index < 3; index += 1) {
      const result = advanceGame(chunked, 1_000)
      chunked = result.state
      companionAttacks += result.report.companionAttacks
      companionDamage += result.report.companionDamage
    }

    expect(chunked).toEqual(once.state)
    expect(companionAttacks).toBe(once.report.companionAttacks)
    expect(companionDamage).toBe(once.report.companionDamage)
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

  it('preserves companion cooldown when selecting another unlocked stage', () => {
    const initial = createInitialState(0)
    const unlocked: GameState = {
      ...initial,
      player: {
        ...initial.player,
        companion: { id: 'emberFox', rank: 1 },
      },
      battle: {
        ...initial.battle,
        highestStage: 5,
        companionCooldownMs: 2_000,
      },
    }
    const result = selectStage(unlocked, 4)

    expect(result.success).toBe(true)
    expect(result.state.battle.companionCooldownMs).toBe(2_000)
  })

  it('heals a decodable non-canonical unrecruited cooldown during a round', () => {
    const initial = createInitialState(0)
    const invalid = {
      ...initial,
      battle: { ...initial.battle, companionCooldownMs: 3_000 },
    }

    expect(isGameState(invalid)).toBe(true)
    expect(advanceGame(invalid, 1_000).state.battle.companionCooldownMs).toBe(0)
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

  it('keeps a recruited companion through prestige but resets rank and cooldown', () => {
    const initial = createInitialState(100)
    const eligible: GameState = {
      ...initial,
      player: {
        ...initial.player,
        companion: { id: 'emberFox', rank: 5 },
      },
      battle: {
        ...initial.battle,
        stage: 30,
        highestStage: 30,
        companionCooldownMs: 2_000,
      },
    }

    const result = performPrestige(eligible)
    expect(result.success).toBe(true)
    expect(result.state.player.companion).toEqual({ id: 'emberFox', rank: 1 })
    expect(result.state.battle.companionCooldownMs).toBe(0)
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

  it('saturates valid upper-bound rewards, counters, reports, and prestige fields', () => {
    const initial = createUpperBoundaryState()
    expect(isGameState(initial)).toBe(true)
    expect(getCompanionDamage(initial)).toBeGreaterThan(0)
    expect(Number.isSafeInteger(getCompanionDamage(initial))).toBe(true)

    const result = advanceGame(initial, 2_000)
    expect(
      collectNumbers({ state: result.state, report: result.report }).every(
        (value) => Number.isSafeInteger(value) && value >= 0,
      ),
    ).toBe(true)
    expect(result.report).toMatchObject({
      rounds: 2,
      kills: 2,
      goldEarned: Number.MAX_SAFE_INTEGER,
    })
    expect(result.state.player.gold).toBe(Number.MAX_SAFE_INTEGER)
    expect(result.state.player.xp).toBe(Number.MAX_SAFE_INTEGER)
    expect(result.state.battle.kills).toBe(Number.MAX_SAFE_INTEGER)
    expect(result.state.stats.goldEarned).toBe(Number.MAX_SAFE_INTEGER)
    expect(result.state.stats.enemiesDefeated).toBe(Number.MAX_SAFE_INTEGER)
    expect(isGameState(result.state)).toBe(true)

    const prestiged = performPrestige(initial)
    expect(prestiged.success).toBe(true)
    expect(prestiged.state.player.essence).toBe(Number.MAX_SAFE_INTEGER)
    expect(prestiged.state.stats.prestiges).toBe(Number.MAX_SAFE_INTEGER)
    expect(isGameState(prestiged.state)).toBe(true)

    const levelReady = createInitialState(0, 0x11223344)
    levelReady.player.xp = getXpToNextLevel(levelReady.player.level) - 1
    levelReady.player.skillPoints = Number.MAX_SAFE_INTEGER
    levelReady.battle.enemyHp = 1
    const leveled = advanceGame(levelReady, 1_000)
    expect(leveled.state.player.level).toBe(2)
    expect(leveled.state.player.skillPoints).toBe(Number.MAX_SAFE_INTEGER)
    expect(isGameState(leveled.state)).toBe(true)

    const fragile = createInitialState(0, 0x55667788)
    const defeatBoundary: GameState = {
      ...fragile,
      player: { ...fragile.player, currentHp: 1 },
      battle: {
        ...fragile.battle,
        stage: MAX_STAGE,
        highestStage: MAX_STAGE,
        enemyHp: getEnemyDefinition(MAX_STAGE).maxHp,
        defeats: Number.MAX_SAFE_INTEGER,
      },
    }
    const defeated = advanceGame(defeatBoundary, 1_000)
    expect(defeated.report.defeats).toBe(1)
    expect(defeated.state.battle.defeats).toBe(Number.MAX_SAFE_INTEGER)
    expect(isGameState(defeated.state)).toBe(true)
  })
})
