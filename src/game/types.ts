export const SAVE_VERSION = 10 as const
export const INVENTORY_DEFINITION_VERSION = 1 as const
export const RNG_ALGORITHM = 'xorshift32-v1' as const

export const EQUIPMENT_SLOTS = ['weapon', 'armor', 'helmet', 'accessory'] as const
export type EquipmentSlot = (typeof EQUIPMENT_SLOTS)[number]

export const ITEM_RARITIES = ['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY'] as const
export type ItemRarity = (typeof ITEM_RARITIES)[number]

export const ITEM_TYPES = ['EQUIPMENT', 'MATERIAL', 'CONSUMABLE'] as const
export type ItemType = (typeof ITEM_TYPES)[number]

export interface ItemStats {
  readonly atk?: number
  readonly hp?: number
  readonly def?: number
  readonly critChanceBasisPoints?: number
  readonly goldBonusPercent?: number
}

export interface ItemDefinition {
  readonly id: string
  readonly name: string
  readonly rarity: ItemRarity
  readonly type: ItemType
  readonly slot?: EquipmentSlot
  readonly stats?: Readonly<ItemStats>
  readonly assetId: string
  readonly description: string
}

export type ItemInventory = Record<string, number>

export interface InventoryState {
  definitionVersion: typeof INVENTORY_DEFINITION_VERSION
  lootBag: ItemInventory
  heroInventory: ItemInventory
  campStorage: ItemInventory
}

export type PlayerEquippedState = Record<EquipmentSlot, string | null>
export type SkillSlotState = [
  SkillId | null,
  SkillId | null,
  SkillId | null,
]

export const ACTIVE_CONTENT_CHAPTER = 'chapter1' as const

export const CHAPTER1_COSTUME_IDS = ['chapter1.sera.field'] as const
export type Chapter1CostumeId = (typeof CHAPTER1_COSTUME_IDS)[number]

export const CHAPTER1_SYNTHESIS_IDS = ['chapter1.sera.ember-vow'] as const
export type Chapter1SynthesisId = (typeof CHAPTER1_SYNTHESIS_IDS)[number]

export const CHAPTER1_REWARD_IDS = ['chapter1.weapon.ember-vow-card'] as const
export type Chapter1RewardId = (typeof CHAPTER1_REWARD_IDS)[number]

export const GAME_MODES = ['BATTLE', 'CAMP'] as const
export type GameMode = (typeof GAME_MODES)[number]

export const CAMP_STRUCTURE_IDS = ['tent', 'workbench', 'trainingGround'] as const
export type CampStructureId = (typeof CAMP_STRUCTURE_IDS)[number]

export const CAMP_TRAINING_IDS = ['attack', 'vitality'] as const
export type CampTrainingId = (typeof CAMP_TRAINING_IDS)[number]

export const CAMP_MATERIAL_IDS = ['ashShard', 'beastHide', 'emberCore'] as const
export type CampMaterialId = (typeof CAMP_MATERIAL_IDS)[number]

export const CAMP_CONSUMABLE_IDS = ['goldStew', 'focusTonic', 'healingPotion'] as const
export type CampConsumableId = (typeof CAMP_CONSUMABLE_IDS)[number]

export const CAMP_RECIPE_IDS = ['goldStew', 'focusTonic', 'healingPotion'] as const
export type CampRecipeId = (typeof CAMP_RECIPE_IDS)[number]

export const CAMP_QUICK_CONSUMABLE_IDS = ['healingPotion'] as const
export type CampQuickConsumableId = (typeof CAMP_QUICK_CONSUMABLE_IDS)[number]

export const CAMP_RESIDENT_IDS = ['sera'] as const
export type CampResidentId = (typeof CAMP_RESIDENT_IDS)[number]
export type CampResidentStatus = 'unmet' | 'rescued' | 'contracted'
export type SeraConsentStatus = 'notGranted' | 'granted' | 'withdrawn'

export type CampStructureLevels = Record<CampStructureId, number>
export type CampTrainingRanks = Record<CampTrainingId, number>
export type CampMaterialInventory = Record<CampMaterialId, number>
export type CampConsumableInventory = Record<CampConsumableId, number>

export interface CampCraftJob {
  recipeId: CampRecipeId
  remainingMs: number
}

export interface CampBuffState {
  goldBoostRounds: number
  bossFocusStage: number | null
}

export interface CampMerchantState {
  cycle: number
  refreshRemainingMs: number
  purchasedOfferMask: number
}

export interface CampResidentState {
  status: CampResidentStatus
  trust: number
}

export interface CampBondState {
  definitionVersion: number
  adultAccessConfirmed: boolean
  seraConsent: SeraConsentStatus
  currentCostumeId: Chapter1CostumeId
  unlockedCostumeMask: number
  claimedSynthesisRewardMask: number
}

export interface CampState {
  definitionVersion: number
  structures: CampStructureLevels
  training: CampTrainingRanks
  materials: CampMaterialInventory
  consumables: CampConsumableInventory
  quickConsumable: CampQuickConsumableId | null
  craftJob: CampCraftJob | null
  buffs: CampBuffState
  merchant: CampMerchantState
  residents: Record<CampResidentId, CampResidentState>
  bond: CampBondState
}

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

export type CompanionAssetId = 'companion.ember-fox.default'

export type EnemyAssetId =
  | 'enemy.ash-slime'
  | 'enemy.twilight-wolf'
  | 'enemy.abandoned-armor'
  | 'enemy.charred-shaman'
  | 'enemy.abyss-sentinel'
  | 'boss.ash-giant'
  | 'boss.eclipse-knight'
  | 'boss.forgotten-dragon'

export type EnemyDamageAssetId =
  | 'boss.eclipse-knight.damaged'
  | 'boss.eclipse-knight.severe'

export type EnemyPresentationAssetId = EnemyAssetId | EnemyDamageAssetId

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
  equipped: PlayerEquippedState
  skillSlots: SkillSlotState
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

export interface LivingCardState {
  cardId: string
  hStage: 0 | 1 | 2
  captureLoyalty: number
  corruptionLevel: number
  isCaptured: boolean
}

export interface GameState {
  schemaVersion: typeof SAVE_VERSION
  lastSavedAt: number
  currentMode: GameMode
  camp: CampState
  inventory: InventoryState
  claimedBossMilestoneMask: number
  expeditionEvents: ExpeditionEventState
  rng: RngState
  player: PlayerState
  battle: BattleState
  stats: LifetimeStats
  livingCards: Record<string, LivingCardState>
}

export interface HeroStats {
  attack: number
  maxHp: number
  defense: number
  goldMultiplier: number
  powerStrikeMultiplier: number
  critChance: number
}

export interface BattleActor {
  id: string
  name: string
  hp: number
  maxHp: number
  atk: number
  def: number
  baseAssetId: string
  damagedAssetId: string
  severeAssetId: string
}

export interface HotbarSlot {
  id: string
  type: 'SKILL' | 'ITEM'
  name: string
  iconAssetId: string
  skillId?: string | undefined
  itemId?: string | undefined
  cooldownMs: number
  maxCooldownMs: number
}

export interface BattleEvent {
  id: string
  type: 'SKILL' | 'CRITICAL' | 'NORMAL' | 'COMPANION'
  targetId: string
  damage: number
  skillName?: string
  timestamp: number
}

export function getActorDamageStage(hp: number, maxHp: number): 0 | 1 | 2 {
  if (maxHp <= 0) return 0
  const ratio = hp / maxHp
  if (ratio >= 0.7) return 0
  if (ratio >= 0.3) return 1
  return 2
}

export function getActorAssetId(actor: BattleActor): string {
  const stage = getActorDamageStage(actor.hp, actor.maxHp)
  if (stage === 1) return actor.damagedAssetId
  if (stage === 2) return actor.severeAssetId
  return actor.baseAssetId
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
