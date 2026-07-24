import { COMPANION_DEFINITIONS, SKILL_DEFINITIONS } from '../game/content'
import { formatNumber } from '../game/format'
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

export function safeNumber(event: CombatEvent, key: string): number | null {
  const value = (event as unknown as Record<string, unknown>)[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function safeString(event: CombatEvent, key: string): string | null {
  const value = (event as unknown as Record<string, unknown>)[key]
  return typeof value === 'string' ? value : null
}

export function getEventCopy(item: CombatLogItem): { readonly badge: string; readonly text: string } {
  const { event, runtimeType } = item
  const damage = safeNumber(event, 'damage')
  if (runtimeType === 'skill') {
    return {
      badge: '스킬',
      text: `${SKILL_DEFINITIONS.powerStrike.name}가 ${formatNumber(damage ?? 0)} 피해를 입혔습니다.`,
    }
  }
  if (runtimeType === 'critical') {
    return {
      badge: '치명타',
      text: `치명타로 ${formatNumber(damage ?? 0)} 피해를 입혔습니다.`,
    }
  }
  if (runtimeType === 'companionAssist') {
    const companionId = safeString(event, 'companionId')
    const companionName = companionId === 'emberFox'
      ? COMPANION_DEFINITIONS.emberFox.name
      : '알 수 없는 동료'
    return {
      badge: '협공',
      text: `${companionName}가 협공으로 ${formatNumber(damage ?? 0)} 피해를 입혔습니다.`,
    }
  }
  if (runtimeType === 'kill' || runtimeType === 'bossVictory') {
    const defeatedStage = safeNumber(event, 'defeatedStage') ?? event.stage
    const gold = safeNumber(event, 'gold') ?? 0
    const xp = safeNumber(event, 'xp') ?? 0
    return {
      badge: runtimeType === 'bossVictory' ? '보스 승리' : '승리',
      text: `${runtimeType === 'bossVictory' ? '보스 ' : ''}스테이지 ${defeatedStage} 승리 · 골드 ${formatNumber(gold)} · 경험치 ${formatNumber(xp)}`,
    }
  }
  if (runtimeType === 'defeat') {
    const defeatedAtStage = safeNumber(event, 'defeatedAtStage') ?? event.stage
    const returnStage = safeNumber(event, 'returnStage') ?? event.stage
    return {
      badge: '패배',
      text: `스테이지 ${defeatedAtStage} 패배 · 스테이지 ${returnStage}로 복귀`,
    }
  }
  return { badge: '기타', text: '알 수 없는 전투 이벤트' }
}
