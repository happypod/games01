import {
  COMPANION_ATTACK_INTERVAL_MS,
  COMPANION_DEFINITIONS,
  EXPEDITION_DEFINITION_VERSION,
  EXPEDITION_MILESTONE_COUNT,
  MAX_OFFLINE_MS,
  MAX_STAGE,
  SKILL_DEFINITIONS,
  UPGRADE_DEFINITIONS,
  getEnemyDefinition,
} from './content'
import { advanceGame, createInitialState } from './engine'
import { getHeroStats } from './formulas'
import {
  deriveLegacyBossMilestoneMask,
  isBossMilestoneMask,
} from './bossMilestones'
import {
  deriveLegacyExpeditionMilestoneMask,
  isValidExpeditionEventState,
} from './expedition'
import { MAX_UINT32, createRngState, seedFromText } from './rng'
import {
  COMPANION_IDS,
  EXPEDITION_DEFINITION_IDS,
  RNG_ALGORITHM,
  SAVE_VERSION,
  SKILL_IDS,
  UPGRADE_IDS,
} from './types'
import type {
  AdvanceReport,
  BattleState,
  ExpeditionEventState,
  GameState,
  LifetimeStats,
  PlayerState,
  RngState,
  StorageLike,
} from './types'

export const LEGACY_SAVE_FORMAT_VERSION = 2 as const
export const SAVE_FORMAT_VERSION = 3 as const
export const LEGACY_SAVE_KEY = 'emberwatch.save.v1'
export const SAVE_SLOT_A_KEY = 'emberwatch.save.v2.a'
export const SAVE_SLOT_B_KEY = 'emberwatch.save.v2.b'
export const SAVE_SLOT_KEYS = [SAVE_SLOT_A_KEY, SAVE_SLOT_B_KEY] as const

/** @deprecated v1 단일 키 fixture와 호환하기 위한 별칭입니다. */
export const SAVE_KEY = LEGACY_SAVE_KEY

type SaveSlotKey = (typeof SAVE_SLOT_KEYS)[number]

export interface SaveEnvelope {
  formatVersion: typeof LEGACY_SAVE_FORMAT_VERSION | typeof SAVE_FORMAT_VERSION
  revision: number
  savedAt: number
  state: GameState
}

export interface BootstrapResult {
  state: GameState
  offlineReport: AdvanceReport | null
  recoveredFromInvalidSave: boolean
  saveHealthy: boolean
  saveBlocked: boolean
  revision: number | null
}

export type SaveCommitResult =
  | { status: 'saved'; revision: number }
  | { status: 'conflict'; currentRevision: number | null }
  | { status: 'blocked'; currentRevision: number | null }

export type BootstrapMode = 'writer' | 'reader'

type SlotRead =
  | { key: SaveSlotKey; status: 'empty' }
  | { key: SaveSlotKey; status: 'invalid' }
  | { key: SaveSlotKey; status: 'future' }
  | { key: SaveSlotKey; status: 'error' }
  | { key: SaveSlotKey; status: 'valid'; envelope: SaveEnvelope }

type LegacyRead =
  | { status: 'empty' }
  | { status: 'invalid' }
  | { status: 'future' }
  | { status: 'error' }
  | { status: 'valid'; state: GameState }

type LegacyPlayerState = Omit<PlayerState, 'companion'>
type LegacyBattleState = Omit<BattleState, 'companionCooldownMs'>

interface LegacyGameStateV1 {
  schemaVersion: 1
  lastSavedAt: number
  player: LegacyPlayerState
  battle: LegacyBattleState
  stats: LifetimeStats
}

interface LegacyGameStateV2 {
  schemaVersion: 2
  lastSavedAt: number
  rng: RngState
  player: LegacyPlayerState
  battle: LegacyBattleState
  stats: LifetimeStats
}

interface LegacyGameStateV3 {
  schemaVersion: 3
  lastSavedAt: number
  rng: RngState
  player: PlayerState
  battle: BattleState
  stats: LifetimeStats
}

type LegacyGameStateV4 = Omit<LegacyGameStateV3, 'schemaVersion'> & {
  schemaVersion: 4
  claimedBossMilestoneMask: number
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isSafeNonNegativeInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0

function hasNumericKeys<T extends readonly string[]>(value: unknown, keys: T): boolean {
  return isRecord(value) && keys.every((key) => isSafeNonNegativeInteger(value[key]))
}

function hasValidSharedState(value: Record<string, unknown>): boolean {
  const player = value.player
  const battle = value.battle
  const stats = value.stats
  if (!isRecord(player) || !isRecord(battle) || !isRecord(stats)) return false

  return (
    isSafeNonNegativeInteger(value.lastSavedAt) &&
    isSafeNonNegativeInteger(player.level) &&
    player.level >= 1 &&
    isSafeNonNegativeInteger(player.xp) &&
    isSafeNonNegativeInteger(player.gold) &&
    isSafeNonNegativeInteger(player.essence) &&
    isSafeNonNegativeInteger(player.currentHp) &&
    isSafeNonNegativeInteger(player.skillPoints) &&
    hasNumericKeys(player.upgrades, UPGRADE_IDS) &&
    hasNumericKeys(player.skills, SKILL_IDS) &&
    isSafeNonNegativeInteger(battle.stage) &&
    battle.stage >= 1 &&
    isSafeNonNegativeInteger(battle.highestStage) &&
    battle.highestStage >= 1 &&
    battle.highestStage >= battle.stage &&
    isSafeNonNegativeInteger(battle.enemyHp) &&
    isSafeNonNegativeInteger(battle.roundRemainderMs) &&
    isSafeNonNegativeInteger(battle.powerStrikeCooldownMs) &&
    isSafeNonNegativeInteger(battle.kills) &&
    isSafeNonNegativeInteger(battle.defeats) &&
    isSafeNonNegativeInteger(stats.goldEarned) &&
    isSafeNonNegativeInteger(stats.enemiesDefeated) &&
    isSafeNonNegativeInteger(stats.prestiges)
  )
}

function isLegacyGameStateV1(value: unknown): value is LegacyGameStateV1 {
  return isRecord(value) && value.schemaVersion === 1 && hasValidSharedState(value)
}

function hasValidRng(value: unknown): value is RngState {
  return (
    isRecord(value) &&
    value.algorithm === RNG_ALGORITHM &&
    isSafeNonNegativeInteger(value.seed) &&
    value.seed >= 1 &&
    value.seed <= MAX_UINT32 &&
    isSafeNonNegativeInteger(value.state) &&
    value.state >= 1 &&
    value.state <= MAX_UINT32 &&
    isSafeNonNegativeInteger(value.draws)
  )
}

function isLegacyGameStateV2(value: unknown): value is LegacyGameStateV2 {
  return (
    isRecord(value) &&
    value.schemaVersion === 2 &&
    hasValidSharedState(value) &&
    hasValidRng(value.rng)
  )
}

function hasValidCompanionState(value: Record<string, unknown>): boolean {
  const player = value.player
  const battle = value.battle
  if (!isRecord(player) || !isRecord(battle)) return false
  const companion = player.companion
  if (!isRecord(companion) || !isSafeNonNegativeInteger(companion.rank)) return false
  const validCompanion =
    (companion.id === null && companion.rank === 0) ||
    (COMPANION_IDS.some((id) => id === companion.id) && companion.rank >= 1)
  return validCompanion && isSafeNonNegativeInteger(battle.companionCooldownMs)
}

function isLegacyGameStateV3(value: unknown): value is LegacyGameStateV3 {
  return (
    isRecord(value) &&
    value.schemaVersion === 3 &&
    hasValidSharedState(value) &&
    hasValidCompanionState(value) &&
    hasValidRng(value.rng)
  )
}

function isLegacyGameStateV4(value: unknown): value is LegacyGameStateV4 {
  return (
    isRecord(value) &&
    value.schemaVersion === 4 &&
    hasValidSharedState(value) &&
    isBossMilestoneMask(value.claimedBossMilestoneMask) &&
    hasValidCompanionState(value) &&
    hasValidRng(value.rng)
  )
}

function hasStructurallySafeExpeditionEvents(value: unknown): value is ExpeditionEventState {
  if (
    !isRecord(value) ||
    !isSafeNonNegativeInteger(value.definitionVersion) ||
    !isSafeNonNegativeInteger(value.runPrestige) ||
    !isSafeNonNegativeInteger(value.milestoneMask) ||
    !Array.isArray(value.pending) ||
    !isSafeNonNegativeInteger(value.overflowCount)
  ) {
    return false
  }

  return value.pending.every((pending) => {
    if (
      !isRecord(pending) ||
      typeof pending.eventId !== 'string' ||
      !EXPEDITION_DEFINITION_IDS.some((id) => id === pending.definitionId) ||
      !isSafeNonNegativeInteger(pending.definitionVersion) ||
      !isSafeNonNegativeInteger(pending.milestoneIndex) ||
      pending.milestoneIndex >= EXPEDITION_MILESTONE_COUNT ||
      !isSafeNonNegativeInteger(pending.milestoneStage) ||
      !isSafeNonNegativeInteger(pending.maxHpAtOffer) ||
      !Array.isArray(pending.resolvedChoices) ||
      pending.resolvedChoices.length !== 2
    ) {
      return false
    }

    return pending.resolvedChoices.every((choice) => {
      if (
        !isRecord(choice) ||
        (choice.choiceId !== 'gold' && choice.choiceId !== 'recovery') ||
        !isRecord(choice.effect)
      ) {
        return false
      }
      return (
        (choice.effect.type === 'grantGold' || choice.effect.type === 'restoreHp') &&
        isSafeNonNegativeInteger(choice.effect.amount)
      )
    })
  })
}

function hasValidExpeditionEvents(
  value: unknown,
  stats: LifetimeStats,
  rng: RngState,
  battle: BattleState,
): value is ExpeditionEventState {
  return (
    hasStructurallySafeExpeditionEvents(value) &&
    isValidExpeditionEventState(value, rng.seed, stats.prestiges, battle.highestStage)
  )
}

export function isGameState(value: unknown): value is GameState {
  if (!isRecord(value) || value.schemaVersion !== SAVE_VERSION || !hasValidSharedState(value)) {
    return false
  }
  return (
    isBossMilestoneMask(value.claimedBossMilestoneMask) &&
    hasValidCompanionState(value) &&
    hasValidRng(value.rng) &&
    hasValidExpeditionEvents(
      value.expeditionEvents,
      value.stats as LifetimeStats,
      value.rng,
      value.battle as BattleState,
    )
  )
}

function normalizeGameState(value: GameState): GameState {
  const state = structuredClone(value)
  state.battle.stage = Math.min(MAX_STAGE, Math.max(1, state.battle.stage))
  state.battle.highestStage = Math.min(
    MAX_STAGE,
    Math.max(state.battle.stage, state.battle.highestStage),
  )
  const enemy = getEnemyDefinition(state.battle.stage)
  state.battle.enemyHp = Math.min(enemy.maxHp, Math.max(1, state.battle.enemyHp))
  state.battle.roundRemainderMs = Math.min(999, state.battle.roundRemainderMs)
  state.battle.powerStrikeCooldownMs = Math.min(5_000, state.battle.powerStrikeCooldownMs)
  if (state.player.companion.id === null) {
    state.player.companion.rank = 0
    state.battle.companionCooldownMs = 0
  } else {
    state.player.companion.rank = Math.min(
      COMPANION_DEFINITIONS[state.player.companion.id].maxRank,
      Math.max(1, state.player.companion.rank),
    )
    state.battle.companionCooldownMs = Math.min(
      COMPANION_ATTACK_INTERVAL_MS,
      state.battle.companionCooldownMs,
    )
  }
  state.player.level = Math.min(999, state.player.level)
  for (const id of UPGRADE_IDS) {
    state.player.upgrades[id] = Math.min(
      UPGRADE_DEFINITIONS[id].maxLevel,
      state.player.upgrades[id],
    )
  }
  for (const id of SKILL_IDS) {
    state.player.skills[id] = Math.min(SKILL_DEFINITIONS[id].maxRank, state.player.skills[id])
  }
  state.player.currentHp = Math.min(getHeroStats(state).maxHp, Math.max(1, state.player.currentHp))
  return state
}

function deriveLegacySeed(state: LegacyGameStateV1): number {
  const values = [
    state.lastSavedAt,
    state.player.level,
    state.player.xp,
    state.player.gold,
    state.player.essence,
    state.player.currentHp,
    state.player.skillPoints,
    ...UPGRADE_IDS.map((id) => state.player.upgrades[id]),
    ...SKILL_IDS.map((id) => state.player.skills[id]),
    state.battle.stage,
    state.battle.highestStage,
    state.battle.enemyHp,
    state.battle.roundRemainderMs,
    state.battle.powerStrikeCooldownMs,
    state.battle.kills,
    state.battle.defeats,
    state.stats.goldEarned,
    state.stats.enemiesDefeated,
    state.stats.prestiges,
  ]
  return seedFromText(`emberwatch-game-state-v1|${values.join('|')}`)
}

function createMigratedExpeditionEvents(
  highestStage: number,
  prestiges: number,
): ExpeditionEventState {
  return {
    definitionVersion: EXPEDITION_DEFINITION_VERSION,
    runPrestige: prestiges,
    milestoneMask: deriveLegacyExpeditionMilestoneMask(highestStage),
    pending: [],
    overflowCount: 0,
  }
}

function migrateLegacyGameState(
  state: LegacyGameStateV1 | LegacyGameStateV2,
  rng: RngState,
): GameState {
  const legacy = structuredClone(state)
  const migrated: GameState = {
    schemaVersion: SAVE_VERSION,
    lastSavedAt: legacy.lastSavedAt,
    claimedBossMilestoneMask: deriveLegacyBossMilestoneMask(
      legacy.battle.highestStage,
      legacy.stats.prestiges,
    ),
    expeditionEvents: createMigratedExpeditionEvents(
      legacy.battle.highestStage,
      legacy.stats.prestiges,
    ),
    rng: { ...rng },
    player: {
      ...legacy.player,
      companion: { id: null, rank: 0 },
    },
    battle: {
      ...legacy.battle,
      companionCooldownMs: 0,
    },
    stats: { ...legacy.stats },
  }
  return normalizeGameState(migrated)
}

function migrateLegacyGameStateV3(state: LegacyGameStateV3): GameState {
  const legacy = structuredClone(state)
  const migrated: GameState = {
    schemaVersion: SAVE_VERSION,
    lastSavedAt: legacy.lastSavedAt,
    claimedBossMilestoneMask: deriveLegacyBossMilestoneMask(
      legacy.battle.highestStage,
      legacy.stats.prestiges,
    ),
    expeditionEvents: createMigratedExpeditionEvents(
      legacy.battle.highestStage,
      legacy.stats.prestiges,
    ),
    rng: { ...legacy.rng },
    player: {
      ...legacy.player,
      upgrades: { ...legacy.player.upgrades },
      skills: { ...legacy.player.skills },
      companion: { ...legacy.player.companion },
    },
    battle: { ...legacy.battle },
    stats: { ...legacy.stats },
  }
  return normalizeGameState(migrated)
}

function migrateLegacyGameStateV4(state: LegacyGameStateV4): GameState {
  const legacy = structuredClone(state)
  const migrated: GameState = {
    schemaVersion: SAVE_VERSION,
    lastSavedAt: legacy.lastSavedAt,
    claimedBossMilestoneMask: legacy.claimedBossMilestoneMask,
    expeditionEvents: createMigratedExpeditionEvents(
      legacy.battle.highestStage,
      legacy.stats.prestiges,
    ),
    rng: { ...legacy.rng },
    player: {
      ...legacy.player,
      upgrades: { ...legacy.player.upgrades },
      skills: { ...legacy.player.skills },
      companion: { ...legacy.player.companion },
    },
    battle: { ...legacy.battle },
    stats: { ...legacy.stats },
  }
  return normalizeGameState(migrated)
}

export function decodeGameState(value: unknown): GameState | null {
  if (isGameState(value)) return normalizeGameState(value)
  if (
    isRecord(value) &&
    value.schemaVersion === SAVE_VERSION &&
    isRecord(value.expeditionEvents) &&
    value.expeditionEvents.definitionVersion === undefined
  ) {
    const transitional = structuredClone(value)
    if (isRecord(transitional.expeditionEvents)) {
      transitional.expeditionEvents.definitionVersion = 1
      if (isGameState(transitional)) return normalizeGameState(transitional)
    }
  }
  if (isLegacyGameStateV4(value)) return migrateLegacyGameStateV4(value)
  if (isLegacyGameStateV3(value)) return migrateLegacyGameStateV3(value)
  if (isLegacyGameStateV2(value)) return migrateLegacyGameState(value, value.rng)
  return isLegacyGameStateV1(value)
    ? migrateLegacyGameState(value, createRngState(deriveLegacySeed(value)))
    : null
}

/** 단일 키의 지원 가능한 raw GameState를 읽는 migration 진입점입니다. */
export function parseSave(raw: string): GameState | null {
  try {
    return decodeGameState(JSON.parse(raw) as unknown)
  } catch {
    return null
  }
}

export function parseSaveEnvelope(raw: string): SaveEnvelope | null {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (
      !isRecord(parsed) ||
      (parsed.formatVersion !== LEGACY_SAVE_FORMAT_VERSION &&
        parsed.formatVersion !== SAVE_FORMAT_VERSION) ||
      !isSafeNonNegativeInteger(parsed.revision) ||
      parsed.revision < 1 ||
      !isSafeNonNegativeInteger(parsed.savedAt)
    ) {
      return null
    }

    const state = decodeGameState(parsed.state)
    if (state === null || state.lastSavedAt !== parsed.savedAt) return null
    return {
      formatVersion: parsed.formatVersion,
      revision: parsed.revision,
      savedAt: parsed.savedAt,
      state,
    }
  } catch {
    return null
  }
}

function hasFutureSaveData(raw: string): boolean {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed)) return false
    if (
      isSafeNonNegativeInteger(parsed.formatVersion) &&
      parsed.formatVersion > SAVE_FORMAT_VERSION
    ) {
      return true
    }
    if (!isRecord(parsed.state)) return false
    return isFutureGameStateValue(parsed.state)
  } catch {
    return false
  }
}

function hasFutureGameState(raw: string): boolean {
  try {
    const parsed: unknown = JSON.parse(raw)
    return isFutureGameStateValue(parsed)
  } catch {
    return false
  }
}

export function isFutureGameStateValue(value: unknown): boolean {
  if (!isRecord(value)) return false
  if (
    isSafeNonNegativeInteger(value.schemaVersion) &&
    value.schemaVersion > SAVE_VERSION
  ) {
    return true
  }
  return hasFutureExpeditionDefinitionVersion(value)
}

function hasFutureExpeditionDefinitionVersion(value: Record<string, unknown>): boolean {
  if (value.schemaVersion !== SAVE_VERSION || !isRecord(value.expeditionEvents)) {
    return false
  }
  if (
    isSafeNonNegativeInteger(value.expeditionEvents.definitionVersion) &&
    value.expeditionEvents.definitionVersion > EXPEDITION_DEFINITION_VERSION
  ) {
    return true
  }
  const pending = value.expeditionEvents.pending
  if (!Array.isArray(pending)) return false
  return pending.some(
    (event) =>
      isRecord(event) &&
      isSafeNonNegativeInteger(event.definitionVersion) &&
      event.definitionVersion > EXPEDITION_DEFINITION_VERSION,
  )
}

function readSlot(storage: StorageLike, key: SaveSlotKey): SlotRead {
  try {
    const raw = storage.getItem(key)
    if (raw === null) return { key, status: 'empty' }
    const envelope = parseSaveEnvelope(raw)
    if (envelope === null && hasFutureSaveData(raw)) return { key, status: 'future' }
    return envelope === null
      ? { key, status: 'invalid' }
      : { key, status: 'valid', envelope }
  } catch {
    return { key, status: 'error' }
  }
}

function readSlots(storage: StorageLike): [SlotRead, SlotRead] {
  return [readSlot(storage, SAVE_SLOT_A_KEY), readSlot(storage, SAVE_SLOT_B_KEY)]
}

function selectLatestSlot(slots: readonly SlotRead[]): Extract<SlotRead, { status: 'valid' }> | null {
  const valid = slots.filter(
    (slot): slot is Extract<SlotRead, { status: 'valid' }> => slot.status === 'valid',
  )
  if (valid.length === 0) return null

  return valid.reduce((latest, candidate) => {
    if (candidate.envelope.revision !== latest.envelope.revision) {
      return candidate.envelope.revision > latest.envelope.revision ? candidate : latest
    }
    if (candidate.envelope.savedAt !== latest.envelope.savedAt) {
      return candidate.envelope.savedAt > latest.envelope.savedAt ? candidate : latest
    }
    return candidate.key === SAVE_SLOT_A_KEY ? candidate : latest
  })
}

function canonicalStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalStringify).join(',')}]`
  }
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalStringify(value[key])}`)
      .join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}

function hasConflictingRevisionTie(slots: readonly SlotRead[]): boolean {
  const valid = slots.filter(
    (slot): slot is Extract<SlotRead, { status: 'valid' }> => slot.status === 'valid',
  )
  const [first, second] = valid
  if (valid.length !== 2 || first === undefined || second === undefined) return false
  return (
    first.envelope.revision === second.envelope.revision &&
    canonicalStringify(first.envelope.state) !== canonicalStringify(second.envelope.state)
  )
}

function readLegacySave(storage: StorageLike): LegacyRead {
  try {
    const raw = storage.getItem(LEGACY_SAVE_KEY)
    if (raw === null) return { status: 'empty' }
    const state = parseSave(raw)
    if (state === null && hasFutureGameState(raw)) return { status: 'future' }
    return state === null ? { status: 'invalid' } : { status: 'valid', state }
  } catch {
    return { status: 'error' }
  }
}

function createEnvelope(state: GameState, revision: number): SaveEnvelope {
  return {
    formatVersion: SAVE_FORMAT_VERSION,
    revision,
    savedAt: state.lastSavedAt,
    state,
  }
}

function commitGame(
  storage: StorageLike,
  state: GameState,
  expectedRevision?: number | null,
): SaveCommitResult {
  if (!isGameState(state)) return { status: 'blocked', currentRevision: null }
  const slots = readSlots(storage)
  if (slots.some((slot) => slot.status === 'error' || slot.status === 'future')) {
    return { status: 'blocked', currentRevision: null }
  }

  const latest = selectLatestSlot(slots)
  const currentRevision = latest?.envelope.revision ?? null
  const legacy = readLegacySave(storage)
  if (legacy.status === 'error' || legacy.status === 'future') {
    return { status: 'blocked', currentRevision }
  }
  if (expectedRevision !== undefined && expectedRevision !== currentRevision) {
    return { status: 'conflict', currentRevision }
  }
  if (expectedRevision !== undefined && hasConflictingRevisionTie(slots)) {
    return { status: 'blocked', currentRevision }
  }
  if (currentRevision === Number.MAX_SAFE_INTEGER) {
    return { status: 'blocked', currentRevision }
  }
  const targetKey = latest?.key === SAVE_SLOT_A_KEY ? SAVE_SLOT_B_KEY : SAVE_SLOT_A_KEY
  const revision = (currentRevision ?? 0) + 1
  const serialized = JSON.stringify(createEnvelope(normalizeGameState(state), revision))
  let previousTargetRaw: string | null

  try {
    previousTargetRaw = storage.getItem(targetKey)
  } catch {
    return { status: 'blocked', currentRevision }
  }

  const restoreTarget = () => {
    try {
      if (previousTargetRaw === null) storage.removeItem(targetKey)
      else storage.setItem(targetKey, previousTargetRaw)
      return storage.getItem(targetKey) === previousTargetRaw
    } catch {
      return false
    }
  }

  try {
    storage.setItem(targetKey, serialized)
    const written = storage.getItem(targetKey)
    if (written !== serialized) {
      restoreTarget()
      return { status: 'blocked', currentRevision }
    }
    const verified = written === null ? null : parseSaveEnvelope(written)
    if (verified === null || verified.revision !== revision) {
      restoreTarget()
      return { status: 'blocked', currentRevision }
    }
    try {
      storage.removeItem(LEGACY_SAVE_KEY)
    } catch {
      // A/B 슬롯 기록은 성공했으므로 legacy 정리 실패는 저장 실패로 취급하지 않습니다.
    }
    return { status: 'saved', revision }
  } catch {
    restoreTarget()
    return { status: 'blocked', currentRevision }
  }
}

/**
 * 단일 writer가 보장된 migration·테스트용 호환 API입니다.
 * 브라우저 런타임은 반드시 saveGameAtRevision을 사용합니다.
 */
export function saveGame(storage: StorageLike, state: GameState): boolean {
  return commitGame(storage, state).status === 'saved'
}

export function saveGameAtRevision(
  storage: StorageLike,
  state: GameState,
  expectedRevision: number | null,
): SaveCommitResult {
  return commitGame(storage, state, expectedRevision)
}

export function clearSave(storage: StorageLike): boolean {
  let success = true
  for (const key of [LEGACY_SAVE_KEY, ...SAVE_SLOT_KEYS]) {
    try {
      storage.removeItem(key)
    } catch {
      success = false
    }
  }
  return success
}

function failedBootstrap(now: number): BootstrapResult {
  return {
    state: createInitialState(now),
    offlineReport: null,
    recoveredFromInvalidSave: true,
    saveHealthy: false,
    saveBlocked: true,
    revision: null,
  }
}

export function bootstrapGame(
  storage: StorageLike,
  now = Date.now(),
  mode: BootstrapMode = 'writer',
): BootstrapResult {
  const slots = readSlots(storage)
  if (slots.some((slot) => slot.status === 'error' || slot.status === 'future')) {
    return failedBootstrap(now)
  }

  const latest = selectLatestSlot(slots)
  const revision = latest?.envelope.revision ?? null
  const hadInvalidSlot = slots.some((slot) => slot.status === 'invalid')
  let loaded: GameState | null = latest?.envelope.state ?? null
  let recoveredFromInvalidSave = hadInvalidSlot || hasConflictingRevisionTie(slots)

  if (loaded === null) {
    const legacy = readLegacySave(storage)
    if (legacy.status === 'error' || legacy.status === 'future') return failedBootstrap(now)
    if (legacy.status === 'valid') loaded = legacy.state
    if (legacy.status === 'invalid') recoveredFromInvalidSave = true
  }

  if (loaded === null) {
    const state = createInitialState(now)
    if (mode === 'reader') {
      return {
        state,
        offlineReport: null,
        recoveredFromInvalidSave,
        saveHealthy: true,
        saveBlocked: false,
        revision: null,
      }
    }
    const committed = saveGameAtRevision(storage, state, revision)
    return {
      state,
      offlineReport: null,
      recoveredFromInvalidSave,
      saveHealthy: committed.status === 'saved',
      saveBlocked: committed.status !== 'saved',
      revision: committed.status === 'saved' ? committed.revision : revision,
    }
  }

  if (mode === 'reader') {
    return {
      state: loaded,
      offlineReport: null,
      recoveredFromInvalidSave,
      saveHealthy: true,
      saveBlocked: false,
      revision,
    }
  }

  const elapsedMs = Math.min(MAX_OFFLINE_MS, Math.max(0, now - loaded.lastSavedAt))
  const result = advanceGame(loaded, elapsedMs)
  result.state.lastSavedAt = now
  const committed = saveGameAtRevision(storage, result.state, revision)
  return {
    state: result.state,
    offlineReport: elapsedMs >= 5_000 ? result.report : null,
    recoveredFromInvalidSave,
    saveHealthy: committed.status === 'saved',
    saveBlocked: committed.status !== 'saved',
    revision: committed.status === 'saved' ? committed.revision : revision,
  }
}
