import { MAX_OFFLINE_MS, MAX_STAGE } from '../game/content'
import {
  DEBUG_SPEEDS,
  runDebugSimulation,
  type DebugSimulationResult,
  type DebugSpeed,
} from '../game/debugSimulator'
import { selectStage } from '../game/engine'
import type { GameState } from '../game/types'

export { DEBUG_SPEEDS }
export type { DebugSpeed }

export const DEBUG_RESOURCE_IDS = ['gold', 'skillPoints', 'essence'] as const
export type DebugResourceId = (typeof DEBUG_RESOURCE_IDS)[number]

export const MAX_DEBUG_OFFLINE_MINUTES = MAX_OFFLINE_MS / 60_000

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

export function scaleDebugElapsedMs(speed: unknown, realElapsedMs: unknown): number {
  const validatedSpeed = requireDebugSpeed(speed)
  assertIntegerInRange(realElapsedMs, 0, Number.MAX_SAFE_INTEGER, 'real elapsed milliseconds')
  const cappedRealElapsedMs = Math.min(
    realElapsedMs,
    Math.floor(MAX_OFFLINE_MS / validatedSpeed),
  )
  return cappedRealElapsedMs * validatedSpeed
}

export function setDebugStage(input: GameState, stage: unknown): GameState {
  assertIntegerInRange(stage, 1, MAX_STAGE, 'stage')

  const state = cloneDebugState(input)
  state.battle.highestStage = Math.max(state.battle.highestStage, stage)
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
  assertIntegerInRange(minutes, 0, MAX_DEBUG_OFFLINE_MINUTES, 'offline minutes')

  return runDebugSimulation(cloneDebugState(input), {
    speed: 100,
    durationMs: minutes * 60_000,
  })
}
