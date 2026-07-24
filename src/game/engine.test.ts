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
  advanceOfflineGame,
  applyCaptureProgress,
  CAPTURE_LOYALTY_BASE_GAIN,
  CAPTURE_LOYALTY_HP_BONUS_MAX,
  createInitialState,
  equipItem,
  equipSkillSlot,
  FOCUS_TONIC_CRITICAL_CHANCE,
  moveItem,
  performPrestige,
  purchaseUpgrade,
  recruitCompanion,
  selectStage,
  settleLootAtCamp,
  switchGameMode,
  trainCompanion,
  unequipItem,
  unequipSkillSlot,
  upgradeSkill,
} from './engine'
import {
  MAX_BOSS_MILESTONE_MASK,
  claimBossMilestone,
} from './bossMilestones'
import { MAX_EXPEDITION_MILESTONE_MASK } from './expedition'
import {
  getCompanionDamage,
  getCompanionTrainingCost,
  getHeroStats,
  getUpgradeCost,
  getXpToNextLevel,
} from './formulas'
import { getItemDefinition, ITEM_REGISTRY } from './itemRegistry'
import {
  EQUIPMENT_LOOT_DEFINITION_VERSION,
  EQUIPMENT_LOOT_REGISTRY,
  rollEnemyEquipmentLoot,
} from './lootRegistry'
import { decodeGameState, isGameState } from './persistence'
import { createRngState, nextRandom } from './rng'
import { SAVE_VERSION, type EnemyDefinition, type GameState } from './types'

function createUpperBoundaryState(): GameState {
  const state = createInitialState(0, 0x1a2b3c4d)
  return {
    ...state,
    expeditionEvents: {
      ...state.expeditionEvents,
      runPrestige: Number.MAX_SAFE_INTEGER,
      milestoneMask: MAX_EXPEDITION_MILESTONE_MASK,
    },
    rng: { ...state.rng, draws: Number.MAX_SAFE_INTEGER },
    player: {
      ...state.player,
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

    expect(state.schemaVersion).toBe(SAVE_VERSION)
    expect(state.claimedBossMilestoneMask).toBe(0)
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

  it('preserves the boss milestone ledger through prestige and prevents a replayed reward', () => {
    const initial = createInitialState(100, 0x12345678)
    const claimedStageTen = claimBossMilestone(initial.claimedBossMilestoneMask, 10)
    const eligible: GameState = {
      ...initial,
      claimedBossMilestoneMask: claimedStageTen,
      player: {
        ...initial.player,
        upgrades: { ...initial.player.upgrades, weapon: 100 },
        skills: { ...initial.player.skills, powerStrike: 0 },
      },
      battle: {
        ...initial.battle,
        stage: 30,
        highestStage: 30,
      },
    }

    const prestiged = performPrestige(eligible)
    expect(prestiged.success).toBe(true)
    expect(prestiged.state.claimedBossMilestoneMask).toBe(claimedStageTen)

    const replayState: GameState = {
      ...prestiged.state,
      player: {
        ...prestiged.state.player,
        upgrades: { ...prestiged.state.player.upgrades, weapon: 100 },
        skills: { ...prestiged.state.player.skills, powerStrike: 0 },
      },
      battle: {
        ...prestiged.state.battle,
        stage: 10,
        highestStage: 10,
        enemyHp: 1,
      },
    }
    const replayed = advanceGame(replayState, 1_000)
    const victory = replayed.events.find((event) => event.type === 'bossVictory')

    expect(victory?.milestoneReward).toBeNull()
    expect(replayed.state.claimedBossMilestoneMask).toBe(claimedStageTen)
    expect(replayed.report.goldEarned).toBe(getEnemyDefinition(10).goldReward)
  })

  it('claims stage 10 once through both hero and companion finishing paths', () => {
    const makeBossState = (companionFinishes: boolean): GameState => {
      const initial = createInitialState(0, 0x12345678)
      const player: GameState['player'] = {
        ...initial.player,
        skills: { ...initial.player.skills, powerStrike: 0 },
        companion: companionFinishes ? { id: 'emberFox', rank: 5 } : { id: null, rank: 0 },
      }
      const provisional: GameState = {
        ...initial,
        player,
        battle: {
          ...initial.battle,
          stage: 10,
          highestStage: 10,
          enemyHp: 1,
        },
      }
      provisional.battle.enemyHp = companionFinishes
        ? getHeroStats(provisional).attack + getCompanionDamage(provisional)
        : 1
      return provisional
    }

    const hero = advanceGame(makeBossState(false), 1_000)
    const companion = advanceGame(makeBossState(true), 1_000)
    const heroVictory = hero.events.find((event) => event.type === 'bossVictory')
    const companionVictory = companion.events.find((event) => event.type === 'bossVictory')

    expect(heroVictory?.milestoneReward).toMatchObject({
      milestoneStage: 10,
      configuredGold: 15,
      appliedGold: 15,
    })
    expect(companion.events.map(({ type }) => type)).toContain('companionAssist')
    expect(companionVictory?.milestoneReward).toEqual(heroVictory?.milestoneReward)
    expect(hero.state.claimedBossMilestoneMask).toBe(1)
    expect(companion.state.claimedBossMilestoneMask).toBe(1)
    expect(hero.report.goldEarned).toBe(getEnemyDefinition(10).goldReward + 15)
    expect(companion.report.goldEarned).toBe(getEnemyDefinition(10).goldReward + 15)
    expect(hero.state.inventory.lootBag).toEqual({ 'armor.guard-armor': 1 })
    expect(companion.state.inventory.lootBag).toEqual({ 'armor.guard-armor': 1 })
  })

  it('claims stage 300 once while remaining on the capped stage', () => {
    const initial = createInitialState(0, 0x12345678)
    const beforeTopBit = 2 ** 29 - 1
    const ready: GameState = {
      ...initial,
      claimedBossMilestoneMask: beforeTopBit,
      player: {
        ...initial.player,
        upgrades: { ...initial.player.upgrades, weapon: 100 },
        skills: { ...initial.player.skills, powerStrike: 0 },
      },
      battle: {
        ...initial.battle,
        stage: MAX_STAGE,
        highestStage: MAX_STAGE,
        enemyHp: 1,
      },
    }

    const first = advanceGame(ready, 1_000)
    const firstVictory = first.events.find((event) => event.type === 'bossVictory')
    expect(firstVictory?.milestoneReward).toMatchObject({
      milestoneStage: 300,
      configuredGold: 450,
      appliedGold: 450,
    })
    expect(first.state.battle.stage).toBe(MAX_STAGE)
    expect(first.state.claimedBossMilestoneMask).toBe(MAX_BOSS_MILESTONE_MASK)

    const repeatInput: GameState = {
      ...first.state,
      battle: { ...first.state.battle, enemyHp: 1 },
    }
    const repeated = advanceGame(repeatInput, 1_000, first.nextCursor)
    const repeatedVictory = repeated.events.find((event) => event.type === 'bossVictory')
    expect(repeatedVictory?.milestoneReward).toBeNull()
    expect(repeated.state.claimedBossMilestoneMask).toBe(MAX_BOSS_MILESTONE_MASK)
    expect(repeated.report.goldEarned).toBe(getEnemyDefinition(MAX_STAGE).goldReward)
  })

  it('claims partial and zero-applied milestone rewards at the safe integer boundary', () => {
    const baseGold = getEnemyDefinition(10).goldReward
    const makeReady = (gold: number): GameState => {
      const initial = createInitialState(0, 0x12345678)
      return {
        ...initial,
        player: {
          ...initial.player,
          gold,
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
    }

    const partial = advanceGame(
      makeReady(Number.MAX_SAFE_INTEGER - baseGold - 5),
      1_000,
    )
    const partialVictory = partial.events.find((event) => event.type === 'bossVictory')
    expect(partialVictory?.milestoneReward).toMatchObject({
      configuredGold: 15,
      appliedGold: 5,
    })
    expect(partial.state.player.gold).toBe(Number.MAX_SAFE_INTEGER)
    expect(partial.state.claimedBossMilestoneMask).toBe(1)
    expect(partial.report.goldEarned).toBe(baseGold + 5)

    const zero = advanceGame(makeReady(Number.MAX_SAFE_INTEGER), 1_000)
    const zeroVictory = zero.events.find((event) => event.type === 'bossVictory')
    expect(zeroVictory?.milestoneReward).toMatchObject({
      configuredGold: 15,
      appliedGold: 0,
    })
    expect(zero.state.player.gold).toBe(Number.MAX_SAFE_INTEGER)
    expect(zero.state.claimedBossMilestoneMask).toBe(1)
    expect(zero.report.goldEarned).toBe(baseGold)
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
    expect(prestiged.success).toBe(false)
    expect(prestiged.state).toBe(initial)

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
      expeditionEvents: {
        ...fragile.expeditionEvents,
        milestoneMask: MAX_EXPEDITION_MILESTONE_MASK,
      },
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

  it('incorporates equipped item stats into getHeroStats and clamps HP when equipping/unequipping', () => {
    let state = createInitialState(0)
    state.inventory.heroInventory['weapon.novice-sword'] = 1
    state.inventory.heroInventory['armor.novice-vest'] = 1

    const baseStats = getHeroStats(state)

    // Equip Novice Sword (+5 atk)
    const equipWeaponResult = equipItem(state, 'weapon', 'weapon.novice-sword')
    expect(equipWeaponResult.success).toBe(true)
    state = equipWeaponResult.state
    expect(state.player.equipped.weapon).toBe('weapon.novice-sword')
    expect(state.inventory.heroInventory['weapon.novice-sword']).toBeUndefined()
    expect(getHeroStats(state).attack).toBe(baseStats.attack + 5)

    // Equip Novice Vest (+30 hp, +2 def)
    const equipArmorResult = equipItem(state, 'armor', 'armor.novice-vest')
    expect(equipArmorResult.success).toBe(true)
    state = equipArmorResult.state
    expect(state.player.equipped.armor).toBe('armor.novice-vest')
    expect(getHeroStats(state).maxHp).toBe(baseStats.maxHp + 30)
    expect(getHeroStats(state).defense).toBe(baseStats.defense + 2)

    // Unequip Armor
    const unequipArmorResult = unequipItem(state, 'armor')
    expect(unequipArmorResult.success).toBe(true)
    state = unequipArmorResult.state
    expect(state.player.equipped.armor).toBeNull()
    expect(state.inventory.heroInventory['armor.novice-vest']).toBe(1)
    expect(getHeroStats(state).maxHp).toBe(baseStats.maxHp)
  })

  it('atomically swaps equipped items and returns the previous item to the hero inventory', () => {
    let state = createInitialState(0)
    state.inventory.heroInventory['weapon.novice-sword'] = 1
    state.inventory.heroInventory['weapon.ember-blade'] = 1

    state = equipItem(state, 'weapon', 'weapon.novice-sword').state
    const swapped = equipItem(state, 'weapon', 'weapon.ember-blade')

    expect(swapped.success).toBe(true)
    expect(swapped.state.player.equipped.weapon).toBe('weapon.ember-blade')
    expect(swapped.state.inventory.heroInventory['weapon.ember-blade']).toBeUndefined()
    expect(swapped.state.inventory.heroInventory['weapon.novice-sword']).toBe(1)
    expect(isGameState(swapped.state)).toBe(true)
  })

  it('moves items between heroInventory and campStorage in CAMP mode', () => {
    let state = createInitialState(0)
    state = switchGameMode(state, 'CAMP').state
    state.inventory.heroInventory['weapon.novice-sword'] = 2

    // Move 1 sword to campStorage
    const moveResult = moveItem(state, 'heroInventory', 'campStorage', 'weapon.novice-sword', 1)
    expect(moveResult.success).toBe(true)
    state = moveResult.state
    expect(state.inventory.heroInventory['weapon.novice-sword']).toBe(1)
    expect(state.inventory.campStorage['weapon.novice-sword']).toBe(1)

    // Attempt moving item in BATTLE mode (should fail)
    state = switchGameMode(state, 'BATTLE').state
    const invalidMove = moveItem(state, 'heroInventory', 'campStorage', 'weapon.novice-sword', 1)
    expect(invalidMove.success).toBe(false)
  })

  it('rejects unregistered and prototype item IDs without mutating inventory state', () => {
    const state = switchGameMode(createInitialState(0), 'CAMP').state
    const snapshot = structuredClone(state)

    for (const itemId of ['invalid.unknown-item', 'toString', '__proto__']) {
      const result = moveItem(state, 'heroInventory', 'campStorage', itemId, 1)
      expect(result).toMatchObject({ success: false, state })
      expect(result.state).toBe(state)
    }

    for (const [source, target] of [
      ['toString', 'campStorage'],
      ['heroInventory', '__proto__'],
    ] as const) {
      const result = moveItem(state, source as never, target as never, 'weapon.novice-sword', 1)
      expect(result).toMatchObject({ success: false, state })
      expect(result.state).toBe(state)
    }

    const invalidSlot = unequipItem(state, 'toString' as never)
    expect(invalidSlot).toMatchObject({ success: false, state })
    expect(invalidSlot.state).toBe(state)

    expect(state).toEqual(snapshot)
    expect(isGameState(state)).toBe(true)
  })

  it('partially moves only the target capacity and preserves the source remainder', () => {
    const state = switchGameMode(createInitialState(0), 'CAMP').state
    state.inventory.heroInventory['weapon.novice-sword'] = 5
    state.inventory.campStorage['weapon.novice-sword'] = Number.MAX_SAFE_INTEGER - 2

    const result = moveItem(
      state,
      'heroInventory',
      'campStorage',
      'weapon.novice-sword',
      5,
    )

    expect(result.success).toBe(true)
    expect(result.state.inventory.heroInventory['weapon.novice-sword']).toBe(3)
    expect(result.state.inventory.campStorage['weapon.novice-sword'])
      .toBe(Number.MAX_SAFE_INTEGER)
    expect(isGameState(result.state)).toBe(true)
  })

  it('settles loot from lootBag into campStorage when switching to CAMP mode and during offline CAMP progress', () => {
    let state = createInitialState(0)
    state.inventory.lootBag['weapon.novice-sword'] = 1
    state.inventory.lootBag['armor.novice-vest'] = 2

    // Switch to CAMP
    const campResult = switchGameMode(state, 'CAMP')
    expect(campResult.success).toBe(true)
    state = campResult.state
    expect(state.inventory.lootBag).toEqual({})
    expect(state.inventory.campStorage['weapon.novice-sword']).toBe(1)
    expect(state.inventory.campStorage['armor.novice-vest']).toBe(2)

    // Offline progress while in CAMP mode
    state.inventory.lootBag['helmet.novice-helm'] = 1
    const offlineResult = advanceOfflineGame(state, 60_000)
    expect(offlineResult.state.inventory.lootBag).toEqual({})
    expect(offlineResult.state.inventory.campStorage['helmet.novice-helm']).toBe(1)
  })

  it('prevents HP healing exploit when equipping and unequipping HP armor', () => {
    let state = createInitialState(0)
    state.inventory.heroInventory['armor.novice-vest'] = 1
    state.player.currentHp = 5 // Damaged

    // Equip Novice Vest (+30 HP maxHp -> 130)
    state = equipItem(state, 'armor', 'armor.novice-vest').state
    expect(state.player.currentHp).toBe(5) // HP does not increase!

    // Unequip Novice Vest (maxHp -> 100)
    state = unequipItem(state, 'armor').state
    expect(state.player.currentHp).toBe(5) // HP does not increase!
  })

  it('preserves inventory, equipment, and skill slots through prestige without aliasing input', () => {
    const state = createInitialState(0)
    state.battle.highestStage = 30
    state.inventory.lootBag['helmet.novice-helm'] = 2
    state.inventory.heroInventory['weapon.novice-sword'] = 5
    state.inventory.campStorage['armor.guard-armor'] = 3
    state.player.equipped.weapon = 'weapon.novice-sword'
    state.player.skillSlots = ['powerStrike', null, null]
    const inputSnapshot = structuredClone(state)

    const prestiged = performPrestige(state)
    expect(prestiged.success).toBe(true)
    expect(state).toEqual(inputSnapshot)
    expect(prestiged.state.inventory).toEqual(inputSnapshot.inventory)
    expect(prestiged.state.player.equipped).toEqual(inputSnapshot.player.equipped)
    expect(prestiged.state.player.skillSlots).toEqual(inputSnapshot.player.skillSlots)
    expect(prestiged.state.inventory).not.toBe(state.inventory)
    expect(prestiged.state.inventory.lootBag).not.toBe(state.inventory.lootBag)
    expect(prestiged.state.inventory.heroInventory).not.toBe(state.inventory.heroInventory)
    expect(prestiged.state.inventory.campStorage).not.toBe(state.inventory.campStorage)
    expect(prestiged.state.player.equipped).not.toBe(state.player.equipped)
    expect(prestiged.state.player.skillSlots).not.toBe(state.player.skillSlots)

    prestiged.state.inventory.heroInventory['weapon.novice-sword'] = 1
    prestiged.state.player.skillSlots[0] = null
    expect(state.inventory.heroInventory['weapon.novice-sword']).toBe(5)
    expect(state.player.skillSlots[0]).toBe('powerStrike')
  })

  it('keeps item and equipment-loot registries deeply frozen with own-key lookup', () => {
    expect(EQUIPMENT_LOOT_DEFINITION_VERSION).toBe('equipment-loot-v1')
    expect(EQUIPMENT_LOOT_REGISTRY.regular.dropChanceBasisPoints).toBe(1_500)
    expect(EQUIPMENT_LOOT_REGISTRY.boss.dropChanceBasisPoints).toBe(10_000)
    expect(EQUIPMENT_LOOT_REGISTRY.regular.itemIds).toEqual([
      'weapon.novice-sword',
      'armor.novice-vest',
      'helmet.novice-helm',
      'accessory.novice-ring',
    ])
    expect(EQUIPMENT_LOOT_REGISTRY.boss.itemIds).toEqual([
      'weapon.ember-blade',
      'armor.guard-armor',
      'accessory.fortune-charm',
    ])
    expect(Object.isFrozen(EQUIPMENT_LOOT_REGISTRY)).toBe(true)
    expect(Object.isFrozen(EQUIPMENT_LOOT_REGISTRY.regular)).toBe(true)
    expect(Object.isFrozen(EQUIPMENT_LOOT_REGISTRY.regular.itemIds)).toBe(true)
    expect(Object.isFrozen(ITEM_REGISTRY)).toBe(true)
    expect(Object.isFrozen(ITEM_REGISTRY['weapon.novice-sword'])).toBe(true)
    expect(Object.isFrozen(ITEM_REGISTRY['weapon.novice-sword'].stats)).toBe(true)
    expect(Reflect.set(ITEM_REGISTRY['weapon.novice-sword'].stats!, 'atk', 999)).toBe(false)
    expect(ITEM_REGISTRY['weapon.novice-sword'].stats?.atk).toBe(5)
    expect(getItemDefinition('toString')).toBeNull()
    expect(getItemDefinition('__proto__')).toBeNull()
    expect(rollEnemyEquipmentLoot({
      gameSeed: 42,
      enemyDefeatOrdinal: 1,
      stage: 10,
      isBoss: true,
    })).toBe('armor.guard-armor')
    expect(rollEnemyEquipmentLoot({
      gameSeed: 42,
      enemyDefeatOrdinal: 1,
      stage: 1,
      isBoss: false,
    })).toBeNull()
    expect(rollEnemyEquipmentLoot({
      gameSeed: 42,
      enemyDefeatOrdinal: 7,
      stage: 1,
      isBoss: false,
    })).toBe('helmet.novice-helm')
  })

  it('uses an exact 35% focus-tonic critical threshold regardless of equipment bonus', () => {
    let missSeed = 1
    while (missSeed < 100_000) {
      const value = nextRandom(createRngState(missSeed)).value
      if (value >= FOCUS_TONIC_CRITICAL_CHANCE && value < 0.4) break
      missSeed += 1
    }
    expect(missSeed).toBeLessThan(100_000)

    const state = createInitialState(0, missSeed)
    state.battle.stage = 10
    state.battle.highestStage = 10
    state.battle.enemyHp = getEnemyDefinition(10).maxHp
    state.camp.buffs.bossFocusStage = 10
    state.player.equipped.accessory = 'accessory.fortune-charm'
    expect(getHeroStats(state).critChance).toBeCloseTo(0.2)
    expect(nextRandom(state.rng).value).toBeGreaterThanOrEqual(0.35)
    expect(nextRandom(state.rng).value).toBeLessThan(0.4)

    const result = advanceGame(state, 1_000)
    expect(result.report.criticalHits).toBe(0)
  })

  it('grants an exact deterministic boss drop once without consuming the combat RNG substream', () => {
    const state = createInitialState(0, 42)
    state.battle.stage = 10
    state.battle.highestStage = 10
    state.battle.enemyHp = 1
    state.expeditionEvents = { ...state.expeditionEvents, milestoneMask: 1 }
    const inputSnapshot = structuredClone(state)
    const expectedItemId = rollEnemyEquipmentLoot({
      gameSeed: state.rng.seed,
      enemyDefeatOrdinal: 1,
      stage: 10,
      isBoss: true,
    })
    const expectedCombatRng = nextRandom(state.rng).rng

    const result = advanceGame(state, 1_000)
    expect(expectedItemId).not.toBeNull()
    expect(result.state.inventory.lootBag).toEqual({ [expectedItemId!]: 1 })
    expect(result.state.rng).toEqual(expectedCombatRng)
    expect(state).toEqual(inputSnapshot)

    const replay = advanceGame(structuredClone(state), 1_000)
    expect(replay.state.inventory.lootBag).toEqual(result.state.inventory.lootBag)
    const reloaded = decodeGameState(JSON.parse(JSON.stringify(state)))
    expect(reloaded).not.toBeNull()
    expect(advanceGame(reloaded!, 1_000).state.inventory.lootBag)
      .toEqual(result.state.inventory.lootBag)
    expect(advanceGame(result.state, 0).state.inventory.lootBag)
      .toEqual(result.state.inventory.lootBag)

    const saturated = structuredClone(state)
    saturated.inventory.lootBag['armor.guard-armor'] = Number.MAX_SAFE_INTEGER
    const saturatedResult = advanceGame(saturated, 1_000)
    expect(saturatedResult.state.inventory.lootBag['armor.guard-armor'])
      .toBe(Number.MAX_SAFE_INTEGER)
    expect(isGameState(saturatedResult.state)).toBe(true)
  })

  it('applies the regular 15% table by encounter identity and is single/split/offline deterministic', () => {
    const gameSeed = 42
    let enemyDefeatOrdinal = 1
    let expectedItemId = rollEnemyEquipmentLoot({
      gameSeed,
      enemyDefeatOrdinal,
      stage: 1,
      isBoss: false,
    })
    while (expectedItemId === null && enemyDefeatOrdinal < 1_000) {
      enemyDefeatOrdinal += 1
      expectedItemId = rollEnemyEquipmentLoot({
        gameSeed,
        enemyDefeatOrdinal,
        stage: 1,
        isBoss: false,
      })
    }
    expect(enemyDefeatOrdinal).toBeLessThan(1_000)

    const regular = createInitialState(0, gameSeed)
    regular.stats.enemiesDefeated = enemyDefeatOrdinal - 1
    regular.battle.enemyHp = 1
    const regularResult = advanceGame(regular, 1_000)
    expect(regularResult.state.inventory.lootBag).toEqual({ [expectedItemId!]: 1 })

    const initial = createInitialState(0, 0x1234abcd)
    initial.battle.enemyHp = 1
    const single = advanceGame(initial, 30_000).state
    let split = initial
    for (let index = 0; index < 30; index += 1) {
      split = advanceGame(split, 1_000).state
    }
    const offline = advanceOfflineGame(initial, 30_000).state
    expect(split.inventory.lootBag).toEqual(single.inventory.lootBag)
    expect(offline.inventory.lootBag).toEqual(single.inventory.lootBag)
    expect(split.rng).toEqual(single.rng)
    expect(offline.rng).toEqual(single.rng)
  })

  it('preserves unsettled loot at MAX_SAFE_INTEGER without mutating the source state', () => {
    const state = createInitialState(0)
    state.inventory.lootBag['weapon.novice-sword'] = 2
    state.inventory.campStorage['weapon.novice-sword'] = Number.MAX_SAFE_INTEGER - 1
    const inputSnapshot = structuredClone(state)

    const settled = settleLootAtCamp(state)
    expect(settled.inventory.campStorage['weapon.novice-sword'])
      .toBe(Number.MAX_SAFE_INTEGER)
    expect(settled.inventory.lootBag['weapon.novice-sword']).toBe(1)
    expect(state).toEqual(inputSnapshot)
  })

  it('manages skill slot equips, unequips, and duplicate prevention for IRPG-704', () => {
    let state = createInitialState(0)
    // Unlock ironWill (level 3, rank 1)
    state.player.level = 3
    state.player.skills.ironWill = 1

    // Rejects invalid slot index or locked skill
    expect(equipSkillSlot(state, -1, 'ironWill').success).toBe(false)
    expect(equipSkillSlot(state, 3, 'ironWill').success).toBe(false)
    expect(equipSkillSlot(state, 1, 'fortune').success).toBe(false) // Locked (level < 5)

    // Equip ironWill in slot 1
    const equipResult = equipSkillSlot(state, 1, 'ironWill')
    expect(equipResult.success).toBe(true)
    state = equipResult.state
    expect(state.player.skillSlots).toEqual(['powerStrike', 'ironWill', null])

    // Move powerStrike from slot 0 to slot 2 (auto-clears slot 0)
    const moveResult = equipSkillSlot(state, 2, 'powerStrike')
    expect(moveResult.success).toBe(true)
    state = moveResult.state
    expect(state.player.skillSlots).toEqual([null, 'ironWill', 'powerStrike'])

    // Unequip slot 1
    const unequipResult = unequipSkillSlot(state, 1)
    expect(unequipResult.success).toBe(true)
    state = unequipResult.state
    expect(state.player.skillSlots).toEqual([null, null, 'powerStrike'])
  })

  it('only activates active skills when equipped in skillSlots during combat', () => {
    const state = createInitialState(0)
    state.battle.enemyHp = 10_000 // High HP enemy
    state.battle.powerStrikeCooldownMs = 0

    // With powerStrike equipped in slot 0 (initial state), powerStrike activates!
    const equippedAdv = advanceGame(state, 1_000)
    expect(equippedAdv.state.battle.powerStrikeCooldownMs).toBe(5_000)

    // Unequip powerStrike from slot 0
    const unequippedState = unequipSkillSlot(state, 0).state
    const unequippedAdv = advanceGame(unequippedState, 1_000)
    // Cooldown is not set to 5_000 because powerStrike did NOT activate!
    expect(unequippedAdv.state.battle.powerStrikeCooldownMs).toBe(0)
  })
})

describe('IRPG-801 deterministic capture progress', () => {
  const capturableFixtureEnemy: EnemyDefinition = {
    stage: 1,
    assetId: 'enemy.ash-slime',
    name: 'Fixture Captive',
    isBoss: false,
    species: 'beast',
    capturable: true,
    maxHp: 100,
    attack: 1,
    goldReward: 1,
    xpReward: 1,
  }
  const nonCapturableFixtureEnemy: EnemyDefinition = {
    ...capturableFixtureEnemy,
    capturable: false,
  }

  it('creates a living card with only the base gain at a zero HP ratio', () => {
    const state = createInitialState(0, 1)
    applyCaptureProgress(state, capturableFixtureEnemy, 0)
    expect(state.livingCards[capturableFixtureEnemy.assetId]).toEqual({
      cardId: capturableFixtureEnemy.assetId,
      hStage: 2,
      captureLoyalty: CAPTURE_LOYALTY_BASE_GAIN,
      corruptionLevel: 0,
      isCaptured: false,
    })
  })

  it('adds the full HP bonus at a full player HP ratio', () => {
    const state = createInitialState(0, 1)
    applyCaptureProgress(state, capturableFixtureEnemy, 1)
    expect(state.livingCards[capturableFixtureEnemy.assetId]?.captureLoyalty).toBe(
      CAPTURE_LOYALTY_BASE_GAIN + CAPTURE_LOYALTY_HP_BONUS_MAX,
    )
  })

  it('is a pure deterministic function of its inputs', () => {
    const stateA = createInitialState(0, 1)
    const stateB = createInitialState(0, 2)
    applyCaptureProgress(stateA, capturableFixtureEnemy, 0.5)
    applyCaptureProgress(stateB, capturableFixtureEnemy, 0.5)
    expect(stateA.livingCards).toEqual(stateB.livingCards)
  })

  it('accumulates across repeated defeats and clamps at exactly 100 with isCaptured flipping at the threshold', () => {
    const state = createInitialState(0, 1)
    for (let i = 0; i < 4; i += 1) {
      applyCaptureProgress(state, capturableFixtureEnemy, 1)
    }
    expect(state.livingCards[capturableFixtureEnemy.assetId]).toMatchObject({
      captureLoyalty: 80,
      isCaptured: false,
    })

    applyCaptureProgress(state, capturableFixtureEnemy, 1)
    expect(state.livingCards[capturableFixtureEnemy.assetId]).toMatchObject({
      captureLoyalty: 100,
      isCaptured: true,
    })
  })

  it('stops changing once a card is captured, even on a later full-HP defeat', () => {
    const state = createInitialState(0, 1)
    for (let i = 0; i < 5; i += 1) {
      applyCaptureProgress(state, capturableFixtureEnemy, 1)
    }
    const capturedCard = state.livingCards[capturableFixtureEnemy.assetId]
    applyCaptureProgress(state, capturableFixtureEnemy, 1)
    expect(state.livingCards[capturableFixtureEnemy.assetId]).toEqual(capturedCard)
  })

  it('does not create a living card for a non-capturable enemy', () => {
    const state = createInitialState(0, 1)
    applyCaptureProgress(state, nonCapturableFixtureEnemy, 1)
    expect(state.livingCards).toEqual({})
  })

  it('never consumes an RNG draw', () => {
    const state = createInitialState(0, 1)
    const rngBefore = { ...state.rng }
    applyCaptureProgress(state, capturableFixtureEnemy, 0.42)
    expect(state.rng).toEqual(rngBefore)
  })

  it('leaves livingCards empty across a full advanceGame run against the real CHAPTER I roster', () => {
    const state = createInitialState(0, 7)
    const result = advanceGame(state, 5 * 60 * 1_000)
    expect(result.report.kills).toBeGreaterThan(0)
    expect(result.state.livingCards).toEqual({})
  })
})
