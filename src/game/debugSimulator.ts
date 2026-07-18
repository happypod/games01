import { COMBAT_ROUND_MS, MAX_OFFLINE_MS } from './content'
import { advanceGame } from './engine'
import { addSafeIntegers } from './formulas'
import type { AdvanceReport, GameState } from './types'

export const DEBUG_SPEEDS = [1, 10, 100] as const
export type DebugSpeed = (typeof DEBUG_SPEEDS)[number]

export interface DebugSimulationOptions {
  speed: DebugSpeed
  durationMs: number
  snapshotIntervalMs?: number
}

export interface DebugSnapshot {
  elapsedMs: number
  state: GameState
  report: AdvanceReport
}

export interface DebugSimulationResult {
  speed: DebugSpeed
  elapsedMs: number
  state: GameState
  report: AdvanceReport
  snapshots: DebugSnapshot[]
}

function cloneState(state: GameState): GameState {
  return {
    ...state,
    rng: { ...state.rng },
    player: {
      ...state.player,
      upgrades: { ...state.player.upgrades },
      skills: { ...state.player.skills },
    },
    battle: { ...state.battle },
    stats: { ...state.stats },
  }
}

function emptyReport(): AdvanceReport {
  return {
    elapsedMs: 0,
    rounds: 0,
    criticalHits: 0,
    kills: 0,
    defeats: 0,
    goldEarned: 0,
    xpEarned: 0,
    levelsGained: 0,
    stagesGained: 0,
  }
}

function addReport(total: AdvanceReport, next: AdvanceReport): AdvanceReport {
  return {
    elapsedMs: addSafeIntegers(total.elapsedMs, next.elapsedMs),
    rounds: addSafeIntegers(total.rounds, next.rounds),
    criticalHits: addSafeIntegers(total.criticalHits, next.criticalHits),
    kills: addSafeIntegers(total.kills, next.kills),
    defeats: addSafeIntegers(total.defeats, next.defeats),
    goldEarned: addSafeIntegers(total.goldEarned, next.goldEarned),
    xpEarned: addSafeIntegers(total.xpEarned, next.xpEarned),
    levelsGained: addSafeIntegers(total.levelsGained, next.levelsGained),
    stagesGained: addSafeIntegers(total.stagesGained, next.stagesGained),
  }
}

function assertSafeDuration(value: number, label: string, allowZero: boolean) {
  const minimum = allowZero ? 0 : 1
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new RangeError(`${label} must be a safe integer of at least ${minimum}ms`)
  }
}

export function runDebugSimulation(
  input: GameState,
  options: DebugSimulationOptions,
): DebugSimulationResult {
  if (!DEBUG_SPEEDS.includes(options.speed)) {
    throw new RangeError('speed must be 1, 10, or 100')
  }
  assertSafeDuration(options.durationMs, 'durationMs', true)
  const snapshotIntervalMs = options.snapshotIntervalMs ?? MAX_OFFLINE_MS
  assertSafeDuration(snapshotIntervalMs, 'snapshotIntervalMs', false)
  if (snapshotIntervalMs > MAX_OFFLINE_MS) {
    throw new RangeError('snapshotIntervalMs must not exceed the 8-hour offline boundary')
  }

  const stepMs = COMBAT_ROUND_MS * options.speed
  let elapsedMs = 0
  let state = cloneState(input)
  let report = emptyReport()
  const snapshots: DebugSnapshot[] = []
  let nextSnapshotAt = Math.min(snapshotIntervalMs, options.durationMs)

  while (elapsedMs < options.durationMs) {
    const targetElapsedMs = Math.min(nextSnapshotAt, options.durationMs)
    const elapsedStepMs = Math.min(stepMs, targetElapsedMs - elapsedMs)
    const advanced = advanceGame(state, elapsedStepMs)
    if (advanced.report.elapsedMs !== elapsedStepMs) {
      throw new Error('debug step was unexpectedly clamped by the game engine')
    }

    state = advanced.state
    report = addReport(report, advanced.report)
    elapsedMs += elapsedStepMs

    if (elapsedMs === targetElapsedMs) {
      snapshots.push({
        elapsedMs,
        state: cloneState(state),
        report: { ...report },
      })
      if (elapsedMs < options.durationMs) {
        nextSnapshotAt = Math.min(options.durationMs, nextSnapshotAt + snapshotIntervalMs)
      }
    }
  }

  return {
    speed: options.speed,
    elapsedMs,
    state: cloneState(state),
    report: { ...report },
    snapshots,
  }
}
