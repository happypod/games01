import { useState } from 'react'
import { CAMP_FACILITY_DEFINITIONS, type CampMerchantOfferSlot } from '../game/camp'
import type {
  CampRecipeId,
  CampStructureId,
  CampTrainingId,
  Chapter1CostumeId,
  Chapter1SynthesisId,
  GameState,
} from '../game/types'
import type { GameCommandFeedback } from '../hooks/useGame'
import { GameAsset } from './GameAsset'
import { MerchantPopup } from './MerchantPopup'
import { SeraPopup } from './SeraPopup'
import { TentPopup } from './TentPopup'
import { TrainingGroundPopup } from './TrainingGroundPopup'
import { WorkbenchPopup } from './WorkbenchPopup'

export interface CampCanvasProps {
  state: GameState
  disabled: boolean
  onUpgradeStructure: (id: CampStructureId) => void
  onTrain: (id: CampTrainingId) => void
  onStartCraft: (id: CampRecipeId) => void
  onPurchaseMerchantOffer: (slot: CampMerchantOfferSlot) => void
  onAcceptSeraContract: () => void
  onIncreaseSeraTrust: () => void
  onSetAdultContentAccess: (confirmed: boolean) => GameCommandFeedback
  onSetSeraBondConsent: (consent: 'granted' | 'withdrawn') => GameCommandFeedback
  onSelectCostume: (id: Chapter1CostumeId) => GameCommandFeedback
  onSynthesizeJointBond: (id: Chapter1SynthesisId) => GameCommandFeedback
}

type OpenPopup = CampStructureId | 'sera' | 'merchant' | null

const CAMP_OBJECT_POSITIONS: Readonly<Record<CampStructureId, { x: number; y: number }>> = {
  tent: { x: 18, y: 66 },
  workbench: { x: 50, y: 74 },
  trainingGround: { x: 82, y: 64 },
}

const SERA_ACTOR_POSITION = { x: 50, y: 30 }
const MERCHANT_POSITION = { x: 12, y: 38 }

export function CampCanvas({
  state,
  disabled,
  onUpgradeStructure,
  onTrain,
  onStartCraft,
  onPurchaseMerchantOffer,
  onAcceptSeraContract,
  onIncreaseSeraTrust,
  onSetAdultContentAccess,
  onSetSeraBondConsent,
  onSelectCostume,
  onSynthesizeJointBond,
}: CampCanvasProps) {
  const [openPopup, setOpenPopup] = useState<OpenPopup>(null)
  const closePopup = () => setOpenPopup(null)
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
        const position = CAMP_OBJECT_POSITIONS[facility.id]
        return (
          <button
            key={facility.id}
            type="button"
            className="camp-canvas__object"
            style={{ left: `${position.x}%`, top: `${position.y}%` }}
            disabled={disabled}
            onClick={() => setOpenPopup(facility.id)}
            aria-label={`${facility.name} 열기 · Lv.${level}`}
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

      <button
        type="button"
        className="camp-canvas__object"
        style={{ left: `${MERCHANT_POSITION.x}%`, top: `${MERCHANT_POSITION.y}%` }}
        disabled={disabled}
        onClick={() => setOpenPopup('merchant')}
        aria-label="떠돌이 상인 열기"
      >
        <GameAsset
          assetId="event.ash-camp"
          purpose="card"
          decorative
          fallbackLabel="상인"
          className="camp-canvas__object-art"
          fit="cover"
        />
        <span className="camp-canvas__label">떠돌이 상인</span>
      </button>

      {showSera && (
        <button
          type="button"
          className="camp-canvas__actor"
          style={{ left: `${SERA_ACTOR_POSITION.x}%`, top: `${SERA_ACTOR_POSITION.y}%` }}
          disabled={disabled}
          onClick={() => setOpenPopup('sera')}
          aria-label="세라 열기"
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

      {openPopup === 'tent' && (
        <TentPopup
          state={state}
          disabled={disabled}
          onUpgradeStructure={() => onUpgradeStructure('tent')}
          onClose={closePopup}
        />
      )}
      {openPopup === 'workbench' && (
        <WorkbenchPopup
          state={state}
          disabled={disabled}
          onUpgradeStructure={() => onUpgradeStructure('workbench')}
          onStartCraft={onStartCraft}
          onClose={closePopup}
        />
      )}
      {openPopup === 'trainingGround' && (
        <TrainingGroundPopup
          state={state}
          disabled={disabled}
          onUpgradeStructure={() => onUpgradeStructure('trainingGround')}
          onTrain={onTrain}
          onClose={closePopup}
        />
      )}
      {openPopup === 'sera' && (
        <SeraPopup
          state={state}
          disabled={disabled}
          onAcceptSeraContract={onAcceptSeraContract}
          onIncreaseSeraTrust={onIncreaseSeraTrust}
          onSetAdultContentAccess={onSetAdultContentAccess}
          onSetSeraBondConsent={onSetSeraBondConsent}
          onSelectCostume={onSelectCostume}
          onSynthesizeJointBond={onSynthesizeJointBond}
          onClose={closePopup}
        />
      )}
      {openPopup === 'merchant' && (
        <MerchantPopup
          state={state}
          disabled={disabled}
          onPurchaseMerchantOffer={onPurchaseMerchantOffer}
          onClose={closePopup}
        />
      )}
    </div>
  )
}
