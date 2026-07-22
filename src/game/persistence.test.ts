import { describe, expect, it } from 'vitest'
import legacySaveV1 from './fixtures/legacy-save-v1.json'
import legacySaveV2 from './fixtures/legacy-save-v2.json'
import legacySaveV3 from './fixtures/legacy-save-v3.json'
import legacySaveV4 from './fixtures/legacy-save-v4.json'
import { MAX_BOSS_MILESTONE_MASK } from './bossMilestones'
import { createInitialCampState } from './camp'
import { getEnemyDefinition } from './content'
import { advanceGame, createInitialState } from './engine'
import {
  createExpeditionPendingEvent,
  createInitialExpeditionEventState,
  resolveReachedExpeditionMilestones,
} from './expedition'
import {
  LEGACY_SAVE_KEY,
  LEGACY_SAVE_FORMAT_VERSION,
  SAVE_FORMAT_VERSION,
  SAVE_SLOT_A_KEY,
  SAVE_SLOT_B_KEY,
  SAVE_SLOT_KEYS,
  bootstrapGame,
  clearSave,
  createInitialInventoryState,
  createInitialPlayerEquippedState,
  isFutureGameStateValue,
  isGameState,
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

function asLegacySchema3(state = createInitialState(1_000, 0x207207)) {
  const {
    claimedBossMilestoneMask: _claimedBossMilestoneMask,
    expeditionEvents: _expeditionEvents,
    ...legacy
  } = structuredClone(state)
  void _claimedBossMilestoneMask
  void _expeditionEvents
  return { ...legacy, schemaVersion: 3 as const }
}

function asLegacySchema4(state = createInitialState(1_000, 0x107107)) {
  const { expeditionEvents: _expeditionEvents, ...legacy } = structuredClone(state)
  void _expeditionEvents
  return { ...legacy, schemaVersion: 4 as const }
}

function migratedExpeditionEvents(highestStage: number, runPrestige: number) {
  const milestoneCount = Math.min(30, Math.floor(Math.min(300, highestStage) / 10))
  return {
    definitionVersion: 1,
    runPrestige,
    milestoneMask: 2 ** milestoneCount - 1,
    pending: [],
    overflowCount: 0,
  }
}

function createStageTenBossReadyState(now: number) {
  const state = createInitialState(now, 0x207_001)
  state.player.upgrades.weapon = 100
  state.player.skills.powerStrike = 0
  state.battle.stage = 10
  state.battle.highestStage = 10
  state.battle.enemyHp = 1
  state.expeditionEvents = { ...state.expeditionEvents, milestoneMask: 1 }
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
      currentMode: migrated.currentMode,
      camp: structuredClone(migrated.camp),
      inventory: structuredClone(migrated.inventory),
      claimedBossMilestoneMask: migrated.claimedBossMilestoneMask,
      expeditionEvents: structuredClone(migrated.expeditionEvents),
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
        equipped: structuredClone(migrated.player.equipped),
        skillSlots: [...migrated.player.skillSlots],
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

  it('migrates the checked-in v1 fixture to a verified current-schema envelope with a stable RNG', () => {
    const storage = new MemoryStorage()
    storage.setItem(LEGACY_SAVE_KEY, JSON.stringify(legacySaveV1))

    const result = bootstrapGame(storage, legacySaveV1.lastSavedAt)

    const { schemaVersion, rng, ...migratedFields } = result.state
    expect(schemaVersion).toBe(SAVE_VERSION)
    expect(migratedFields).toEqual({
      lastSavedAt: legacySaveV1.lastSavedAt,
      currentMode: 'BATTLE',
      camp: createInitialCampState(),
      inventory: createInitialInventoryState(),
      claimedBossMilestoneMask: 0,
      expeditionEvents: migratedExpeditionEvents(legacySaveV1.battle.highestStage, 0),
      player: {
        ...legacySaveV1.player,
        companion: { id: null, rank: 0 },
        equipped: createInitialPlayerEquippedState(),
        skillSlots: ['powerStrike', null, null],
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

  it('reads a v2/schema1 envelope without writing and checkpoints the current schema only as writer', () => {
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
      currentMode: 'BATTLE',
      camp: createInitialCampState(),
      inventory: createInitialInventoryState(),
      claimedBossMilestoneMask: 0,
      expeditionEvents: migratedExpeditionEvents(
        legacySaveV2.battle.highestStage,
        legacySaveV2.stats.prestiges,
      ),
      rng: legacySaveV2.rng,
      player: {
        ...legacySaveV2.player,
        companion: { id: null, rank: 0 },
        equipped: createInitialPlayerEquippedState(),
        skillSlots: ['powerStrike', null, null],
      },
      battle: {
        ...legacySaveV2.battle,
        companionCooldownMs: 0,
      },
    })
  })

  it('reads a format3/schema2 A/B winner and checkpoints the current schema only as writer', () => {
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

  it.each([
    ['schema1 stage 10', { ...legacySaveV1, battle: { ...legacySaveV1.battle, highestStage: 10 } }, 1],
    ['schema1 prior prestige', { ...legacySaveV1, stats: { ...legacySaveV1.stats, prestiges: 1 } }, MAX_BOSS_MILESTONE_MASK],
    ['schema2 stage 299', { ...legacySaveV2, battle: { ...legacySaveV2.battle, highestStage: 299 } }, 2 ** 29 - 1],
    ['schema2 prior prestige', { ...legacySaveV2, stats: { ...legacySaveV2.stats, prestiges: 1 } }, MAX_BOSS_MILESTONE_MASK],
    ['schema3 stage 9', { ...asLegacySchema3(), battle: { ...asLegacySchema3().battle, highestStage: 9 } }, 0],
    ['schema3 stage 300', { ...asLegacySchema3(), battle: { ...asLegacySchema3().battle, highestStage: 300 } }, MAX_BOSS_MILESTONE_MASK],
    ['schema3 oversized stage', { ...asLegacySchema3(), battle: { ...asLegacySchema3().battle, highestStage: Number.MAX_SAFE_INTEGER } }, MAX_BOSS_MILESTONE_MASK],
    ['schema3 prior prestige', { ...asLegacySchema3(), stats: { ...asLegacySchema3().stats, prestiges: 1 } }, MAX_BOSS_MILESTONE_MASK],
  ])('derives the conservative waiver mask for %s', (_label, legacy, expectedMask) => {
    expect(parseSave(JSON.stringify(legacy))?.claimedBossMilestoneMask).toBe(expectedMask)
  })

  it('preserves schema3 RNG and companion state while ignoring a spoofed mask', () => {
    const current = createInitialState(1_000, 0x1234_5678)
    current.player.companion = { id: 'emberFox', rank: 4 }
    current.battle.companionCooldownMs = 2_000
    current.battle.highestStage = 299
    const legacy = {
      ...asLegacySchema3(current),
      claimedBossMilestoneMask: 0,
    }

    expect(parseSave(JSON.stringify(legacy))).toMatchObject({
      schemaVersion: SAVE_VERSION,
      claimedBossMilestoneMask: 2 ** 29 - 1,
      rng: current.rng,
      player: { companion: { id: 'emberFox', rank: 4 } },
      battle: { companionCooldownMs: 2_000 },
    })
  })

  it('migrates the checked-in schema3 fixture without drifting historical fields', () => {
    expect(parseSave(JSON.stringify(legacySaveV3))).toMatchObject({
      schemaVersion: SAVE_VERSION,
      lastSavedAt: legacySaveV3.lastSavedAt,
      claimedBossMilestoneMask: 2 ** 29 - 1,
      expeditionEvents: migratedExpeditionEvents(
        legacySaveV3.battle.highestStage,
        legacySaveV3.stats.prestiges,
      ),
      rng: legacySaveV3.rng,
      player: {
        gold: legacySaveV3.player.gold,
        upgrades: legacySaveV3.player.upgrades,
        skills: legacySaveV3.player.skills,
        companion: legacySaveV3.player.companion,
      },
      battle: {
        stage: legacySaveV3.battle.stage,
        highestStage: legacySaveV3.battle.highestStage,
        companionCooldownMs: legacySaveV3.battle.companionCooldownMs,
      },
      stats: legacySaveV3.stats,
    })
  })

  it('migrates a format3/schema3 A/B winner in memory and checkpoints only as writer', () => {
    const storage = new MemoryStorage()
    const current = createInitialState(1_000, 0x8765_4321)
    current.player.companion = { id: 'emberFox', rank: 3 }
    current.battle.companionCooldownMs = 1_500
    current.battle.highestStage = 10
    const legacyState = asLegacySchema3(current)
    const legacyEnvelope = JSON.stringify({
      formatVersion: SAVE_FORMAT_VERSION,
      revision: 21,
      savedAt: legacyState.lastSavedAt,
      state: legacyState,
    })
    storage.setItem(SAVE_SLOT_A_KEY, legacyEnvelope)

    const reader = bootstrapGame(storage, legacyState.lastSavedAt, 'reader')
    expect(reader).toMatchObject({
      revision: 21,
      saveBlocked: false,
      state: {
        schemaVersion: SAVE_VERSION,
        claimedBossMilestoneMask: 1,
        rng: current.rng,
        player: { companion: { id: 'emberFox', rank: 3 } },
        battle: { companionCooldownMs: 1_500 },
      },
    })
    expect(storage.getItem(SAVE_SLOT_A_KEY)).toBe(legacyEnvelope)
    expect(storage.getItem(SAVE_SLOT_B_KEY)).toBeNull()

    const writer = bootstrapGame(storage, legacyState.lastSavedAt, 'writer')
    expect(writer).toMatchObject({ revision: 22, saveHealthy: true })
    expect(parseSaveEnvelope(storage.getItem(SAVE_SLOT_B_KEY)!)).toMatchObject({
      formatVersion: SAVE_FORMAT_VERSION,
      revision: 22,
      state: {
        schemaVersion: SAVE_VERSION,
        claimedBossMilestoneMask: 1,
        rng: current.rng,
        player: { companion: { id: 'emberFox', rank: 3 } },
        battle: { companionCooldownMs: 1_500 },
      },
    })
    expect(storage.getItem(SAVE_SLOT_A_KEY)).toBe(legacyEnvelope)
  })

  it('migrates the checked-in schema4 fixture without retroactive events', () => {
    expect(parseSave(JSON.stringify(legacySaveV4))).toMatchObject({
      schemaVersion: SAVE_VERSION,
      lastSavedAt: legacySaveV4.lastSavedAt,
      claimedBossMilestoneMask: legacySaveV4.claimedBossMilestoneMask,
      expeditionEvents: {
        runPrestige: legacySaveV4.stats.prestiges,
        milestoneMask: 2 ** 29 - 1,
        pending: [],
        overflowCount: 0,
      },
      rng: legacySaveV4.rng,
      player: {
        gold: legacySaveV4.player.gold,
        companion: legacySaveV4.player.companion,
      },
      battle: {
        highestStage: legacySaveV4.battle.highestStage,
        companionCooldownMs: legacySaveV4.battle.companionCooldownMs,
      },
      stats: legacySaveV4.stats,
    })
  })

  it('reads a schema4 A/B winner in memory and checkpoints the current schema only as writer', () => {
    const storage = new MemoryStorage()
    const current = createInitialState(1_000, 0x0107_0005)
    current.claimedBossMilestoneMask = 1
    current.battle.highestStage = 30
    const legacyState = asLegacySchema4(current)
    const legacyEnvelope = JSON.stringify({
      formatVersion: SAVE_FORMAT_VERSION,
      revision: 31,
      savedAt: legacyState.lastSavedAt,
      state: legacyState,
    })
    storage.setItem(SAVE_SLOT_A_KEY, legacyEnvelope)

    expect(bootstrapGame(storage, legacyState.lastSavedAt, 'reader')).toMatchObject({
      revision: 31,
      saveBlocked: false,
      state: {
        schemaVersion: SAVE_VERSION,
        claimedBossMilestoneMask: 1,
        expeditionEvents: migratedExpeditionEvents(30, 0),
      },
    })
    expect(storage.getItem(SAVE_SLOT_A_KEY)).toBe(legacyEnvelope)
    expect(storage.getItem(SAVE_SLOT_B_KEY)).toBeNull()

    expect(bootstrapGame(storage, legacyState.lastSavedAt, 'writer')).toMatchObject({
      revision: 32,
      saveHealthy: true,
    })
    expect(parseSaveEnvelope(storage.getItem(SAVE_SLOT_B_KEY)!)).toMatchObject({
      formatVersion: SAVE_FORMAT_VERSION,
      revision: 32,
      state: {
        schemaVersion: SAVE_VERSION,
        expeditionEvents: migratedExpeditionEvents(30, 0),
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

  it('rolls milestone gold and its claim mask back together when an A/B write fails', () => {
    const storage = new MemoryStorage()
    const beforeClaim = withGold(100, 100)
    expect(saveGameAtRevision(storage, beforeClaim, null)).toMatchObject({ revision: 1 })
    const stableRaw = storage.getItem(SAVE_SLOT_A_KEY)
    const afterClaim = structuredClone(beforeClaim)
    afterClaim.player.gold = 115
    afterClaim.stats.goldEarned = 15
    afterClaim.claimedBossMilestoneMask = 1
    storage.failReadAfterNextWrite = true

    expect(saveGameAtRevision(storage, afterClaim, 1)).toEqual({
      status: 'blocked',
      currentRevision: 1,
    })
    expect(storage.getItem(SAVE_SLOT_A_KEY)).toBe(stableRaw)
    expect(storage.getItem(SAVE_SLOT_B_KEY)).toBeNull()
    expect(bootstrapGame(storage, 100, 'reader').state).toMatchObject({
      claimedBossMilestoneMask: 0,
      player: { gold: 100 },
      stats: { goldEarned: 0 },
    })

    expect(saveGameAtRevision(storage, afterClaim, 1)).toMatchObject({ revision: 2 })
    expect(bootstrapGame(storage, 100, 'reader').state).toMatchObject({
      claimedBossMilestoneMask: 1,
      player: { gold: 115 },
      stats: { goldEarned: 15 },
    })
  })

  it('checkpoints an offline first boss reward once and does not repay it after reload', () => {
    const storage = new MemoryStorage()
    const initial = createStageTenBossReadyState(1_000)
    const repeatedBossGold = getEnemyDefinition(10).goldReward
    expect(saveGameAtRevision(storage, initial, null)).toMatchObject({ revision: 1 })

    const first = bootstrapGame(storage, 2_000, 'writer')
    expect(first).toMatchObject({ revision: 2, saveHealthy: true })
    expect(first.state).toMatchObject({
      claimedBossMilestoneMask: 1,
      player: { gold: repeatedBossGold + 15 },
      stats: { goldEarned: repeatedBossGold + 15 },
    })
    expect(parseSaveEnvelope(storage.getItem(SAVE_SLOT_B_KEY)!)).toMatchObject({
      revision: 2,
      state: {
        claimedBossMilestoneMask: 1,
        player: { gold: repeatedBossGold + 15 },
      },
    })

    const replayCheckpoint = structuredClone(first.state)
    replayCheckpoint.battle.stage = 10
    replayCheckpoint.battle.enemyHp = 1
    expect(saveGameAtRevision(storage, replayCheckpoint, 2)).toMatchObject({ revision: 3 })

    const second = bootstrapGame(storage, 3_000, 'writer')
    expect(second).toMatchObject({ revision: 4, saveHealthy: true })
    expect(second.state.claimedBossMilestoneMask).toBe(1)
    expect(second.state.player.gold - replayCheckpoint.player.gold).toBe(repeatedBossGold)
    expect(second.state.stats.goldEarned - replayCheckpoint.stats.goldEarned).toBe(
      repeatedBossGold,
    )
  })

  it('checkpoints a stage 10 expedition offer identically during offline bootstrap', () => {
    const storage = new MemoryStorage()
    const initial = createInitialState(1_000, 0x0107_0010)
    initial.player.upgrades.weapon = 100
    initial.player.skills.powerStrike = 0
    initial.battle.stage = 9
    initial.battle.highestStage = 9
    initial.battle.enemyHp = 1
    const expected = advanceGame(initial, 1_000).state

    expect(saveGameAtRevision(storage, initial, null)).toMatchObject({ revision: 1 })
    const offline = bootstrapGame(storage, 2_000, 'writer')

    expect(offline).toMatchObject({ revision: 2, saveHealthy: true })
    expect(offline.state.rng).toEqual(expected.rng)
    expect(offline.state.expeditionEvents).toEqual(expected.expeditionEvents)
    expect(offline.state.expeditionEvents).toMatchObject({
      milestoneMask: 1,
      pending: [{ milestoneIndex: 0, definitionVersion: 1 }],
      overflowCount: 0,
    })
    expect(parseSaveEnvelope(storage.getItem(SAVE_SLOT_B_KEY)!)?.state.expeditionEvents)
      .toEqual(expected.expeditionEvents)
  })

  it('replays a pre-claim fallback to the same post-claim gold and mask after rev2 corruption', () => {
    const storage = new MemoryStorage()
    const preClaim = createStageTenBossReadyState(0)
    expect(saveGameAtRevision(storage, preClaim, null)).toMatchObject({ revision: 1 })
    const originalPostClaim = advanceGame(preClaim, 1_000)
    expect(originalPostClaim.state).toMatchObject({
      claimedBossMilestoneMask: 1,
      player: { gold: getEnemyDefinition(10).goldReward + 15 },
    })
    expect(saveGameAtRevision(storage, originalPostClaim.state, 1)).toMatchObject({ revision: 2 })
    storage.setItem(SAVE_SLOT_B_KEY, '{corrupt post-claim revision')

    const fallback = bootstrapGame(storage, 0, 'reader')
    expect(fallback).toMatchObject({
      revision: 1,
      recoveredFromInvalidSave: true,
      state: { claimedBossMilestoneMask: 0, player: { gold: 0 } },
    })
    const replayedPostClaim = advanceGame(fallback.state, 1_000)
    expect(replayedPostClaim).toEqual(originalPostClaim)
    expect(replayedPostClaim.state).toMatchObject({
      claimedBossMilestoneMask: 1,
      player: { gold: getEnemyDefinition(10).goldReward + 15 },
    })
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

  it('blocks a future nested bond definition in A/B and legacy raw saves', () => {
    const storage = new MemoryStorage()
    const stable = createInitialState(100, 0x4260_2001)
    expect(saveGameAtRevision(storage, stable, null)).toMatchObject({ revision: 1 })

    const future = createInitialState(200, stable.rng.seed)
    future.camp.bond.definitionVersion = 2
    const futureRaw = JSON.stringify({
      formatVersion: SAVE_FORMAT_VERSION,
      revision: 2,
      savedAt: future.lastSavedAt,
      state: future,
    })
    storage.setItem(SAVE_SLOT_B_KEY, futureRaw)

    expect(bootstrapGame(storage, 500, 'writer').saveBlocked).toBe(true)
    expect(saveGameAtRevision(storage, createInitialState(500), 1)).toMatchObject({
      status: 'blocked',
    })
    expect(storage.getItem(SAVE_SLOT_B_KEY)).toBe(futureRaw)

    const legacyStorage = new MemoryStorage()
    const futureLegacyRaw = JSON.stringify(future)
    legacyStorage.setItem(LEGACY_SAVE_KEY, futureLegacyRaw)
    expect(bootstrapGame(legacyStorage, 500, 'writer').saveBlocked).toBe(true)
    expect(saveGame(legacyStorage, createInitialState(500))).toBe(false)
    expect(legacyStorage.getItem(LEGACY_SAVE_KEY)).toBe(futureLegacyRaw)
    expect(legacyStorage.getItem(SAVE_SLOT_A_KEY)).toBeNull()
  })

  it('treats a higher expedition definition version as future and never overwrites it', () => {
    const storage = new MemoryStorage()
    const stable = createInitialState(100, 0x0107_5000)
    expect(saveGameAtRevision(storage, stable, null)).toMatchObject({ revision: 1 })

    const future = createInitialState(200, stable.rng.seed)
    future.expeditionEvents = {
      definitionVersion: 2,
      runPrestige: 0,
      milestoneMask: 0,
      pending: [],
      overflowCount: 0,
    }
    const futureRaw = JSON.stringify({
      formatVersion: SAVE_FORMAT_VERSION,
      revision: 2,
      savedAt: future.lastSavedAt,
      state: future,
    })
    storage.setItem(SAVE_SLOT_B_KEY, futureRaw)

    const bootstrap = bootstrapGame(storage, 500, 'writer')
    expect(bootstrap.saveBlocked).toBe(true)
    expect(saveGameAtRevision(storage, createInitialState(500), 1)).toMatchObject({
      status: 'blocked',
    })
    expect(storage.getItem(SAVE_SLOT_B_KEY)).toBe(futureRaw)

    const legacyStorage = new MemoryStorage()
    const futureLegacyRaw = JSON.stringify(future)
    legacyStorage.setItem(LEGACY_SAVE_KEY, futureLegacyRaw)
    expect(bootstrapGame(legacyStorage, 500, 'writer').saveBlocked).toBe(true)
    expect(saveGame(legacyStorage, createInitialState(500))).toBe(false)
    expect(legacyStorage.getItem(LEGACY_SAVE_KEY)).toBe(futureLegacyRaw)
    expect(legacyStorage.getItem(SAVE_SLOT_A_KEY)).toBeNull()

    const pendingOnlyStorage = new MemoryStorage()
    const pendingOnlyFuture = createInitialState(200, stable.rng.seed)
    pendingOnlyFuture.battle.highestStage = 10
    const pending = createExpeditionPendingEvent(pendingOnlyFuture.rng.seed, 0, 0, 100)
    pendingOnlyFuture.expeditionEvents = {
      ...pendingOnlyFuture.expeditionEvents,
      milestoneMask: 1,
      pending: [{ ...pending, definitionVersion: 2 }],
    }
    const pendingOnlyRaw = JSON.stringify({
      formatVersion: SAVE_FORMAT_VERSION,
      revision: 1,
      savedAt: pendingOnlyFuture.lastSavedAt,
      state: pendingOnlyFuture,
    })
    pendingOnlyStorage.setItem(SAVE_SLOT_A_KEY, pendingOnlyRaw)
    expect(bootstrapGame(pendingOnlyStorage, 500, 'writer').saveBlocked).toBe(true)
    expect(saveGameAtRevision(pendingOnlyStorage, createInitialState(500), null)).toMatchObject({
      status: 'blocked',
    })
    expect(pendingOnlyStorage.getItem(SAVE_SLOT_A_KEY)).toBe(pendingOnlyRaw)
  })

  it('migrates transitional schema5 expedition ledgers without a marker as literal v1', () => {
    const state = createInitialState(100, 0x0107_0005)
    state.battle.highestStage = 10
    state.expeditionEvents = {
      ...state.expeditionEvents,
      milestoneMask: 1,
      pending: [createExpeditionPendingEvent(state.rng.seed, 0, 0, 100)],
    }
    const { currentMode: _mode, camp: _camp, ...schema5Fields } = structuredClone(state)
    void _mode
    void _camp
    const transitional = {
      ...schema5Fields,
      schemaVersion: 5,
    } as unknown as { expeditionEvents: Record<string, unknown> }
    delete transitional.expeditionEvents.definitionVersion

    expect(parseSave(JSON.stringify(transitional))).toMatchObject({
      expeditionEvents: {
        definitionVersion: 1,
        pending: [{ definitionVersion: 1 }],
      },
    })

    const currentEmpty = structuredClone(createInitialState(100))
    const { currentMode: _emptyMode, camp: _emptyCamp, ...emptySchema5Fields } = currentEmpty
    void _emptyMode
    void _emptyCamp
    const empty = {
      ...emptySchema5Fields,
      schemaVersion: 5,
    } as unknown as { expeditionEvents: Record<string, unknown> }
    delete empty.expeditionEvents.definitionVersion
    expect(parseSave(JSON.stringify(empty))).toMatchObject({
      expeditionEvents: { definitionVersion: 1, pending: [] },
    })

    const storage = new MemoryStorage()
    const transitionalRaw = JSON.stringify({
      formatVersion: SAVE_FORMAT_VERSION,
      revision: 7,
      savedAt: state.lastSavedAt,
      state: transitional,
    })
    storage.setItem(SAVE_SLOT_A_KEY, transitionalRaw)
    const reader = bootstrapGame(storage, state.lastSavedAt, 'reader')
    expect(reader).toMatchObject({
      revision: 7,
      state: { expeditionEvents: { definitionVersion: 1 } },
    })
    expect(storage.getItem(SAVE_SLOT_A_KEY)).toBe(transitionalRaw)

    const writer = bootstrapGame(storage, state.lastSavedAt, 'writer')
    expect(writer.saveHealthy).toBe(true)
    expect(parseSaveEnvelope(storage.getItem(SAVE_SLOT_B_KEY)!)).toMatchObject({
      revision: 8,
      state: { expeditionEvents: { definitionVersion: 1 } },
    })
  })

  it('treats zero and non-numeric expedition markers as malformed rather than future', () => {
    for (const definitionVersion of [0, '1']) {
      const storage = new MemoryStorage()
      expect(saveGameAtRevision(storage, withGold(100, 77), null)).toMatchObject({ revision: 1 })
      const malformed = withGold(200, 999)
      malformed.expeditionEvents = {
        ...malformed.expeditionEvents,
        definitionVersion: definitionVersion as number,
      }
      const malformedRaw = JSON.stringify({
        formatVersion: SAVE_FORMAT_VERSION,
        revision: 2,
        savedAt: malformed.lastSavedAt,
        state: malformed,
      })
      storage.setItem(SAVE_SLOT_B_KEY, malformedRaw)

      expect(bootstrapGame(storage, 200, 'reader')).toMatchObject({
        revision: 1,
        recoveredFromInvalidSave: true,
        saveBlocked: false,
        state: { player: { gold: 77 } },
      })
      expect(storage.getItem(SAVE_SLOT_B_KEY)).toBe(malformedRaw)
    }
  })

  it('falls back when the newest schema5 slot has stage above highestStage', () => {
    const storage = new MemoryStorage()
    const stable = withGold(100, 77)
    expect(saveGameAtRevision(storage, stable, null)).toMatchObject({ revision: 1 })

    const malformed = withGold(200, 999)
    malformed.battle.stage = 10
    malformed.battle.highestStage = 9
    const malformedRaw = JSON.stringify({
      formatVersion: SAVE_FORMAT_VERSION,
      revision: 2,
      savedAt: malformed.lastSavedAt,
      state: malformed,
    })
    storage.setItem(SAVE_SLOT_B_KEY, malformedRaw)

    const recovered = bootstrapGame(storage, 200, 'reader')
    expect(recovered).toMatchObject({
      revision: 1,
      recoveredFromInvalidSave: true,
      state: { player: { gold: 77 } },
    })
    expect(storage.getItem(SAVE_SLOT_B_KEY)).toBe(malformedRaw)
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

  it('requires a strict bounded schema4 milestone mask without coercion', () => {
    const state = createInitialState(100)
    for (const claimedBossMilestoneMask of [
      -1,
      0.5,
      2 ** 30,
      Number.MAX_SAFE_INTEGER,
      '1',
      null,
    ]) {
      expect(parseSave(JSON.stringify({ ...state, claimedBossMilestoneMask }))).toBeNull()
    }
    const missingMask = { ...state } as Record<string, unknown>
    delete missingMask.claimedBossMilestoneMask
    expect(parseSave(JSON.stringify(missingMask))).toBeNull()
    expect(parseSave(JSON.stringify({ ...state, claimedBossMilestoneMask: 0 }))).toMatchObject({
      claimedBossMilestoneMask: 0,
    })
    expect(
      parseSave(JSON.stringify({
        ...state,
        claimedBossMilestoneMask: MAX_BOSS_MILESTONE_MASK,
      })),
    ).toMatchObject({ claimedBossMilestoneMask: MAX_BOSS_MILESTONE_MASK })
  })

  it('strictly validates schema5 expedition pending state without coercion', () => {
    const state = createInitialState(100, 0x0107_0005)
    state.battle.highestStage = 10
    const first = createExpeditionPendingEvent(state.rng.seed, 0, 0, 100)
    const second = createExpeditionPendingEvent(state.rng.seed, 0, 1, 100)
    const third = createExpeditionPendingEvent(state.rng.seed, 0, 2, 100)
    const fourth = createExpeditionPendingEvent(state.rng.seed, 0, 3, 100)
    state.expeditionEvents = {
      definitionVersion: 1,
      runPrestige: 0,
      milestoneMask: 1,
      pending: [first],
      overflowCount: 0,
    }
    expect(parseSave(JSON.stringify(state))).toEqual(state)

    const goldChoice = first.resolvedChoices[0]!
    const recoveryChoice = first.resolvedChoices[1]!
    const invalidExpeditionStates: unknown[] = [
      { ...state.expeditionEvents, definitionVersion: 0 },
      { ...state.expeditionEvents, definitionVersion: '1' },
      { ...state.expeditionEvents, runPrestige: 1 },
      { ...state.expeditionEvents, milestoneMask: -1 },
      { ...state.expeditionEvents, milestoneMask: 2 ** 30 },
      { ...state.expeditionEvents, milestoneMask: 0 },
      { ...state.expeditionEvents, pending: [first, second, third, fourth], milestoneMask: 15 },
      { ...state.expeditionEvents, overflowCount: 31 },
      { ...state.expeditionEvents, overflowCount: 2 },
      { ...state.expeditionEvents, pending: [first, first] },
      { ...state.expeditionEvents, pending: [second, first], milestoneMask: 3 },
      { ...state.expeditionEvents, pending: [{ ...first, eventId: `${first.eventId}-spoofed` }] },
      { ...state.expeditionEvents, pending: [{ ...first, definitionId: 'event.unknown' }] },
      { ...state.expeditionEvents, pending: [{ ...first, definitionVersion: 2 }] },
      { ...state.expeditionEvents, pending: [{ ...first, milestoneStage: 20 }] },
      { ...state.expeditionEvents, pending: [{ ...first, maxHpAtOffer: 0 }] },
      {
        ...state.expeditionEvents,
        pending: [{ ...first, resolvedChoices: [recoveryChoice, goldChoice] }],
      },
      {
        ...state.expeditionEvents,
        pending: [{
          ...first,
          resolvedChoices: [
            { ...goldChoice, effect: { ...goldChoice.effect, amount: goldChoice.effect.amount + 1 } },
            recoveryChoice,
          ],
        }],
      },
      {
        ...state.expeditionEvents,
        pending: [{
          ...first,
          resolvedChoices: [
            { ...goldChoice, effect: { type: 'grantXp', amount: 1 } },
            recoveryChoice,
          ],
        }],
      },
      {
        ...state.expeditionEvents,
        pending: [{
          ...first,
          resolvedChoices: [
            goldChoice,
            { ...recoveryChoice, effect: { ...recoveryChoice.effect, amount: Number.NaN } },
          ],
        }],
      },
    ]

    for (const expeditionEvents of invalidExpeditionStates) {
      expect(parseSave(JSON.stringify({ ...state, expeditionEvents }))).toBeNull()
    }

    const missing = { ...state } as Record<string, unknown>
    delete missing.expeditionEvents
    expect(parseSave(JSON.stringify(missing))).toBeNull()
    expect(
      parseSave(JSON.stringify({
        ...state,
        battle: { ...state.battle, highestStage: 300 },
        expeditionEvents: {
          definitionVersion: 1,
          runPrestige: 0,
          milestoneMask: MAX_BOSS_MILESTONE_MASK,
          pending: [],
          overflowCount: 27,
        },
      })),
    ).toMatchObject({
      expeditionEvents: {
        milestoneMask: MAX_BOSS_MILESTONE_MASK,
        pending: [],
        overflowCount: 27,
      },
    })

    const impossibleOverflow = createInitialState(100, 1)
    impossibleOverflow.battle.highestStage = 40
    impossibleOverflow.expeditionEvents = {
      ...resolveReachedExpeditionMilestones(
        createInitialExpeditionEventState(),
        impossibleOverflow.rng.seed,
        0,
        40,
        100,
      ),
      overflowCount: 0,
    }
    expect(parseSave(JSON.stringify(impossibleOverflow))).toBeNull()
  })

  it('falls back from malformed schema5 expedition data to the older valid A/B slot', () => {
    const storage = new MemoryStorage()
    const stable = withGold(100, 115)
    const invalid = withGold(200, 999)
    const pending = createExpeditionPendingEvent(invalid.rng.seed, 0, 0, 100)
    invalid.expeditionEvents = {
      definitionVersion: 1,
      runPrestige: 0,
      milestoneMask: 1,
      pending: [{
        ...pending,
        resolvedChoices: [
          {
            ...pending.resolvedChoices[0]!,
            effect: { type: 'grantGold', amount: 999 },
          },
          pending.resolvedChoices[1]!,
        ],
      }],
      overflowCount: 0,
    }
    storage.setItem(
      SAVE_SLOT_A_KEY,
      JSON.stringify({
        formatVersion: SAVE_FORMAT_VERSION,
        revision: 1,
        savedAt: stable.lastSavedAt,
        state: stable,
      }),
    )
    storage.setItem(
      SAVE_SLOT_B_KEY,
      JSON.stringify({
        formatVersion: SAVE_FORMAT_VERSION,
        revision: 2,
        savedAt: invalid.lastSavedAt,
        state: invalid,
      }),
    )

    expect(bootstrapGame(storage, stable.lastSavedAt, 'reader')).toMatchObject({
      recoveredFromInvalidSave: true,
      revision: 1,
      state: {
        player: { gold: 115 },
        expeditionEvents: { milestoneMask: 0, pending: [] },
      },
    })
    expect(parseSaveEnvelope(storage.getItem(SAVE_SLOT_B_KEY)!)).toBeNull()
  })

  it('falls back from an invalid schema4 mask without fabricating a zero-mask winner', () => {
    const storage = new MemoryStorage()
    const stable = withGold(100, 115)
    stable.claimedBossMilestoneMask = 1
    stable.stats.goldEarned = 15
    const invalid = withGold(200, 999)
    invalid.claimedBossMilestoneMask = 2 ** 30
    storage.setItem(
      SAVE_SLOT_A_KEY,
      JSON.stringify({
        formatVersion: SAVE_FORMAT_VERSION,
        revision: 1,
        savedAt: stable.lastSavedAt,
        state: stable,
      }),
    )
    storage.setItem(
      SAVE_SLOT_B_KEY,
      JSON.stringify({
        formatVersion: SAVE_FORMAT_VERSION,
        revision: 2,
        savedAt: invalid.lastSavedAt,
        state: invalid,
      }),
    )

    const reader = bootstrapGame(storage, stable.lastSavedAt, 'reader')
    expect(reader).toMatchObject({
      recoveredFromInvalidSave: true,
      revision: 1,
      state: {
        claimedBossMilestoneMask: 1,
        player: { gold: 115 },
        stats: { goldEarned: 15 },
      },
    })
    expect(parseSaveEnvelope(storage.getItem(SAVE_SLOT_B_KEY)!)).toBeNull()
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

  it('migrates Schema 8 to Schema 9 with powerStrike in slot 0 regardless of legacy rank', () => {
    const schema8State: Record<string, unknown> = JSON.parse(JSON.stringify(createInitialState(1_000)))
    delete schema8State.inventory
    delete (schema8State.player as Record<string, unknown>).equipped
    delete (schema8State.player as Record<string, unknown>).skillSlots
    ;((schema8State.player as Record<string, unknown>).skills as Record<string, unknown>)
      .powerStrike = 0
    schema8State.schemaVersion = 8

    const decoded = parseSave(JSON.stringify(schema8State))
    expect(decoded).not.toBeNull()
    expect(decoded?.schemaVersion).toBe(9)
    expect(decoded?.inventory).toEqual({
      definitionVersion: 1,
      lootBag: {},
      heroInventory: {},
      campStorage: {},
    })
    expect(decoded?.player.equipped).toEqual({
      weapon: null,
      armor: null,
      helmet: null,
      accessory: null,
    })
    expect(decoded?.player.skillSlots).toEqual(['powerStrike', null, null])
  })

  it('copies only allow-listed nested Schema 8 fields into Schema 9', () => {
    const schema8 = JSON.parse(JSON.stringify(createInitialState(1_000))) as Record<string, unknown>
    delete schema8.inventory
    const player = schema8.player as Record<string, unknown>
    delete player.equipped
    delete player.skillSlots
    schema8.schemaVersion = 8

    const marker = 'schema8-unknown-field-must-not-survive'
    const inject = (value: unknown) => {
      ;(value as Record<string, unknown>).injected = marker
    }
    inject(schema8)
    inject(player)
    inject(player.upgrades)
    inject(player.skills)
    inject(player.companion)
    inject(schema8.battle)
    inject(schema8.stats)
    inject(schema8.rng)
    inject(schema8.expeditionEvents)
    const camp = schema8.camp as Record<string, unknown>
    inject(camp)
    for (const key of [
      'structures',
      'training',
      'materials',
      'consumables',
      'buffs',
      'merchant',
      'residents',
      'bond',
    ]) {
      inject(camp[key])
    }
    inject((camp.residents as Record<string, unknown>).sera)

    const decoded = parseSave(JSON.stringify(schema8))
    expect(decoded).not.toBeNull()
    expect(isGameState(decoded)).toBe(true)
    expect(JSON.stringify(decoded)).not.toContain(marker)
  })

  it('rejects invalid item IDs, invalid equipment slots, and duplicate skill slots in isGameState', () => {
    const valid = createInitialState(1_000)

    // Unregistered item in inventory
    const invalidInv = JSON.parse(JSON.stringify(valid))
    invalidInv.inventory.heroInventory['invalid.unknown-item'] = 1
    expect(isGameState(invalidInv)).toBe(false)

    // Invalid item slot in equipped (weapon in armor slot)
    const invalidSlot = JSON.parse(JSON.stringify(valid))
    invalidSlot.player.equipped.armor = 'weapon.novice-sword'
    expect(isGameState(invalidSlot)).toBe(false)

    // Duplicate skills in skillSlots
    const duplicateSkills = JSON.parse(JSON.stringify(valid))
    duplicateSkills.player.skillSlots = ['powerStrike', 'powerStrike', null]
    expect(isGameState(duplicateSkills)).toBe(false)

    // Arrays are not plain inventory records.
    const arrayInventory = JSON.parse(JSON.stringify(valid))
    arrayInventory.inventory.heroInventory = []
    expect(isGameState(arrayInventory)).toBe(false)

    // Object.prototype keys are not registered item IDs.
    const prototypeItem = JSON.parse(JSON.stringify(valid))
    prototypeItem.inventory.heroInventory = { toString: 1 }
    expect(isGameState(prototypeItem)).toBe(false)
  })

  it('recovers the previous A/B slot from malformed Schema 9 inventory, equipment, and skills', () => {
    const mutations: Array<(state: ReturnType<typeof createInitialState>) => void> = [
      (state) => { state.inventory.heroInventory['invalid.unknown-item'] = 1 },
      (state) => { state.player.equipped.armor = 'weapon.novice-sword' },
      (state) => { state.player.skillSlots = ['powerStrike', 'powerStrike', null] },
    ]

    for (const mutate of mutations) {
      const storage = new MemoryStorage()
      const stable = withGold(100, 77)
      expect(saveGameAtRevision(storage, stable, null)).toMatchObject({ revision: 1 })

      const malformed = withGold(200, 999)
      mutate(malformed)
      const malformedRaw = JSON.stringify({
        formatVersion: SAVE_FORMAT_VERSION,
        revision: 2,
        savedAt: malformed.lastSavedAt,
        state: malformed,
      })
      storage.setItem(SAVE_SLOT_B_KEY, malformedRaw)

      expect(bootstrapGame(storage, 200, 'reader')).toMatchObject({
        revision: 1,
        recoveredFromInvalidSave: true,
        saveBlocked: false,
        state: { player: { gold: 77 } },
      })
      expect(storage.getItem(SAVE_SLOT_B_KEY)).toBe(malformedRaw)
    }
  })

  it('blocks future inventory definitions in A/B and raw saves without changing their bytes', () => {
    const stableStorage = new MemoryStorage()
    const stable = withGold(100, 77)
    expect(saveGameAtRevision(stableStorage, stable, null)).toMatchObject({ revision: 1 })
    const stableRaw = stableStorage.getItem(SAVE_SLOT_A_KEY)

    const future = createInitialState(200, stable.rng.seed)
    future.inventory.definitionVersion = 2 as never
    expect(isFutureGameStateValue(future)).toBe(true)
    const futureEnvelopeRaw = JSON.stringify({
      formatVersion: SAVE_FORMAT_VERSION,
      revision: 2,
      savedAt: future.lastSavedAt,
      state: future,
    })
    stableStorage.setItem(SAVE_SLOT_B_KEY, futureEnvelopeRaw)

    expect(bootstrapGame(stableStorage, 500, 'writer')).toMatchObject({
      revision: null,
      saveBlocked: true,
      state: { player: { gold: 0 } },
    })
    expect(saveGameAtRevision(stableStorage, createInitialState(500), null)).toEqual({
      status: 'blocked',
      currentRevision: null,
    })
    expect(stableStorage.getItem(SAVE_SLOT_A_KEY)).toBe(stableRaw)
    expect(stableStorage.getItem(SAVE_SLOT_B_KEY)).toBe(futureEnvelopeRaw)

    const rawStorage = new MemoryStorage()
    const futureRaw = JSON.stringify(future)
    rawStorage.setItem(LEGACY_SAVE_KEY, futureRaw)
    expect(bootstrapGame(rawStorage, 500, 'writer').saveBlocked).toBe(true)
    expect(saveGame(rawStorage, createInitialState(500))).toBe(false)
    expect(rawStorage.getItem(LEGACY_SAVE_KEY)).toBe(futureRaw)
    expect(rawStorage.getItem(SAVE_SLOT_A_KEY)).toBeNull()
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
