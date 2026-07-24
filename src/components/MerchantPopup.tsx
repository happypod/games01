import {
  CAMP_MERCHANT_OFFER_SLOTS,
  formatCampCountdown,
  getCampMerchantOfferCost,
  getCampMerchantOffers,
  getSeraMerchantDiscountPercent,
  type CampMerchantOfferSlot,
} from '../game/camp'
import { formatNumber } from '../game/format'
import type { GameState } from '../game/types'
import { CampBuildingModal } from './CampBuildingModal'
import { GameAsset } from './GameAsset'

export interface MerchantPopupProps {
  state: GameState
  disabled: boolean
  onPurchaseMerchantOffer: (slot: CampMerchantOfferSlot) => void
  onClose: () => void
}

export function MerchantPopup({
  state,
  disabled,
  onPurchaseMerchantOffer,
  onClose,
}: MerchantPopupProps) {
  const merchantOffers = getCampMerchantOffers(state.camp.merchant.cycle)
  const merchantDiscount = getSeraMerchantDiscountPercent(state.camp)
  const sera = state.camp.residents.sera

  return (
    <CampBuildingModal
      titleId="merchant-popup-title"
      eyebrow="EVENT MERCHANT"
      title={`떠돌이 상인 · 회차 ${state.camp.merchant.cycle + 1}`}
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
      <p>갱신 {formatCampCountdown(state.camp.merchant.refreshRemainingMs)}</p>
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
    </CampBuildingModal>
  )
}
