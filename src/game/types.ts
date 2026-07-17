export const SAVE_VERSION = 1 as const

export const UPGRADE_IDS = ['weapon', 'armor', 'charm'] as const
export type UpgradeId = (typeof UPGRADE_IDS)[number]

export const SKILL_IDS = ['powerStrike', 'ironWill', 'fortune'] as const
export type SkillId = (typeof SKILL_IDS)[number]

export type UpgradeLevels = Record<UpgradeId, number>
export type SkillRanks = Record<SkillId, number>

export interface PlayerState {
  level: number
  xp: number
  gold: number
  essence: number
  currentHp: number
  skillPoints: number
  upgrades: UpgradeLevels
  skills: SkillRanks
}

export interface BattleState {
  stage: number
  highestStage: number
  enemyHp: number
  roundRemainderMs: number
  powerStrikeCooldownMs: number
  kills: number
  defeats: number
}

export interface LifetimeStats {
  goldEarned: number
  enemiesDefeated: number
  prestiges: number
}

export interface GameState {
  schemaVersion: typeof SAVE_VERSION
  lastSavedAt: number
  player: PlayerState
  battle: BattleState
  stats: LifetimeStats
}

export interface HeroStats {
  attack: number
  maxHp: number
  defense: number
  goldMultiplier: number
  powerStrikeMultiplier: number
}

export interface EnemyDefinition {
  stage: number
  name: string
  isBoss: boolean
  maxHp: number
  attack: number
  goldReward: number
  xpReward: number
}

export interface AdvanceReport {
  elapsedMs: number
  rounds: number
  kills: number
  defeats: number
  goldEarned: number
  xpEarned: number
  levelsGained: number
  stagesGained: number
}

export interface AdvanceResult {
  state: GameState
  report: AdvanceReport
}

export interface CommandResult {
  state: GameState
  success: boolean
  message: string
}

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}
