import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import {
  STAGE_REGIONS,
  getAdjacentRegionId,
  getRegionStageAtOffset,
  getStageNodes,
  getStageOffsetInRegion,
  getStageRegionForStage,
  type StageNodeView,
  type StageRegionId,
} from '../game/stageMap'
import { GameAsset } from './GameAsset'

interface StageMapPanelProps {
  currentStage: number
  highestStage: number
  onChooseStage: (stage: number) => void
  disabled?: boolean
  disabledReason?: string
}

const PANEL_ID = 'stage-map-content'
const DISABLED_REASON_ID = 'stage-map-disabled-reason'

function getNodeLabel(
  node: StageNodeView,
  highestStage: number,
  globallyDisabled: boolean,
) {
  const labels = [`스테이지 ${node.stage}`]
  if (node.isBoss) labels.push('보스')
  if (node.isCurrent) labels.push('현재 위치')
  if (node.progress === 'completed') labels.push('완료')
  if (node.progress === 'frontier') labels.push('최전선')
  if (node.progress === 'locked') {
    labels.push(`잠김, 스테이지 ${node.stage} 도달 시 해제, 현재 최고 ${highestStage}`)
  }
  if (globallyDisabled) labels.push('현재 스테이지 이동 불가')
  return labels.join(', ')
}

export function StageMapPanel({
  currentStage,
  highestStage,
  onChooseStage,
  disabled = false,
  disabledReason,
}: StageMapPanelProps) {
  const initialRegion = getStageRegionForStage(currentStage)
  const [open, setOpen] = useState(false)
  const [activeRegionId, setActiveRegionId] = useState<StageRegionId>(initialRegion.id)
  const [rovingStage, setRovingStage] = useState(currentStage)
  const nodeRefs = useRef(new Map<number, HTMLButtonElement>())
  const tabRefs = useRef(new Map<StageRegionId, HTMLButtonElement>())
  const pendingNodeFocus = useRef<number | null>(null)

  const activeRegion = STAGE_REGIONS.find((region) => region.id === activeRegionId)!
  const nodes = getStageNodes(activeRegionId, currentStage, highestStage)
  const currentRegion = getStageRegionForStage(currentStage)
  const currentRegionNodes = getStageNodes(currentRegion.id, currentStage, highestStage)
  const currentNodeOffset = currentRegionNodes.find((node) => node.isCurrent)?.offset ?? 0
  const compactBlockStart = Math.floor(currentNodeOffset / 10) * 10
  const compactNodes = currentRegionNodes.slice(compactBlockStart, compactBlockStart + 10)

  useLayoutEffect(() => {
    const stage = pendingNodeFocus.current
    if (stage === null) return
    const node = nodeRefs.current.get(stage)
    if (node === undefined) return
    node.focus()
    node.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
    pendingNodeFocus.current = null
  }, [activeRegionId, rovingStage])

  const setRegionAtOffset = (
    regionId: StageRegionId,
    offset: number,
    focusNode: boolean,
  ) => {
    const stage = getRegionStageAtOffset(regionId, offset)
    pendingNodeFocus.current = focusNode ? stage : null
    setActiveRegionId(regionId)
    setRovingStage(stage)
  }

  const toggleMap = () => {
    if (open) {
      setOpen(false)
      return
    }
    const currentRegion = getStageRegionForStage(currentStage)
    setActiveRegionId(currentRegion.id)
    setRovingStage(currentStage)
    setOpen(true)
  }

  const activateTab = (regionId: StageRegionId) => {
    const offset = getStageOffsetInRegion(rovingStage)
    setRegionAtOffset(regionId, offset, false)
  }

  const handleTabKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    regionId: StageRegionId,
  ) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const index = STAGE_REGIONS.findIndex((region) => region.id === regionId)
    const delta = event.key === 'ArrowRight' ? 1 : -1
    const nextIndex = (index + delta + STAGE_REGIONS.length) % STAGE_REGIONS.length
    const nextRegion = STAGE_REGIONS[nextIndex]
    if (nextRegion === undefined) return
    activateTab(nextRegion.id)
    tabRefs.current.get(nextRegion.id)?.focus()
  }

  const focusStage = (stage: number) => {
    if (stage === rovingStage) {
      const node = nodeRefs.current.get(stage)
      node?.focus()
      node?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
      pendingNodeFocus.current = null
      return
    }
    pendingNodeFocus.current = stage
    setRovingStage(stage)
  }

  const handleNodeKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    node: StageNodeView,
  ) => {
    let nextStage: number
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextStage = Math.max(activeRegion.startStage, node.stage - 1)
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextStage = Math.min(activeRegion.endStage, node.stage + 1)
    } else if (event.key === 'Home') {
      nextStage = activeRegion.startStage
    } else if (event.key === 'End') {
      nextStage = activeRegion.endStage
    } else if (event.key === 'PageUp' || event.key === 'PageDown') {
      const adjacentRegionId = getAdjacentRegionId(
        activeRegionId,
        event.key === 'PageUp' ? 'previous' : 'next',
      )
      event.preventDefault()
      if (adjacentRegionId === null) return
      setRegionAtOffset(adjacentRegionId, node.offset, true)
      return
    } else {
      return
    }

    event.preventDefault()
    focusStage(nextStage)
  }

  const chooseNode = (node: StageNodeView) => {
    pendingNodeFocus.current = null
    setRovingStage(node.stage)
    if (disabled || node.progress === 'locked') return
    onChooseStage(node.stage)
  }

  return (
    <section className="stage-map-disclosure panel" aria-labelledby="stage-map-title">
      <div className="stage-map-disclosure__header">
        <div>
          <p className="eyebrow">EXPEDITION MAP · IRPG-408</p>
          <h2 id="stage-map-title">3지역 원정 지도</h2>
          <p>완료한 길과 현재 위치, 다음 최전선을 한눈에 확인합니다.</p>
        </div>
        <button
          type="button"
          className="stage-map-disclosure__toggle"
          aria-expanded={open}
          aria-controls={open ? PANEL_ID : undefined}
          onClick={toggleMap}
        >
          {open ? '원정 지도 접기' : '원정 지도 열기'}
        </button>
      </div>

      {!open && (
        <div className="stage-map-compact">
          <div className="stage-map-compact__header">
            <strong className="stage-map-compact__region">{currentRegion.name}</strong>
            <span className="stage-map-compact__range">
              {compactNodes[0]?.stage}–{compactNodes.at(-1)?.stage}
            </span>
          </div>

          {disabled && (
            <p className="stage-map-disabled-reason" id={DISABLED_REASON_ID} role="status">
              {disabledReason ?? '현재 게임 상태에서는 스테이지를 이동할 수 없습니다.'}
            </p>
          )}

          <div
            className="stage-map-compact__timeline"
            role="group"
            aria-label={`${currentRegion.name} 현재 10단계`}
          >
            {compactNodes.map((node) => {
              const interactionDisabled = disabled || node.progress === 'locked'
              return (
                <button
                  key={node.stage}
                  type="button"
                  className={[
                    'stage-map-compact__stage',
                    `stage-map-compact__stage--${node.progress}`,
                    node.isCurrent ? 'stage-map-compact__stage--current' : '',
                    node.isBoss ? 'stage-map-compact__stage--boss' : '',
                  ].filter(Boolean).join(' ')}
                  aria-label={getNodeLabel(node, highestStage, disabled)}
                  aria-current={node.isCurrent ? 'step' : undefined}
                  aria-disabled={interactionDisabled || undefined}
                  aria-describedby={disabled ? DISABLED_REASON_ID : undefined}
                  data-stage-state={node.progress}
                  data-current={node.isCurrent ? 'true' : 'false'}
                  data-boss={node.isBoss ? 'true' : 'false'}
                  onClick={() => chooseNode(node)}
                >
                  <span>{node.stage}</span>
                  {node.isBoss && <small aria-hidden="true">B</small>}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {open && (
        <div className="stage-map-panel" id={PANEL_ID}>
          <div className="stage-map-tabs" role="tablist" aria-label="원정 지역">
            {STAGE_REGIONS.map((region) => {
              const active = region.id === activeRegionId
              return (
                <button
                  key={region.id}
                  ref={(node) => {
                    if (node === null) tabRefs.current.delete(region.id)
                    else tabRefs.current.set(region.id, node)
                  }}
                  id={`stage-map-tab-${region.id}`}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-controls={active ? `stage-map-region-${region.id}` : undefined}
                  tabIndex={active ? 0 : -1}
                  onClick={() => activateTab(region.id)}
                  onKeyDown={(event) => handleTabKeyDown(event, region.id)}
                >
                  <strong>{region.name}</strong>
                  <span>{region.startStage}–{region.endStage}</span>
                </button>
              )
            })}
          </div>

          <div
            id={`stage-map-region-${activeRegion.id}`}
            className="stage-map-region"
            role="tabpanel"
            aria-labelledby={`stage-map-tab-${activeRegion.id}`}
          >
            <div className="stage-map-scene">
              <GameAsset
                assetId={activeRegion.assetId}
                purpose="region"
                className="stage-map-scene__art"
                decorative
                fallbackLabel="지도"
                loading="lazy"
                style={{ aspectRatio: 'auto', height: '100%' }}
              />
              <div className="stage-map-scene__copy">
                <span>{activeRegion.landmark}</span>
                <h3>{activeRegion.name}</h3>
                <p>{activeRegion.description}</p>
              </div>
            </div>

            <div className="stage-map-legend" aria-label="스테이지 상태 범례">
              <span data-kind="current">현재</span>
              <span data-kind="completed">완료</span>
              <span data-kind="frontier">최전선</span>
              <span data-kind="locked">잠김</span>
              <span data-kind="boss">보스</span>
            </div>

            {disabled && (
              <p className="stage-map-disabled-reason" id={DISABLED_REASON_ID} role="status">
                {disabledReason ?? '현재 게임 상태에서는 스테이지를 이동할 수 없습니다.'}
              </p>
            )}

            <div
              className="stage-map-node-grid"
              role="group"
              aria-label={`${activeRegion.name} 스테이지`}
            >
              {nodes.map((node) => {
                const interactionDisabled = disabled || node.progress === 'locked'
                return (
                  <button
                    key={node.stage}
                    ref={(element) => {
                      if (element === null) nodeRefs.current.delete(node.stage)
                      else nodeRefs.current.set(node.stage, element)
                    }}
                    type="button"
                    className={[
                      'stage-map-node',
                      `stage-map-node--${node.progress}`,
                      node.isCurrent ? 'stage-map-node--current' : '',
                      node.isBoss ? 'stage-map-node--boss' : '',
                    ].filter(Boolean).join(' ')}
                    aria-label={getNodeLabel(node, highestStage, disabled)}
                    aria-current={node.isCurrent ? 'step' : undefined}
                    aria-disabled={interactionDisabled || undefined}
                    aria-describedby={disabled ? DISABLED_REASON_ID : undefined}
                    tabIndex={node.stage === rovingStage ? 0 : -1}
                    data-testid={`stage-map-node-${node.stage}`}
                    data-stage-state={node.progress}
                    data-current={node.isCurrent ? 'true' : 'false'}
                    data-boss={node.isBoss ? 'true' : 'false'}
                    onClick={() => chooseNode(node)}
                    onKeyDown={(event) => handleNodeKeyDown(event, node)}
                  >
                    <span>{node.stage}</span>
                    {node.isBoss && <small aria-hidden="true">B</small>}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
