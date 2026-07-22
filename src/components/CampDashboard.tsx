import {
  CAMP_OFFLINE_CAP_HOURS,
  CAMP_MERCHANT_OFFER_SLOTS,
  CAMP_RECIPE_DEFINITIONS,
  CAMP_STRUCTURE_MAX_LEVEL,
  CAMP_TRAINING_EFFECTS,
  CAMP_WORKBENCH_DURATION_PERCENT,
  getCampStructureUpgradeCost,
  getCampCraftDurationMs,
  getCampMerchantOfferCost,
  getCampMerchantOffers,
  getCampTrainingCost,
  getCampTrainingRankCap,
  getSeraMerchantDiscountPercent,
  getSeraTrustCost,
  type CampMerchantOfferSlot,
} from '../game/camp'
import { getHeroStats } from '../game/formulas'
import { formatNumber } from '../game/format'
import type {
  CampStructureId,
  CampTrainingId,
  CampConsumableId,
  CampRecipeId,
  GameState,
} from '../game/types'
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
  onPurchaseMerchantOffer: (slot: CampMerchantOfferSlot) => void
  onAcceptSeraContract: () => void
  onIncreaseSeraTrust: () => void
}

const FACILITIES = [
  {
    id: 'tent',
    name: '원정 텐트',
    assetId: 'event.ash-camp',
    copy: '휴식과 오프라인 원정 시간을 관리합니다.',
  },
  {
    id: 'workbench',
    name: '불씨 작업대',
    assetId: 'event.wandering-smith',
    copy: '전리품을 확정 레시피로 가공하는 공간입니다.',
  },
  {
    id: 'trainingGround',
    name: '단련소',
    assetId: 'event.ember-shrine',
    copy: '영구 공격력과 체력 훈련을 준비합니다.',
  },
] as const

const MATERIAL_LABELS = {
  ashShard: '재의 파편',
  beastHide: '야수 가죽',
  emberCore: '불씨 핵',
} as const

function formatDuration(milliseconds: number): string {
  const totalSeconds = Math.ceil(milliseconds / 1_000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}분 ${seconds}초`
}

function facilityEffect(id: CampStructureId, level: number): string {
  const nextLevel = Math.min(CAMP_STRUCTURE_MAX_LEVEL, level + 1)
  if (id === 'tent') {
    return `오프라인 ${CAMP_OFFLINE_CAP_HOURS[level - 1]}시간 → ${CAMP_OFFLINE_CAP_HOURS[nextLevel - 1]}시간`
  }
  if (id === 'workbench') {
    return `제작 시간 ${CAMP_WORKBENCH_DURATION_PERCENT[level - 1]}% → ${CAMP_WORKBENCH_DURATION_PERCENT[nextLevel - 1]}%`
  }
  return `훈련 상한 ${level * 5} → ${nextLevel * 5} rank`
}

function facilityCurrentEffect(id: CampStructureId, level: number): string {
  if (id === 'tent') return `오프라인 상한 ${CAMP_OFFLINE_CAP_HOURS[level - 1]}시간`
  if (id === 'workbench') return `제작 시간 ${CAMP_WORKBENCH_DURATION_PERCENT[level - 1]}%`
  return `훈련 상한 ${level * 5} rank`
}

export function CampDashboard({
  state,
  notice,
  disabled,
  onUpgradeStructure,
  onTrain,
  onStartCraft,
  onUseConsumable,
  onPurchaseMerchantOffer,
  onAcceptSeraContract,
  onIncreaseSeraTrust,
}: CampDashboardProps) {
  const hero = getHeroStats(state)
  const trainingCap = getCampTrainingRankCap(state.camp)
  const merchantOffers = getCampMerchantOffers(state.camp.merchant.cycle)
  const merchantDiscount = getSeraMerchantDiscountPercent(state.camp)
  const sera = state.camp.residents.sera

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
          <span>schema 6 · 안전한 기반</span>
        </header>
        <div className="camp-facility-grid">
          {FACILITIES.map((facility) => {
            const level = state.camp.structures[facility.id]
            const cost = getCampStructureUpgradeCost(facility.id, level)
            const isMax = cost === null
            const cannotAfford = !isMax && state.player.gold < cost
            return (
              <article className="camp-facility-card" key={facility.id}>
              <GameAsset
                assetId={facility.assetId}
                purpose="card"
                decorative
                fallbackLabel="◆"
                className="camp-facility-card__art"
                fit="cover"
              />
              <div>
                <span>Lv.{level}</span>
                <h3>{facility.name}</h3>
                <p>{facility.copy}</p>
              </div>
              <button
                type="button"
                disabled={disabled || isMax || cannotAfford}
                aria-describedby={`${facility.id}-foundation-note`}
                aria-label={isMax
                  ? `${facility.name} 최고 레벨`
                  : cannotAfford
                    ? `${facility.name} 확장 · ${formatNumber(cost)} 골드 필요 · 골드 부족`
                    : `${facility.name} 확장 · ${formatNumber(cost)} 골드`}
                onClick={() => onUpgradeStructure(facility.id)}
              >
                {isMax ? 'MAX' : `확장 · ${formatNumber(cost)} 골드`}
              </button>
              <small id={`${facility.id}-foundation-note`}>
                {isMax
                  ? `${facilityCurrentEffect(facility.id, level)} · 최고 레벨`
                  : `${facilityEffect(facility.id, level)}${cannotAfford ? ' · 골드 부족' : ''}`}
              </small>
              </article>
            )
          })}
        </div>
        <section className="camp-merchant" aria-labelledby="camp-merchant-title">
          <div className="camp-training__heading">
            <div>
              <p className="eyebrow">EVENT MERCHANT</p>
              <h3 id="camp-merchant-title">떠돌이 상인 · 회차 {state.camp.merchant.cycle + 1}</h3>
            </div>
            <span>갱신 {formatDuration(state.camp.merchant.refreshRemainingMs)}</span>
          </div>
          {merchantDiscount > 0 && (
            <p className="camp-merchant__discount">세라의 시세 조언 · 모든 제안 {merchantDiscount}% 할인</p>
          )}
          <div className="camp-offer-list">
            {CAMP_MERCHANT_OFFER_SLOTS.map((slot) => {
              const offer = merchantOffers[slot]
              const purchased = (state.camp.merchant.purchasedOfferMask & (1 << slot)) !== 0
              const unavailable = offer.effect.type === 'rescueSera' && sera.status !== 'unmet'
              const cost = getCampMerchantOfferCost(state.camp, offer)
              const cannotAfford = state.player.gold < cost
              return (
                <article className="camp-offer-card" key={`${state.camp.merchant.cycle}-${slot}`}>
                  <div>
                    <strong>{offer.name}</strong>
                    <small>{offer.description}</small>
                  </div>
                  <button
                    type="button"
                    disabled={disabled || purchased || unavailable || cannotAfford}
                    onClick={() => onPurchaseMerchantOffer(slot)}
                    aria-label={`${offer.name} · ${purchased
                      ? '이번 갱신 구매 완료'
                      : unavailable
                        ? '현재 이용 불가'
                        : cannotAfford
                          ? `${formatNumber(cost)} 골드 필요 · 골드 부족`
                          : `${formatNumber(cost)} 골드`}`}
                  >
                    {purchased ? '완료' : unavailable ? '지원 완료' : `${formatNumber(cost)} G`}
                  </button>
                </article>
              )
            })}
          </div>
        </section>
        <section className="camp-resident" aria-labelledby="camp-resident-title">
          <GameAsset
            assetId="event.ash-camp"
            purpose="card"
            decorative
            className="camp-resident__art"
            fit="cover"
          />
          <div className="camp-resident__body">
            <p className="eyebrow">CAMP RESIDENT</p>
            <h3 id="camp-resident-title">성인 정찰병 세라</h3>
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
          </div>
        </section>
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
        <section className="camp-training" aria-labelledby="camp-training-title">
          <div className="camp-training__heading">
            <div>
              <p className="eyebrow">TRAINING GROUND</p>
              <h3 id="camp-training-title">영구 훈련</h3>
            </div>
            <span>상한 {trainingCap}</span>
          </div>
          {(['attack', 'vitality'] as const).map((id) => {
            const rank = state.camp.training[id]
            const cost = getCampTrainingCost(id, rank)
            const atCap = rank >= trainingCap
            const atAbsoluteMax = atCap && state.camp.structures.trainingGround >= CAMP_STRUCTURE_MAX_LEVEL
            const cannotAfford = !atCap && state.player.gold < cost
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
                  disabled={disabled || atCap || state.player.gold < cost}
                  onClick={() => onTrain(id)}
                  aria-label={`${label} · ${atAbsoluteMax
                    ? '최대 훈련 완료'
                    : atCap
                      ? '단련소 확장 필요'
                      : cannotAfford
                        ? `${formatNumber(cost)} 골드 필요 · 골드 부족`
                        : `${formatNumber(cost)} 골드`}`}
                >
                  {atAbsoluteMax ? 'MAX' : atCap ? '단련소 확장 필요' : cannotAfford ? `${formatNumber(cost)} G · 부족` : `${formatNumber(cost)} G`}
                </button>
              </article>
            )
          })}
        </section>
        <section className="camp-crafting" aria-labelledby="camp-crafting-title">
          <div className="camp-training__heading">
            <div>
              <p className="eyebrow">WORKBENCH</p>
              <h3 id="camp-crafting-title">재료와 제작</h3>
            </div>
            <span>작업대 Lv.{state.camp.structures.workbench}</span>
          </div>
          <dl className="camp-materials" aria-label="보유 제작 재료">
            {(Object.keys(MATERIAL_LABELS) as Array<keyof typeof MATERIAL_LABELS>).map((id) => (
              <div key={id}>
                <dt>{MATERIAL_LABELS[id]}</dt>
                <dd>{formatNumber(state.camp.materials[id])}</dd>
              </div>
            ))}
          </dl>
          {state.camp.craftJob !== null && (
            <div className="camp-craft-progress">
              <strong>{CAMP_RECIPE_DEFINITIONS[state.camp.craftJob.recipeId].name} 제작 중</strong>
              <span>남은 시간 {formatDuration(state.camp.craftJob.remainingMs)}</span>
            </div>
          )}
          <div className="camp-recipe-list">
            {(['goldStew', 'focusTonic'] as const).map((id) => {
              const recipe = CAMP_RECIPE_DEFINITIONS[id]
              const missing = (Object.keys(MATERIAL_LABELS) as Array<keyof typeof MATERIAL_LABELS>)
                .some((materialId) => state.camp.materials[materialId] < recipe.ingredients[materialId])
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
                      {(Object.keys(MATERIAL_LABELS) as Array<keyof typeof MATERIAL_LABELS>)
                        .filter((materialId) => recipe.ingredients[materialId] > 0)
                        .map((materialId) => `${MATERIAL_LABELS[materialId]} ${recipe.ingredients[materialId]}`)
                        .join(' · ')}
                    </small>
                    <span>{formatDuration(getCampCraftDurationMs(state.camp, id))}</span>
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
