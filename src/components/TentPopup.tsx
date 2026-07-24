import {
  CAMP_STRUCTURE_MAX_LEVEL,
  getCampFacilityCurrentEffect,
  getCampFacilityNextEffect,
  getCampStructureUpgradeCost,
} from '../game/camp'
import { formatNumber } from '../game/format'
import type { GameState } from '../game/types'
import { CampBuildingModal } from './CampBuildingModal'
import { GameAsset } from './GameAsset'

export interface TentPopupProps {
  state: GameState
  disabled: boolean
  onUpgradeStructure: () => void
  onClose: () => void
}

export function TentPopup({ state, disabled, onUpgradeStructure, onClose }: TentPopupProps) {
  const level = state.camp.structures.tent
  const cost = getCampStructureUpgradeCost('tent', level)
  const isMax = cost === null
  const cannotAfford = !isMax && state.player.gold < cost

  return (
    <CampBuildingModal
      titleId="tent-popup-title"
      eyebrow="EXPEDITION TENT"
      title="원정 텐트"
      onClose={onClose}
    >
      <GameAsset
        assetId="event.ash-camp"
        purpose="card"
        decorative
        fallbackLabel="◆"
        className="camp-building-modal__art"
        fit="cover"
      />
      <p>휴식과 오프라인 원정 시간을 관리합니다.</p>
      <dl className="camp-building-modal__facts">
        <div><dt>레벨</dt><dd>{level} / {CAMP_STRUCTURE_MAX_LEVEL}</dd></div>
        <div><dt>현재 효과</dt><dd>{getCampFacilityCurrentEffect('tent', level)}</dd></div>
      </dl>
      <button
        type="button"
        disabled={disabled || isMax || cannotAfford}
        aria-label={isMax
          ? '원정 텐트 최고 레벨'
          : cannotAfford
            ? `원정 텐트 확장 · ${formatNumber(cost)} 골드 필요 · 골드 부족`
            : `원정 텐트 확장 · ${formatNumber(cost)} 골드`}
        onClick={onUpgradeStructure}
      >
        {isMax ? 'MAX' : `확장 · ${formatNumber(cost)} 골드`}
      </button>
      <small>
        {isMax
          ? `${getCampFacilityCurrentEffect('tent', level)} · 최고 레벨`
          : `${getCampFacilityNextEffect('tent', level)}${cannotAfford ? ' · 골드 부족' : ''}`}
      </small>
    </CampBuildingModal>
  )
}
