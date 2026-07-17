import {
  decodeGameState,
  isGameState,
  saveGameAtRevision,
  type SaveCommitResult,
} from './persistence'
import type { GameState, StorageLike } from './types'

export const PORTABLE_SAVE_KIND = 'emberwatch-portable-save' as const
export const PORTABLE_SAVE_VERSION = 1 as const
export const MAX_PORTABLE_SAVE_BYTES = 1024 * 1024

interface PortableSaveV1 {
  kind: typeof PORTABLE_SAVE_KIND
  exportVersion: typeof PORTABLE_SAVE_VERSION
  exportedAt: number
  state: GameState
  checksum: string
}

export interface SaveImportPreview {
  exportedAt: number
  checksum: string
  state: GameState
}

export type SaveImportParseResult =
  | { success: true; preview: SaveImportPreview }
  | { success: false; message: string }

export type SaveImportCommitResult =
  | { status: 'saved'; revision: number; state: GameState }
  | Exclude<SaveCommitResult, { status: 'saved' }>

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isSafeNonNegativeInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0

function checksumText(text: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export function createPortableSave(state: GameState, now = Date.now()): string | null {
  if (!isGameState(state)) return null
  const exportedAt = Math.max(state.lastSavedAt, Math.max(0, Math.floor(now)))
  if (!Number.isSafeInteger(exportedAt)) return null
  const portableState = structuredClone(state)
  const serializedState = JSON.stringify(portableState)
  const payload: PortableSaveV1 = {
    kind: PORTABLE_SAVE_KIND,
    exportVersion: PORTABLE_SAVE_VERSION,
    exportedAt,
    state: portableState,
    checksum: checksumText(serializedState),
  }
  return JSON.stringify(payload, null, 2)
}

export function parsePortableSave(raw: string): SaveImportParseResult {
  if (new TextEncoder().encode(raw).byteLength > MAX_PORTABLE_SAVE_BYTES) {
    return { success: false, message: '저장 파일이 1 MiB 제한을 초과합니다.' }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw) as unknown
  } catch {
    return { success: false, message: 'JSON 형식이 올바르지 않습니다.' }
  }

  if (!isRecord(parsed) || parsed.kind !== PORTABLE_SAVE_KIND) {
    return { success: false, message: 'Emberwatch 저장 파일이 아닙니다.' }
  }
  if (
    isSafeNonNegativeInteger(parsed.exportVersion) &&
    parsed.exportVersion > PORTABLE_SAVE_VERSION
  ) {
    return { success: false, message: '더 새로운 게임 버전에서 만든 저장 파일입니다.' }
  }
  if (parsed.exportVersion !== PORTABLE_SAVE_VERSION) {
    return { success: false, message: '지원하지 않는 저장 파일 버전입니다.' }
  }
  if (!isSafeNonNegativeInteger(parsed.exportedAt)) {
    return { success: false, message: '내보낸 시각이 올바르지 않습니다.' }
  }
  if (typeof parsed.checksum !== 'string' || !/^[0-9a-f]{8}$/.test(parsed.checksum)) {
    return { success: false, message: '저장 파일 checksum이 없거나 올바르지 않습니다.' }
  }

  const serializedState = JSON.stringify(parsed.state)
  if (serializedState === undefined) {
    return { success: false, message: '게임 진행 데이터가 없습니다.' }
  }
  if (checksumText(serializedState) !== parsed.checksum) {
    return { success: false, message: '저장 파일이 손상되었거나 편집되었습니다.' }
  }
  const state = decodeGameState(parsed.state)
  if (state === null || state.lastSavedAt > parsed.exportedAt) {
    return { success: false, message: '게임 진행 데이터가 올바르지 않습니다.' }
  }

  return {
    success: true,
    preview: {
      exportedAt: parsed.exportedAt,
      checksum: parsed.checksum,
      state,
    },
  }
}

export function commitPortableSave(
  storage: StorageLike,
  preview: SaveImportPreview,
  expectedRevision: number | null,
  now = Date.now(),
): SaveImportCommitResult {
  const importedAt = Math.max(0, Math.floor(now))
  if (!Number.isSafeInteger(importedAt)) {
    return { status: 'blocked', currentRevision: expectedRevision }
  }
  const serializedState = JSON.stringify(preview.state)
  if (
    serializedState === undefined ||
    checksumText(serializedState) !== preview.checksum ||
    !isSafeNonNegativeInteger(preview.exportedAt)
  ) {
    return { status: 'blocked', currentRevision: expectedRevision }
  }
  const state = decodeGameState(preview.state)
  if (state === null || state.lastSavedAt > preview.exportedAt) {
    return { status: 'blocked', currentRevision: expectedRevision }
  }
  state.lastSavedAt = importedAt
  const committed = saveGameAtRevision(storage, state, expectedRevision)
  return committed.status === 'saved' ? { ...committed, state } : committed
}
