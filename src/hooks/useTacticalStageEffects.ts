import { useEffect, useReducer, useRef } from 'react'
import type {
  CombatEvent,
  CombatEventBatch,
  CombatEventCursor,
  CombatEventSnapshot,
} from '../game/types'

export const TACTICAL_STAGE_SCENE_MS = 900
export const TACTICAL_STAGE_SCENE_LIMIT = 6

export type TacticalStagePriorityOutcome = Extract<
  CombatEvent,
  { readonly type: 'bossVictory' | 'defeat' }
>

export interface TacticalStageScene {
  readonly id: string
  readonly roundSequence: CombatEventCursor
  readonly events: readonly CombatEvent[]
  readonly snapshot: CombatEventSnapshot
  readonly priorityOutcome: TacticalStagePriorityOutcome | null
}

export interface TacticalStageEffectsController {
  readonly scene: TacticalStageScene | null
  readonly queuedSceneCount: number
  readonly skippedSceneCount: number
}

interface CombatEventCoordinate {
  readonly roundSequence: CombatEventCursor
  readonly ordinal: number
}

interface ConsumerState {
  readonly generation: number
  readonly lastBatchCursor: CombatEventCursor
  readonly lastBatchTotalEvents: number
  readonly lastConsumedCoordinate: CombatEventCoordinate | null
}

interface PlaybackState {
  readonly generation: number
  readonly scenes: readonly TacticalStageScene[]
  readonly skippedSceneCount: number
}

type PlaybackAction =
  | { readonly type: 'reset'; readonly generation: number }
  | {
      readonly type: 'append'
      readonly generation: number
      readonly scenes: readonly TacticalStageScene[]
    }
  | {
      readonly type: 'advance'
      readonly generation: number
      readonly sceneId: string
    }

const EMPTY_SCENES: readonly TacticalStageScene[] = Object.freeze([])

function parseCursor(cursor: CombatEventCursor): bigint | null {
  if (!/^(0|[1-9]\d*)$/.test(cursor)) return null
  try {
    return BigInt(cursor)
  } catch {
    return null
  }
}

function hasCanonicalCoordinate(event: CombatEvent): boolean {
  return parseCursor(event.roundSequence) !== null &&
    Number.isSafeInteger(event.ordinal) &&
    event.ordinal >= 0
}

function compareCoordinates(
  left: CombatEventCoordinate,
  right: CombatEventCoordinate,
): number {
  const leftRound = parseCursor(left.roundSequence)
  const rightRound = parseCursor(right.roundSequence)
  if (leftRound === null || rightRound === null) return 0
  if (leftRound !== rightRound) return leftRound < rightRound ? -1 : 1
  return left.ordinal - right.ordinal
}

function compareBatchCursors(left: CombatEventCursor, right: CombatEventCursor): number {
  const leftCursor = parseCursor(left)
  const rightCursor = parseCursor(right)
  if (leftCursor === null || rightCursor === null) return 0
  return leftCursor < rightCursor ? -1 : leftCursor > rightCursor ? 1 : 0
}

function orderedUniqueEvents(events: readonly CombatEvent[]): readonly CombatEvent[] {
  const ids = new Set<string>()
  const coordinates = new Set<string>()
  return events
    .filter(hasCanonicalCoordinate)
    .sort(compareCoordinates)
    .filter((event) => {
      const coordinate = `${event.roundSequence}:${event.ordinal}`
      if (ids.has(event.id) || coordinates.has(coordinate)) return false
      ids.add(event.id)
      coordinates.add(coordinate)
      return true
    })
}

function latestCoordinate(events: readonly CombatEvent[]): CombatEventCoordinate | null {
  const latest = events.at(-1)
  return latest === undefined
    ? null
    : { roundSequence: latest.roundSequence, ordinal: latest.ordinal }
}

function seedConsumer(batch: CombatEventBatch, generation: number): ConsumerState {
  const events = orderedUniqueEvents(batch.events)
  return {
    generation,
    lastBatchCursor: batch.nextCursor,
    lastBatchTotalEvents: batch.totalEvents,
    lastConsumedCoordinate: latestCoordinate(events),
  }
}

function createScene(
  events: readonly CombatEvent[],
  generation: number,
): TacticalStageScene {
  const latest = events.at(-1)
  if (latest === undefined) throw new Error('a tactical stage scene requires an event')
  const priorityOutcome = events.find(
    (event): event is TacticalStagePriorityOutcome =>
      event.type === 'bossVictory' || event.type === 'defeat',
  ) ?? null
  return Object.freeze({
    id: `${generation}:${latest.roundSequence}`,
    roundSequence: latest.roundSequence,
    events: Object.freeze([...events]),
    snapshot: Object.freeze({ ...latest.snapshot }),
    priorityOutcome,
  })
}

function createScenes(
  events: readonly CombatEvent[],
  generation: number,
): readonly TacticalStageScene[] {
  const grouped = new Map<CombatEventCursor, CombatEvent[]>()
  for (const event of events) {
    const group = grouped.get(event.roundSequence)
    if (group === undefined) grouped.set(event.roundSequence, [event])
    else group.push(event)
  }
  return [...grouped.values()].map((group) => createScene(group, generation))
}

function appendBoundedScenes(
  current: PlaybackState,
  additions: readonly TacticalStageScene[],
): PlaybackState {
  if (additions.length === 0) return current
  const scenes = [...current.scenes, ...additions]
  let skippedSceneCount = current.skippedSceneCount

  while (scenes.length > TACTICAL_STAGE_SCENE_LIMIT) {
    const ordinaryQueuedIndex = scenes.findIndex(
      (scene, index) => index > 0 && scene.priorityOutcome === null,
    )
    const removedIndex = ordinaryQueuedIndex >= 0 ? ordinaryQueuedIndex : 1
    scenes.splice(removedIndex, 1)
    skippedSceneCount += 1
  }

  return { ...current, scenes: Object.freeze(scenes), skippedSceneCount }
}

function emptyPlayback(generation: number): PlaybackState {
  return { generation, scenes: EMPTY_SCENES, skippedSceneCount: 0 }
}

function playbackReducer(state: PlaybackState, action: PlaybackAction): PlaybackState {
  if (action.type === 'reset') return emptyPlayback(action.generation)
  if (action.type === 'append') {
    const base = state.generation === action.generation
      ? state
      : emptyPlayback(action.generation)
    return appendBoundedScenes(base, action.scenes)
  }
  if (
    state.generation !== action.generation ||
    state.scenes[0]?.id !== action.sceneId
  ) {
    return state
  }
  return { ...state, scenes: Object.freeze(state.scenes.slice(1)) }
}

/**
 * Converts the non-persistent combat event stream into short, display-only scenes.
 * The initial batch and batches observed while inactive are consumed without replay.
 */
export function useTacticalStageEffects(
  batch: CombatEventBatch,
  generation: number,
  active: boolean,
): TacticalStageEffectsController {
  const consumerRef = useRef<ConsumerState | null>(null)
  if (consumerRef.current === null) {
    consumerRef.current = seedConsumer(batch, generation)
  }
  const [playback, dispatchPlayback] = useReducer(
    playbackReducer,
    generation,
    emptyPlayback,
  )

  useEffect(() => {
    const current = consumerRef.current
    if (current === null || current.generation !== generation) {
      consumerRef.current = seedConsumer(batch, generation)
      dispatchPlayback({ type: 'reset', generation })
      return
    }

    const staleBatch =
      compareBatchCursors(batch.nextCursor, current.lastBatchCursor) < 0 ||
      batch.totalEvents < current.lastBatchTotalEvents
    if (staleBatch) {
      if (!active) dispatchPlayback({ type: 'reset', generation })
      return
    }

    const ordered = orderedUniqueEvents(batch.events)
    const newEvents = ordered.filter((event) =>
      current.lastConsumedCoordinate === null ||
      compareCoordinates(event, current.lastConsumedCoordinate) > 0,
    )
    const nextCoordinate = latestCoordinate(ordered)
    consumerRef.current = {
      generation,
      lastBatchCursor: batch.nextCursor,
      lastBatchTotalEvents: batch.totalEvents,
      lastConsumedCoordinate:
        nextCoordinate !== null && (
          current.lastConsumedCoordinate === null ||
          compareCoordinates(nextCoordinate, current.lastConsumedCoordinate) > 0
        )
          ? nextCoordinate
          : current.lastConsumedCoordinate,
    }

    if (!active) {
      dispatchPlayback({ type: 'reset', generation })
      return
    }
    if (newEvents.length === 0) return

    const additions = createScenes(newEvents, generation)
    dispatchPlayback({ type: 'append', generation, scenes: additions })
  }, [active, batch, generation])

  const sceneId = playback.scenes[0]?.id ?? null
  useEffect(() => {
    if (!active || sceneId === null || playback.generation !== generation) return
    const timer = window.setTimeout(() => {
      dispatchPlayback({ type: 'advance', generation, sceneId })
    }, TACTICAL_STAGE_SCENE_MS)
    return () => window.clearTimeout(timer)
  }, [active, generation, playback.generation, sceneId])

  const scene = active && playback.generation === generation
    ? playback.scenes[0] ?? null
    : null
  return {
    scene,
    queuedSceneCount: scene === null ? 0 : Math.max(0, playback.scenes.length - 1),
    skippedSceneCount: playback.skippedSceneCount,
  }
}
