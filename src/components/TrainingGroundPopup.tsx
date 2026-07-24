import {
  CAMP_STRUCTURE_MAX_LEVEL,
  CAMP_TRAINING_EFFECTS,
  getCampFacilityCurrentEffect,
  getCampFacilityNextEffect,
  getCampStructureUpgradeCost,
  getCampTrainingCost,
  getCampTrainingRankCap,
} from '../game/camp'
import { getHeroStats } from '../game/formulas'
import { formatNumber } from '../game/format'
import type { CampTrainingId, GameState } from '../game/types'
import { CampBuildingModal } from './CampBuildingModal'
import { GameAsset } from './GameAsset'

export interface TrainingGroundPopupProps {
  state: GameState
  disabled: boolean
  onUpgradeStructure: () => void
  onTrain: (id: CampTrainingId) => void
  onClose: () => void
}

const TRAINING_IDS = ['attack', 'vitality'] as const

export function TrainingGroundPopup({
  state,
  disabled,
  onUpgradeStructure,
  onTrain,
  onClose,
}: TrainingGroundPopupProps) {
  const level = state.camp.structures.trainingGround
  const cost = getCampStructureUpgradeCost('trainingGround', level)
  const isMax = cost === null
  const cannotAfford = !isMax && state.player.gold < cost
  const trainingCap = getCampTrainingRankCap(state.camp)
  const hero = getHeroStats(state)

  return (
    <CampBuildingModal
      titleId="training-ground-popup-title"
      eyebrow="TRAINING GROUND"
      title="단련소"
      onClose={onClose}
    >
      <GameAsset
        assetId="event.ember-shrine"
        purpose="card"
        decorative
        fallbackLabel="◆"
        className="camp-building-modal__art"
        fit="cover"
      />
      <p>영구 공격력과 체력 훈련을 준비합니다.</p>
      <dl className="camp-building-modal__facts">
        <div><dt>레벨</dt><dd>{level} / {CAMP_STRUCTURE_MAX_LEVEL}</dd></div>
        <div><dt>현재 효과</dt><dd>{getCampFacilityCurrentEffect('trainingGround', level)}</dd></div>
      </dl>
      <button
        type="button"
        disabled={disabled || isMax || cannotAfford}
        aria-label={isMax
          ? '단련소 최고 레벨'
          : cannotAfford
            ? `단련소 확장 · ${formatNumber(cost)} 골드 필요 · 골드 부족`
            : `단련소 확장 · ${formatNumber(cost)} 골드`}
        onClick={onUpgradeStructure}
      >
        {isMax ? 'MAX' : `확장 · ${formatNumber(cost)} 골드`}
      </button>
      <small>
        {isMax
          ? `${getCampFacilityCurrentEffect('trainingGround', level)} · 최고 레벨`
          : `${getCampFacilityNextEffect('trainingGround', level)}${cannotAfford ? ' · 골드 부족' : ''}`}
      </small>

      <section aria-labelledby="training-ground-training-title">
        <div>
          <p className="eyebrow">PERMANENT TRAINING</p>
          <h3 id="training-ground-training-title">영구 훈련</h3>
          <span>상한 {trainingCap}</span>
        </div>
        {TRAINING_IDS.map((id) => {
          const rank = state.camp.training[id]
          const trainingCost = getCampTrainingCost(id, rank)
          const atCap = rank >= trainingCap
          const atAbsoluteMax = atCap && level >= CAMP_STRUCTURE_MAX_LEVEL
          const trainingCannotAfford = !atCap && state.player.gold < trainingCost
          const label = id === 'attack' ? '공격 훈련' : '체력 훈련'
          const effect = CAMP_TRAINING_EFFECTS[id]
          const currentValue = id === 'attack' ? hero.attack : hero.maxHp
          return (
            <article className="camp-training-card" key={id}>
              <div>
                <strong>{label}</strong>
                <span>Rank {rank}/{trainingCap}</span>
                <small>
                  {id === 'attack' ? '공격력' : '최대 체력'} {currentValue} → {currentValue + effect} · 환생 후 유지
                </small>
              </div>
              <button
                type="button"
                disabled={disabled || atCap || state.player.gold < trainingCost}
                onClick={() => onTrain(id)}
                aria-label={`${label} · ${atAbsoluteMax
                  ? '최대 훈련 완료'
                  : atCap
                    ? '단련소 확장 필요'
                    : trainingCannotAfford
                      ? `${formatNumber(trainingCost)} 골드 필요 · 골드 부족`
                      : `${formatNumber(trainingCost)} 골드`}`}
              >
                {atAbsoluteMax ? 'MAX' : atCap ? '단련소 확장 필요' : trainingCannotAfford ? `${formatNumber(trainingCost)} G · 부족` : `${formatNumber(trainingCost)} G`}
              </button>
            </article>
          )
        })}
      </section>
    </CampBuildingModal>
  )
}
