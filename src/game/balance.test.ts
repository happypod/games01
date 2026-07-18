import { describe, expect, it } from 'vitest'
import {
  ENEMY_HP_GROWTH,
  FIRST_PRESTIGE_HP_GROWTH,
  getEnemyDefinition,
} from './content'
import {
  advanceGame,
  createInitialState,
  purchaseUpgrade,
  recruitCompanion,
  trainCompanion,
  upgradeSkill,
} from './engine'
import { getUpgradeCost } from './formulas'
import { UPGRADE_IDS } from './types'
import type { GameState, SkillId, UpgradeId } from './types'

type EquipmentStrategy = 'cheapest' | 'offense' | 'balanced'

interface PlaytestProfile {
  name: string
  seed: number
  decisionCadenceSeconds: number
  equipment: EquipmentStrategy
  skills: readonly SkillId[]
}

interface PlaytestResult {
  name: string
  firstUpgradeSeconds: number
  firstBossSeconds: number
  firstBossClearSeconds: number
  prestigeGateSeconds: number
  equipmentPurchases: number
  skillPurchases: number
  criticalHits: number
  defeats: number
  longestStallSeconds: number
  finalGold: number
  finalState: GameState
}

interface CompanionPlaytestResult {
  name: string
  recruitSeconds: number
  prestigeGateSeconds: number
  trainingPurchases: number
  companionAttacks: number
  companionDamage: number
  finalRank: number
  finalState: GameState
}

const PLAYTEST_PROFILES: readonly PlaytestProfile[] = [
  { name: 'C5-A', seed: 0x10203040, decisionCadenceSeconds: 5, equipment: 'cheapest', skills: ['powerStrike', 'ironWill', 'fortune'] },
  { name: 'C10-S', seed: 0x22334455, decisionCadenceSeconds: 10, equipment: 'cheapest', skills: ['ironWill', 'powerStrike', 'fortune'] },
  { name: 'C15-G', seed: 0x3456789a, decisionCadenceSeconds: 15, equipment: 'cheapest', skills: ['fortune', 'powerStrike', 'ironWill'] },
  { name: 'O5-A', seed: 0x456789ab, decisionCadenceSeconds: 5, equipment: 'offense', skills: ['powerStrike', 'fortune', 'ironWill'] },
  { name: 'O10-S', seed: 0x56789abc, decisionCadenceSeconds: 10, equipment: 'offense', skills: ['ironWill', 'powerStrike', 'fortune'] },
  { name: 'O15-G', seed: 0x6789abcd, decisionCadenceSeconds: 15, equipment: 'offense', skills: ['fortune', 'ironWill', 'powerStrike'] },
  { name: 'B5-A', seed: 0x789abcde, decisionCadenceSeconds: 5, equipment: 'balanced', skills: ['powerStrike', 'ironWill', 'fortune'] },
  { name: 'B10-S', seed: 0x89abcdef, decisionCadenceSeconds: 10, equipment: 'balanced', skills: ['ironWill', 'fortune', 'powerStrike'] },
  { name: 'B15-G', seed: 0x9abcdef0, decisionCadenceSeconds: 15, equipment: 'balanced', skills: ['fortune', 'powerStrike', 'ironWill'] },
  { name: 'C20-M', seed: 0xcafebabe, decisionCadenceSeconds: 20, equipment: 'cheapest', skills: ['powerStrike', 'fortune', 'ironWill'] },
]

const EXPECTED_PLAYTEST_SUMMARIES: readonly Omit<PlaytestResult, 'finalState'>[] = [
  { name: 'C5-A', firstUpgradeSeconds: 5, firstBossSeconds: 31, firstBossClearSeconds: 86, prestigeGateSeconds: 1929, equipmentPurchases: 36, skillPurchases: 12, criticalHits: 291, defeats: 50, longestStallSeconds: 670, finalGold: 1602 },
  { name: 'C10-S', firstUpgradeSeconds: 10, firstBossSeconds: 31, firstBossClearSeconds: 92, prestigeGateSeconds: 2029, equipmentPurchases: 36, skillPurchases: 12, criticalHits: 280, defeats: 50, longestStallSeconds: 841, finalGold: 1291 },
  { name: 'C15-G', firstUpgradeSeconds: 15, firstBossSeconds: 36, firstBossClearSeconds: 91, prestigeGateSeconds: 1848, equipmentPurchases: 36, skillPurchases: 11, criticalHits: 271, defeats: 54, longestStallSeconds: 860, finalGold: 1641 },
  { name: 'O5-A', firstUpgradeSeconds: 10, firstBossSeconds: 31, firstBossClearSeconds: 101, prestigeGateSeconds: 1850, equipmentPurchases: 37, skillPurchases: 12, criticalHits: 278, defeats: 56, longestStallSeconds: 842, finalGold: 603 },
  { name: 'O10-S', firstUpgradeSeconds: 10, firstBossSeconds: 35, firstBossClearSeconds: 80, prestigeGateSeconds: 1968, equipmentPurchases: 36, skillPurchases: 12, criticalHits: 336, defeats: 51, longestStallSeconds: 821, finalGold: 1289 },
  { name: 'O15-G', firstUpgradeSeconds: 15, firstBossSeconds: 32, firstBossClearSeconds: 85, prestigeGateSeconds: 2132, equipmentPurchases: 38, skillPurchases: 12, criticalHits: 340, defeats: 57, longestStallSeconds: 807, finalGold: 753 },
  { name: 'B5-A', firstUpgradeSeconds: 5, firstBossSeconds: 31, firstBossClearSeconds: 130, prestigeGateSeconds: 2223, equipmentPurchases: 38, skillPurchases: 12, criticalHits: 326, defeats: 57, longestStallSeconds: 803, finalGold: 615 },
  { name: 'B10-S', firstUpgradeSeconds: 10, firstBossSeconds: 36, firstBossClearSeconds: 152, prestigeGateSeconds: 2195, equipmentPurchases: 37, skillPurchases: 12, criticalHits: 298, defeats: 52, longestStallSeconds: 844, finalGold: 568 },
  { name: 'B15-G', firstUpgradeSeconds: 15, firstBossSeconds: 36, firstBossClearSeconds: 74, prestigeGateSeconds: 1895, equipmentPurchases: 37, skillPurchases: 12, criticalHits: 251, defeats: 55, longestStallSeconds: 900, finalGold: 987 },
  { name: 'C20-M', firstUpgradeSeconds: 20, firstBossSeconds: 41, firstBossClearSeconds: 96, prestigeGateSeconds: 2001, equipmentPurchases: 37, skillPurchases: 12, criticalHits: 308, defeats: 58, longestStallSeconds: 1019, finalGold: 936 },
]

function summarizePlaytest(result: PlaytestResult): Omit<PlaytestResult, 'finalState'> {
  return {
    name: result.name,
    firstUpgradeSeconds: result.firstUpgradeSeconds,
    firstBossSeconds: result.firstBossSeconds,
    firstBossClearSeconds: result.firstBossClearSeconds,
    prestigeGateSeconds: result.prestigeGateSeconds,
    equipmentPurchases: result.equipmentPurchases,
    skillPurchases: result.skillPurchases,
    criticalHits: result.criticalHits,
    defeats: result.defeats,
    longestStallSeconds: result.longestStallSeconds,
    finalGold: result.finalGold,
  }
}

function hashState(state: GameState): string {
  let hash = 0x811c9dc5
  for (const character of JSON.stringify(state)) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

function assertNumericInvariants(state: GameState, profileName: string, second: number) {
  const values = [
    state.player.level,
    state.player.gold,
    state.player.xp,
    state.player.essence,
    state.player.currentHp,
    state.player.skillPoints,
    ...Object.values(state.player.upgrades),
    ...Object.values(state.player.skills),
    state.player.companion.rank,
    state.battle.enemyHp,
    state.battle.stage,
    state.battle.highestStage,
    state.battle.roundRemainderMs,
    state.battle.powerStrikeCooldownMs,
    state.battle.companionCooldownMs,
    state.battle.kills,
    state.battle.defeats,
    state.stats.goldEarned,
    state.stats.enemiesDefeated,
    state.stats.prestiges,
    state.rng.seed,
    state.rng.state,
    state.rng.draws,
  ]
  if (values.some((value) => !Number.isSafeInteger(value) || value < 0)) {
    throw new Error(`${profileName} violated a numeric invariant at ${second}s`)
  }
}

function chooseUpgrade(state: GameState, strategy: EquipmentStrategy): UpgradeId | null {
  const affordable = UPGRADE_IDS
    .map((id) => ({ id, level: state.player.upgrades[id], cost: getUpgradeCost(id, state.player.upgrades[id]) }))
    .filter(({ cost }) => cost <= state.player.gold)
  if (affordable.length === 0) return null

  if (strategy === 'offense') {
    return (['weapon', 'charm', 'armor'] as const).find((id) =>
      affordable.some((candidate) => candidate.id === id),
    ) ?? null
  }
  if (strategy === 'balanced') {
    affordable.sort((left, right) => left.level - right.level || left.cost - right.cost)
    return affordable[0]?.id ?? null
  }
  affordable.sort((left, right) => left.cost - right.cost)
  return affordable[0]?.id ?? null
}

function spendAvailableResources(input: GameState, profile: PlaytestProfile) {
  let state = input
  let equipmentPurchases = 0
  let skillPurchases = 0

  while (true) {
    const id = chooseUpgrade(state, profile.equipment)
    if (id === null) break
    const result = purchaseUpgrade(state, id)
    if (!result.success) break
    state = result.state
    equipmentPurchases += 1
  }

  for (const id of profile.skills) {
    while (state.player.skillPoints > 0) {
      const result = upgradeSkill(state, id)
      if (!result.success) break
      state = result.state
      skillPurchases += 1
    }
  }

  return { state, equipmentPurchases, skillPurchases }
}

function runPlaytest(profile: PlaytestProfile): PlaytestResult {
  let state = createInitialState(0, profile.seed)
  let firstUpgradeSeconds = 0
  let firstBossSeconds = 0
  let firstBossClearSeconds = 0
  let equipmentPurchases = 0
  let skillPurchases = 0
  let criticalHits = 0
  let lastHighestStage = state.battle.highestStage
  let lastProgressSeconds = 0
  let longestStallSeconds = 0

  for (let second = 1; second <= 60 * 60; second += 1) {
    const advanced = advanceGame(state, 1_000)
    state = advanced.state
    criticalHits += advanced.report.criticalHits
    assertNumericInvariants(state, profile.name, second)
    if (state.battle.highestStage > lastHighestStage) {
      longestStallSeconds = Math.max(longestStallSeconds, second - lastProgressSeconds)
      lastProgressSeconds = second
      lastHighestStage = state.battle.highestStage
    }
    if (firstBossSeconds === 0 && state.battle.highestStage >= 10) firstBossSeconds = second
    if (firstBossClearSeconds === 0 && state.battle.highestStage >= 11) {
      firstBossClearSeconds = second
    }

    if (second % profile.decisionCadenceSeconds === 0) {
      const spent = spendAvailableResources(state, profile)
      state = spent.state
      assertNumericInvariants(state, profile.name, second)
      equipmentPurchases += spent.equipmentPurchases
      skillPurchases += spent.skillPurchases
      if (firstUpgradeSeconds === 0 && spent.equipmentPurchases > 0) {
        firstUpgradeSeconds = second
      }
    }

    if (state.battle.highestStage >= 30) {
      return {
        name: profile.name,
        firstUpgradeSeconds,
        firstBossSeconds,
        firstBossClearSeconds,
        prestigeGateSeconds: second,
        equipmentPurchases,
        skillPurchases,
        criticalHits,
        defeats: state.battle.defeats,
        longestStallSeconds: Math.max(longestStallSeconds, second - lastProgressSeconds),
        finalGold: state.player.gold,
        finalState: state,
      }
    }
  }

  throw new Error(`${profile.name} did not reach the prestige gate within 60 minutes`)
}

function runCompanionPlaytest(profile: PlaytestProfile): CompanionPlaytestResult {
  let state = createInitialState(0, profile.seed)
  let recruitSeconds = 0
  let trainingPurchases = 0
  let companionAttacks = 0
  let companionDamage = 0

  for (let second = 1; second <= 60 * 60; second += 1) {
    const advanced = advanceGame(state, 1_000)
    state = advanced.state
    companionAttacks += advanced.report.companionAttacks
    companionDamage += advanced.report.companionDamage
    assertNumericInvariants(state, `${profile.name}-companion`, second)

    if (state.player.companion.id === null && state.battle.highestStage >= 11) {
      const recruited = recruitCompanion(state, 'emberFox')
      if (!recruited.success) throw new Error(`${profile.name} failed to recruit emberFox`)
      state = recruited.state
      recruitSeconds = second
    }

    if (second % profile.decisionCadenceSeconds === 0) {
      while (state.player.companion.id !== null) {
        const trained = trainCompanion(state)
        if (!trained.success) break
        state = trained.state
        trainingPurchases += 1
      }
      const spent = spendAvailableResources(state, profile)
      state = spent.state
      assertNumericInvariants(state, `${profile.name}-companion`, second)
    }

    if (state.battle.highestStage >= 30) {
      return {
        name: profile.name,
        recruitSeconds,
        prestigeGateSeconds: second,
        trainingPurchases,
        companionAttacks,
        companionDamage,
        finalRank: state.player.companion.rank,
        finalState: state,
      }
    }
  }

  throw new Error(`${profile.name} companion run did not reach the prestige gate within 60 minutes`)
}

function summarizeCompanionPlaytest(
  result: CompanionPlaytestResult,
): Omit<CompanionPlaytestResult, 'finalState'> {
  return {
    name: result.name,
    recruitSeconds: result.recruitSeconds,
    prestigeGateSeconds: result.prestigeGateSeconds,
    trainingPurchases: result.trainingPurchases,
    companionAttacks: result.companionAttacks,
    companionDamage: result.companionDamage,
    finalRank: result.finalRank,
  }
}

describe('first prestige balance playtest', () => {
  it('keeps the median of ten deterministic play sessions between 30 and 45 minutes', () => {
    const results = PLAYTEST_PROFILES.map(runPlaytest)
    const sortedTimes = results.map(({ prestigeGateSeconds }) => prestigeGateSeconds).sort((a, b) => a - b)
    const medianSeconds = (sortedTimes[4]! + sortedTimes[5]!) / 2

    expect(PLAYTEST_PROFILES).toHaveLength(10)
    expect(results.map(summarizePlaytest)).toEqual(EXPECTED_PLAYTEST_SUMMARIES)
    expect(sortedTimes[0]).toBe(1848)
    expect(sortedTimes.at(-1)).toBe(2223)
    expect(medianSeconds).toBe(1984.5)
    expect(medianSeconds).toBeGreaterThanOrEqual(30 * 60)
    expect(medianSeconds).toBeLessThanOrEqual(45 * 60)
    expect(results.every(({ firstUpgradeSeconds }) => firstUpgradeSeconds > 0 && firstUpgradeSeconds <= 120)).toBe(true)
    expect(results.every(({ firstBossSeconds }) => firstBossSeconds >= 30 && firstBossSeconds <= 60)).toBe(true)
    expect(results.every(({ firstBossClearSeconds }) => firstBossClearSeconds >= 60 && firstBossClearSeconds <= 180)).toBe(true)
    expect(results.every(({ longestStallSeconds }) => longestStallSeconds < 20 * 60)).toBe(true)
    expect(results.every(({ criticalHits }) => criticalHits > 0)).toBe(true)
    expect(results.every(({ finalState }) => finalState.battle.highestStage >= 30)).toBe(true)
    expect(results.every(({ finalGold }) => Number.isSafeInteger(finalGold) && finalGold >= 0)).toBe(true)
  })

  it('replays every fixed playtest profile exactly', () => {
    const first = PLAYTEST_PROFILES.map(runPlaytest)
    expect(PLAYTEST_PROFILES.map(runPlaytest)).toEqual(first)
    expect(first.map(({ finalState }) => hashState(finalState))).toEqual([
      'ac143c4e',
      '3a70f43c',
      'f9f8c502',
      '207f6592',
      '7bd29bd1',
      '63634fcd',
      '9905f9a2',
      'bda55a85',
      '5791cf9c',
      '5e3eb888',
    ])
  })

  it('keeps recruit-and-train companion profiles deterministic and inside the prestige target', () => {
    const results = PLAYTEST_PROFILES.map(runCompanionPlaytest)
    const replay = PLAYTEST_PROFILES.map(runCompanionPlaytest)
    const sortedTimes = results
      .map(({ prestigeGateSeconds }) => prestigeGateSeconds)
      .sort((left, right) => left - right)
    const medianSeconds = (sortedTimes[4]! + sortedTimes[5]!) / 2

    expect(replay).toEqual(results)
    expect(results.map(summarizeCompanionPlaytest)).toEqual([
      { name: 'C5-A', recruitSeconds: 86, prestigeGateSeconds: 1885, trainingPurchases: 4, companionAttacks: 612, companionDamage: 17560, finalRank: 5 },
      { name: 'C10-S', recruitSeconds: 92, prestigeGateSeconds: 2004, trainingPurchases: 4, companionAttacks: 647, companionDamage: 18225, finalRank: 5 },
      { name: 'C15-G', recruitSeconds: 91, prestigeGateSeconds: 1717, trainingPurchases: 4, companionAttacks: 555, companionDamage: 15951, finalRank: 5 },
      { name: 'O5-A', recruitSeconds: 101, prestigeGateSeconds: 1746, trainingPurchases: 4, companionAttacks: 565, companionDamage: 16697, finalRank: 5 },
      { name: 'O10-S', recruitSeconds: 80, prestigeGateSeconds: 1882, trainingPurchases: 4, companionAttacks: 613, companionDamage: 17197, finalRank: 5 },
      { name: 'O15-G', recruitSeconds: 85, prestigeGateSeconds: 1753, trainingPurchases: 4, companionAttacks: 565, companionDamage: 16016, finalRank: 5 },
      { name: 'B5-A', recruitSeconds: 130, prestigeGateSeconds: 1848, trainingPurchases: 4, companionAttacks: 583, companionDamage: 16149, finalRank: 5 },
      { name: 'B10-S', recruitSeconds: 152, prestigeGateSeconds: 2107, trainingPurchases: 4, companionAttacks: 656, companionDamage: 18257, finalRank: 5 },
      { name: 'B15-G', recruitSeconds: 74, prestigeGateSeconds: 1883, trainingPurchases: 4, companionAttacks: 615, companionDamage: 17851, finalRank: 5 },
      { name: 'C20-M', recruitSeconds: 96, prestigeGateSeconds: 1804, trainingPurchases: 4, companionAttacks: 586, companionDamage: 17103, finalRank: 5 },
    ])
    expect(results.map(({ finalState }) => hashState(finalState))).toEqual([
      '8d7a06d0',
      'fe05cd91',
      'ae3c2f42',
      '0213ed00',
      '7426b47b',
      'dff599bf',
      '21170913',
      '337b6701',
      'ac04c4b9',
      'a60867bb',
    ])
    expect(medianSeconds).toBeGreaterThanOrEqual(30 * 60)
    expect(medianSeconds).toBeLessThanOrEqual(45 * 60)
    expect(medianSeconds).toBe(1865)
    expect(results.every(({ recruitSeconds }) => recruitSeconds >= 60 && recruitSeconds <= 180)).toBe(true)
    expect(results.every(({ trainingPurchases }) => trainingPurchases > 0)).toBe(true)
    expect(results.every(({ finalRank }) => finalRank >= 2 && finalRank <= 5)).toBe(true)
    expect(results.every(({ companionAttacks }) => companionAttacks > 0)).toBe(true)
    expect(results.every(({ companionDamage }) => companionDamage > 0)).toBe(true)
    expect(results.every(({ prestigeGateSeconds }) => prestigeGateSeconds <= 60 * 60)).toBe(true)
  })

  it('tapers the first-prestige adjustment back to the long-term HP curve', () => {
    expect(getEnemyDefinition(30).maxHp).toBe(
      Math.round(34 * FIRST_PRESTIGE_HP_GROWTH ** 29 * 4.8),
    )

    const normalizedPacingMultiplier = (stage: number) =>
      getEnemyDefinition(stage).maxHp / (34 * ENEMY_HP_GROWTH ** (stage - 1))
    const stage30Multiplier = normalizedPacingMultiplier(30) / 4.8
    const stage31Multiplier = normalizedPacingMultiplier(31)
    const stage45Multiplier = normalizedPacingMultiplier(45)
    const stage59Multiplier = normalizedPacingMultiplier(59)
    expect(stage30Multiplier).toBeGreaterThan(stage31Multiplier)
    expect(stage31Multiplier).toBeGreaterThan(stage45Multiplier)
    expect(stage45Multiplier).toBeGreaterThan(stage59Multiplier)
    expect(stage59Multiplier).toBeGreaterThan(1)

    for (const stage of [60, 100, 200]) {
      const bossMultiplier = stage % 10 === 0 ? 4.8 : 1
      expect(getEnemyDefinition(stage).maxHp).toBe(
        Math.round(34 * ENEMY_HP_GROWTH ** (stage - 1) * bossMultiplier),
      )
    }
  })
})
