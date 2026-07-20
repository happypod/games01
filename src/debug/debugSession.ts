import { getCampOfflineCapMs } from '../game/camp'
import { MAX_OFFLINE_MS, MAX_STAGE } from '../game/content'
import {
  DEBUG_SPEEDS,
  type DebugSimulationResult,
  type DebugSpeed,
} from '../game/debugSimulator'
import { advanceOfflineGame, selectStage } from '../game/engine'
import { deriveLegacyExpeditionMilestoneMask } from '../game/expedition'
import type { GameState } from '../game/types'

export { DEBUG_SPEEDS }
export type { DebugSpeed }

export const DEBUG_RESOURCE_IDS = ['gold', 'skillPoints', 'essence'] as const
export type DebugResourceId = (typeof DEBUG_RESOURCE_IDS)[number]

export const MAX_DEBUG_OFFLINE_MINUTES = 12 * 60

function assertIntegerInRange(
  value: unknown,
  minimum: number,
  maximum: number,
  label: string,
): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    throw new RangeError(`${label} must be a safe integer from ${minimum} to ${maximum}`)
  }
}

export function cloneDebugState(input: GameState): GameState {
  return {
    ...input,
    camp: {
      ...input.camp,
      structures: { ...input.camp.structures },
      training: { ...input.camp.training },
      materials: { ...input.camp.materials },
      consumables: { ...input.camp.consumables },
      craftJob: input.camp.craftJob === null ? null : { ...input.camp.craftJob },
      buffs: { ...input.camp.buffs },
      merchant: { ...input.camp.merchant },
      residents: { sera: { ...input.camp.residents.sera } },
    },
    expeditionEvents: {
      ...input.expeditionEvents,
      pending: input.expeditionEvents.pending.map((event) => ({
        ...event,
        resolvedChoices: event.resolvedChoices.map((choice) => ({
          ...choice,
          effect: { ...choice.effect },
        })) as typeof event.resolvedChoices,
      })),
    },
    rng: { ...input.rng },
    player: {
      ...input.player,
      upgrades: { ...input.player.upgrades },
      skills: { ...input.player.skills },
      companion: { ...input.player.companion },
    },
    battle: { ...input.battle },
    stats: { ...input.stats },
  }
}

export function isDebugSpeed(value: unknown): value is DebugSpeed {
  return typeof value === 'number' && DEBUG_SPEEDS.some((speed) => speed === value)
}

export function requireDebugSpeed(value: unknown): DebugSpeed {
  if (!isDebugSpeed(value)) {
    throw new RangeError('speed must be 1, 10, or 100')
  }
  return value
}

export function scaleDebugElapsedMs(
  speed: unknown,
  realElapsedMs: unknown,
  elapsedCapMs = MAX_OFFLINE_MS,
): number {
  const validatedSpeed = requireDebugSpeed(speed)
  assertIntegerInRange(realElapsedMs, 0, Number.MAX_SAFE_INTEGER, 'real elapsed milliseconds')
  assertIntegerInRange(elapsedCapMs, 1, 12 * 60 * 60 * 1_000, 'elapsed cap milliseconds')
  const cappedRealElapsedMs = Math.min(
    realElapsedMs,
    Math.floor(elapsedCapMs / validatedSpeed),
  )
  return cappedRealElapsedMs * validatedSpeed
}

export function setDebugStage(input: GameState, stage: unknown): GameState {
  assertIntegerInRange(stage, 1, MAX_STAGE, 'stage')

  const state = cloneDebugState(input)
  state.battle.highestStage = Math.max(state.battle.highestStage, stage)
  state.expeditionEvents = {
    ...state.expeditionEvents,
    milestoneMask: deriveLegacyExpeditionMilestoneMask(state.battle.highestStage),
  }
  const selected = selectStage(state, stage)

  if (!selected.success) {
    throw new Error('validated debug stage was rejected by the game engine')
  }
  return selected.state
}

export function setDebugResource(
  input: GameState,
  resource: DebugResourceId,
  value: unknown,
): GameState {
  assertIntegerInRange(value, 0, Number.MAX_SAFE_INTEGER, resource)

  const state = cloneDebugState(input)
  switch (resource) {
    case 'gold':
      state.player.gold = value
      break
    case 'skillPoints':
      state.player.skillPoints = value
      break
    case 'essence':
      state.player.essence = value
      break
    default: {
      const unsupportedResource: never = resource
      throw new RangeError(`unsupported debug resource: ${String(unsupportedResource)}`)
    }
  }
  return state
}

export function applyDebugOfflineMinutes(
  input: GameState,
  minutes: unknown,
): DebugSimulationResult {
  const maximumMinutes = getCampOfflineCapMs(input.camp) / 60_000
  assertIntegerInRange(minutes, 0, maximumMinutes, 'offline minutes')
  const elapsedMs = minutes * 60_000
  const advanced = advanceOfflineGame(cloneDebugState(input), elapsedMs)
  return {
    speed: 100,
    elapsedMs: advanced.report.elapsedMs,
    state: cloneDebugState(advanced.state),
    report: { ...advanced.report },
    snapshots: elapsedMs === 0
      ? []
      : [{
          elapsedMs: advanced.report.elapsedMs,
          state: cloneDebugState(advanced.state),
          report: { ...advanced.report },
        }],
  }
}
