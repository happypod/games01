import { describe, expect, it } from 'vitest'
import { CAMP_RECIPE_DEFINITIONS, createInitialCampState } from './camp'
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
import { SAVE_VERSION, type StorageLike } from './types'

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

describe('IRPG-418 schema6 camp persistence', () => {
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
