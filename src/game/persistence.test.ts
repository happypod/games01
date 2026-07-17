import { describe, expect, it } from 'vitest'
import legacySaveV1 from './fixtures/legacy-save-v1.json'
import { createInitialState } from './engine'
import {
  LEGACY_SAVE_KEY,
  SAVE_FORMAT_VERSION,
  SAVE_SLOT_A_KEY,
  SAVE_SLOT_B_KEY,
  SAVE_SLOT_KEYS,
  bootstrapGame,
  clearSave,
  parseSave,
  parseSaveEnvelope,
  saveGame,
  saveGameAtRevision,
} from './persistence'

class MemoryStorage {
  private values = new Map<string, string>()
  failNextWrite = false
  ignoreNextWrite = false
  truncateNextWrite = false
  failReadKey: string | null = null
  failReadAfterNextWrite = false
  private failNextReadKey: string | null = null
  failRemoveKey: string | null = null

  getItem(key: string) {
    if (this.failNextReadKey === key) {
      this.failNextReadKey = null
      throw new Error('simulated post-write read failure')
    }
    if (this.failReadKey === key) throw new Error('simulated read failure')
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string) {
    if (this.failNextWrite) {
      this.failNextWrite = false
      throw new Error('simulated write failure')
    }
    if (this.ignoreNextWrite) {
      this.ignoreNextWrite = false
      return
    }
    if (this.truncateNextWrite) {
      this.truncateNextWrite = false
      this.values.set(key, value.slice(0, Math.floor(value.length / 2)))
      return
    }
    this.values.set(key, value)
    if (this.failReadAfterNextWrite) {
      this.failReadAfterNextWrite = false
      this.failNextReadKey = key
    }
  }

  removeItem(key: string) {
    if (this.failRemoveKey === key) throw new Error('simulated remove failure')
    this.values.delete(key)
  }
}

function withGold(timestamp: number, gold: number) {
  const state = createInitialState(timestamp)
  state.player.gold = gold
  return state
}

describe('A/B game persistence', () => {
  it('alternates slots with monotonically increasing revisions', () => {
    const storage = new MemoryStorage()
    const first = withGold(100, 10)
    const second = withGold(200, 20)
    const third = withGold(300, 30)

    expect(saveGame(storage, first)).toBe(true)
    expect(saveGame(storage, second)).toBe(true)
    expect(saveGame(storage, third)).toBe(true)

    const slotA = parseSaveEnvelope(storage.getItem(SAVE_SLOT_A_KEY)!)
    const slotB = parseSaveEnvelope(storage.getItem(SAVE_SLOT_B_KEY)!)
    expect(slotA).toMatchObject({ formatVersion: SAVE_FORMAT_VERSION, revision: 3 })
    expect(slotB).toMatchObject({ formatVersion: SAVE_FORMAT_VERSION, revision: 2 })
    expect(slotA?.state.player.gold).toBe(30)
    expect(slotB?.state.player.gold).toBe(20)
  })

  it('rejects a stale expected revision without changing either slot', () => {
    const storage = new MemoryStorage()
    expect(saveGameAtRevision(storage, withGold(100, 10), null)).toEqual({
      status: 'saved',
      revision: 1,
    })
    const staleView = withGold(200, 20)
    expect(saveGameAtRevision(storage, withGold(300, 30), 1)).toEqual({
      status: 'saved',
      revision: 2,
    })
    const beforeA = storage.getItem(SAVE_SLOT_A_KEY)
    const beforeB = storage.getItem(SAVE_SLOT_B_KEY)

    expect(saveGameAtRevision(storage, staleView, 1)).toEqual({
      status: 'conflict',
      currentRevision: 2,
    })
    expect(storage.getItem(SAVE_SLOT_A_KEY)).toBe(beforeA)
    expect(storage.getItem(SAVE_SLOT_B_KEY)).toBe(beforeB)
  })

  it('loads reader snapshots without advancing time or writing a checkpoint', () => {
    const storage = new MemoryStorage()
    expect(saveGameAtRevision(storage, withGold(1_000, 10), null)).toMatchObject({ revision: 1 })
    const beforeA = storage.getItem(SAVE_SLOT_A_KEY)

    const reader = bootstrapGame(storage, 61_000, 'reader')

    expect(reader.state.player.gold).toBe(10)
    expect(reader.state.lastSavedAt).toBe(1_000)
    expect(reader.offlineReport).toBeNull()
    expect(reader.revision).toBe(1)
    expect(storage.getItem(SAVE_SLOT_A_KEY)).toBe(beforeA)
    expect(storage.getItem(SAVE_SLOT_B_KEY)).toBeNull()
  })

  it('blocks guarded writes when equal revisions contain divergent states', () => {
    const storage = new MemoryStorage()
    const left = withGold(100, 10)
    const right = withGold(200, 20)
    storage.setItem(
      SAVE_SLOT_A_KEY,
      JSON.stringify({ formatVersion: SAVE_FORMAT_VERSION, revision: 7, savedAt: 100, state: left }),
    )
    storage.setItem(
      SAVE_SLOT_B_KEY,
      JSON.stringify({ formatVersion: SAVE_FORMAT_VERSION, revision: 7, savedAt: 200, state: right }),
    )
    const beforeA = storage.getItem(SAVE_SLOT_A_KEY)
    const beforeB = storage.getItem(SAVE_SLOT_B_KEY)

    expect(saveGameAtRevision(storage, withGold(300, 30), 7)).toEqual({
      status: 'blocked',
      currentRevision: 7,
    })
    expect(storage.getItem(SAVE_SLOT_A_KEY)).toBe(beforeA)
    expect(storage.getItem(SAVE_SLOT_B_KEY)).toBe(beforeB)
  })

  it('loads the highest valid revision and immediately checkpoints offline progress', () => {
    const storage = new MemoryStorage()
    saveGame(storage, withGold(1_000, 10))
    saveGame(storage, withGold(2_000, 20))

    const first = bootstrapGame(storage, 12_000)
    expect(first.state.player.gold).toBeGreaterThan(20)
    expect(first.offlineReport?.elapsedMs).toBe(10_000)
    expect(first.saveHealthy).toBe(true)

    const second = bootstrapGame(storage, 12_000)
    expect(second.offlineReport).toBeNull()
    expect(second.state).toEqual(first.state)
  })

  it('falls back to the older slot when the newest slot is corrupt', () => {
    const storage = new MemoryStorage()
    const older = withGold(100, 10)
    saveGame(storage, older)
    saveGame(storage, withGold(200, 20))
    storage.setItem(SAVE_SLOT_B_KEY, '{corrupt')

    const result = bootstrapGame(storage, 100)
    expect(result.state.player.gold).toBe(10)
    expect(result.recoveredFromInvalidSave).toBe(true)
    expect(result.saveHealthy).toBe(true)
  })

  it('uses savedAt and then slot A as deterministic revision tie-breakers', () => {
    const storage = new MemoryStorage()
    const older = withGold(100, 10)
    const newer = withGold(200, 20)
    storage.setItem(
      SAVE_SLOT_A_KEY,
      JSON.stringify({ formatVersion: SAVE_FORMAT_VERSION, revision: 7, savedAt: 100, state: older }),
    )
    storage.setItem(
      SAVE_SLOT_B_KEY,
      JSON.stringify({ formatVersion: SAVE_FORMAT_VERSION, revision: 7, savedAt: 200, state: newer }),
    )

    const resolved = bootstrapGame(storage, 200)
    expect(resolved.state.player.gold).toBe(20)
    expect(resolved.recoveredFromInvalidSave).toBe(true)

    storage.setItem(
      SAVE_SLOT_A_KEY,
      JSON.stringify({ formatVersion: SAVE_FORMAT_VERSION, revision: 9, savedAt: 200, state: newer }),
    )
    storage.setItem(
      SAVE_SLOT_B_KEY,
      JSON.stringify({ formatVersion: SAVE_FORMAT_VERSION, revision: 9, savedAt: 200, state: newer }),
    )
    expect(bootstrapGame(storage, 200).saveHealthy).toBe(true)
    expect(parseSaveEnvelope(storage.getItem(SAVE_SLOT_B_KEY)!)?.revision).toBe(10)
  })

  it('migrates the checked-in v1 fixture to a verified v2 envelope', () => {
    const storage = new MemoryStorage()
    storage.setItem(LEGACY_SAVE_KEY, JSON.stringify(legacySaveV1))

    const result = bootstrapGame(storage, legacySaveV1.lastSavedAt)

    expect(result.state).toEqual(legacySaveV1)
    expect(result.recoveredFromInvalidSave).toBe(false)
    expect(result.saveHealthy).toBe(true)
    expect(storage.getItem(LEGACY_SAVE_KEY)).toBeNull()
    expect(parseSaveEnvelope(storage.getItem(SAVE_SLOT_A_KEY)!)).toMatchObject({
      formatVersion: SAVE_FORMAT_VERSION,
      revision: 1,
      state: { player: { gold: 87 } },
    })
  })

  it('preserves the previous valid slot when the next write fails', () => {
    const storage = new MemoryStorage()
    const stable = withGold(100, 10)
    expect(saveGame(storage, stable)).toBe(true)
    const stableRaw = storage.getItem(SAVE_SLOT_A_KEY)

    storage.failNextWrite = true
    expect(saveGame(storage, withGold(200, 999))).toBe(false)
    expect(storage.getItem(SAVE_SLOT_A_KEY)).toBe(stableRaw)
    expect(storage.getItem(SAVE_SLOT_B_KEY)).toBeNull()
    expect(bootstrapGame(storage, 100).state.player.gold).toBe(10)
  })

  it('detects a silent partial write by exact read-back verification', () => {
    const storage = new MemoryStorage()
    expect(saveGame(storage, withGold(100, 10))).toBe(true)
    storage.ignoreNextWrite = true

    expect(saveGame(storage, withGold(200, 999))).toBe(false)
    expect(parseSaveEnvelope(storage.getItem(SAVE_SLOT_A_KEY)!)?.state.player.gold).toBe(10)
    expect(storage.getItem(SAVE_SLOT_B_KEY)).toBeNull()
  })

  it('rolls back the target slot when read-back fails after a successful write', () => {
    const storage = new MemoryStorage()
    expect(saveGameAtRevision(storage, withGold(100, 10), null)).toMatchObject({ revision: 1 })
    const stableRaw = storage.getItem(SAVE_SLOT_A_KEY)
    storage.failReadAfterNextWrite = true

    expect(saveGameAtRevision(storage, withGold(200, 999), 1)).toEqual({
      status: 'blocked',
      currentRevision: 1,
    })
    expect(storage.getItem(SAVE_SLOT_A_KEY)).toBe(stableRaw)
    expect(storage.getItem(SAVE_SLOT_B_KEY)).toBeNull()
  })

  it('rolls back a truncated target write without mutating the winner', () => {
    const storage = new MemoryStorage()
    expect(saveGame(storage, withGold(100, 10))).toBe(true)
    const winnerRaw = storage.getItem(SAVE_SLOT_A_KEY)
    storage.truncateNextWrite = true

    expect(saveGame(storage, withGold(200, 999))).toBe(false)
    expect(storage.getItem(SAVE_SLOT_A_KEY)).toBe(winnerRaw)

    const recovered = bootstrapGame(storage, 100)
    expect(recovered.state.player.gold).toBe(10)
    expect(recovered.recoveredFromInvalidSave).toBe(false)
  })

  it('preserves a valid legacy save when migration writing fails and retries idempotently', () => {
    const storage = new MemoryStorage()
    const rawLegacy = JSON.stringify(legacySaveV1)
    storage.setItem(LEGACY_SAVE_KEY, rawLegacy)
    storage.failNextWrite = true

    const failed = bootstrapGame(storage, legacySaveV1.lastSavedAt)
    expect(failed.saveHealthy).toBe(false)
    expect(storage.getItem(LEGACY_SAVE_KEY)).toBe(rawLegacy)
    expect(storage.getItem(SAVE_SLOT_A_KEY)).toBeNull()

    const retried = bootstrapGame(storage, legacySaveV1.lastSavedAt)
    expect(retried.saveHealthy).toBe(true)
    expect(retried.state.player.gold).toBe(87)
    expect(storage.getItem(LEGACY_SAVE_KEY)).toBeNull()
  })

  it('never overwrites a save written by a future client', () => {
    const storage = new MemoryStorage()
    const futureRaw = JSON.stringify({ formatVersion: 3, revision: 99, state: { future: true } })
    storage.setItem(SAVE_SLOT_A_KEY, futureRaw)

    const result = bootstrapGame(storage, 500)
    expect(result.saveHealthy).toBe(false)
    expect(result.recoveredFromInvalidSave).toBe(true)
    expect(saveGame(storage, createInitialState(500))).toBe(false)
    expect(storage.getItem(SAVE_SLOT_A_KEY)).toBe(futureRaw)
    expect(storage.getItem(SAVE_SLOT_B_KEY)).toBeNull()
  })

  it('blocks the session when any slot cannot be read', () => {
    const storage = new MemoryStorage()
    expect(saveGame(storage, withGold(100, 777))).toBe(true)
    const stableRaw = storage.getItem(SAVE_SLOT_A_KEY)
    storage.failReadKey = SAVE_SLOT_A_KEY

    const result = bootstrapGame(storage, 500)
    expect(result.saveBlocked).toBe(true)
    expect(result.saveHealthy).toBe(false)
    expect(storage.getItem(SAVE_SLOT_B_KEY)).toBeNull()
    storage.failReadKey = null
    expect(storage.getItem(SAVE_SLOT_A_KEY)).toBe(stableRaw)
  })

  it('refuses revision overflow without touching either slot', () => {
    const storage = new MemoryStorage()
    const state = withGold(100, 10)
    const raw = JSON.stringify({
      formatVersion: SAVE_FORMAT_VERSION,
      revision: Number.MAX_SAFE_INTEGER,
      savedAt: state.lastSavedAt,
      state,
    })
    storage.setItem(SAVE_SLOT_A_KEY, raw)

    expect(saveGame(storage, withGold(200, 999))).toBe(false)
    expect(storage.getItem(SAVE_SLOT_A_KEY)).toBe(raw)
    expect(storage.getItem(SAVE_SLOT_B_KEY)).toBeNull()
  })

  it('rejects malformed states and mismatched envelope timestamps', () => {
    expect(parseSave('{broken')).toBeNull()
    expect(parseSave(JSON.stringify({ schemaVersion: 1 }))).toBeNull()

    const state = createInitialState(100)
    expect(
      parseSaveEnvelope(
        JSON.stringify({ formatVersion: SAVE_FORMAT_VERSION, revision: 1, savedAt: 99, state }),
      ),
    ).toBeNull()
  })

  it('clears legacy and both A/B slots', () => {
    const storage = new MemoryStorage()
    storage.setItem(LEGACY_SAVE_KEY, JSON.stringify(legacySaveV1))
    saveGame(storage, createInitialState(0))
    storage.setItem(SAVE_SLOT_B_KEY, storage.getItem(SAVE_SLOT_A_KEY)!)

    expect(clearSave(storage)).toBe(true)
    expect(SAVE_SLOT_KEYS.every((key) => storage.getItem(key) === null)).toBe(true)
    expect(storage.getItem(LEGACY_SAVE_KEY)).toBeNull()
  })

  it('continues clearing the remaining keys after one removal fails', () => {
    const storage = new MemoryStorage()
    storage.setItem(LEGACY_SAVE_KEY, JSON.stringify(legacySaveV1))
    storage.setItem(SAVE_SLOT_A_KEY, 'a')
    storage.setItem(SAVE_SLOT_B_KEY, 'b')
    storage.failRemoveKey = SAVE_SLOT_A_KEY

    expect(clearSave(storage)).toBe(false)
    expect(storage.getItem(LEGACY_SAVE_KEY)).toBeNull()
    expect(storage.getItem(SAVE_SLOT_A_KEY)).toBe('a')
    expect(storage.getItem(SAVE_SLOT_B_KEY)).toBeNull()
  })
})
