import {
  INVENTORY_DEFINITION_VERSION,
  type InventoryState,
  type PlayerEquippedState,
  type SkillSlotState,
} from './types'

/**
 * Pure schema defaults shared by the engine and persistence migrations.
 * Keeping these constructors free of engine imports prevents a runtime
 * engine <-> persistence dependency cycle.
 */
export function createInitialInventoryState(): InventoryState {
  return {
    definitionVersion: INVENTORY_DEFINITION_VERSION,
    lootBag: {},
    heroInventory: {},
    campStorage: {},
  }
}

export function createInitialPlayerEquippedState(): PlayerEquippedState {
  return {
    weapon: null,
    armor: null,
    helmet: null,
    accessory: null,
  }
}

export function createInitialSkillSlotsState(): SkillSlotState {
  return ['powerStrike', null, null]
}
