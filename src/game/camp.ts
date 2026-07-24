import { getHeroStats, toSafeInteger } from './formulas'
import type {
  Chapter1CostumeId,
  Chapter1RewardId,
  Chapter1SynthesisId,
  CampBondState,
  CampMaterialInventory,
  CampRecipeId,
  CampState,
  CampStructureId,
  CampTrainingId,
  EnemyDefinition,
  GameState,
} from './types'
import {
  ACTIVE_CONTENT_CHAPTER,
  CHAPTER1_COSTUME_IDS,
  CHAPTER1_REWARD_IDS,
  CHAPTER1_SYNTHESIS_IDS,
} from './types'

export const CAMP_DEFINITION_VERSION = 3 as const
export const CAMP_BOND_DEFINITION_VERSION = 1 as const
export const CAMP_MERCHANT_REFRESH_MS = 30 * 60 * 1_000
export const CAMP_STRUCTURE_MAX_LEVEL = 5
export const CAMP_TRAINING_RANKS_PER_LEVEL = 5
export const CAMP_HEALING_MAX_ASH_COST = 5
export const CAMP_HEALING_POTION_RECOVERY_RATIO = 0.35

const HOUR_MS = 60 * 60 * 1_000

export const CAMP_OFFLINE_CAP_HOURS = Object.freeze([8, 9, 10, 11, 12] as const)
export const CAMP_WORKBENCH_DURATION_PERCENT = Object.freeze([100, 90, 80, 70, 60] as const)

export const CAMP_STRUCTURE_UPGRADE_COSTS: Readonly<
  Record<CampStructureId, readonly [number, number, number, number]>
> = Object.freeze({
  tent: Object.freeze([600, 1_500, 3_600, 8_000] as const),
  workbench: Object.freeze([450, 1_100, 2_700, 6_200] as const),
  trainingGround: Object.freeze([500, 1_250, 3_000, 7_000] as const),
})

export const CAMP_TRAINING_EFFECTS: Readonly<Record<CampTrainingId, number>> = Object.freeze({
  attack: 2,
  vitality: 20,
})

export const CAMP_MATERIAL_LABELS: Readonly<Record<keyof CampMaterialInventory, string>> = Object.freeze({
  ashShard: '재의 파편',
  beastHide: '야수 가죽',
  emberCore: '불씨 핵',
})

export interface CampFacilityDefinition {
  readonly id: CampStructureId
  readonly name: string
  readonly assetId: string
  readonly copy: string
}

// IRPG-803: shared by the card-grid (CampDashboard) and 2.5D canvas (CampCanvas)
// presentations so both stay in sync from a single definition.
export const CAMP_FACILITY_DEFINITIONS: readonly CampFacilityDefinition[] = Object.freeze([
  Object.freeze({
    id: 'tent',
    name: '원정 텐트',
    assetId: 'event.ash-camp',
    copy: '휴식과 오프라인 원정 시간을 관리합니다.',
  }),
  Object.freeze({
    id: 'workbench',
    name: '불씨 작업대',
    assetId: 'event.wandering-smith',
    copy: '전리품을 확정 레시피로 가공하는 공간입니다.',
  }),
  Object.freeze({
    id: 'trainingGround',
    name: '단련소',
    assetId: 'event.ember-shrine',
    copy: '영구 공격력과 체력 훈련을 준비합니다.',
  }),
] as const)

export const CAMP_GOLD_STEW_ROUNDS = 1_800
export const CAMP_FOCUS_CRITICAL_BONUS = 0.2
export const CAMP_MERCHANT_OFFER_SLOTS = [0, 1, 2] as const
export type CampMerchantOfferSlot = (typeof CAMP_MERCHANT_OFFER_SLOTS)[number]

export const CHAPTER1_ADULT_CHARACTER_DEFINITIONS = Object.freeze({
  sera: Object.freeze({
    id: 'sera',
    chapterId: ACTIVE_CONTENT_CHAPTER,
    adult: true,
    consentRequired: true,
  }),
} as const)

export interface Chapter1CostumeDefinition {
  readonly id: Chapter1CostumeId
  readonly name: string
  readonly manifestAssetId: `costume.chapter1.${string}`
  readonly unlockBit: number
}

export const CHAPTER1_COSTUME_DEFINITIONS: Readonly<
  Record<Chapter1CostumeId, Chapter1CostumeDefinition>
> = Object.freeze({
  'chapter1.sera.field': Object.freeze({
    id: 'chapter1.sera.field',
    name: '세라의 잿불 정찰복',
    manifestAssetId: 'costume.chapter1.sera.ember-bond',
    unlockBit: 1,
  }),
})

export const MAX_CHAPTER1_COSTUME_MASK = (2 ** CHAPTER1_COSTUME_IDS.length) - 1
export const MAX_CHAPTER1_SYNTHESIS_REWARD_MASK = (2 ** CHAPTER1_REWARD_IDS.length) - 1

export interface CampJointSynthesisDefinition {
  readonly id: Chapter1SynthesisId
  readonly name: string
  readonly cost: Readonly<{
    gold: number
    materials: Readonly<CampMaterialInventory>
  }>
  readonly reward: Readonly<{
    id: Chapter1RewardId
    name: string
    claimBit: number
  }>
}

export const CAMP_JOINT_SYNTHESIS_DEFINITIONS: Readonly<
  Record<Chapter1SynthesisId, CampJointSynthesisDefinition>
> = Object.freeze({
  'chapter1.sera.ember-vow': Object.freeze({
    id: 'chapter1.sera.ember-vow',
    name: '잿불의 서약 합동 연성',
    cost: Object.freeze({
      gold: 900,
      materials: Object.freeze({ ashShard: 12, beastHide: 6, emberCore: 1 }),
    }),
    reward: Object.freeze({
      id: 'chapter1.weapon.ember-vow-card',
      name: '잿불의 서약 무기 카드',
      claimBit: 1,
    }),
  }),
})

export function isChapter1CostumeId(value: unknown): value is Chapter1CostumeId {
  return typeof value === 'string' && CHAPTER1_COSTUME_IDS.some((id) => id === value)
}

export function isChapter1SynthesisId(value: unknown): value is Chapter1SynthesisId {
  return typeof value === 'string' && CHAPTER1_SYNTHESIS_IDS.some((id) => id === value)
}

export function createInitialCampBondState(): CampBondState {
  const initialCostumeId = CHAPTER1_COSTUME_IDS[0]
  return {
    definitionVersion: CAMP_BOND_DEFINITION_VERSION,
    adultAccessConfirmed: false,
    seraConsent: 'notGranted',
    currentCostumeId: initialCostumeId,
    unlockedCostumeMask: CHAPTER1_COSTUME_DEFINITIONS[initialCostumeId].unlockBit,
    claimedSynthesisRewardMask: 0,
  }
}

type CampMerchantOfferEffect =
  | { readonly type: 'material'; readonly id: keyof CampMaterialInventory; readonly amount: number }
  | { readonly type: 'consumable'; readonly id: CampRecipeId; readonly amount: number }
  | { readonly type: 'rescueSera' }

export interface CampMerchantOfferDefinition {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly baseCost: number
  readonly effect: CampMerchantOfferEffect
}

function merchantOffer(
  definition: CampMerchantOfferDefinition,
): CampMerchantOfferDefinition {
  return Object.freeze({ ...definition, effect: Object.freeze({ ...definition.effect }) })
}

export const CAMP_MERCHANT_OFFER_CYCLES = Object.freeze([
  Object.freeze([
    merchantOffer({ id: 'ash-cache', name: '재 파편 꾸러미', description: '재의 파편 10개', baseCost: 120, effect: { type: 'material', id: 'ashShard', amount: 10 } }),
    merchantOffer({ id: 'gold-stew', name: '완성된 황금 스튜', description: '황금 스튜 1개', baseCost: 420, effect: { type: 'consumable', id: 'goldStew', amount: 1 } }),
    merchantOffer({ id: 'sera-relief', name: '세라 구조 지원', description: '구호대에 안전한 이동·치료 비용을 지원합니다.', baseCost: 800, effect: { type: 'rescueSera' } }),
  ] as const),
  Object.freeze([
    merchantOffer({ id: 'hide-bundle', name: '야수 가죽 묶음', description: '야수 가죽 6개', baseCost: 220, effect: { type: 'material', id: 'beastHide', amount: 6 } }),
    merchantOffer({ id: 'focus-tonic', name: '완성된 집중 물약', description: '집중 물약 1개', baseCost: 620, effect: { type: 'consumable', id: 'focusTonic', amount: 1 } }),
    merchantOffer({ id: 'mixed-cache', name: '원정 재료 상자', description: '재의 파편 18개', baseCost: 260, effect: { type: 'material', id: 'ashShard', amount: 18 } }),
  ] as const),
  Object.freeze([
    merchantOffer({ id: 'ember-core', name: '정제된 불씨 핵', description: '불씨 핵 1개', baseCost: 520, effect: { type: 'material', id: 'emberCore', amount: 1 } }),
    merchantOffer({ id: 'hide-reserve', name: '가죽 비축분', description: '야수 가죽 10개', baseCost: 360, effect: { type: 'material', id: 'beastHide', amount: 10 } }),
    merchantOffer({ id: 'stew-reserve', name: '황금 스튜 비축분', description: '황금 스튜 1개', baseCost: 380, effect: { type: 'consumable', id: 'goldStew', amount: 1 } }),
  ] as const),
] as const)

export const SERA_TRUST_COSTS = Object.freeze([250, 500, 900, 1_500, 2_400] as const)

export function getCampMerchantOffers(cycle: number) {
  return CAMP_MERCHANT_OFFER_CYCLES[cycle % CAMP_MERCHANT_OFFER_CYCLES.length]!
}

export function getSeraMerchantDiscountPercent(camp: Pick<CampState, 'residents'>): number {
  return camp.residents.sera.status === 'contracted'
    ? camp.residents.sera.trust * 2
    : 0
}

export function getCampMerchantOfferCost(
  camp: Pick<CampState, 'residents'>,
  offer: CampMerchantOfferDefinition,
): number {
  return toSafeInteger(
    offer.baseCost * (1 - getSeraMerchantDiscountPercent(camp) / 100),
    1,
  )
}

export function getSeraTrustCost(currentTrust: number): number | null {
  if (currentTrust < 0 || currentTrust >= SERA_TRUST_COSTS.length) return null
  return SERA_TRUST_COSTS[currentTrust] ?? null
}

export interface CampRecipeDefinition {
  readonly id: CampRecipeId
  readonly name: string
  readonly baseDurationMs: number
  readonly ingredients: Readonly<CampMaterialInventory>
}

export const CAMP_RECIPE_DEFINITIONS: Readonly<Record<CampRecipeId, CampRecipeDefinition>> = Object.freeze({
  goldStew: Object.freeze({
    id: 'goldStew',
    name: '황금 스튜',
    baseDurationMs: 5 * 60 * 1_000,
    ingredients: Object.freeze({ ashShard: 10, beastHide: 4, emberCore: 0 }),
  }),
  focusTonic: Object.freeze({
    id: 'focusTonic',
    name: '집중 물약',
    baseDurationMs: 10 * 60 * 1_000,
    ingredients: Object.freeze({ ashShard: 6, beastHide: 2, emberCore: 1 }),
  }),
  healingPotion: Object.freeze({
    id: 'healingPotion',
    name: '회복 물약',
    baseDurationMs: 2 * 60 * 1_000,
    ingredients: Object.freeze({ ashShard: 4, beastHide: 2, emberCore: 0 }),
  }),
})

export function getCampHealingAshCost(state: GameState): number | null {
  const maxHp = getHeroStats(state).maxHp
  const missingHp = Math.max(0, maxHp - state.player.currentHp)
  if (missingHp === 0) return null
  return Math.min(
    CAMP_HEALING_MAX_ASH_COST,
    Math.max(1, Math.ceil((missingHp / maxHp) * CAMP_HEALING_MAX_ASH_COST)),
  )
}

export function getHealingPotionRecoveryAmount(state: GameState): number {
  return toSafeInteger(
    getHeroStats(state).maxHp * CAMP_HEALING_POTION_RECOVERY_RATIO,
    1,
  )
}

export function getCampMaterialYield(
  enemy: Pick<EnemyDefinition, 'assetId' | 'isBoss'>,
): CampMaterialInventory {
  return {
    ashShard: 1,
    beastHide: enemy.assetId === 'enemy.twilight-wolf' ? 1 : 0,
    emberCore: enemy.isBoss ? 1 : 0,
  }
}

export function getCampCraftDurationMs(
  camp: Pick<CampState, 'structures'>,
  recipeId: CampRecipeId,
): number {
  return toSafeInteger(
    CAMP_RECIPE_DEFINITIONS[recipeId].baseDurationMs *
      getCampWorkbenchDurationMultiplier(camp),
    1,
  )
}

const CAMP_TRAINING_COSTS = Object.freeze({
  attack: { base: 140, growth: 1.45 },
  vitality: { base: 160, growth: 1.45 },
} as const satisfies Readonly<Record<CampTrainingId, { base: number; growth: number }>>)

export function getCampStructureUpgradeCost(
  id: CampStructureId,
  currentLevel: number,
): number | null {
  if (currentLevel < 1 || currentLevel >= CAMP_STRUCTURE_MAX_LEVEL) return null
  return CAMP_STRUCTURE_UPGRADE_COSTS[id][currentLevel - 1] ?? null
}

export function getCampOfflineCapMs(camp: Pick<CampState, 'structures'>): number {
  const level = Math.min(
    CAMP_STRUCTURE_MAX_LEVEL,
    Math.max(1, Math.floor(camp.structures.tent)),
  )
  return CAMP_OFFLINE_CAP_HOURS[level - 1]! * HOUR_MS
}

export function getCampWorkbenchDurationMultiplier(
  camp: Pick<CampState, 'structures'>,
): number {
  const level = Math.min(
    CAMP_STRUCTURE_MAX_LEVEL,
    Math.max(1, Math.floor(camp.structures.workbench)),
  )
  return CAMP_WORKBENCH_DURATION_PERCENT[level - 1]! / 100
}

export function getCampTrainingRankCap(camp: Pick<CampState, 'structures'>): number {
  return camp.structures.trainingGround * CAMP_TRAINING_RANKS_PER_LEVEL
}

export function getCampTrainingCost(id: CampTrainingId, currentRank: number): number {
  const definition = CAMP_TRAINING_COSTS[id]
  return toSafeInteger(definition.base * definition.growth ** Math.max(0, currentRank), 1)
}

// Distinct from game/format.ts's formatDuration: camp countdowns (craft jobs,
// merchant refresh) always show minutes even at 0, matching existing display copy.
export function formatCampCountdown(milliseconds: number): string {
  const totalSeconds = Math.ceil(milliseconds / 1_000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}분 ${seconds}초`
}

export function getCampFacilityNextEffect(id: CampStructureId, level: number): string {
  const nextLevel = Math.min(CAMP_STRUCTURE_MAX_LEVEL, level + 1)
  if (id === 'tent') {
    return `오프라인 ${CAMP_OFFLINE_CAP_HOURS[level - 1]}시간 → ${CAMP_OFFLINE_CAP_HOURS[nextLevel - 1]}시간`
  }
  if (id === 'workbench') {
    return `제작 시간 ${CAMP_WORKBENCH_DURATION_PERCENT[level - 1]}% → ${CAMP_WORKBENCH_DURATION_PERCENT[nextLevel - 1]}%`
  }
  return `훈련 상한 ${level * 5} → ${nextLevel * 5} rank`
}

export function getCampFacilityCurrentEffect(id: CampStructureId, level: number): string {
  if (id === 'tent') return `오프라인 상한 ${CAMP_OFFLINE_CAP_HOURS[level - 1]}시간`
  if (id === 'workbench') return `제작 시간 ${CAMP_WORKBENCH_DURATION_PERCENT[level - 1]}%`
  return `훈련 상한 ${level * 5} rank`
}

export function createInitialCampState(): CampState {
  return {
    definitionVersion: CAMP_DEFINITION_VERSION,
    structures: {
      tent: 1,
      workbench: 1,
      trainingGround: 1,
    },
    training: {
      attack: 0,
      vitality: 0,
    },
    materials: {
      ashShard: 0,
      beastHide: 0,
      emberCore: 0,
    },
    consumables: {
      goldStew: 0,
      focusTonic: 0,
      healingPotion: 0,
    },
    quickConsumable: null,
    craftJob: null,
    buffs: {
      goldBoostRounds: 0,
      bossFocusStage: null,
    },
    merchant: {
      cycle: 0,
      refreshRemainingMs: CAMP_MERCHANT_REFRESH_MS,
      purchasedOfferMask: 0,
    },
    residents: {
      sera: {
        status: 'unmet',
        trust: 0,
      },
    },
    bond: createInitialCampBondState(),
  }
}
