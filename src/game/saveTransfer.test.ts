import { describe, expect, it } from 'vitest'
import portableSaveV1 from './fixtures/portable-save-v1.json'
import { createInitialState } from './engine'
import { SAVE_SLOT_A_KEY, SAVE_SLOT_B_KEY, parseSaveEnvelope, saveGameAtRevision } from './persistence'
import {
  MAX_PORTABLE_SAVE_BYTES,
  PORTABLE_SAVE_VERSION,
  commitPortableSave,
  createPortableSave,
  parsePortableSave,
} from './saveTransfer'

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

  it('migrates and commits a checked-in schema1 portable backup', () => {
    const parsed = parsePortableSave(JSON.stringify(portableSaveV1))
    expect(parsed).toMatchObject({
      success: true,
      preview: {
        exportedAt: portableSaveV1.exportedAt,
        state: {
          schemaVersion: 2,
          rng: { algorithm: 'xorshift32-v1', seed: 873835004, draws: 0 },
          player: { gold: 87 },
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
      state: { schemaVersion: 2, rng: { seed: 873835004 }, lastSavedAt: 5_000 },
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
    const parsed = parsePortableSave(createPortableSave(exported, 2_000)!)
    expect(parsed.success).toBe(true)
    if (!parsed.success) return

    const committed = commitPortableSave(storage, parsed.preview, 1, 9_000)
    expect(committed).toMatchObject({
      status: 'saved',
      revision: 2,
      state: { lastSavedAt: 9_000, player: { gold: 321 } },
    })
    expect(parseSaveEnvelope(storage.getItem(SAVE_SLOT_B_KEY)!)).toMatchObject({
      revision: 2,
      savedAt: 9_000,
      state: { player: { gold: 321 } },
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
