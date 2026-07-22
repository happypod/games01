import { createRngState, nextRandom, seedFromText } from './rng'
import type { RegisteredItemId } from './itemRegistry'

export const EQUIPMENT_LOOT_DEFINITION_VERSION = 'equipment-loot-v1' as const

export interface EquipmentLootPoolDefinition {
  readonly dropChanceBasisPoints: number
  readonly itemIds: readonly RegisteredItemId[]
}

export interface EquipmentLootRegistryDefinition {
  readonly definitionVersion: typeof EQUIPMENT_LOOT_DEFINITION_VERSION
  readonly regular: EquipmentLootPoolDefinition
  readonly boss: EquipmentLootPoolDefinition
}

export interface LootEncounterIdentity {
  readonly gameSeed: number
  readonly enemyDefeatOrdinal: number
  readonly stage: number
  readonly isBoss: boolean
}

const REGULAR_ITEM_IDS = Object.freeze([
  'weapon.novice-sword',
  'armor.novice-vest',
  'helmet.novice-helm',
  'accessory.novice-ring',
] as const satisfies readonly RegisteredItemId[])

const BOSS_ITEM_IDS = Object.freeze([
  'weapon.ember-blade',
  'armor.guard-armor',
  'accessory.fortune-charm',
] as const satisfies readonly RegisteredItemId[])

export const EQUIPMENT_LOOT_REGISTRY: EquipmentLootRegistryDefinition = Object.freeze({
  definitionVersion: EQUIPMENT_LOOT_DEFINITION_VERSION,
  regular: Object.freeze({
    dropChanceBasisPoints: 1_500,
    itemIds: REGULAR_ITEM_IDS,
  }),
  boss: Object.freeze({
    dropChanceBasisPoints: 10_000,
    itemIds: BOSS_ITEM_IDS,
  }),
})

/**
 * Rolls equipment on an isolated substream derived only from the immutable
 * encounter identity. The caller's combat RNG is never read or advanced.
 */
export function rollEnemyEquipmentLoot(
  encounter: LootEncounterIdentity,
): RegisteredItemId | null {
  const pool = encounter.isBoss
    ? EQUIPMENT_LOOT_REGISTRY.boss
    : EQUIPMENT_LOOT_REGISTRY.regular
  const lootSeed = seedFromText(
    `loot:${encounter.gameSeed}:${encounter.enemyDefeatOrdinal}:${encounter.stage}:${encounter.isBoss ? 1 : 0}`,
  )
  const dropDraw = nextRandom(createRngState(lootSeed))
  const drops = encounter.isBoss || dropDraw.value < pool.dropChanceBasisPoints / 10_000
  if (!drops) return null

  const itemDraw = encounter.isBoss ? dropDraw : nextRandom(dropDraw.rng)
  const itemIndex = Math.min(
    Math.floor(itemDraw.value * pool.itemIds.length),
    pool.itemIds.length - 1,
  )
  return pool.itemIds[itemIndex] ?? null
}
