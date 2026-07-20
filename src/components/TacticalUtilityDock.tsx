import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faFireFlameCurved,
  faFloppyDisk,
  faScroll,
  faTrophy,
  faXmark,
} from '@fortawesome/free-solid-svg-icons'
import type { CombatEventBatch, GameState } from '../game/types'
import type { SaveImportPreview } from '../game/saveTransfer'
import { useCombatLogAnnouncements } from '../hooks/useCombatLogAnnouncements'
import type { CombatResultsController } from '../hooks/useCombatResults'
import { CombatLogPanel } from './CombatLogPanel'
import { CombatResultSurface } from './CombatResultRegion'
import { PrestigePanel } from './PrestigePanel'
import { SaveTransferPanel } from './SaveTransferPanel'

const UTILITY_DEFINITIONS = [
  { id: 'log', label: '전투 로그', icon: faScroll },
  { id: 'results', label: '승패 결과', icon: faTrophy },
  { id: 'prestige', label: '불씨의 계승', icon: faFireFlameCurved },
  { id: 'backup', label: '저장 백업', icon: faFloppyDisk },
] as const

type TacticalUtilityId = (typeof UTILITY_DEFINITIONS)[number]['id']

export interface TacticalUtilityDockProps {
  batch: CombatEventBatch
  results: CombatResultsController
  state: GameState
  onPrestige: () => void
  disabled?: boolean
  showSaveTransfer?: boolean
  saveExportDisabled?: boolean
  saveImportDisabled?: boolean
  onRestore: (preview: SaveImportPreview) => { success: boolean; message: string }
}

function TacticalUtilityDockSurface({
  batch,
  results,
  state,
  onPrestige,
  disabled = false,
  showSaveTransfer = true,
  saveExportDisabled = false,
  saveImportDisabled = false,
  onRestore,
}: TacticalUtilityDockProps) {
  const [activeId, setActiveId] = useState<TacticalUtilityId | null>(null)
  const [tooltipId, setTooltipId] = useState<TacticalUtilityId | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const panelHeadingRef = useRef<HTMLHeadingElement>(null)
  const logPanelRef = useRef<HTMLDivElement>(null)
  const triggerRefs = useRef(new Map<TacticalUtilityId, HTMLButtonElement>())
  const focusReturnIdRef = useRef<TacticalUtilityId | null>(null)
  const logAnnouncement = useCombatLogAnnouncements(batch)

  const availableDefinitions = showSaveTransfer
    ? UTILITY_DEFINITIONS
    : UTILITY_DEFINITIONS.filter(({ id }) => id !== 'backup')
  const activeDefinition = UTILITY_DEFINITIONS.find(({ id }) => id === activeId)

  const closePanel = useCallback((id: TacticalUtilityId, restoreFocus = true) => {
    focusReturnIdRef.current = restoreFocus ? id : null
    setActiveId((current) => current === id ? null : current)
  }, [])

  useLayoutEffect(() => {
    if (activeId !== null) {
      panelHeadingRef.current?.focus()
      return
    }

    const focusReturnId = focusReturnIdRef.current
    focusReturnIdRef.current = null
    if (focusReturnId !== null) triggerRefs.current.get(focusReturnId)?.focus()
  }, [activeId])

  useLayoutEffect(() => {
    if (activeId !== 'log') return
    const nestedAnnouncement = logPanelRef.current?.querySelector<HTMLElement>(
      '[data-testid="combat-log-announcement"]',
    )
    if (nestedAnnouncement === undefined || nestedAnnouncement === null) return

    // CombatLogPanel owns its legacy announcer. The dock keeps the canonical
    // announcer mounted while every panel is closed, so silence only this nested copy.
    nestedAnnouncement.setAttribute('aria-live', 'off')
    nestedAnnouncement.setAttribute('aria-hidden', 'true')
  }, [activeId, batch])

  useEffect(() => {
    if (activeId === null) return

    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Node) || rootRef.current?.contains(target)) return
      closePanel(activeId, false)
    }

    document.addEventListener('click', handleOutsideClick, true)
    return () => document.removeEventListener('click', handleOutsideClick, true)
  }, [activeId, closePanel])

  const selectUtility = (id: TacticalUtilityId) => {
    setTooltipId(null)
    if (activeId === id) {
      closePanel(id)
      return
    }
    focusReturnIdRef.current = null
    setActiveId(id)
  }

  const handlePanelKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Escape' || activeId === null) return
    const target = event.target
    if (
      target instanceof Element
      && target.closest('[role="dialog"][aria-modal="true"]') !== null
    ) {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    closePanel(activeId)
  }

  const panelContent = activeId === 'log' ? (
    <div ref={logPanelRef} className="tactical-utility-dock__legacy-surface">
      <CombatLogPanel batch={batch} />
    </div>
  ) : activeId === 'results' ? (
    <div className="tactical-utility-dock__legacy-surface">
      <CombatResultSurface results={results} announce={false} />
    </div>
  ) : activeId === 'prestige' ? (
    <div className="tactical-utility-dock__legacy-surface">
      <PrestigePanel state={state} onPrestige={onPrestige} disabled={disabled} />
    </div>
  ) : activeId === 'backup' && showSaveTransfer ? (
    <div className="tactical-utility-dock__legacy-surface">
      <SaveTransferPanel
        state={state}
        exportDisabled={saveExportDisabled}
        importDisabled={saveImportDisabled}
        onRestore={onRestore}
      />
    </div>
  ) : null

  return (
    <div ref={rootRef} className="tactical-utility-dock" data-testid="tactical-utility-dock">
      <div className="tactical-utility-dock__toolbar" role="group" aria-label="원정 보조 기능">
        {availableDefinitions.map((definition) => {
          const expanded = definition.id === activeId
          const tooltipVisible = definition.id === tooltipId
          const triggerId = `tactical-utility-trigger-${definition.id}`
          const tooltipElementId = `tactical-utility-tooltip-${definition.id}`
          const panelId = `tactical-utility-panel-${definition.id}`
          return (
            <span key={definition.id} className="tactical-utility-dock__item">
              <button
                ref={(node) => {
                  if (node === null) triggerRefs.current.delete(definition.id)
                  else triggerRefs.current.set(definition.id, node)
                }}
                id={triggerId}
                type="button"
                className="tactical-utility-dock__trigger"
                aria-label={definition.label}
                aria-haspopup="dialog"
                aria-expanded={expanded}
                aria-controls={panelId}
                aria-describedby={tooltipVisible ? tooltipElementId : undefined}
                data-utility-id={definition.id}
                onMouseEnter={() => setTooltipId(definition.id)}
                onMouseLeave={() => setTooltipId((current) => current === definition.id ? null : current)}
                onFocus={() => setTooltipId(definition.id)}
                onBlur={() => setTooltipId((current) => current === definition.id ? null : current)}
                onClick={() => selectUtility(definition.id)}
              >
                <FontAwesomeIcon icon={definition.icon} fixedWidth aria-hidden="true" />
              </button>
              {tooltipVisible && (
                <span
                  id={tooltipElementId}
                  className="tactical-utility-dock__tooltip"
                  role="tooltip"
                >
                  {definition.label}
                </span>
              )}
            </span>
          )
        })}
      </div>

      <p
        className="sr-only"
        aria-live="polite"
        aria-atomic="true"
        data-testid="tactical-utility-log-announcement"
      >
        {logAnnouncement}
      </p>
      <p
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-testid="tactical-utility-result-announcement"
      >
        {results.announcement}
      </p>

      {activeId !== null && activeDefinition !== undefined && panelContent !== null && (
        <section
          id={`tactical-utility-panel-${activeId}`}
          className="tactical-utility-dock__panel"
          role="dialog"
          aria-modal="false"
          aria-labelledby={`tactical-utility-panel-title-${activeId}`}
          data-testid="tactical-utility-panel"
          data-utility-panel={activeId}
          onKeyDownCapture={handlePanelKeyDown}
        >
          <header className="tactical-utility-dock__panel-header">
            <div>
              <p className="eyebrow">QUICK ACCESS</p>
              <h2
                ref={panelHeadingRef}
                id={`tactical-utility-panel-title-${activeId}`}
                tabIndex={-1}
              >
                {activeDefinition.label}
              </h2>
            </div>
            <button
              type="button"
              className="tactical-utility-dock__close"
              aria-label={`${activeDefinition.label} 닫기`}
              onClick={() => closePanel(activeId)}
            >
              <FontAwesomeIcon icon={faXmark} fixedWidth aria-hidden="true" />
            </button>
          </header>
          <div className="tactical-utility-dock__panel-body">{panelContent}</div>
        </section>
      )}
    </div>
  )
}

export function TacticalUtilityDock(props: TacticalUtilityDockProps) {
  const availabilityKey = props.showSaveTransfer === false ? 'without-backup' : 'with-backup'
  return <TacticalUtilityDockSurface key={availabilityKey} {...props} />
}
