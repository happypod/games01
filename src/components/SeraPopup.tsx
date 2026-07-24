import {
  faFireFlameCurved,
  faHeart,
  faShirt,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useId, useRef, useState, type KeyboardEvent } from 'react'
import { getSeraTrustCost } from '../game/camp'
import { formatNumber } from '../game/format'
import type {
  Chapter1CostumeId,
  Chapter1SynthesisId,
  GameState,
} from '../game/types'
import type { GameCommandFeedback } from '../hooks/useGame'
import {
  CampSpecialFacilities,
  type CampSpecialFacilityId,
} from './CampSpecialFacilities'
import { CampBuildingModal } from './CampBuildingModal'
import { GameAsset } from './GameAsset'

export interface SeraPopupProps {
  state: GameState
  disabled: boolean
  onAcceptSeraContract: () => void
  onIncreaseSeraTrust: () => void
  onSetAdultContentAccess: (confirmed: boolean) => GameCommandFeedback
  onSetSeraBondConsent: (consent: 'granted' | 'withdrawn') => GameCommandFeedback
  onSelectCostume: (id: Chapter1CostumeId) => GameCommandFeedback
  onSynthesizeJointBond: (id: Chapter1SynthesisId) => GameCommandFeedback
  onClose: () => void
}

const SERA_POPUP_TABS = [
  { id: 'bondTraining', label: '유대 훈련실', icon: faHeart },
  { id: 'costumeRoom', label: '의상실', icon: faShirt },
  { id: 'jointSynthesis', label: '합동 연성실', icon: faFireFlameCurved },
] as const

export function SeraPopup({
  state,
  disabled,
  onAcceptSeraContract,
  onIncreaseSeraTrust,
  onSetAdultContentAccess,
  onSetSeraBondConsent,
  onSelectCostume,
  onSynthesizeJointBond,
  onClose,
}: SeraPopupProps) {
  const [activeFacility, setActiveFacility] = useState<CampSpecialFacilityId>('bondTraining')
  const tabRefs = useRef(new Map<CampSpecialFacilityId, HTMLButtonElement>())
  const tabIdPrefix = useId().replaceAll(':', '')
  const sera = state.camp.residents.sera
  const merchantDiscount = state.camp.residents.sera.status === 'contracted'
    ? state.camp.residents.sera.trust * 2
    : 0

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, tabId: CampSpecialFacilityId) => {
    const currentIndex = SERA_POPUP_TABS.findIndex(({ id }) => id === tabId)
    let nextIndex: number
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (currentIndex - 1 + SERA_POPUP_TABS.length) % SERA_POPUP_TABS.length
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (currentIndex + 1) % SERA_POPUP_TABS.length
    } else if (event.key === 'Home') {
      nextIndex = 0
    } else if (event.key === 'End') {
      nextIndex = SERA_POPUP_TABS.length - 1
    } else {
      return
    }
    event.preventDefault()
    const nextTab = SERA_POPUP_TABS[nextIndex]
    if (nextTab === undefined) return
    setActiveFacility(nextTab.id)
    tabRefs.current.get(nextTab.id)?.focus()
  }

  const activeTabId = `${tabIdPrefix}-sera-tab-${activeFacility}`
  const activePanelId = `${tabIdPrefix}-sera-panel`

  return (
    <CampBuildingModal
      titleId="sera-popup-title"
      eyebrow="CAMP RESIDENT"
      title="성인 정찰병 세라"
      onClose={onClose}
    >
      <GameAsset
        assetId="event.ash-camp"
        purpose="card"
        decorative
        className="camp-building-modal__art"
        fit="cover"
      />
      {sera.status === 'unmet' && (
        <p>성인 정찰병 세라의 구조 지원을 완료하면 안전한 캠프 거처로 이동합니다. 구조와 계약은 분리되며 어떤 계약도 자동으로 체결되지 않습니다.</p>
      )}
      {sera.status === 'rescued' && (
        <>
          <p>세라는 안전하게 회복 중입니다. 상점 조언 계약은 본인이 자유롭게 수락하거나 보류할 수 있는 별도 선택입니다.</p>
          <button type="button" disabled={disabled} onClick={onAcceptSeraContract}>
            자발적 상점 조언 계약 제안
          </button>
        </>
      )}
      {sera.status === 'contracted' && (() => {
        const trustCost = getSeraTrustCost(sera.trust)
        const cannotAfford = trustCost !== null && state.player.gold < trustCost
        return (
          <>
            <p>세라는 캠프 상점의 시세 조언을 맡습니다. 전투 동료가 아니며 신뢰 {sera.trust}/5에 따라 가격이 {merchantDiscount}% 할인됩니다.</p>
            <button
              type="button"
              disabled={disabled || trustCost === null || cannotAfford}
              onClick={onIncreaseSeraTrust}
              aria-label={trustCost === null
                ? '세라 신뢰 최대 단계'
                : cannotAfford
                  ? `세라 신뢰 활동 · ${formatNumber(trustCost)} 골드 필요 · 골드 부족`
                  : `세라 신뢰 활동 · ${formatNumber(trustCost)} 골드`}
            >
              {trustCost === null ? '신뢰 MAX' : cannotAfford ? `${formatNumber(trustCost)} G · 부족` : `신뢰 활동 · ${formatNumber(trustCost)} G`}
            </button>
          </>
        )
      })()}

      <div className="camp-center-tabs" role="tablist" aria-label="세라 유대 시설">
        {SERA_POPUP_TABS.map((tab) => {
          const selected = tab.id === activeFacility
          return (
            <button
              key={tab.id}
              ref={(node) => {
                if (node === null) tabRefs.current.delete(tab.id)
                else tabRefs.current.set(tab.id, node)
              }}
              id={`${tabIdPrefix}-sera-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={activePanelId}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActiveFacility(tab.id)}
              onKeyDown={(event) => handleTabKeyDown(event, tab.id)}
            >
              <FontAwesomeIcon icon={tab.icon} fixedWidth aria-hidden="true" />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>
      <div
        id={activePanelId}
        role="tabpanel"
        aria-labelledby={activeTabId}
        data-camp-panel={activeFacility}
      >
        <CampSpecialFacilities
          key={activeFacility}
          activeFacility={activeFacility}
          state={state}
          disabled={disabled}
          onSetAdultContentAccess={onSetAdultContentAccess}
          onSetSeraBondConsent={onSetSeraBondConsent}
          onSelectCostume={onSelectCostume}
          onSynthesizeJointBond={onSynthesizeJointBond}
          onIncreaseSeraTrust={onIncreaseSeraTrust}
        />
      </div>
    </CampBuildingModal>
  )
}
