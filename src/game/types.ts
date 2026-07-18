export const SAVE_VERSION = 3 as const
export const RNG_ALGORITHM = 'xorshift32-v1' as const

export const UPGRADE_IDS = ['weapon', 'armor', 'charm'] as const
export type UpgradeId = (typeof UPGRADE_IDS)[number]

export const SKILL_IDS = ['powerStrike', 'ironWill', 'fortune'] as const
export type SkillId = (typeof SKILL_IDS)[number]

export const COMPANION_IDS = ['emberFox'] as const
export type CompanionId = (typeof COMPANION_IDS)[number]

export type EnemyAssetId =
  | 'enemy.ash-slime'
  | 'enemy.twilight-wolf'
  | 'enemy.abandoned-armor'
  | 'enemy.charred-shaman'
  | 'enemy.abyss-sentinel'
  | 'boss.ash-giant'
  | 'boss.eclipse-knight'
  | 'boss.forgotten-dragon'

export type UpgradeLevels = Record<UpgradeId, number>
export type SkillRanks = Record<SkillId, number>

export interface CompanionState {
  id: CompanionId | null
  rank: number
}

export interface RngState {
  algorithm: typeof RNG_ALGORITHM
  seed: number
  state: number
  draws: number
}

export interface PlayerState {
  level: number
  xp: number
  gold: number
  essence: number
  currentHp: number
  skillPoints: number
  upgrades: UpgradeLevels
  skills: SkillRanks
  companion: CompanionState
}

export interface BattleState {
  stage: number
  highestStage: number
  enemyHp: number
  roundRemainderMs: number
  powerStrikeCooldownMs: number
  companionCooldownMs: number
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
  rng: RngState
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
  assetId: EnemyAssetId
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
  criticalHits: number
  companionAttacks: number
  companionDamage: number
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
