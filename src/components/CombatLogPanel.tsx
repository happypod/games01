import { useState } from 'react'
import { COMPANION_DEFINITIONS, SKILL_DEFINITIONS } from '../game/content'
import { formatNumber } from '../game/format'
import type { CombatEvent, CombatEventBatch } from '../game/types'
import { useCombatLogAnnouncements } from '../hooks/useCombatLogAnnouncements'
import {
  COMBAT_LOG_FILTER_IDS,
  createCombatLogView,
  type CombatLogFilterId,
  type CombatLogItem,
} from './combatLogView'

const CONTENT_ID = 'combat-log-content'

const FILTER_LABELS: Readonly<Record<CombatLogFilterId, string>> = {
  critical: '치명타',
  skill: '스킬',
  companionAssist: '협공',
  victory: '승리',
  defeat: '패배',
}

function safeNumber(event: CombatEvent, key: string): number | null {
  const value = (event as unknown as Record<string, unknown>)[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function safeString(event: CombatEvent, key: string): string | null {
  const value = (event as unknown as Record<string, unknown>)[key]
  return typeof value === 'string' ? value : null
}

function getEventCopy(item: CombatLogItem): { readonly badge: string; readonly text: string } {
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

interface CombatLogPanelProps {
  batch: CombatEventBatch
}

export function CombatLogPanel({ batch }: CombatLogPanelProps) {
  const [open, setOpen] = useState(false)
  const [activeFilters, setActiveFilters] = useState<ReadonlySet<CombatLogFilterId>>(
    () => new Set(COMBAT_LOG_FILTER_IDS),
  )
  const announcement = useCombatLogAnnouncements(batch)
  const view = createCombatLogView(batch, activeFilters)
  const allSelected = activeFilters.size === COMBAT_LOG_FILTER_IDS.length

  const toggleAll = () => {
    setActiveFilters(allSelected ? new Set() : new Set(COMBAT_LOG_FILTER_IDS))
  }

  const toggleFilter = (filterId: CombatLogFilterId) => {
    setActiveFilters((current) => {
      const next = new Set(current)
      if (next.has(filterId)) next.delete(filterId)
      else next.add(filterId)
      return next
    })
  }

  return (
    <section className="panel combat-log-panel" aria-labelledby="combat-log-heading">
      <div className="combat-log-panel__header">
        <div>
          <p className="eyebrow">BATTLE RECORD</p>
          <h2 id="combat-log-heading">전투 로그</h2>
          <p className="combat-log-panel__summary">
            최근 {view.recentCount}건
            {view.olderCount > 0 ? ` · 이전 ${view.olderCount}건 요약` : ' · 이전 기록 없음'}
          </p>
        </div>
        <button
          type="button"
          className="combat-log-panel__toggle"
          aria-expanded={open}
          aria-controls={CONTENT_ID}
          onClick={() => setOpen((current) => !current)}
        >
          전투 로그 {open ? '접기' : '펼치기'}
        </button>
      </div>

      <p
        className="sr-only"
        aria-live="polite"
        aria-atomic="true"
        data-testid="combat-log-announcement"
      >
        {announcement}
      </p>

      <div id={CONTENT_ID} hidden={!open}>
        <fieldset className="combat-log-filters">
          <legend>로그 필터</legend>
          <label>
            <input type="checkbox" checked={allSelected} onChange={toggleAll} />
            모두
          </label>
          {COMBAT_LOG_FILTER_IDS.map((filterId) => (
            <label key={filterId}>
              <input
                type="checkbox"
                checked={activeFilters.has(filterId)}
                onChange={() => toggleFilter(filterId)}
              />
              {FILTER_LABELS[filterId]}
            </label>
          ))}
        </fieldset>

        {view.filterHiddenCount > 0 && (
          <p className="combat-log-filter-summary">
            현재 필터에서 최근 기록 {view.filterHiddenCount}건을 숨겼습니다.
          </p>
        )}

        {view.recentCount === 0 ? (
          <p className="combat-log-empty">아직 기록된 전투 이벤트가 없습니다.</p>
        ) : view.items.length === 0 ? (
          <p className="combat-log-empty">선택한 필터에 해당하는 최근 이벤트가 없습니다.</p>
        ) : (
          <ol className="combat-log-list" data-testid="combat-log-list">
            {view.items.map((item) => {
              const copy = getEventCopy(item)
              const roundSequence = safeString(item.event, 'roundSequence') ?? '알 수 없음'
              const stage = safeNumber(item.event, 'stage') ?? '알 수 없음'
              return (
                <li
                  key={item.event.id}
                  className={`combat-log-entry combat-log-entry--${item.filterId}`}
                  data-combat-event-type={item.runtimeType}
                >
                  <span className="combat-log-entry__badge">{copy.badge}</span>
                  <span className="combat-log-entry__copy">{copy.text}</span>
                  <small>
                    라운드 {roundSequence} · 스테이지 {stage}
                  </small>
                </li>
              )
            })}
          </ol>
        )}
      </div>
    </section>
  )
}
