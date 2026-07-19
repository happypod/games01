export const SAVE_VERSION = 5 as const
export const RNG_ALGORITHM = 'xorshift32-v1' as const

export const EXPEDITION_DEFINITION_IDS_V1 = Object.freeze([
  'event.ember-shrine',
  'event.wandering-smith',
  'event.ash-camp',
] as const)
export type ExpeditionDefinitionIdV1 = (typeof EXPEDITION_DEFINITION_IDS_V1)[number]

export const EXPEDITION_DEFINITION_IDS = [...EXPEDITION_DEFINITION_IDS_V1] as const
export type ExpeditionDefinitionId = (typeof EXPEDITION_DEFINITION_IDS)[number]

export const EXPEDITION_CHOICE_IDS = ['gold', 'recovery'] as const
export type ExpeditionChoiceId = (typeof EXPEDITION_CHOICE_IDS)[number]

export type ExpeditionResolvedEffect =
  | { readonly type: 'grantGold'; readonly amount: number }
  | { readonly type: 'restoreHp'; readonly amount: number }

export interface ExpeditionResolvedChoice {
  readonly choiceId: ExpeditionChoiceId
  readonly effect: ExpeditionResolvedEffect
}

export interface ExpeditionPendingEvent {
  readonly eventId: string
  readonly definitionId: ExpeditionDefinitionId
  readonly definitionVersion: number
  readonly milestoneIndex: number
  readonly milestoneStage: number
  readonly maxHpAtOffer: number
  readonly resolvedChoices: readonly ExpeditionResolvedChoice[]
}

export interface ExpeditionEventState {
  readonly definitionVersion: number
  readonly runPrestige: number
  readonly milestoneMask: number
  readonly pending: readonly ExpeditionPendingEvent[]
  readonly overflowCount: number
}

export const UPGRADE_IDS = ['weapon', 'armor', 'charm'] as const
export type UpgradeId = (typeof UPGRADE_IDS)[number]

export const SKILL_IDS = ['powerStrike', 'ironWill', 'fortune'] as const
export type SkillId = (typeof SKILL_IDS)[number]

export type ProgressionCardAssetId =
  | 'equipment.ember-blade'
  | 'equipment.guard-armor'
  | 'equipment.fortune-charm'
  | 'skill.power-strike'
  | 'skill.iron-will'
  | 'skill.loot-sense'

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
  claimedBossMilestoneMask: number
  expeditionEvents: ExpeditionEventState
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

export type CombatEventCursor = string

export interface CombatEventSnapshot {
  readonly stage: number
  readonly highestStage: number
  readonly playerHp: number
  readonly enemyHp: number
  readonly gold: number
  readonly xp: number
}

interface CombatEventBase {
  readonly id: string
  readonly roundSequence: CombatEventCursor
  readonly ordinal: number
  readonly rngState: number
  readonly stage: number
  readonly snapshot: CombatEventSnapshot
}

export interface SkillCombatEvent extends CombatEventBase {
  readonly type: 'skill'
  readonly ordinal: 10
  readonly skillId: 'powerStrike'
  readonly damage: number
}

export interface CriticalCombatEvent extends CombatEventBase {
  readonly type: 'critical'
  readonly ordinal: 20
  readonly damage: number
}

export interface CompanionAssistCombatEvent extends CombatEventBase {
  readonly type: 'companionAssist'
  readonly ordinal: 25
  readonly companionId: CompanionId
  readonly damage: number
}

export interface KillCombatEvent extends CombatEventBase {
  readonly type: 'kill'
  readonly ordinal: 30
  readonly defeatedStage: number
  readonly nextStage: number
  readonly gold: number
  readonly xp: number
}

export interface BossVictoryCombatEvent extends CombatEventBase {
  readonly type: 'bossVictory'
  readonly ordinal: 30
  readonly defeatedStage: number
  readonly nextStage: number
  readonly gold: number
  readonly xp: number
  readonly milestoneReward: BossMilestoneRewardSnapshot | null
}

export interface BossMilestoneRewardSnapshot {
  readonly tableId: 'boss-milestone-v1'
  readonly kind: 'gold'
  readonly milestoneStage: number
  readonly configuredGold: number
  readonly appliedGold: number
}

export interface DefeatCombatEvent extends CombatEventBase {
  readonly type: 'defeat'
  readonly ordinal: 30
  readonly damage: number
  readonly defeatedAtStage: number
  readonly returnStage: number
  readonly highestStage: number
}

export type CombatEvent =
  | SkillCombatEvent
  | CriticalCombatEvent
  | CompanionAssistCombatEvent
  | KillCombatEvent
  | BossVictoryCombatEvent
  | DefeatCombatEvent

export interface CombatEventBatch {
  readonly nextCursor: CombatEventCursor
  readonly totalEvents: number
  readonly events: readonly CombatEvent[]
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

export interface AdvanceResult extends CombatEventBatch {
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
