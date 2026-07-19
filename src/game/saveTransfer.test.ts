import { describe, expect, it } from 'vitest'
import portableSaveV1 from './fixtures/portable-save-v1.json'
import legacySaveV2 from './fixtures/legacy-save-v2.json'
import legacySaveV4 from './fixtures/legacy-save-v4.json'
import { MAX_BOSS_MILESTONE_MASK } from './bossMilestones'
import { getEnemyDefinition } from './content'
import { advanceGame, chooseExpeditionEvent, createInitialState } from './engine'
import { createExpeditionPendingEvent } from './expedition'
import { SAVE_SLOT_A_KEY, SAVE_SLOT_B_KEY, parseSaveEnvelope, saveGameAtRevision } from './persistence'
import {
  MAX_PORTABLE_SAVE_BYTES,
  PORTABLE_SAVE_VERSION,
  commitPortableSave,
  createPortableSave,
  parsePortableSave,
} from './saveTransfer'
import { SAVE_VERSION } from './types'

class MemoryStorage {
  private values = new Map<string, string>()

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

function checksumText(text: string) {
  let hash = 0x811c9dc5
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

function exportedState() {
  const state = createInitialState(1_000)
  state.player.level = 7
  state.player.gold = 321
  state.player.upgrades.weapon = 4
  state.battle.stage = 9
  state.battle.highestStage = 12
  state.expeditionEvents = { ...state.expeditionEvents, milestoneMask: 1 }
  return state
}

function asLegacySchema3(state = exportedState()) {
  const {
    claimedBossMilestoneMask: _claimedBossMilestoneMask,
    expeditionEvents: _expeditionEvents,
    ...legacy
  } = structuredClone(state)
  void _claimedBossMilestoneMask
  void _expeditionEvents
  return { ...legacy, schemaVersion: 3 as const }
}

function createStageTenBossReadyState(now: number) {
  const state = createInitialState(now, 0x207_002)
  state.player.upgrades.weapon = 100
  state.player.skills.powerStrike = 0
  state.battle.stage = 10
  state.battle.highestStage = 10
  state.battle.enemyHp = 1
  state.expeditionEvents = { ...state.expeditionEvents, milestoneMask: 1 }
  return state
}

describe('portable save transfer', () => {
  it('round-trips a valid state with an integrity checksum', () => {
    const state = exportedState()
    const raw = createPortableSave(state, 2_000)
    expect(raw).not.toBeNull()

    const result = parsePortableSave(raw!)
    expect(result).toEqual({
      success: true,
      preview: {
        exportedAt: 2_000,
        checksum: expect.stringMatching(/^[0-9a-f]{8}$/),
        state,
      },
    })
  })

  it('round-trips and commits an active companion rank and cooldown', () => {
    const state = exportedState()
    state.claimedBossMilestoneMask = 1
    state.player.companion = { id: 'emberFox', rank: 4 }
    state.battle.companionCooldownMs = 2_000
    const parsed = parsePortableSave(createPortableSave(state, 2_000)!)

    expect(parsed).toMatchObject({
      success: true,
      preview: {
        state: {
          claimedBossMilestoneMask: 1,
          player: { companion: { id: 'emberFox', rank: 4 } },
          battle: { companionCooldownMs: 2_000 },
        },
      },
    })
    expect(parsed.success).toBe(true)
    if (!parsed.success) return

    const storage = new MemoryStorage()
    expect(commitPortableSave(storage, parsed.preview, null, 3_000)).toMatchObject({
      status: 'saved',
      revision: 1,
      state: {
        claimedBossMilestoneMask: 1,
        player: { companion: { id: 'emberFox', rank: 4 } },
        battle: { companionCooldownMs: 2_000 },
      },
    })
  })

  it('round-trips and commits resolved pending expedition choices without rerolling them', () => {
    const state = exportedState()
    const pending = createExpeditionPendingEvent(state.rng.seed, 0, 0, 137)
    state.expeditionEvents = {
      definitionVersion: 1,
      runPrestige: 0,
      milestoneMask: 1,
      pending: [pending],
      overflowCount: 0,
    }

    const parsed = parsePortableSave(createPortableSave(state, 2_000)!)
    expect(parsed).toMatchObject({
      success: true,
      preview: {
        state: {
          rng: state.rng,
          expeditionEvents: {
            runPrestige: 0,
            milestoneMask: 1,
            pending: [pending],
            overflowCount: 0,
          },
        },
      },
    })
    expect(parsed.success).toBe(true)
    if (!parsed.success) return

    const storage = new MemoryStorage()
    expect(commitPortableSave(storage, parsed.preview, null, 3_000)).toMatchObject({
      status: 'saved',
      revision: 1,
      state: { expeditionEvents: { pending: [pending] } },
    })
    expect(parseSaveEnvelope(storage.getItem(SAVE_SLOT_A_KEY)!)).toMatchObject({
      state: { rng: state.rng, expeditionEvents: { pending: [pending] } },
    })
  })

  it('rolls back pending and gold together from an older portable backup, then pays once', () => {
    const beforeChoice = exportedState()
    beforeChoice.player.gold = 10
    const pending = createExpeditionPendingEvent(beforeChoice.rng.seed, 0, 0, 137)
    beforeChoice.expeditionEvents = {
      definitionVersion: 1,
      runPrestige: 0,
      milestoneMask: 1,
      pending: [pending],
      overflowCount: 0,
    }
    const backup = parsePortableSave(createPortableSave(beforeChoice, 2_000)!)
    expect(backup.success).toBe(true)
    if (!backup.success) return

    const firstChoice = chooseExpeditionEvent(beforeChoice, pending.eventId, 'gold')
    expect(firstChoice.success).toBe(true)
    const storage = new MemoryStorage()
    expect(saveGameAtRevision(storage, firstChoice.state, null)).toMatchObject({ revision: 1 })

    const restored = commitPortableSave(storage, backup.preview, 1, 3_000)
    expect(restored).toMatchObject({
      status: 'saved',
      revision: 2,
      state: {
        player: { gold: 10 },
        expeditionEvents: { pending: [pending] },
      },
    })
    if (restored.status !== 'saved') return

    const replay = chooseExpeditionEvent(restored.state, pending.eventId, 'gold')
    expect(replay.success).toBe(true)
    expect(replay.state.player.gold).toBe(10 + pending.resolvedChoices[0]!.effect.amount)
    const duplicate = chooseExpeditionEvent(replay.state, pending.eventId, 'gold')
    expect(duplicate.success).toBe(false)
    expect(duplicate.state).toBe(replay.state)
  })

  it('keeps a post-claim ledger through portable import and emits no reward on replay', () => {
    const firstVictory = advanceGame(createStageTenBossReadyState(1_000), 1_000)
    const firstEvent = firstVictory.events.find(({ type }) => type === 'bossVictory')
    expect(firstEvent?.type).toBe('bossVictory')
    if (firstEvent?.type !== 'bossVictory') return
    expect(firstEvent.milestoneReward).toMatchObject({
      milestoneStage: 10,
      configuredGold: 15,
      appliedGold: 15,
    })
    expect(firstVictory.state.claimedBossMilestoneMask).toBe(1)

    const parsed = parsePortableSave(createPortableSave(firstVictory.state, 2_000)!)
    expect(parsed.success).toBe(true)
    if (!parsed.success) return
    const storage = new MemoryStorage()
    const imported = commitPortableSave(storage, parsed.preview, null, 3_000)
    expect(imported).toMatchObject({
      status: 'saved',
      revision: 1,
      state: {
        claimedBossMilestoneMask: 1,
        player: { gold: getEnemyDefinition(10).goldReward + 15 },
      },
    })
    if (imported.status !== 'saved') return
    expect(parseSaveEnvelope(storage.getItem(SAVE_SLOT_A_KEY)!)).toMatchObject({
      state: { claimedBossMilestoneMask: 1 },
    })

    const replayInput = structuredClone(imported.state)
    replayInput.battle.stage = 10
    replayInput.battle.enemyHp = 1
    const replay = advanceGame(replayInput, 1_000)
    const replayEvent = replay.events.find(({ type }) => type === 'bossVictory')
    expect(replayEvent?.type).toBe('bossVictory')
    if (replayEvent?.type !== 'bossVictory') return
    expect(replayEvent.milestoneReward).toBeNull()
    expect(replay.state.claimedBossMilestoneMask).toBe(1)
    expect(replay.state.player.gold - replayInput.player.gold).toBe(
      getEnemyDefinition(10).goldReward,
    )
  })

  it('migrates and commits a checked-in schema1 portable backup', () => {
    const parsed = parsePortableSave(JSON.stringify(portableSaveV1))
    expect(parsed).toMatchObject({
      success: true,
      preview: {
        exportedAt: portableSaveV1.exportedAt,
        state: {
          schemaVersion: SAVE_VERSION,
          claimedBossMilestoneMask: 0,
          expeditionEvents: {
            runPrestige: portableSaveV1.state.stats.prestiges,
            milestoneMask: 0,
            pending: [],
            overflowCount: 0,
          },
          rng: { algorithm: 'xorshift32-v1', seed: 873835004, draws: 0 },
          player: { gold: 87, companion: { id: null, rank: 0 } },
          battle: { companionCooldownMs: 0 },
        },
      },
    })
    expect(parsed.success).toBe(true)
    if (!parsed.success) return
    expect(parsed.preview.checksum).not.toBe(portableSaveV1.checksum)

    const storage = new MemoryStorage()
    expect(saveGameAtRevision(storage, createInitialState(100), null)).toMatchObject({
      revision: 1,
    })
    expect(commitPortableSave(storage, parsed.preview, 1, 5_000)).toMatchObject({
      status: 'saved',
      revision: 2,
      state: { schemaVersion: SAVE_VERSION, rng: { seed: 873835004 }, lastSavedAt: 5_000 },
    })
  })

  it('migrates and commits a schema2 portable backup without changing its RNG', () => {
    const exportedAt = legacySaveV2.lastSavedAt + 1_000
    const portableV2 = {
      kind: 'emberwatch-portable-save',
      exportVersion: PORTABLE_SAVE_VERSION,
      exportedAt,
      state: legacySaveV2,
      checksum: checksumText(JSON.stringify(legacySaveV2)),
    }
    const parsed = parsePortableSave(JSON.stringify(portableV2))

    expect(parsed).toMatchObject({
      success: true,
      preview: {
        exportedAt,
        state: {
          schemaVersion: SAVE_VERSION,
          claimedBossMilestoneMask: 0,
          expeditionEvents: {
            runPrestige: legacySaveV2.stats.prestiges,
            milestoneMask: 0,
            pending: [],
            overflowCount: 0,
          },
          rng: legacySaveV2.rng,
          player: { companion: { id: null, rank: 0 } },
          battle: { companionCooldownMs: 0 },
        },
      },
    })
    expect(parsed.success).toBe(true)
    if (!parsed.success) return

    const storage = new MemoryStorage()
    expect(commitPortableSave(storage, parsed.preview, null, exportedAt + 1_000)).toMatchObject({
      status: 'saved',
      revision: 1,
      state: {
        schemaVersion: SAVE_VERSION,
        claimedBossMilestoneMask: 0,
        rng: legacySaveV2.rng,
        player: { companion: { id: null, rank: 0 } },
      },
    })
  })

  it('migrates a schema3 portable backup without retroactive gold and preserves companion state', () => {
    const state = exportedState()
    state.player.gold = 444
    state.player.companion = { id: 'emberFox', rank: 4 }
    state.battle.companionCooldownMs = 2_000
    state.battle.highestStage = 299
    const legacyState = {
      ...asLegacySchema3(state),
      claimedBossMilestoneMask: 0,
    }
    const exportedAt = state.lastSavedAt + 1_000
    const portableV3 = {
      kind: 'emberwatch-portable-save',
      exportVersion: PORTABLE_SAVE_VERSION,
      exportedAt,
      state: legacyState,
      checksum: checksumText(JSON.stringify(legacyState)),
    }

    const parsed = parsePortableSave(JSON.stringify(portableV3))
    expect(parsed).toMatchObject({
      success: true,
      preview: {
        exportedAt,
        state: {
          schemaVersion: SAVE_VERSION,
          claimedBossMilestoneMask: 2 ** 29 - 1,
          expeditionEvents: {
            runPrestige: state.stats.prestiges,
            milestoneMask: 2 ** 29 - 1,
            pending: [],
            overflowCount: 0,
          },
          player: { gold: 444, companion: { id: 'emberFox', rank: 4 } },
          battle: { companionCooldownMs: 2_000 },
        },
      },
    })
    expect(parsed.success).toBe(true)
    if (!parsed.success) return
    expect(parsed.preview.checksum).not.toBe(portableV3.checksum)

    const storage = new MemoryStorage()
    expect(commitPortableSave(storage, parsed.preview, null, exportedAt + 1_000)).toMatchObject({
      status: 'saved',
      revision: 1,
      state: {
        schemaVersion: SAVE_VERSION,
        claimedBossMilestoneMask: 2 ** 29 - 1,
        player: { gold: 444, companion: { id: 'emberFox', rank: 4 } },
        battle: { companionCooldownMs: 2_000 },
      },
    })
    expect(parseSaveEnvelope(storage.getItem(SAVE_SLOT_A_KEY)!)).toMatchObject({
      revision: 1,
      state: { claimedBossMilestoneMask: 2 ** 29 - 1, player: { gold: 444 } },
    })
  })

  it('migrates and commits a schema4 portable backup without retroactive events', () => {
    const exportedAt = legacySaveV4.lastSavedAt + 1_000
    const portableV4 = {
      kind: 'emberwatch-portable-save',
      exportVersion: PORTABLE_SAVE_VERSION,
      exportedAt,
      state: legacySaveV4,
      checksum: checksumText(JSON.stringify(legacySaveV4)),
    }

    const parsed = parsePortableSave(JSON.stringify(portableV4))
    expect(parsed).toMatchObject({
      success: true,
      preview: {
        state: {
          schemaVersion: SAVE_VERSION,
          claimedBossMilestoneMask: legacySaveV4.claimedBossMilestoneMask,
          expeditionEvents: {
            runPrestige: legacySaveV4.stats.prestiges,
            milestoneMask: 2 ** 29 - 1,
            pending: [],
            overflowCount: 0,
          },
          rng: legacySaveV4.rng,
          player: { gold: legacySaveV4.player.gold },
        },
      },
    })
    expect(parsed.success).toBe(true)
    if (!parsed.success) return

    const storage = new MemoryStorage()
    expect(commitPortableSave(storage, parsed.preview, null, exportedAt + 1_000)).toMatchObject({
      status: 'saved',
      revision: 1,
      state: {
        expeditionEvents: {
          runPrestige: legacySaveV4.stats.prestiges,
          milestoneMask: 2 ** 29 - 1,
          pending: [],
        },
        player: { gold: legacySaveV4.player.gold },
      },
    })
  })

  it('rejects malformed, oversized, unrelated, and future payloads', () => {
    expect(parsePortableSave('{broken')).toMatchObject({ success: false })
    expect(parsePortableSave('x'.repeat(MAX_PORTABLE_SAVE_BYTES + 1))).toMatchObject({
      success: false,
      message: expect.stringContaining('1 MiB'),
    })
    expect(parsePortableSave(JSON.stringify({ kind: 'other' }))).toMatchObject({
      success: false,
    })
    expect(
      parsePortableSave(
        JSON.stringify({
          kind: 'emberwatch-portable-save',
          exportVersion: PORTABLE_SAVE_VERSION + 1,
        }),
      ),
    ).toMatchObject({ success: false, message: expect.stringContaining('더 새로운') })
  })

  it('rejects checksum changes and invalid state fields', () => {
    const raw = createPortableSave(exportedState(), 2_000)!
    const tampered = JSON.parse(raw) as Record<string, unknown>
    const tamperedState = tampered.state as { player: { gold: number } }
    tamperedState.player.gold += 1
    expect(parsePortableSave(JSON.stringify(tampered))).toMatchObject({
      success: false,
      message: expect.stringContaining('손상'),
    })

    const invalid = JSON.parse(raw) as Record<string, unknown>
    const invalidState = invalid.state as { player: { gold: number } }
    invalidState.player.gold = -1
    invalid.checksum = checksumText(JSON.stringify(invalid.state))
    expect(parsePortableSave(JSON.stringify(invalid))).toMatchObject({
      success: false,
      message: expect.stringContaining('진행 데이터'),
    })

    const futureState = JSON.parse(raw) as Record<string, unknown>
    const futureGameState = futureState.state as { schemaVersion: number }
    futureGameState.schemaVersion = 999
    futureState.checksum = checksumText(JSON.stringify(futureState.state))
    expect(parsePortableSave(JSON.stringify(futureState))).toMatchObject({ success: false })

    const missingExpedition = JSON.parse(raw) as Record<string, unknown>
    const missingExpeditionState = missingExpedition.state as Record<string, unknown>
    delete missingExpeditionState.expeditionEvents
    missingExpedition.checksum = checksumText(JSON.stringify(missingExpeditionState))
    expect(parsePortableSave(JSON.stringify(missingExpedition))).toMatchObject({
      success: false,
      message: expect.stringContaining('진행 데이터'),
    })

    const activeState = exportedState()
    const pending = createExpeditionPendingEvent(activeState.rng.seed, 0, 0, 100)
    activeState.expeditionEvents = {
      definitionVersion: 1,
      runPrestige: 0,
      milestoneMask: 1,
      pending: [pending],
      overflowCount: 0,
    }
    const malformedExpedition = JSON.parse(
      createPortableSave(activeState, 2_000)!,
    ) as Record<string, unknown>
    const malformedExpeditionState = malformedExpedition.state as {
      expeditionEvents: {
        pending: Array<{ resolvedChoices: Array<{ effect: { amount: number } }> }>
      }
    }
    malformedExpeditionState.expeditionEvents.pending[0]!.resolvedChoices[0]!.effect.amount += 1
    malformedExpedition.checksum = checksumText(JSON.stringify(malformedExpeditionState))
    expect(parsePortableSave(JSON.stringify(malformedExpedition))).toMatchObject({
      success: false,
      message: expect.stringContaining('진행 데이터'),
    })

    for (const claimedBossMilestoneMask of [-1, 0.5, 2 ** 30, '1']) {
      const invalidMask = JSON.parse(raw) as Record<string, unknown>
      const invalidMaskState = invalidMask.state as Record<string, unknown>
      invalidMaskState.claimedBossMilestoneMask = claimedBossMilestoneMask
      invalidMask.checksum = checksumText(JSON.stringify(invalidMaskState))
      expect(parsePortableSave(JSON.stringify(invalidMask))).toMatchObject({
        success: false,
        message: expect.stringContaining('진행 데이터'),
      })
    }
    const validMaximum = JSON.parse(raw) as Record<string, unknown>
    const maximumState = validMaximum.state as Record<string, unknown>
    maximumState.claimedBossMilestoneMask = MAX_BOSS_MILESTONE_MASK
    validMaximum.checksum = checksumText(JSON.stringify(maximumState))
    expect(parsePortableSave(JSON.stringify(validMaximum))).toMatchObject({
      success: true,
      preview: { state: { claimedBossMilestoneMask: MAX_BOSS_MILESTONE_MASK } },
    })
  })

  it('rejects a future expedition ledger even when its pending queue is empty', () => {
    const raw = JSON.parse(createPortableSave(exportedState(), 2_000)!) as {
      exportedAt: number
      state: ReturnType<typeof exportedState>
      checksum: string
    }
    raw.state.expeditionEvents = {
      ...raw.state.expeditionEvents,
      definitionVersion: 2,
      pending: [],
    }
    raw.checksum = checksumText(JSON.stringify(raw.state))

    expect(parsePortableSave(JSON.stringify(raw))).toEqual({
      success: false,
      message: '더 새로운 게임 버전에서 만든 저장 파일입니다.',
    })

    const storage = new MemoryStorage()
    expect(commitPortableSave(storage, {
      exportedAt: raw.exportedAt,
      checksum: raw.checksum,
      state: raw.state,
    }, null, 3_000)).toMatchObject({ status: 'blocked' })
    expect(storage.getItem(SAVE_SLOT_A_KEY)).toBeNull()
    expect(storage.getItem(SAVE_SLOT_B_KEY)).toBeNull()
  })

  it('migrates a transitional markerless schema5 portable save as literal v1', () => {
    const raw = JSON.parse(createPortableSave(exportedState(), 2_000)!) as {
      state: ReturnType<typeof exportedState> & {
        expeditionEvents: Record<string, unknown>
      }
      checksum: string
    }
    const markerlessState = raw.state as unknown as {
      expeditionEvents: Record<string, unknown>
    }
    delete markerlessState.expeditionEvents.definitionVersion
    raw.checksum = checksumText(JSON.stringify(raw.state))

    expect(parsePortableSave(JSON.stringify(raw))).toMatchObject({
      success: true,
      preview: {
        state: { expeditionEvents: { definitionVersion: 1 } },
      },
    })
  })

  it('never exports an invalid state or a timestamp older than the state', () => {
    const state = exportedState()
    expect(createPortableSave({ ...state, schemaVersion: 999 } as never, 2_000)).toBeNull()
    const result = parsePortableSave(createPortableSave(state, 500)!)
    expect(result).toMatchObject({ success: true, preview: { exportedAt: 1_000 } })
  })

  it('commits a preview at local revision + 1 and resets its offline timestamp', () => {
    const storage = new MemoryStorage()
    expect(saveGameAtRevision(storage, createInitialState(100), null)).toMatchObject({
      status: 'saved',
      revision: 1,
    })
    const exported = exportedState()
    exported.claimedBossMilestoneMask = 5
    const parsed = parsePortableSave(createPortableSave(exported, 2_000)!)
    expect(parsed.success).toBe(true)
    if (!parsed.success) return

    const committed = commitPortableSave(storage, parsed.preview, 1, 9_000)
    expect(committed).toMatchObject({
      status: 'saved',
      revision: 2,
      state: { lastSavedAt: 9_000, claimedBossMilestoneMask: 5, player: { gold: 321 } },
    })
    expect(parseSaveEnvelope(storage.getItem(SAVE_SLOT_B_KEY)!)).toMatchObject({
      revision: 2,
      savedAt: 9_000,
      state: { claimedBossMilestoneMask: 5, player: { gold: 321 } },
    })
  })

  it('does not touch either slot when an import preview is stale', () => {
    const storage = new MemoryStorage()
    saveGameAtRevision(storage, createInitialState(100), null)
    const parsed = parsePortableSave(createPortableSave(exportedState(), 2_000)!)
    expect(parsed.success).toBe(true)
    if (!parsed.success) return
    saveGameAtRevision(storage, createInitialState(200), 1)
    const beforeA = storage.getItem(SAVE_SLOT_A_KEY)
    const beforeB = storage.getItem(SAVE_SLOT_B_KEY)

    expect(commitPortableSave(storage, parsed.preview, 1, 9_000)).toEqual({
      status: 'conflict',
      currentRevision: 2,
    })
    expect(storage.getItem(SAVE_SLOT_A_KEY)).toBe(beforeA)
    expect(storage.getItem(SAVE_SLOT_B_KEY)).toBe(beforeB)
  })

  it('revalidates a preview at commit time and rejects later mutation', () => {
    const storage = new MemoryStorage()
    saveGameAtRevision(storage, createInitialState(100), null)
    const parsed = parsePortableSave(createPortableSave(exportedState(), 2_000)!)
    expect(parsed.success).toBe(true)
    if (!parsed.success) return
    parsed.preview.state.player.gold += 1
    const beforeA = storage.getItem(SAVE_SLOT_A_KEY)

    expect(commitPortableSave(storage, parsed.preview, 1, 9_000)).toEqual({
      status: 'blocked',
      currentRevision: 1,
    })
    expect(storage.getItem(SAVE_SLOT_A_KEY)).toBe(beforeA)
    expect(storage.getItem(SAVE_SLOT_B_KEY)).toBeNull()
  })
})
