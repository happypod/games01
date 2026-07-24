import { CAMP_FACILITY_DEFINITIONS, getCampStructureUpgradeCost } from '../game/camp'
import { formatNumber } from '../game/format'
import type { CampStructureId, GameState } from '../game/types'
import { GameAsset } from './GameAsset'

export interface CampCanvasProps {
  state: GameState
  disabled: boolean
  onUpgradeStructure: (id: CampStructureId) => void
  onOpenBondTraining: () => void
}

const CAMP_OBJECT_POSITIONS: Readonly<Record<CampStructureId, { x: number; y: number }>> = {
  tent: { x: 18, y: 66 },
  workbench: { x: 50, y: 74 },
  trainingGround: { x: 82, y: 64 },
}

const SERA_ACTOR_POSITION = { x: 50, y: 30 }

export function CampCanvas({
  state,
  disabled,
  onUpgradeStructure,
  onOpenBondTraining,
}: CampCanvasProps) {
  const sera = state.camp.residents.sera
  const showSera = sera.status !== 'unmet'

  return (
    <div className="camp-canvas" data-testid="camp-canvas">
      <GameAsset
        assetId="event.ash-camp"
        purpose="region"
        decorative
        className="camp-canvas__background"
        fit="cover"
      />
      <div className="camp-canvas__shade" aria-hidden="true" />

      {CAMP_FACILITY_DEFINITIONS.map((facility) => {
        const level = state.camp.structures[facility.id]
        const cost = getCampStructureUpgradeCost(facility.id, level)
        const isMax = cost === null
        const cannotAfford = !isMax && state.player.gold < cost
        const position = CAMP_OBJECT_POSITIONS[facility.id]
        return (
          <button
            key={facility.id}
            type="button"
            className="camp-canvas__object"
            style={{ left: `${position.x}%`, top: `${position.y}%` }}
            disabled={disabled || isMax || cannotAfford}
            onClick={() => onUpgradeStructure(facility.id)}
            aria-label={isMax
              ? `${facility.name} 최고 레벨`
              : cannotAfford
                ? `${facility.name} 확장 · ${formatNumber(cost)} 골드 필요 · 골드 부족`
                : `${facility.name} 확장 · ${formatNumber(cost)} 골드`}
          >
            <span className="camp-canvas__badge">Lv.{level}</span>
            <GameAsset
              assetId={facility.assetId}
              purpose="card"
              decorative
              fallbackLabel="◆"
              className="camp-canvas__object-art"
              fit="cover"
            />
            <span className="camp-canvas__label">{facility.name}</span>
          </button>
        )
      })}

      {showSera && (
        <button
          type="button"
          className="camp-canvas__actor"
          style={{ left: `${SERA_ACTOR_POSITION.x}%`, top: `${SERA_ACTOR_POSITION.y}%` }}
          disabled={disabled}
          onClick={onOpenBondTraining}
          aria-label="세라 · 유대 훈련실 열기"
        >
          <GameAsset
            assetId="character.sera.camp-default"
            purpose="card"
            decorative
            fallbackLabel="세라"
            className="camp-canvas__actor-art"
            fit="cover"
          />
          <span className="camp-canvas__label">세라</span>
        </button>
      )}
    </div>
  )
}
