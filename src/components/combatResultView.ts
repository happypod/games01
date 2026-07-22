import type {
  BossMilestoneRewardSnapshot,
  CombatEvent,
  CombatEventBatch,
  CombatEventCursor,
} from '../game/types'

export const COMBAT_RESULT_QUEUE_LIMIT = 3

export interface CombatResultCoordinate {
  readonly roundSequence: CombatEventCursor
  readonly ordinal: number
}

interface CombatResultSnapshotBase extends CombatResultCoordinate {
  readonly id: string
  readonly stage: number
}

export interface BossVictoryResultSnapshot extends CombatResultSnapshotBase {
  readonly type: 'bossVictory'
  readonly ordinal: 30
  readonly defeatedStage: number
  readonly nextStage: number
  readonly gold: number
  readonly xp: number
  readonly balanceGold: number
  readonly milestoneReward: BossMilestoneRewardSnapshot | null
}

export interface DefeatResultSnapshot extends CombatResultSnapshotBase {
  readonly type: 'defeat'
  readonly ordinal: 30
  readonly damage: number
  readonly defeatedAtStage: number
  readonly returnStage: number
  readonly highestStage: number
}

export type CombatResultSnapshot =
  | BossVictoryResultSnapshot
  | DefeatResultSnapshot

export interface CombatResultConsumerState {
  readonly streamGeneration: number
  readonly queue: readonly CombatResultSnapshot[]
  readonly overflowCount: number
  readonly announcement: string
  readonly pinnedResult: CombatResultSnapshot | null
  readonly lastConsumedCoordinate: CombatResultCoordinate | null
  readonly lastBatchCursor: CombatEventCursor
  readonly lastBatchTotalEvents: number
}

const EMPTY_QUEUE: readonly CombatResultSnapshot[] = Object.freeze([])

function parseCursor(cursor: CombatEventCursor): bigint {
  if (!/^(0|[1-9]\d*)$/.test(cursor)) {
    throw new RangeError('combat result cursor must be a canonical non-negative decimal string')
  }
  return BigInt(cursor)
}

export function compareCombatResultCoordinates(
  left: CombatResultCoordinate,
  right: CombatResultCoordinate,
): number {
  const leftRound = parseCursor(left.roundSequence)
  const rightRound = parseCursor(right.roundSequence)
  if (leftRound !== rightRound) return leftRound < rightRound ? -1 : 1
  return left.ordinal - right.ordinal
}

function compareBatchCursors(left: CombatEventCursor, right: CombatEventCursor): number {
  const leftCursor = parseCursor(left)
  const rightCursor = parseCursor(right)
  return leftCursor < rightCursor ? -1 : leftCursor > rightCursor ? 1 : 0
}

function freezeCoordinate(event: CombatEvent): CombatResultCoordinate {
  return Object.freeze({
    roundSequence: event.roundSequence,
    ordinal: event.ordinal,
  })
}

function hasCanonicalCoordinate(event: CombatEvent): boolean {
  try {
    parseCursor(event.roundSequence)
    return Number.isSafeInteger(event.ordinal) && event.ordinal >= 0
  } catch {
    return false
  }
}

function freezeMilestoneReward(
  reward: BossMilestoneRewardSnapshot | null,
): BossMilestoneRewardSnapshot | null {
  return reward === null ? null : Object.freeze({ ...reward })
}

export function createCombatResultSnapshot(
  event: CombatEvent,
): CombatResultSnapshot | null {
  if (event.type === 'bossVictory') {
    return Object.freeze({
      id: event.id,
      type: event.type,
      roundSequence: event.roundSequence,
      ordinal: event.ordinal,
      stage: event.stage,
      defeatedStage: event.defeatedStage,
      nextStage: event.nextStage,
      gold: event.gold,
      xp: event.xp,
      balanceGold: event.snapshot.gold,
      milestoneReward: freezeMilestoneReward(event.milestoneReward),
    })
  }
  if (event.type === 'defeat') {
    return Object.freeze({
      id: event.id,
      type: event.type,
      roundSequence: event.roundSequence,
      ordinal: event.ordinal,
      stage: event.stage,
      damage: event.damage,
      defeatedAtStage: event.defeatedAtStage,
      returnStage: event.returnStage,
      highestStage: event.highestStage,
    })
  }
  return null
}

function addOverflowCount(current: number, added: number): number {
  return current > Number.MAX_SAFE_INTEGER - added
    ? Number.MAX_SAFE_INTEGER
    : current + added
}

function createAnnouncement(results: readonly CombatResultSnapshot[]): string {
  const latest = results.at(-1)
  if (latest === undefined) return ''
  if (results.length === 1) {
    return latest.type === 'bossVictory'
      ? `새 전투 결과: 스테이지 ${latest.defeatedStage} 보스 승리. 라운드 ${latest.roundSequence}.`
      : `새 전투 결과: 스테이지 ${latest.defeatedAtStage} 패배, 스테이지 ${latest.returnStage} 복귀. 라운드 ${latest.roundSequence}.`
  }

  let victories = 0
  let defeats = 0
  for (const result of results) {
    if (result.type === 'bossVictory') victories += 1
    else defeats += 1
  }
  return `새 전투 결과 ${results.length}건: 보스 승리 ${victories}건, 패배 ${defeats}건. 마지막 라운드 ${latest.roundSequence}.`
}

function createEmptyConsumerState(streamGeneration: number): CombatResultConsumerState {
  return {
    streamGeneration,
    queue: EMPTY_QUEUE,
    overflowCount: 0,
    announcement: '',
    pinnedResult: null,
    lastConsumedCoordinate: null,
    lastBatchCursor: '0',
    lastBatchTotalEvents: 0,
  }
}

function consumeCurrentGenerationBatch(
  current: CombatResultConsumerState,
  batch: CombatEventBatch,
): CombatResultConsumerState {
  const staleBatch =
    compareBatchCursors(batch.nextCursor, current.lastBatchCursor) < 0 ||
    batch.totalEvents < current.lastBatchTotalEvents
  if (staleBatch) return current

  const orderedEvents = batch.events
    .filter(hasCanonicalCoordinate)
    .sort(compareCombatResultCoordinates)
  let lastCoordinate = current.lastConsumedCoordinate
  const newResults: CombatResultSnapshot[] = []

  for (const event of orderedEvents) {
    if (
      lastCoordinate !== null &&
      compareCombatResultCoordinates(event, lastCoordinate) <= 0
    ) {
      continue
    }
    lastCoordinate = freezeCoordinate(event)
    const result = createCombatResultSnapshot(event)
    if (result !== null) newResults.push(result)
  }

  const nextQueue = [...current.queue, ...newResults]
  const removedCount = Math.max(0, nextQueue.length - COMBAT_RESULT_QUEUE_LIMIT)
  const boundedQueue = removedCount === 0
    ? nextQueue
    : nextQueue.slice(removedCount)
  const sourceChanged =
    batch.nextCursor !== current.lastBatchCursor ||
    batch.totalEvents !== current.lastBatchTotalEvents
  const coordinateChanged = lastCoordinate !== current.lastConsumedCoordinate

  if (!sourceChanged && !coordinateChanged && newResults.length === 0) return current

  return {
    ...current,
    queue: newResults.length === 0
      ? current.queue
      : Object.freeze(boundedQueue),
    overflowCount: addOverflowCount(current.overflowCount, removedCount),
    announcement: newResults.length === 0
      ? current.announcement
      : createAnnouncement(newResults),
    lastConsumedCoordinate: lastCoordinate,
    lastBatchCursor: batch.nextCursor,
    lastBatchTotalEvents: batch.totalEvents,
  }
}

export function consumeCombatResultBatch(
  current: CombatResultConsumerState,
  batch: CombatEventBatch,
  streamGeneration: number,
): CombatResultConsumerState {
  const base = current.streamGeneration === streamGeneration
    ? current
    : createEmptyConsumerState(streamGeneration)
  return consumeCurrentGenerationBatch(base, batch)
}

export function createCombatResultConsumerState(
  batch: CombatEventBatch,
  streamGeneration: number,
): CombatResultConsumerState {
  return consumeCurrentGenerationBatch(
    createEmptyConsumerState(streamGeneration),
    batch,
  )
}

export function pinCombatResult(
  current: CombatResultConsumerState,
  resultId: string,
): CombatResultConsumerState {
  const result = current.queue.find(({ id }) => id === resultId)
  if (result === undefined || current.pinnedResult === result) return current
  return { ...current, pinnedResult: result }
}

export function closePinnedCombatResult(
  current: CombatResultConsumerState,
): CombatResultConsumerState {
  return current.pinnedResult === null
    ? current
    : { ...current, pinnedResult: null }
}
