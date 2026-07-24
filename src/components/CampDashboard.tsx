import { getCampHealingAshCost, getHealingPotionRecoveryAmount, type CampMerchantOfferSlot } from '../game/camp'
import { getHeroStats } from '../game/formulas'
import { formatNumber } from '../game/format'
import {
  SAVE_VERSION,
  type Chapter1CostumeId,
  type Chapter1SynthesisId,
  type CampConsumableId,
  type CampQuickConsumableId,
  type CampRecipeId,
  type CampStructureId,
  type CampTrainingId,
  type GameState,
} from '../game/types'
import type { GameCommandFeedback } from '../hooks/useGame'
import { CampCanvas } from './CampCanvas'
import { GameAsset } from './GameAsset'
import { StatBar } from './StatBar'

interface CampDashboardProps {
  state: GameState
  notice: string
  disabled: boolean
  onUpgradeStructure: (id: CampStructureId) => void
  onTrain: (id: CampTrainingId) => void
  onStartCraft: (id: CampRecipeId) => void
  onUseConsumable: (id: CampConsumableId) => void
  onHealAtCamp: () => void
  onEquipQuickConsumable: (id: CampQuickConsumableId | null) => void
  onPurchaseMerchantOffer: (slot: CampMerchantOfferSlot) => void
  onAcceptSeraContract: () => void
  onIncreaseSeraTrust: () => void
  onSetAdultContentAccess: (confirmed: boolean) => GameCommandFeedback
  onSetSeraBondConsent: (consent: 'granted' | 'withdrawn') => GameCommandFeedback
  onSelectCostume: (id: Chapter1CostumeId) => GameCommandFeedback
  onSynthesizeJointBond: (id: Chapter1SynthesisId) => GameCommandFeedback
}

export function CampDashboard({
  state,
  notice,
  disabled,
  onUpgradeStructure,
  onTrain,
  onStartCraft,
  onUseConsumable,
  onHealAtCamp,
  onEquipQuickConsumable,
  onPurchaseMerchantOffer,
  onAcceptSeraContract,
  onIncreaseSeraTrust,
  onSetAdultContentAccess,
  onSetSeraBondConsent,
  onSelectCostume,
  onSynthesizeJointBond,
}: CampDashboardProps) {
  const hero = getHeroStats(state)
  const healingAshCost = getCampHealingAshCost(state)
  const healingCannotAfford = healingAshCost !== null
    && state.camp.materials.ashShard < healingAshCost
  const healingPotionRecovery = getHealingPotionRecoveryAmount(state)
  const healingPotionEquipped = state.camp.quickConsumable === 'healingPotion'

  return (
    <div className="camp-dashboard" data-testid="camp-dashboard">
      <section className="camp-rest panel" aria-labelledby="camp-rest-title">
        <GameAsset
          assetId="event.ash-camp"
          purpose="card"
          decorative
          className="camp-rest__background"
          fit="cover"
          style={{ position: 'absolute', inset: 0 }}
        />
        <div className="camp-rest__shade" aria-hidden="true" />
        <header className="camp-rest__header">
          <div>
            <p className="eyebrow">RESTING PARTY</p>
            <h2 id="camp-rest-title">잿불 야영지</h2>
          </div>
          <span className="camp-pause-badge">전경 전투 일시 정지</span>
        </header>
        <GameAsset
          assetId="hero.ashen-knight.default"
          purpose="character"
          alt="모닥불 앞에서 휴식 중인 방랑 기사 아렌"
          fallbackLabel="A"
          className="camp-rest__hero"
          fit="contain"
          loading="eager"
        />
        <div className="camp-rest__status">
          <strong>아렌</strong>
          <span>마지막 전투 · STAGE {state.battle.stage}</span>
          <StatBar
            label="영웅 체력"
            value={state.player.currentHp}
            maximum={hero.maxHp}
            tone="health"
          />
          <p>
            캠프 화면을 보는 동안 라운드와 전투 로그가 멈춥니다. 앱을 닫은 시간은 마지막 전투 상태부터 오프라인 원정으로 한 번 정산됩니다.
          </p>
        </div>
      </section>

      <section className="camp-overview panel" aria-labelledby="camp-overview-title">
        <header className="panel__header camp-section-header">
          <div>
            <p className="eyebrow">CAMP OVERVIEW</p>
            <h2 id="camp-overview-title">캠프 조감도</h2>
          </div>
          <span>schema {SAVE_VERSION} · 안전한 기반</span>
        </header>
        <CampCanvas
          state={state}
          disabled={disabled}
          onUpgradeStructure={onUpgradeStructure}
          onTrain={onTrain}
          onStartCraft={onStartCraft}
          onPurchaseMerchantOffer={onPurchaseMerchantOffer}
          onAcceptSeraContract={onAcceptSeraContract}
          onIncreaseSeraTrust={onIncreaseSeraTrust}
          onSetAdultContentAccess={onSetAdultContentAccess}
          onSetSeraBondConsent={onSetSeraBondConsent}
          onSelectCostume={onSelectCostume}
          onSynthesizeJointBond={onSynthesizeJointBond}
        />
      </section>

      <aside className="camp-command panel" aria-labelledby="camp-command-title">
        <header className="camp-section-header">
          <p className="eyebrow">CAMP COMMAND</p>
          <h2 id="camp-command-title">관리 준비</h2>
        </header>
        <dl className="camp-summary">
          <div><dt>텐트</dt><dd>Lv.{state.camp.structures.tent}</dd></div>
          <div><dt>작업대</dt><dd>Lv.{state.camp.structures.workbench}</dd></div>
          <div><dt>단련소</dt><dd>Lv.{state.camp.structures.trainingGround}</dd></div>
          <div><dt>보유 골드</dt><dd>{formatNumber(state.player.gold)}</dd></div>
        </dl>
        <section className="camp-supplies" aria-labelledby="camp-healing-title">
          <div className="camp-training__heading">
            <div>
              <p className="eyebrow">HEALING BRAZIER</p>
              <h3 id="camp-healing-title">치유 화로</h3>
            </div>
            <span>재의 온기로 완전 회복</span>
          </div>
          <div className="camp-supply-grid camp-supply-grid--healing">
            <button
              type="button"
              className="camp-healing-device"
              disabled={disabled || healingAshCost === null || healingCannotAfford}
              onClick={onHealAtCamp}
              aria-label={disabled
                ? '치유 화로 · 지금은 사용할 수 없음'
                : healingAshCost === null
                  ? '치유 화로 · 체력이 가득 참'
                  : healingCannotAfford
                    ? `치유 화로 · 재의 파편 ${healingAshCost}개 필요 · 재료 부족`
                    : `치유 화로 · 재의 파편 ${healingAshCost}개로 완전 회복`}
            >
              <GameAsset
                assetId="event.ember-shrine"
                purpose="card"
                className="camp-healing-device__art"
                fallbackLabel="치유 화로"
                fit="cover"
                decorative
              />
              <span>
                <strong>치유 화로</strong>
                <small>{healingAshCost === null
                  ? '현재 체력이 가득 찼습니다.'
                  : healingCannotAfford
                    ? `재의 파편 ${healingAshCost}개 필요 · 재료 부족`
                    : `재의 파편 ${healingAshCost}개 · HP ${formatNumber(state.player.currentHp)} → ${formatNumber(hero.maxHp)}`}</small>
              </span>
            </button>
          </div>
        </section>
        <section className="camp-supplies" aria-labelledby="camp-supplies-title">
          <div className="camp-training__heading">
            <div>
              <p className="eyebrow">BATTLE SUPPLIES</p>
              <h3 id="camp-supplies-title">다음 원정 보급</h3>
            </div>
          </div>
          <div className="camp-supply-grid">
            <button
              type="button"
              disabled={disabled || state.camp.consumables.goldStew < 1 || state.camp.buffs.goldBoostRounds > 0}
              onClick={() => onUseConsumable('goldStew')}
            >
              <strong>황금 스튜 ×{state.camp.consumables.goldStew}</strong>
              <small>{state.camp.buffs.goldBoostRounds > 0 ? `남은 ${state.camp.buffs.goldBoostRounds} 라운드` : '1,800 라운드 골드 +50%'}</small>
            </button>
            <button
              type="button"
              disabled={disabled || state.camp.consumables.focusTonic < 1 || state.camp.buffs.bossFocusStage !== null}
              onClick={() => onUseConsumable('focusTonic')}
            >
              <strong>집중 물약 ×{state.camp.consumables.focusTonic}</strong>
              <small>{state.camp.buffs.bossFocusStage === null
                ? '다음 보스 치명타 35%'
                : state.camp.buffs.bossFocusStage === 0
                  ? '다음 보스전 준비 완료'
                  : `STAGE ${state.camp.buffs.bossFocusStage} 집중 적용 중`}</small>
            </button>
            <button
              type="button"
              disabled={disabled || (!healingPotionEquipped && state.camp.consumables.healingPotion < 1)}
              onClick={() => onEquipQuickConsumable(
                healingPotionEquipped ? null : 'healingPotion',
              )}
              aria-pressed={healingPotionEquipped}
              aria-label={disabled
                ? '회복 물약 빠른 슬롯 · 지금은 변경할 수 없음'
                : healingPotionEquipped
                  ? '회복 물약 빠른 슬롯 장착 해제'
                  : state.camp.consumables.healingPotion < 1
                    ? '회복 물약 빠른 슬롯 장착 · 보유 물약 없음'
                    : '회복 물약 빠른 슬롯 장착'}
            >
              <strong>회복 물약 ×{state.camp.consumables.healingPotion}</strong>
              <small>{healingPotionEquipped
                ? `장착 중 · 전투에서 HP ${formatNumber(healingPotionRecovery)} 회복`
                : `빠른 슬롯 장착 · HP ${formatNumber(healingPotionRecovery)} 회복`}</small>
            </button>
          </div>
        </section>
        <div className="camp-command__note">
          <strong>자동 전투 안전 정지</strong>
          <p>HP, 적 HP, cooldown, RNG와 보상은 캠프 전경에서 변하지 않습니다.</p>
        </div>
        <div className="notice-strip" role="status" aria-live="polite">{notice}</div>
      </aside>
    </div>
  )
}
