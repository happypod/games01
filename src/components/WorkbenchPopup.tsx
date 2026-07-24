import {
  CAMP_MATERIAL_LABELS,
  CAMP_RECIPE_DEFINITIONS,
  CAMP_STRUCTURE_MAX_LEVEL,
  formatCampCountdown,
  getCampCraftDurationMs,
  getCampFacilityCurrentEffect,
  getCampFacilityNextEffect,
  getCampStructureUpgradeCost,
} from '../game/camp'
import { formatNumber } from '../game/format'
import { CAMP_RECIPE_IDS, type CampRecipeId, type GameState } from '../game/types'
import { CampBuildingModal } from './CampBuildingModal'
import { GameAsset } from './GameAsset'

export interface WorkbenchPopupProps {
  state: GameState
  disabled: boolean
  onUpgradeStructure: () => void
  onStartCraft: (id: CampRecipeId) => void
  onClose: () => void
}

const MATERIAL_IDS = Object.keys(CAMP_MATERIAL_LABELS) as Array<keyof typeof CAMP_MATERIAL_LABELS>

export function WorkbenchPopup({
  state,
  disabled,
  onUpgradeStructure,
  onStartCraft,
  onClose,
}: WorkbenchPopupProps) {
  const level = state.camp.structures.workbench
  const cost = getCampStructureUpgradeCost('workbench', level)
  const isMax = cost === null
  const cannotAfford = !isMax && state.player.gold < cost

  return (
    <CampBuildingModal
      titleId="workbench-popup-title"
      eyebrow="WORKBENCH"
      title="불씨 작업대"
      onClose={onClose}
    >
      <GameAsset
        assetId="event.wandering-smith"
        purpose="card"
        decorative
        fallbackLabel="◆"
        className="camp-building-modal__art"
        fit="cover"
      />
      <p>전리품을 확정 레시피로 가공하는 공간입니다.</p>
      <dl className="camp-building-modal__facts">
        <div><dt>레벨</dt><dd>{level} / {CAMP_STRUCTURE_MAX_LEVEL}</dd></div>
        <div><dt>현재 효과</dt><dd>{getCampFacilityCurrentEffect('workbench', level)}</dd></div>
      </dl>
      <button
        type="button"
        disabled={disabled || isMax || cannotAfford}
        aria-label={isMax
          ? '불씨 작업대 최고 레벨'
          : cannotAfford
            ? `불씨 작업대 확장 · ${formatNumber(cost)} 골드 필요 · 골드 부족`
            : `불씨 작업대 확장 · ${formatNumber(cost)} 골드`}
        onClick={onUpgradeStructure}
      >
        {isMax ? 'MAX' : `확장 · ${formatNumber(cost)} 골드`}
      </button>
      <small>
        {isMax
          ? `${getCampFacilityCurrentEffect('workbench', level)} · 최고 레벨`
          : `${getCampFacilityNextEffect('workbench', level)}${cannotAfford ? ' · 골드 부족' : ''}`}
      </small>

      <section aria-labelledby="workbench-storage-title">
        <p className="eyebrow">STORAGE & LOOT</p>
        <h3 id="workbench-storage-title">캠프 대형 보관함 & 임시 전리품</h3>
        <p>
          임시 전리품 종류: {Object.keys(state.inventory.lootBag).length}종 | 보관함 아이템: {Object.keys(state.inventory.campStorage).length}종 | 영웅 가방: {Object.keys(state.inventory.heroInventory).length}종
        </p>
      </section>

      <section aria-labelledby="workbench-crafting-title">
        <p className="eyebrow">MATERIALS</p>
        <h3 id="workbench-crafting-title">재료와 제작</h3>
        <dl className="camp-materials" aria-label="보유 제작 재료">
          {MATERIAL_IDS.map((id) => (
            <div key={id}>
              <dt>{CAMP_MATERIAL_LABELS[id]}</dt>
              <dd>{formatNumber(state.camp.materials[id])}</dd>
            </div>
          ))}
        </dl>
        {state.camp.craftJob !== null && (
          <div className="camp-craft-progress">
            <strong>{CAMP_RECIPE_DEFINITIONS[state.camp.craftJob.recipeId].name} 제작 중</strong>
            <span>남은 시간 {formatCampCountdown(state.camp.craftJob.remainingMs)}</span>
          </div>
        )}
        <div className="camp-recipe-list">
          {CAMP_RECIPE_IDS.map((id) => {
            const recipe = CAMP_RECIPE_DEFINITIONS[id]
            const missing = MATERIAL_IDS.some(
              (materialId) => state.camp.materials[materialId] < recipe.ingredients[materialId],
            )
            const actionLabel = state.camp.craftJob !== null
              ? '작업대 제작 중'
              : missing
                ? '재료 부족'
                : '제작'
            return (
              <article className="camp-recipe-card" key={id}>
                <div>
                  <strong>{recipe.name}</strong>
                  <small>
                    {MATERIAL_IDS
                      .filter((materialId) => recipe.ingredients[materialId] > 0)
                      .map((materialId) => `${CAMP_MATERIAL_LABELS[materialId]} ${recipe.ingredients[materialId]}`)
                      .join(' · ')}
                  </small>
                  <span>{formatCampCountdown(getCampCraftDurationMs(state.camp, id))}</span>
                </div>
                <button
                  type="button"
                  disabled={disabled || state.camp.craftJob !== null || missing}
                  aria-label={`${recipe.name} ${actionLabel}`}
                  onClick={() => onStartCraft(id)}
                >
                  {actionLabel}
                </button>
              </article>
            )
          })}
        </div>
      </section>
    </CampBuildingModal>
  )
}
