import { describe, expect, it } from 'vitest'
import {
  CAMP_MERCHANT_REFRESH_MS,
  getCampMerchantOfferCost,
  getCampMerchantOffers,
  getSeraMerchantDiscountPercent,
  getSeraTrustCost,
} from './camp'
import {
  acceptSeraContract,
  advanceGame,
  createInitialState,
  increaseSeraTrust,
  performPrestige,
  purchaseCampMerchantOffer,
} from './engine'
import {
  bootstrapGame,
  saveGameAtRevision,
} from './persistence'
import { createPortableSave, parsePortableSave } from './saveTransfer'
import type { StorageLike } from './types'

class MemoryStorage implements StorageLike {
  readonly values = new Map<string, string>()
  getItem(key: string) { return this.values.get(key) ?? null }
  setItem(key: string, value: string) { this.values.set(key, value) }
  removeItem(key: string) { this.values.delete(key) }
}

describe('IRPG-421 deterministic merchant, rescue, contract, and trust', () => {
  it('refreshes fixed offers at exact 30-minute boundaries with chunk equivalence', () => {
    const state = createInitialState(0, 0x4210_0001)
    state.currentMode = 'CAMP'
    state.camp.merchant.purchasedOfferMask = 5
    const rngBefore = structuredClone(state.rng)

    const almost = advanceGame(state, CAMP_MERCHANT_REFRESH_MS - 1).state
    expect(almost.camp.merchant).toEqual({
      cycle: 0,
      refreshRemainingMs: 1,
      purchasedOfferMask: 5,
    })
    const exact = advanceGame(almost, 1).state
    expect(exact.camp.merchant).toEqual({
      cycle: 1,
      refreshRemainingMs: CAMP_MERCHANT_REFRESH_MS,
      purchasedOfferMask: 0,
    })
    expect(exact.rng).toEqual(rngBefore)

    const single = advanceGame(state, CAMP_MERCHANT_REFRESH_MS * 3).state
    const first = advanceGame(state, CAMP_MERCHANT_REFRESH_MS + 12_345).state
    const split = advanceGame(first, CAMP_MERCHANT_REFRESH_MS * 2 - 12_345).state
    expect(split).toEqual(single)
    expect(single.camp.merchant.cycle).toBe(3)
  })

  it('freezes the final safe cycle ledger instead of wrapping or duplicating offers', () => {
    const state = createInitialState(0, 0x4210_0007)
    state.currentMode = 'CAMP'
    state.camp.merchant = {
      cycle: Number.MAX_SAFE_INTEGER,
      refreshRemainingMs: 1,
      purchasedOfferMask: 7,
    }

    const advanced = advanceGame(state, CAMP_MERCHANT_REFRESH_MS * 2).state

    expect(advanced.camp.merchant).toEqual(state.camp.merchant)
    expect(advanced.rng).toEqual(state.rng)
  })

  it('normalizes the transition into the final safe cycle across elapsed chunks', () => {
    const state = createInitialState(0, 0x4210_0008)
    state.currentMode = 'CAMP'
    state.camp.merchant = {
      cycle: Number.MAX_SAFE_INTEGER - 1,
      refreshRemainingMs: 1,
      purchasedOfferMask: 7,
    }

    const single = advanceGame(state, CAMP_MERCHANT_REFRESH_MS * 2).state
    const boundary = advanceGame(state, 1).state
    const split = advanceGame(boundary, CAMP_MERCHANT_REFRESH_MS * 2 - 1).state

    expect(single).toEqual(split)
    expect(single.camp.merchant).toEqual({
      cycle: Number.MAX_SAFE_INTEGER,
      refreshRemainingMs: CAMP_MERCHANT_REFRESH_MS,
      purchasedOfferMask: 0,
    })
    expect(single.rng).toEqual(state.rng)
  })

  it('applies one-short, exact, and duplicate purchase boundaries atomically', () => {
    const state = createInitialState(0, 0x4210_0002)
    state.currentMode = 'CAMP'
    const offer = getCampMerchantOffers(0)[0]
    const cost = getCampMerchantOfferCost(state.camp, offer)
    state.player.gold = cost - 1
    expect(purchaseCampMerchantOffer(state, 0)).toMatchObject({ success: false, state })

    state.player.gold = cost
    const exact = purchaseCampMerchantOffer(state, 0)
    expect(exact.success).toBe(true)
    expect(exact.state.player.gold).toBe(0)
    expect(exact.state.camp.materials.ashShard).toBe(10)
    expect(exact.state.camp.merchant.purchasedOfferMask).toBe(1)
    expect(purchaseCampMerchantOffer(exact.state, 0)).toMatchObject({
      success: false,
      state: exact.state,
    })
  })

  it('separates rescue support from an explicit voluntary contract', () => {
    const state = createInitialState(0, 0x4210_0003)
    state.currentMode = 'CAMP'
    state.player.gold = 800
    const companionBefore = structuredClone(state.player.companion)

    const rescued = purchaseCampMerchantOffer(state, 2)
    expect(rescued.success).toBe(true)
    expect(rescued.state.camp.residents.sera).toEqual({ status: 'rescued', trust: 0 })
    expect(rescued.state.player.companion).toEqual(companionBefore)

    const contracted = acceptSeraContract(rescued.state)
    expect(contracted.success).toBe(true)
    expect(contracted.state.camp.residents.sera).toEqual({ status: 'contracted', trust: 0 })
    expect(contracted.state.player.companion).toEqual(companionBefore)
    expect(acceptSeraContract(contracted.state)).toMatchObject({
      success: false,
      state: contracted.state,
    })
  })

  it('raises trust 0-5 for fixed costs and caps merchant advice at 10%', () => {
    let state = createInitialState(0, 0x4210_0004)
    state.currentMode = 'CAMP'
    state.camp.residents.sera = { status: 'contracted', trust: 0 }
    const baseOffer = getCampMerchantOffers(1)[1]

    for (let rank = 0; rank < 5; rank += 1) {
      const cost = getSeraTrustCost(rank)
      if (cost === null) throw new Error('missing trust cost')
      state.player.gold = cost
      const result = increaseSeraTrust(state)
      expect(result.success).toBe(true)
      state = result.state
      expect(state.camp.residents.sera.trust).toBe(rank + 1)
      expect(getSeraMerchantDiscountPercent(state.camp)).toBe((rank + 1) * 2)
    }

    expect(getCampMerchantOfferCost(state.camp, baseOffer))
      .toBe(Math.round(baseOffer.baseCost * 0.9))
    expect(increaseSeraTrust(state)).toMatchObject({ success: false, state })
  })

  it('rejects insufficient trust funding without changing rank or gold', () => {
    const state = createInitialState(0, 0x4210_0005)
    state.currentMode = 'CAMP'
    state.camp.residents.sera = { status: 'contracted', trust: 0 }
    const cost = getSeraTrustCost(0)
    if (cost === null) throw new Error('missing trust cost')
    state.player.gold = cost - 1
    expect(increaseSeraTrust(state)).toMatchObject({ success: false, state })
  })

  it('checkpoints refresh exactly once and preserves the ledger through portable and prestige', () => {
    const state = createInitialState(0, 0x4210_0006)
    state.currentMode = 'CAMP'
    state.camp.merchant.refreshRemainingMs = 1_000
    state.camp.merchant.purchasedOfferMask = 3
    state.camp.residents.sera = { status: 'contracted', trust: 4 }
    const storage = new MemoryStorage()
    expect(saveGameAtRevision(storage, state, null)).toEqual({ status: 'saved', revision: 1 })

    const first = bootstrapGame(storage, 1_000, 'writer')
    expect(first.state.camp.merchant).toEqual({
      cycle: 1,
      refreshRemainingMs: CAMP_MERCHANT_REFRESH_MS,
      purchasedOfferMask: 0,
    })
    const second = bootstrapGame(storage, 1_000, 'writer')
    expect(second.state.camp.merchant).toEqual(first.state.camp.merchant)

    const portable = createPortableSave(first.state, 1_000)
    if (portable === null) throw new Error('portable save missing')
    const parsed = parsePortableSave(portable)
    if (!parsed.success) throw new Error(parsed.message)
    expect(parsed.preview.state.camp.merchant).toEqual(first.state.camp.merchant)
    expect(parsed.preview.state.camp.residents.sera).toEqual(state.camp.residents.sera)

    const prestigeInput = structuredClone(first.state)
    prestigeInput.battle.highestStage = 30
    const prestige = performPrestige(prestigeInput)
    expect(prestige.state.camp.merchant).toEqual(first.state.camp.merchant)
    expect(prestige.state.camp.residents.sera).toEqual(state.camp.residents.sera)
  })
})
