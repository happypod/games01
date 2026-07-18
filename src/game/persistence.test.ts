import { describe, expect, it } from 'vitest'
import legacySaveV1 from './fixtures/legacy-save-v1.json'
import legacySaveV2 from './fixtures/legacy-save-v2.json'
import { advanceGame, createInitialState } from './engine'
import {
  LEGACY_SAVE_KEY,
  LEGACY_SAVE_FORMAT_VERSION,
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
import { SAVE_VERSION } from './types'

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
  it('does not persist or replay the non-persistent combat event stream', () => {
    const storage = new MemoryStorage()
    const advanced = advanceGame(createInitialState(0, 1), 1_000, '99')

    expect(advanced.events.length).toBeGreaterThan(0)
    expect(saveGameAtRevision(storage, advanced.state, null)).toMatchObject({
      status: 'saved',
      revision: 1,
    })
    const raw = storage.getItem(SAVE_SLOT_A_KEY)
    expect(raw).not.toBeNull()
    expect(raw).not.toContain('"events"')
    expect(raw).not.toContain('"nextCursor"')

    const reloaded = bootstrapGame(storage, 0, 'reader')
    expect(reloaded.state).toEqual(advanced.state)
    expect(reloaded.offlineReport).toBeNull()

    const resumed = bootstrapGame(storage, 60_000, 'writer')
    expect(resumed.offlineReport).toMatchObject({ elapsedMs: 60_000, rounds: 60 })
    for (const key of SAVE_SLOT_KEYS) {
      const envelope = storage.getItem(key)
      if (envelope === null) continue
      expect(envelope).not.toContain('"events"')
      expect(envelope).not.toContain('"nextCursor"')
    }
  })

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

  it('does not treat equivalent mixed-schema states as a conflicting revision tie', () => {
    const storage = new MemoryStorage()
    const migrated = parseSave(JSON.stringify(legacySaveV2))!
    const reordered = {
      schemaVersion: migrated.schemaVersion,
      lastSavedAt: migrated.lastSavedAt,
      rng: { ...migrated.rng },
      player: {
        companion: { ...migrated.player.companion },
        level: migrated.player.level,
        xp: migrated.player.xp,
        gold: migrated.player.gold,
        essence: migrated.player.essence,
        currentHp: migrated.player.currentHp,
        skillPoints: migrated.player.skillPoints,
        upgrades: { ...migrated.player.upgrades },
        skills: { ...migrated.player.skills },
      },
      battle: {
        companionCooldownMs: migrated.battle.companionCooldownMs,
        stage: migrated.battle.stage,
        highestStage: migrated.battle.highestStage,
        enemyHp: migrated.battle.enemyHp,
        roundRemainderMs: migrated.battle.roundRemainderMs,
        powerStrikeCooldownMs: migrated.battle.powerStrikeCooldownMs,
        kills: migrated.battle.kills,
        defeats: migrated.battle.defeats,
      },
      stats: { ...migrated.stats },
    }
    storage.setItem(
      SAVE_SLOT_A_KEY,
      JSON.stringify({
        formatVersion: SAVE_FORMAT_VERSION,
        revision: 7,
        savedAt: legacySaveV2.lastSavedAt,
        state: legacySaveV2,
      }),
    )
    storage.setItem(
      SAVE_SLOT_B_KEY,
      JSON.stringify({
        formatVersion: SAVE_FORMAT_VERSION,
        revision: 7,
        savedAt: migrated.lastSavedAt,
        state: reordered,
      }),
    )

    expect(saveGameAtRevision(storage, migrated, 7)).toEqual({
      status: 'saved',
      revision: 8,
    })
    expect(parseSaveEnvelope(storage.getItem(SAVE_SLOT_B_KEY)!)).toMatchObject({
      revision: 8,
      state: migrated,
    })
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

  it('migrates the checked-in v1 fixture to a verified v3 envelope with a stable RNG', () => {
    const storage = new MemoryStorage()
    storage.setItem(LEGACY_SAVE_KEY, JSON.stringify(legacySaveV1))

    const result = bootstrapGame(storage, legacySaveV1.lastSavedAt)

    const { schemaVersion, rng, ...migratedFields } = result.state
    expect(schemaVersion).toBe(SAVE_VERSION)
    expect(migratedFields).toEqual({
      lastSavedAt: legacySaveV1.lastSavedAt,
      player: {
        ...legacySaveV1.player,
        companion: { id: null, rank: 0 },
      },
      battle: {
        ...legacySaveV1.battle,
        companionCooldownMs: 0,
      },
      stats: legacySaveV1.stats,
    })
    expect(rng).toEqual({
      algorithm: 'xorshift32-v1',
      seed: 873835004,
      state: 873835004,
      draws: 0,
    })
    expect(result.recoveredFromInvalidSave).toBe(false)
    expect(result.saveHealthy).toBe(true)
    expect(storage.getItem(LEGACY_SAVE_KEY)).toBeNull()
    expect(parseSaveEnvelope(storage.getItem(SAVE_SLOT_A_KEY)!)).toMatchObject({
      formatVersion: SAVE_FORMAT_VERSION,
      revision: 1,
      state: { player: { gold: 87 } },
    })
  })

  it('derives the same migration seed regardless of legacy object key order', () => {
    const canonical = parseSave(JSON.stringify(legacySaveV1))
    const reordered = {
      stats: { ...legacySaveV1.stats },
      battle: { ...legacySaveV1.battle },
      player: {
        ...legacySaveV1.player,
        skills: {
          fortune: legacySaveV1.player.skills.fortune,
          ironWill: legacySaveV1.player.skills.ironWill,
          powerStrike: legacySaveV1.player.skills.powerStrike,
        },
        upgrades: {
          charm: legacySaveV1.player.upgrades.charm,
          armor: legacySaveV1.player.upgrades.armor,
          weapon: legacySaveV1.player.upgrades.weapon,
        },
      },
      lastSavedAt: legacySaveV1.lastSavedAt,
      schemaVersion: 1,
      ignoredByV1: 'does not affect the seed',
    }

    expect(parseSave(JSON.stringify(reordered))?.rng.seed).toBe(canonical?.rng.seed)
  })

  it('reads a v2/schema1 envelope without writing and checkpoints v3 only as writer', () => {
    const storage = new MemoryStorage()
    const legacyEnvelope = JSON.stringify({
      formatVersion: LEGACY_SAVE_FORMAT_VERSION,
      revision: 7,
      savedAt: legacySaveV1.lastSavedAt,
      state: legacySaveV1,
    })
    storage.setItem(SAVE_SLOT_A_KEY, legacyEnvelope)

    const reader = bootstrapGame(storage, legacySaveV1.lastSavedAt, 'reader')
    expect(reader.state).toMatchObject({ schemaVersion: SAVE_VERSION, rng: { draws: 0 } })
    expect(reader.revision).toBe(7)
    expect(storage.getItem(SAVE_SLOT_A_KEY)).toBe(legacyEnvelope)
    expect(storage.getItem(SAVE_SLOT_B_KEY)).toBeNull()

    const writer = bootstrapGame(storage, legacySaveV1.lastSavedAt)
    expect(writer.saveHealthy).toBe(true)
    expect(parseSaveEnvelope(storage.getItem(SAVE_SLOT_B_KEY)!)).toMatchObject({
      formatVersion: SAVE_FORMAT_VERSION,
      revision: 8,
      state: { schemaVersion: SAVE_VERSION, rng: { draws: 0 } },
    })
    expect(storage.getItem(SAVE_SLOT_A_KEY)).toBe(legacyEnvelope)
  })

  it('migrates schema2 without changing its saved RNG sequence', () => {
    const migrated = parseSave(JSON.stringify(legacySaveV2))

    expect(migrated).toEqual({
      ...legacySaveV2,
      schemaVersion: SAVE_VERSION,
      rng: legacySaveV2.rng,
      player: {
        ...legacySaveV2.player,
        companion: { id: null, rank: 0 },
      },
      battle: {
        ...legacySaveV2.battle,
        companionCooldownMs: 0,
      },
    })
  })

  it('reads a format3/schema2 A/B winner and checkpoints schema3 only as writer', () => {
    const storage = new MemoryStorage()
    const legacyEnvelope = JSON.stringify({
      formatVersion: SAVE_FORMAT_VERSION,
      revision: 12,
      savedAt: legacySaveV2.lastSavedAt,
      state: legacySaveV2,
    })
    storage.setItem(SAVE_SLOT_A_KEY, legacyEnvelope)

    const reader = bootstrapGame(storage, legacySaveV2.lastSavedAt, 'reader')
    expect(reader).toMatchObject({
      state: {
        schemaVersion: SAVE_VERSION,
        rng: legacySaveV2.rng,
        player: { companion: { id: null, rank: 0 } },
        battle: { companionCooldownMs: 0 },
      },
      revision: 12,
      saveBlocked: false,
    })
    expect(storage.getItem(SAVE_SLOT_A_KEY)).toBe(legacyEnvelope)
    expect(storage.getItem(SAVE_SLOT_B_KEY)).toBeNull()

    const writer = bootstrapGame(storage, legacySaveV2.lastSavedAt)
    expect(writer.saveHealthy).toBe(true)
    expect(parseSaveEnvelope(storage.getItem(SAVE_SLOT_B_KEY)!)).toMatchObject({
      formatVersion: SAVE_FORMAT_VERSION,
      revision: 13,
      state: {
        schemaVersion: SAVE_VERSION,
        rng: legacySaveV2.rng,
        player: { companion: { id: null, rank: 0 } },
        battle: { companionCooldownMs: 0 },
      },
    })
    expect(storage.getItem(SAVE_SLOT_A_KEY)).toBe(legacyEnvelope)
  })

  it('resumes a saved RNG sequence identically through offline bootstrap', () => {
    const initial = createInitialState(0, 0x12345678)
    const midpoint = advanceGame(initial, 7_000).state
    midpoint.lastSavedAt = 7_000
    const storage = new MemoryStorage()
    expect(saveGameAtRevision(storage, midpoint, null)).toMatchObject({ revision: 1 })

    const resumed = bootstrapGame(storage, 20_000)
    const uninterrupted = advanceGame(initial, 20_000).state
    uninterrupted.lastSavedAt = 20_000

    expect(resumed.state).toEqual(uninterrupted)
    expect(resumed.offlineReport?.criticalHits).toBe(
      advanceGame(midpoint, 13_000).report.criticalHits,
    )
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
    const futureRaw = JSON.stringify({
      formatVersion: SAVE_FORMAT_VERSION + 1,
      revision: 99,
      state: { future: true },
    })
    storage.setItem(SAVE_SLOT_A_KEY, futureRaw)

    const result = bootstrapGame(storage, 500)
    expect(result.saveHealthy).toBe(false)
    expect(result.recoveredFromInvalidSave).toBe(true)
    expect(saveGame(storage, createInitialState(500))).toBe(false)
    expect(storage.getItem(SAVE_SLOT_A_KEY)).toBe(futureRaw)
    expect(storage.getItem(SAVE_SLOT_B_KEY)).toBeNull()
  })

  it('blocks future state schemas inside known envelopes and the legacy raw key', () => {
    const futureState = { ...createInitialState(100), schemaVersion: SAVE_VERSION + 1 }
    const envelopeStorage = new MemoryStorage()
    const futureEnvelope = JSON.stringify({
      formatVersion: LEGACY_SAVE_FORMAT_VERSION,
      revision: 4,
      savedAt: 100,
      state: futureState,
    })
    envelopeStorage.setItem(SAVE_SLOT_A_KEY, futureEnvelope)

    expect(bootstrapGame(envelopeStorage, 500).saveBlocked).toBe(true)
    expect(saveGame(envelopeStorage, createInitialState(500))).toBe(false)
    expect(envelopeStorage.getItem(SAVE_SLOT_A_KEY)).toBe(futureEnvelope)
    expect(envelopeStorage.getItem(SAVE_SLOT_B_KEY)).toBeNull()

    const legacyStorage = new MemoryStorage()
    const futureLegacy = JSON.stringify(futureState)
    legacyStorage.setItem(LEGACY_SAVE_KEY, futureLegacy)
    expect(bootstrapGame(legacyStorage, 500).saveBlocked).toBe(true)
    expect(saveGame(legacyStorage, createInitialState(500))).toBe(false)
    expect(legacyStorage.getItem(LEGACY_SAVE_KEY)).toBe(futureLegacy)
    expect(legacyStorage.getItem(SAVE_SLOT_A_KEY)).toBeNull()
  })

  it('preserves a valid A/B winner when a future raw legacy save also exists', () => {
    const storage = new MemoryStorage()
    expect(saveGameAtRevision(storage, withGold(100, 77), null)).toMatchObject({ revision: 1 })
    const winnerRaw = storage.getItem(SAVE_SLOT_A_KEY)
    const futureLegacy = JSON.stringify({ ...createInitialState(100), schemaVersion: 99 })
    storage.setItem(LEGACY_SAVE_KEY, futureLegacy)

    const bootstrap = bootstrapGame(storage, 500)
    expect(bootstrap.saveBlocked).toBe(true)
    expect(saveGameAtRevision(storage, withGold(500, 999), 1)).toEqual({
      status: 'blocked',
      currentRevision: 1,
    })
    expect(storage.getItem(SAVE_SLOT_A_KEY)).toBe(winnerRaw)
    expect(storage.getItem(SAVE_SLOT_B_KEY)).toBeNull()
    expect(storage.getItem(LEGACY_SAVE_KEY)).toBe(futureLegacy)
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

    for (const rng of [
      { algorithm: 'unknown', seed: 1, state: 1, draws: 0 },
      { algorithm: 'xorshift32-v1', seed: 0, state: 1, draws: 0 },
      { algorithm: 'xorshift32-v1', seed: 1, state: 0, draws: 0 },
      { algorithm: 'xorshift32-v1', seed: 1, state: 1, draws: -1 },
      { algorithm: 'xorshift32-v1', seed: 1, state: 0x1_0000_0000, draws: 0 },
    ]) {
      expect(parseSave(JSON.stringify({ ...state, rng }))).toBeNull()
    }
  })

  it('normalizes an oversized saved power-strike cooldown at decode and bootstrap', () => {
    const state = createInitialState(100)
    state.battle.powerStrikeCooldownMs = Number.MAX_SAFE_INTEGER
    expect(parseSave(JSON.stringify(state))?.battle.powerStrikeCooldownMs).toBe(5_000)

    const storage = new MemoryStorage()
    storage.setItem(
      SAVE_SLOT_A_KEY,
      JSON.stringify({
        formatVersion: SAVE_FORMAT_VERSION,
        revision: 1,
        savedAt: state.lastSavedAt,
        state,
      }),
    )
    const loaded = bootstrapGame(storage, state.lastSavedAt, 'reader')
    expect(loaded.state.battle.powerStrikeCooldownMs).toBe(5_000)
    expect(loaded.saveHealthy).toBe(true)
  })

  it('normalizes companion rank and cooldown without inventing a legacy recruitment', () => {
    const active = createInitialState(100)
    active.player.companion = { id: 'emberFox', rank: Number.MAX_SAFE_INTEGER }
    active.battle.companionCooldownMs = Number.MAX_SAFE_INTEGER
    expect(parseSave(JSON.stringify(active))).toMatchObject({
      player: { companion: { id: 'emberFox', rank: 5 } },
      battle: { companionCooldownMs: 3_000 },
    })

    const inactive = createInitialState(100)
    inactive.battle.companionCooldownMs = 2_000
    expect(parseSave(JSON.stringify(inactive))).toMatchObject({
      player: { companion: { id: null, rank: 0 } },
      battle: { companionCooldownMs: 0 },
    })

    expect(
      parseSave(
        JSON.stringify({
          ...active,
          player: { ...active.player, companion: { id: 'unknown', rank: 1 } },
        }),
      ),
    ).toBeNull()
    expect(
      parseSave(
        JSON.stringify({
          ...active,
          player: { ...active.player, companion: { id: 'emberFox', rank: 0 } },
        }),
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
