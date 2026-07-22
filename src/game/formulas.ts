import {
  COMPANION_DEFINITIONS,
  SKILL_DEFINITIONS,
  UPGRADE_DEFINITIONS,
} from './content'
import type { CompanionId, GameState, HeroStats, SkillId, UpgradeId } from './types'

export type GrowthEffectMetricKey =
  | 'attack'
  | 'maxHp'
  | 'defense'
  | 'goldBonusPercent'
  | 'powerStrikeMultiplier'

export interface GrowthEffectMetric {
  readonly key: GrowthEffectMetricKey
  readonly current: number | null
  readonly next: number | null
}

export interface GrowthEffectComparison {
  readonly isMax: boolean
  readonly metrics: readonly GrowthEffectMetric[]
}

export const toSafeInteger = (value: number, minimum = 0) =>
  Math.min(Number.MAX_SAFE_INTEGER, Math.max(minimum, Math.round(value)))

export const addSafeIntegers = (left: number, right: number) =>
  toSafeInteger(left + right)

export const ESSENCE_STAT_BONUS_PER_POINT = 0.042

export function getXpToNextLevel(level: number): number {
  return toSafeInteger(18 * Math.max(1, level) ** 1.42, 1)
}

export function getUpgradeCost(id: UpgradeId, currentLevel: number): number {
  const definition = UPGRADE_DEFINITIONS[id]
  return toSafeInteger(definition.baseCost * definition.costGrowth ** currentLevel, 1)
}

export function getSkillPointCost(_id: SkillId, currentRank: number): number {
  return 1 + Math.floor(currentRank / 4)
}

export function getCompanionTrainingCost(id: CompanionId, currentRank: number): number {
  const definition = COMPANION_DEFINITIONS[id]
  return toSafeInteger(
    definition.baseTrainingCost * definition.trainingCostGrowth ** Math.max(0, currentRank - 1),
    1,
  )
}

export function getHeroStats(state: GameState): HeroStats {
  const { level, essence, upgrades, skills } = state.player
  const permanentMultiplier = 1 + essence * ESSENCE_STAT_BONUS_PER_POINT
  const ironWillMultiplier = 1 + skills.ironWill * 0.1

  return {
    attack: toSafeInteger(
      (10 + (level - 1) * 2.2 + upgrades.weapon * 5) * permanentMultiplier +
        state.camp.training.attack * 2,
      1,
    ),
    maxHp: toSafeInteger(
      (100 + (level - 1) * 14 + upgrades.armor * 30) *
        ironWillMultiplier *
        permanentMultiplier +
        state.camp.training.vitality * 20,
      1,
    ),
    defense: toSafeInteger(
      (upgrades.armor * 1.8 + (level - 1) * 0.35) * ironWillMultiplier,
    ),
    goldMultiplier:
      1 +
      upgrades.charm * 0.1 +
      skills.fortune * 0.12 +
      (state.camp.buffs.goldBoostRounds > 0 ? 0.5 : 0),
    powerStrikeMultiplier: 2.5 + Math.max(0, skills.powerStrike - 1) * 0.25,
  }
}

const percentBonus = (multiplier: number) =>
  Math.round((multiplier - 1) * 1_000) / 10

function withUpgradeLevel(state: GameState, id: UpgradeId, level: number): GameState {
  return {
    ...state,
    player: {
      ...state.player,
      upgrades: { ...state.player.upgrades, [id]: level },
    },
  }
}

function withSkillRank(state: GameState, id: SkillId, rank: number): GameState {
  return {
    ...state,
    player: {
      ...state.player,
      skills: { ...state.player.skills, [id]: rank },
    },
  }
}

export function getUpgradeEffectComparison(
  state: GameState,
  id: UpgradeId,
): GrowthEffectComparison {
  const definition = UPGRADE_DEFINITIONS[id]
  const level = state.player.upgrades[id]
  const isMax = level >= definition.maxLevel
  const currentStats = getHeroStats(state)
  const nextStats = isMax
    ? null
    : getHeroStats(withUpgradeLevel(state, id, Math.min(level + 1, definition.maxLevel)))

  switch (id) {
    case 'weapon':
      return {
        isMax,
        metrics: [{ key: 'attack', current: currentStats.attack, next: nextStats?.attack ?? null }],
      }
    case 'armor':
      return {
        isMax,
        metrics: [
          { key: 'maxHp', current: currentStats.maxHp, next: nextStats?.maxHp ?? null },
          { key: 'defense', current: currentStats.defense, next: nextStats?.defense ?? null },
        ],
      }
    case 'charm':
      return {
        isMax,
        metrics: [{
          key: 'goldBonusPercent',
          current: percentBonus(currentStats.goldMultiplier),
          next: nextStats === null ? null : percentBonus(nextStats.goldMultiplier),
        }],
      }
  }
}

export function getSkillEffectComparison(
  state: GameState,
  id: SkillId,
): GrowthEffectComparison {
  const definition = SKILL_DEFINITIONS[id]
  const rank = state.player.skills[id]
  const isMax = rank >= definition.maxRank
  const currentStats = getHeroStats(state)
  const nextStats = isMax
    ? null
    : getHeroStats(withSkillRank(state, id, Math.min(rank + 1, definition.maxRank)))

  switch (id) {
    case 'powerStrike':
      return {
        isMax,
        metrics: [{
          key: 'powerStrikeMultiplier',
          current: rank === 0 ? null : currentStats.powerStrikeMultiplier,
          next: nextStats?.powerStrikeMultiplier ?? null,
        }],
      }
    case 'ironWill':
      return {
        isMax,
        metrics: [
          { key: 'maxHp', current: currentStats.maxHp, next: nextStats?.maxHp ?? null },
          { key: 'defense', current: currentStats.defense, next: nextStats?.defense ?? null },
        ],
      }
    case 'fortune':
      return {
        isMax,
        metrics: [{
          key: 'goldBonusPercent',
          current: percentBonus(currentStats.goldMultiplier),
          next: nextStats === null ? null : percentBonus(nextStats.goldMultiplier),
        }],
      }
  }
}

export function getPrestigeReward(highestStage: number): number {
  if (highestStage < 30) return 0
  return Math.max(1, Math.floor((highestStage / 10) ** 1.5))
}

export function isCompanionUnlocked(state: GameState, id: CompanionId): boolean {
  return state.battle.highestStage >= COMPANION_DEFINITIONS[id].unlockStage
}

export function getCompanionDamage(state: GameState): number {
  const { id, rank } = state.player.companion
  if (id === null || rank < 1) return 0
  const definition = COMPANION_DEFINITIONS[id]
  const ratio = definition.baseDamageRatio + definition.damageRatioPerRank * (rank - 1)
  return toSafeInteger(getHeroStats(state).attack * ratio, 1)
}

export function isSkillUnlocked(state: GameState, id: SkillId): boolean {
  return state.player.level >= SKILL_DEFINITIONS[id].unlockLevel
}
