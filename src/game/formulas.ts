import { SKILL_DEFINITIONS, UPGRADE_DEFINITIONS } from './content'
import type { GameState, HeroStats, SkillId, UpgradeId } from './types'

export const toSafeInteger = (value: number, minimum = 0) =>
  Math.min(Number.MAX_SAFE_INTEGER, Math.max(minimum, Math.round(value)))

export const addSafeIntegers = (left: number, right: number) =>
  toSafeInteger(left + right)

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

export function getHeroStats(state: GameState): HeroStats {
  const { level, essence, upgrades, skills } = state.player
  const permanentMultiplier = 1 + essence * 0.03
  const ironWillMultiplier = 1 + skills.ironWill * 0.1

  return {
    attack: toSafeInteger(
      (10 + (level - 1) * 2.2 + upgrades.weapon * 5) * permanentMultiplier,
      1,
    ),
    maxHp: toSafeInteger(
      (100 + (level - 1) * 14 + upgrades.armor * 30) *
        ironWillMultiplier *
        permanentMultiplier,
      1,
    ),
    defense: toSafeInteger(
      (upgrades.armor * 1.8 + (level - 1) * 0.35) * ironWillMultiplier,
    ),
    goldMultiplier: 1 + upgrades.charm * 0.1 + skills.fortune * 0.12,
    powerStrikeMultiplier: 2.5 + Math.max(0, skills.powerStrike - 1) * 0.25,
  }
}

export function getPrestigeReward(highestStage: number): number {
  if (highestStage < 30) return 0
  return Math.max(1, Math.floor((highestStage / 10) ** 1.5))
}

export function isSkillUnlocked(state: GameState, id: SkillId): boolean {
  return state.player.level >= SKILL_DEFINITIONS[id].unlockLevel
}
