import type { CombatEvent, CombatEventBatch } from '../game/types'

export const COMBAT_LOG_LIMIT = 20

export const COMBAT_LOG_FILTER_IDS = [
  'critical',
  'skill',
  'companionAssist',
  'victory',
  'defeat',
] as const

export type CombatLogFilterId = (typeof COMBAT_LOG_FILTER_IDS)[number]

export type CombatLogTone = CombatLogFilterId | 'unknown'

export interface CombatLogItem {
  readonly event: CombatEvent
  readonly runtimeType: string
  readonly filterId: CombatLogTone
  readonly unknown: boolean
}

export interface CombatLogView {
  readonly items: readonly CombatLogItem[]
  readonly recentCount: number
  readonly olderCount: number
  readonly filterHiddenCount: number
}

function getRuntimeType(event: CombatEvent): string {
  const value = (event as { readonly type?: unknown }).type
  return typeof value === 'string' ? value : 'unknown'
}

function getFilterId(runtimeType: string): CombatLogTone {
  if (runtimeType === 'critical') return 'critical'
  if (runtimeType === 'skill') return 'skill'
  if (runtimeType === 'companionAssist') return 'companionAssist'
  if (runtimeType === 'kill' || runtimeType === 'bossVictory') return 'victory'
  if (runtimeType === 'defeat') return 'defeat'
  return 'unknown'
}

export function createCombatLogView(
  batch: CombatEventBatch,
  activeFilters: ReadonlySet<CombatLogFilterId>,
): CombatLogView {
  const recentEvents = batch.events.slice(-COMBAT_LOG_LIMIT)
  const showUnknown = activeFilters.size === COMBAT_LOG_FILTER_IDS.length
  const items = recentEvents
    .map((event): CombatLogItem => {
      const runtimeType = getRuntimeType(event)
      const filterId = getFilterId(runtimeType)
      return {
        event,
        runtimeType,
        filterId,
        unknown: filterId === 'unknown',
      }
    })
    .filter(({ filterId }) =>
      filterId === 'unknown' ? showUnknown : activeFilters.has(filterId),
    )

  return {
    items,
    recentCount: recentEvents.length,
    olderCount: Math.max(0, batch.totalEvents - Math.min(batch.totalEvents, COMBAT_LOG_LIMIT)),
    filterHiddenCount: recentEvents.length - items.length,
  }
}
