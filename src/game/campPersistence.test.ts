import { describe, expect, it } from 'vitest'
import legacySaveV6 from './fixtures/legacy-save-v6.json'
import legacySaveV7 from './fixtures/legacy-save-v7.json'
import {
  CAMP_RECIPE_DEFINITIONS,
  createInitialCampBondState,
  createInitialCampState,
} from './camp'
import { advanceOfflineGame, createInitialState, switchGameMode } from './engine'
import { deriveLegacyExpeditionMilestoneMask } from './expedition'
import {
  SAVE_SLOT_KEYS,
  bootstrapGame,
  decodeGameState,
  isFutureGameStateValue,
  parseSaveEnvelope,
  saveGameAtRevision,
} from './persistence'
import { SAVE_VERSION, type GameState, type StorageLike } from './types'

class MemoryStorage implements StorageLike {
  readonly values = new Map<string, string>()

  getItem(key: string) {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string) {
    this.values.set(key, value)
  }

  removeItem(key: string) {
    this.values.delete(key)
  }
}

function asLegacySchema6(state: GameState) {
  const current = structuredClone(state)
  const { healingPotion: _healingPotion, ...legacyConsumables } = current.camp.consumables
  const {
    quickConsumable: _quickConsumable,
    bond: _bond,
    ...legacyCamp
  } = current.camp
  void _healingPotion
  void _quickConsumable
  void _bond
  return {
    ...current,
    schemaVersion: 6 as const,
    camp: {
      ...legacyCamp,
      definitionVersion: 1 as const,
      consumables: legacyConsumables,
    },
  }
}

function asLegacySchema7(state: GameState) {
  const current = structuredClone(state)
  const { bond: _bond, ...legacyCamp } = current.camp
  void _bond
  return {
    ...current,
    schemaVersion: 7 as const,
    camp: {
      ...legacyCamp,
      definitionVersion: 2 as const,
    },
  }
}

describe('IRPG-418 schema6 camp persistence', () => {
  it('migrates the checked-in schema6 fixture with only new recovery defaults', () => {
    const migrated = decodeGameState(legacySaveV6)

    expect(migrated).not.toBeNull()
    expect(migrated).toMatchObject({
      schemaVersion: SAVE_VERSION,
      lastSavedAt: 123,
      currentMode: 'CAMP',
      rng: legacySaveV6.rng,
      player: { gold: 456, currentHp: 75 },
      battle: { powerStrikeCooldownMs: 2_500 },
      camp: {
        definitionVersion: 3,
        structures: legacySaveV6.camp.structures,
        training: legacySaveV6.camp.training,
        materials: legacySaveV6.camp.materials,
        consumables: { goldStew: 3, focusTonic: 2, healingPotion: 0 },
        quickConsumable: null,
        craftJob: legacySaveV6.camp.craftJob,
        buffs: legacySaveV6.camp.buffs,
        merchant: legacySaveV6.camp.merchant,
        residents: legacySaveV6.camp.residents,
        bond: createInitialCampBondState(),
      },
    })
  })

  it('migrates schema6 camp v1 without drifting its existing deterministic ledgers', () => {
    const current = createInitialState(123, 0x4230_1001)
    current.currentMode = 'CAMP'
    current.player.gold = 456
    current.camp.structures = { tent: 4, workbench: 3, trainingGround: 2 }
    current.camp.training = { attack: 7, vitality: 6 }
    current.camp.materials = { ashShard: 17, beastHide: 8, emberCore: 2 }
    current.camp.consumables = { goldStew: 3, focusTonic: 2, healingPotion: 99 }
    current.camp.quickConsumable = 'healingPotion'
    current.camp.craftJob = { recipeId: 'goldStew', remainingMs: 12_345 }
    current.camp.buffs = { goldBoostRounds: 321, bossFocusStage: 0 }
    current.camp.merchant = {
      cycle: 4,
      refreshRemainingMs: 123_456,
      purchasedOfferMask: 5,
    }
    current.camp.residents.sera = { status: 'contracted', trust: 3 }
    const legacy = asLegacySchema6(current)

    const migrated = decodeGameState(legacy)

    expect(migrated).not.toBeNull()
    expect(migrated).toEqual({
      ...current,
      schemaVersion: SAVE_VERSION,
      camp: {
        ...current.camp,
        definitionVersion: 3,
        consumables: { goldStew: 3, focusTonic: 2, healingPotion: 0 },
        quickConsumable: null,
      },
    })
  })

  it('migrates the checked-in schema7 fixture by adding only Chapter I bond defaults', () => {
    const migrated = decodeGameState(legacySaveV7)

    expect(migrated).not.toBeNull()
    expect(migrated).toEqual({
      ...legacySaveV7,
      schemaVersion: SAVE_VERSION,
      camp: {
        ...legacySaveV7.camp,
        definitionVersion: 3,
        bond: createInitialCampBondState(),
      },
    })
  })

  it('keeps schema7 migration in memory for readers and checkpoints schema8 only for writers', () => {
    const storage = new MemoryStorage()
    storage.setItem(SAVE_SLOT_KEYS[0], JSON.stringify({
      formatVersion: 3,
      revision: 7,
      savedAt: legacySaveV7.lastSavedAt,
      state: legacySaveV7,
    }))

    const reader = bootstrapGame(storage, legacySaveV7.lastSavedAt, 'reader')
    expect(reader.state.schemaVersion).toBe(SAVE_VERSION)
    expect(reader.state.camp.definitionVersion).toBe(3)
    expect(reader.state.camp.bond).toEqual(createInitialCampBondState())
    expect(reader.state.camp.materials).toEqual(legacySaveV7.camp.materials)
    expect(reader.state.camp.consumables).toEqual(legacySaveV7.camp.consumables)
    expect(reader.state.camp.craftJob).toEqual(legacySaveV7.camp.craftJob)
    expect(reader.state.rng).toEqual(legacySaveV7.rng)
    expect(reader.revision).toBe(7)
    expect(storage.getItem(SAVE_SLOT_KEYS[1])).toBeNull()

    const writer = bootstrapGame(storage, legacySaveV7.lastSavedAt, 'writer')
    expect(writer.revision).toBe(8)
    expect(parseSaveEnvelope(storage.getItem(SAVE_SLOT_KEYS[1]) ?? '')?.state)
      .toEqual(writer.state)
  })

  it('keeps schema6 migration in memory for readers and checkpoints schema8 only for writers', () => {
    const storage = new MemoryStorage()
    const current = createInitialState(500, 0x4230_1002)
    current.currentMode = 'CAMP'
    current.camp.materials.ashShard = 12
    current.camp.consumables.goldStew = 2
    const legacy = asLegacySchema6(current)
    storage.setItem(SAVE_SLOT_KEYS[0], JSON.stringify({
      formatVersion: 3,
      revision: 7,
      savedAt: 500,
      state: legacy,
    }))

    const reader = bootstrapGame(storage, 500, 'reader')
    expect(reader.state).toMatchObject({
      schemaVersion: SAVE_VERSION,
      currentMode: 'CAMP',
      camp: {
        definitionVersion: 3,
        materials: { ashShard: 12 },
        consumables: { goldStew: 2, healingPotion: 0 },
        quickConsumable: null,
        bond: createInitialCampBondState(),
      },
    })
    expect(reader.revision).toBe(7)
    expect(storage.getItem(SAVE_SLOT_KEYS[1])).toBeNull()

    const writer = bootstrapGame(storage, 500, 'writer')
    expect(writer.revision).toBe(8)
    expect(parseSaveEnvelope(storage.getItem(SAVE_SLOT_KEYS[1]) ?? '')?.state)
      .toEqual(writer.state)
  })

  it('migrates schema5 without retroactive camp progress', () => {
    const current = createInitialState(123, 0x4180_0010)
    current.player.gold = 456
    const { currentMode: _mode, camp: _camp, ...legacyFields } = current
    void _mode
    void _camp
    const legacy = { ...legacyFields, schemaVersion: 5 }

    const migrated = decodeGameState(legacy)

    expect(migrated).not.toBeNull()
    expect(migrated).toMatchObject({
      schemaVersion: SAVE_VERSION,
      currentMode: 'BATTLE',
      player: { gold: 456 },
      battle: { highestStage: 1 },
    })
    expect(migrated?.camp).toEqual(createInitialCampState())
  })

  it('checkpoints offline progress once while preserving a saved camp mode', () => {
    const storage = new MemoryStorage()
    const initial = createInitialState(0, 0x4180_0011)
    const camp = switchGameMode(initial, 'CAMP').state
    camp.camp.craftJob = { recipeId: 'goldStew', remainingMs: 60_000 }
    expect(saveGameAtRevision(storage, camp, null)).toEqual({ status: 'saved', revision: 1 })
    const expected = advanceOfflineGame(camp, 60_000)

    const first = bootstrapGame(storage, 60_000, 'writer')

    expect(first.state).toEqual({ ...expected.state, lastSavedAt: 60_000 })
    expect(first.state.currentMode).toBe('CAMP')
    expect(first.state.camp.craftJob).toBeNull()
    expect(first.state.camp.consumables.goldStew).toBe(1)
    expect(first.offlineReport).toEqual(expected.report)
    expect(first.revision).toBe(2)

    const second = bootstrapGame(storage, 60_000, 'writer')
    expect(second.state).toEqual(first.state)
    expect(second.offlineReport).toBeNull()
    expect(second.revision).toBe(3)
  })

  it('keeps schema5 migration in memory for readers and checkpoints only for writers', () => {
    const storage = new MemoryStorage()
    const current = createInitialState(500, 0x4180_0012)
    const { currentMode: _mode, camp: _camp, ...legacyFields } = current
    void _mode
    void _camp
    const legacyState = { ...legacyFields, schemaVersion: 5 }
    storage.setItem(SAVE_SLOT_KEYS[0], JSON.stringify({
      formatVersion: 3,
      revision: 7,
      savedAt: 500,
      state: legacyState,
    }))

    const reader = bootstrapGame(storage, 500, 'reader')
    expect(reader.state.schemaVersion).toBe(SAVE_VERSION)
    expect(reader.state.camp).toEqual(createInitialCampState())
    expect(storage.getItem(SAVE_SLOT_KEYS[1])).toBeNull()

    const writer = bootstrapGame(storage, 500, 'writer')
    expect(writer.revision).toBe(8)
    expect(parseSaveEnvelope(storage.getItem(SAVE_SLOT_KEYS[1]) ?? '')?.state)
      .toEqual(writer.state)
  })

  it('classifies a future camp definition as future data', () => {
    const future = createInitialState(0, 0x4180_0013)
    future.camp.definitionVersion += 1
    expect(isFutureGameStateValue(future)).toBe(true)
  })

  it('preserves the schema6 future-definition fence after schema8 becomes current', () => {
    const future = asLegacySchema6(createInitialState(0, 0x4230_1003))
    ;(future.camp as { definitionVersion: number }).definitionVersion = 2
    expect(isFutureGameStateValue(future)).toBe(true)
    expect(decodeGameState(future)).toBeNull()
  })

  it('preserves the schema7 future-definition fence after schema8 becomes current', () => {
    const future = asLegacySchema7(createInitialState(0, 0x4260_1001))
    ;(future.camp as { definitionVersion: number }).definitionVersion = 3
    expect(isFutureGameStateValue(future)).toBe(true)
    expect(decodeGameState(future)).toBeNull()
  })

  it('classifies a higher bond definition as future but keeps missing/lower markers invalid', () => {
    const future = createInitialState(0, 0x4260_1002)
    future.camp.bond.definitionVersion = 2
    expect(isFutureGameStateValue(future)).toBe(true)
    expect(decodeGameState(future)).toBeNull()

    const missing = structuredClone(createInitialState(0, 0x4260_1003)) as unknown as {
      camp: { bond?: unknown }
    }
    delete missing.camp.bond
    expect(isFutureGameStateValue(missing)).toBe(false)
    expect(decodeGameState(missing)).toBeNull()

    const lower = createInitialState(0, 0x4260_1004)
    lower.camp.bond.definitionVersion = 0
    expect(isFutureGameStateValue(lower)).toBe(false)
    expect(decodeGameState(lower)).toBeNull()
  })

  it('rejects impossible consent, Chapter II/III costume IDs, and invalid masks', () => {
    const invalid = [
      (() => {
        const state = createInitialState(0, 0x4260_1010)
        state.camp.bond.seraConsent = 'granted'
        return state
      })(),
      (() => {
        const state = createInitialState(0, 0x4260_1011)
        state.camp.residents.sera = { status: 'contracted', trust: 0 }
        state.camp.bond.seraConsent = 'granted'
        return state
      })(),
      (() => {
        const state = createInitialState(0, 0x4260_1012) as unknown as {
          camp: { bond: { currentCostumeId: string } }
        }
        state.camp.bond.currentCostumeId = 'chapter2.sera.field'
        return state
      })(),
      (() => {
        const state = createInitialState(0, 0x4260_1013) as unknown as {
          camp: { bond: { currentCostumeId: string } }
        }
        state.camp.bond.currentCostumeId = 'chapter3.sera.field'
        return state
      })(),
      (() => {
        const state = createInitialState(0, 0x4260_1014)
        state.camp.bond.unlockedCostumeMask = 0
        return state
      })(),
      (() => {
        const state = createInitialState(0, 0x4260_1015)
        state.camp.bond.claimedSynthesisRewardMask = 2
        return state
      })(),
    ]

    for (const state of invalid) expect(decodeGameState(state)).toBeNull()
  })

  it('rejects a missing or unsupported quick consumable in schema8', () => {
    const missing = structuredClone(createInitialState(0, 0x4230_1004)) as unknown as {
      camp: { quickConsumable?: unknown }
    }
    delete missing.camp.quickConsumable
    expect(decodeGameState(missing)).toBeNull()

    const unsupported = structuredClone(createInitialState(0, 0x4230_1005)) as unknown as {
      camp: { quickConsumable: unknown }
    }
    unsupported.camp.quickConsumable = 'focusTonic'
    expect(decodeGameState(unsupported)).toBeNull()
  })

  it('rejects a non-string resident status instead of coercing malformed data', () => {
    const malformed = structuredClone(createInitialState(0, 0x4180_0014)) as unknown as {
      camp: { residents: { sera: { status: unknown } } }
    }
    malformed.camp.residents.sera.status = ['unmet']

    expect(decodeGameState(malformed)).toBeNull()
  })

  it('rejects training ranks above the saved training-ground capacity', () => {
    const malformed = createInitialState(0, 0x4190_0010)
    malformed.camp.structures.trainingGround = 1
    malformed.camp.training.attack = 6

    expect(decodeGameState(malformed)).toBeNull()
  })

  it('rejects a craft timer longer than the recipe can legally start with', () => {
    const malformed = createInitialState(0, 0x4200_0010)
    malformed.camp.craftJob = {
      recipeId: 'goldStew',
      remainingMs: CAMP_RECIPE_DEFINITIONS.goldStew.baseDurationMs + 1,
    }

    expect(decodeGameState(malformed)).toBeNull()
  })

  it('rejects a bound focus buff that does not match the active boss battle', () => {
    const malformed = createInitialState(0, 0x4200_0011)
    malformed.camp.buffs.bossFocusStage = 10

    expect(decodeGameState(malformed)).toBeNull()

    const valid = {
      ...malformed,
      battle: { ...malformed.battle, stage: 10, highestStage: 10 },
      expeditionEvents: {
        ...malformed.expeditionEvents,
        milestoneMask: deriveLegacyExpeditionMilestoneMask(10),
      },
    }
    expect(decodeGameState(valid)).not.toBeNull()
  })
})
