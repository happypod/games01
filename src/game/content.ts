import type { CompanionId, EnemyDefinition, SkillId, UpgradeId } from './types'

export const COMBAT_ROUND_MS = 1_000
export const MAX_OFFLINE_MS = 8 * 60 * 60 * 1_000
export const MAX_STAGE = 300
export const PRESTIGE_STAGE = 30
export const CRITICAL_CHANCE = 0.15
export const CRITICAL_DAMAGE_MULTIPLIER = 1.75
export const ENEMY_HP_GROWTH = 1.15
export const FIRST_PRESTIGE_HP_GROWTH = 1.188
export const PRESTIGE_PACING_TAPER_STAGE = 60
export const COMPANION_ATTACK_INTERVAL_MS = 3_000

export interface UpgradeDefinition {
  id: UpgradeId
  name: string
  description: string
  baseCost: number
  costGrowth: number
  maxLevel: number
}

export interface SkillDefinition {
  id: SkillId
  name: string
  description: string
  unlockLevel: number
  maxRank: number
}

export interface CompanionDefinition {
  id: CompanionId
  name: string
  description: string
  unlockStage: number
  maxRank: number
  baseTrainingCost: number
  trainingCostGrowth: number
  baseDamageRatio: number
  damageRatioPerRank: number
}

export const UPGRADE_DEFINITIONS: Record<UpgradeId, UpgradeDefinition> = {
  weapon: {
    id: 'weapon',
    name: '불씨 검',
    description: '공격력을 크게 올립니다.',
    baseCost: 18,
    costGrowth: 1.42,
    maxLevel: 100,
  },
  armor: {
    id: 'armor',
    name: '수호 갑옷',
    description: '최대 체력과 방어력을 올립니다.',
    baseCost: 24,
    costGrowth: 1.45,
    maxLevel: 100,
  },
  charm: {
    id: 'charm',
    name: '행운 부적',
    description: '적에게서 얻는 골드를 늘립니다.',
    baseCost: 30,
    costGrowth: 1.5,
    maxLevel: 50,
  },
}

export const SKILL_DEFINITIONS: Record<SkillId, SkillDefinition> = {
  powerStrike: {
    id: 'powerStrike',
    name: '화염 강타',
    description: '5초마다 자동으로 강력한 일격을 가합니다.',
    unlockLevel: 1,
    maxRank: 10,
  },
  ironWill: {
    id: 'ironWill',
    name: '강철 의지',
    description: '최대 체력과 방어력을 영구히 강화합니다.',
    unlockLevel: 3,
    maxRank: 10,
  },
  fortune: {
    id: 'fortune',
    name: '전리품 감각',
    description: '모든 전투의 골드 획득량을 높입니다.',
    unlockLevel: 5,
    maxRank: 10,
  },
}

export const COMPANION_DEFINITIONS: Record<CompanionId, CompanionDefinition> = {
  emberFox: {
    id: 'emberFox',
    name: '불씨 여우 루미',
    description: '3초마다 영웅 공격력에 비례한 불꽃 협공을 가합니다.',
    unlockStage: 11,
    maxRank: 5,
    baseTrainingCost: 100,
    trainingCostGrowth: 1.8,
    baseDamageRatio: 0.2,
    damageRatioPerRank: 0.05,
  },
}

const ENEMY_NAMES = [
  '잿빛 슬라임',
  '황혼 늑대',
  '버려진 갑주',
  '그을린 주술사',
  '심연의 파수꾼',
] as const

const BOSS_NAMES = ['재의 거인', '월식의 기사', '잊힌 용'] as const

const bounded = (value: number, maximum: number) =>
  Math.min(maximum, Math.max(1, Math.round(value)))

function getFirstPrestigeHpMultiplier(stage: number): number {
  const growthRatio = FIRST_PRESTIGE_HP_GROWTH / ENEMY_HP_GROWTH
  if (stage <= PRESTIGE_STAGE) return growthRatio ** (stage - 1)
  if (stage >= PRESTIGE_PACING_TAPER_STAGE) return 1
  const taperProgress =
    (PRESTIGE_PACING_TAPER_STAGE - stage) /
    (PRESTIGE_PACING_TAPER_STAGE - PRESTIGE_STAGE)
  return growthRatio ** ((PRESTIGE_STAGE - 1) * taperProgress)
}

export function getEnemyDefinition(rawStage: number): EnemyDefinition {
  const stage = Math.min(MAX_STAGE, Math.max(1, Math.floor(rawStage)))
  const isBoss = stage % 10 === 0
  const regularIndex = (stage - 1) % ENEMY_NAMES.length
  const bossIndex = Math.floor(stage / 10 - 1) % BOSS_NAMES.length
  const hpMultiplier = isBoss ? 4.8 : 1
  const attackMultiplier = isBoss ? 1.55 : 1

  return {
    stage,
    name: isBoss
      ? (BOSS_NAMES[bossIndex] ?? BOSS_NAMES[0])
      : (ENEMY_NAMES[regularIndex] ?? ENEMY_NAMES[0]),
    isBoss,
    maxHp: bounded(
      34 *
        ENEMY_HP_GROWTH ** (stage - 1) *
        getFirstPrestigeHpMultiplier(stage) *
        hpMultiplier,
      Number.MAX_SAFE_INTEGER,
    ),
    attack: bounded(4 * 1.105 ** (stage - 1) * attackMultiplier, Number.MAX_SAFE_INTEGER),
    goldReward: bounded(9 * 1.115 ** (stage - 1) * (isBoss ? 4 : 1), Number.MAX_SAFE_INTEGER),
    xpReward: bounded(7 * 1.1 ** (stage - 1) * (isBoss ? 3 : 1), Number.MAX_SAFE_INTEGER),
  }
}
