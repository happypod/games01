import type { EnemyDefinition, SkillId, UpgradeId } from './types'

export const COMBAT_ROUND_MS = 1_000
export const MAX_OFFLINE_MS = 8 * 60 * 60 * 1_000
export const MAX_STAGE = 300
export const PRESTIGE_STAGE = 30

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
    maxHp: bounded(34 * 1.15 ** (stage - 1) * hpMultiplier, Number.MAX_SAFE_INTEGER),
    attack: bounded(4 * 1.105 ** (stage - 1) * attackMultiplier, Number.MAX_SAFE_INTEGER),
    goldReward: bounded(9 * 1.115 ** (stage - 1) * (isBoss ? 4 : 1), Number.MAX_SAFE_INTEGER),
    xpReward: bounded(7 * 1.1 ** (stage - 1) * (isBoss ? 3 : 1), Number.MAX_SAFE_INTEGER),
  }
}
