import { describe, expect, it } from 'vitest'
import {
  CAMP_JOINT_SYNTHESIS_DEFINITIONS,
  CHAPTER1_ADULT_CHARACTER_DEFINITIONS,
  CHAPTER1_COSTUME_DEFINITIONS,
  createInitialCampBondState,
} from './camp'
import {
  advanceGame,
  advanceOfflineGame,
  createInitialState,
  performPrestige,
  selectCampCostume,
  setAdultContentAccess,
  setSeraBondConsent,
  synthesizeJointBond,
} from './engine'
import { getHeroStats } from './formulas'
import { isGameState } from './persistence'
import type { GameState } from './types'

const SYNTHESIS_ID = 'chapter1.sera.ember-vow'

function createConsentedCamp(): GameState {
  const initial = createInitialState(0, 0x4250_0001)
  initial.currentMode = 'CAMP'
  initial.camp.residents.sera = { status: 'contracted', trust: 3 }
  const confirmed = setAdultContentAccess(initial, true)
  if (!confirmed.success) throw new Error(confirmed.message)
  const consented = setSeraBondConsent(confirmed.state, 'granted')
  if (!consented.success) throw new Error(consented.message)
  return consented.state
}

function fundSynthesis(state: GameState): GameState {
  const funded = structuredClone(state)
  const cost = CAMP_JOINT_SYNTHESIS_DEFINITIONS[SYNTHESIS_ID].cost
  funded.player.gold = cost.gold
  funded.camp.materials = { ...cost.materials }
  return funded
}

describe('IRPG-425 Chapter I adult consent contract', () => {
  it('starts closed with one real Chapter I costume and an independent consent ledger', () => {
    const state = createInitialState(0, 0x4250_0002)

    expect(CHAPTER1_ADULT_CHARACTER_DEFINITIONS.sera).toMatchObject({
      chapterId: 'chapter1',
      adult: true,
      consentRequired: true,
    })
    expect(CHAPTER1_COSTUME_DEFINITIONS['chapter1.sera.field'].manifestAssetId)
      .toBe('costume.chapter1.sera.ember-bond')
    expect(state.camp.bond).toEqual(createInitialCampBondState())
    expect(state.camp.bond).toEqual({
      definitionVersion: 1,
      adultAccessConfirmed: false,
      seraConsent: 'notGranted',
      currentCostumeId: 'chapter1.sera.field',
      unlockedCostumeMask: 1,
      claimedSynthesisRewardMask: 0,
    })
  })

  it('keeps the shop contract, adult confirmation, and revocable consent separate', () => {
    const initial = createInitialState(0, 0x4250_0003)
    const rngBefore = structuredClone(initial.rng)
    expect(setAdultContentAccess(initial, true)).toMatchObject({ success: false, state: initial })

    initial.currentMode = 'CAMP'
    const confirmed = setAdultContentAccess(initial, true)
    expect(confirmed.success).toBe(true)
    expect(confirmed.state.camp.bond.adultAccessConfirmed).toBe(true)
    expect(confirmed.state.camp.bond.seraConsent).toBe('notGranted')
    expect(confirmed.state.rng).toEqual(rngBefore)
    expect(setSeraBondConsent(confirmed.state, 'granted')).toMatchObject({
      success: false,
      state: confirmed.state,
    })

    const contracted = structuredClone(confirmed.state)
    contracted.camp.residents.sera = { status: 'contracted', trust: 4 }
    contracted.camp.bond.unlockedCostumeMask = 1
    contracted.camp.bond.claimedSynthesisRewardMask = 1
    const granted = setSeraBondConsent(contracted, 'granted')
    expect(granted.success).toBe(true)

    granted.state.currentMode = 'BATTLE'
    const withdrawn = setSeraBondConsent(granted.state, 'withdrawn')
    expect(withdrawn.success).toBe(true)
    expect(withdrawn.state.camp.bond).toMatchObject({
      adultAccessConfirmed: true,
      seraConsent: 'withdrawn',
      unlockedCostumeMask: 1,
      claimedSynthesisRewardMask: 1,
    })
    expect(withdrawn.state.camp.residents.sera).toEqual({ status: 'contracted', trust: 4 })
    expect(withdrawn.state.rng).toEqual(rngBefore)

    expect(setSeraBondConsent(withdrawn.state, 'granted')).toMatchObject({
      success: false,
      state: withdrawn.state,
    })
    withdrawn.state.currentMode = 'CAMP'
    expect(setSeraBondConsent(withdrawn.state, 'granted')).toMatchObject({ success: true })
  })

  it('turns an active consent into withdrawn when adult access is disabled atomically', () => {
    const state = fundSynthesis(createConsentedCamp())
    state.camp.bond.claimedSynthesisRewardMask = 1
    const ledgerBefore = {
      gold: state.player.gold,
      materials: structuredClone(state.camp.materials),
      resident: structuredClone(state.camp.residents.sera),
      unlockedCostumeMask: state.camp.bond.unlockedCostumeMask,
      claimedSynthesisRewardMask: state.camp.bond.claimedSynthesisRewardMask,
      rng: structuredClone(state.rng),
    }

    state.currentMode = 'BATTLE'
    const disabled = setAdultContentAccess(state, false)

    expect(disabled.success).toBe(true)
    expect(disabled.state.camp.bond).toMatchObject({
      adultAccessConfirmed: false,
      seraConsent: 'withdrawn',
      unlockedCostumeMask: ledgerBefore.unlockedCostumeMask,
      claimedSynthesisRewardMask: ledgerBefore.claimedSynthesisRewardMask,
    })
    expect(disabled.state.player.gold).toBe(ledgerBefore.gold)
    expect(disabled.state.camp.materials).toEqual(ledgerBefore.materials)
    expect(disabled.state.camp.residents.sera).toEqual(ledgerBefore.resident)
    expect(disabled.state.rng).toEqual(ledgerBefore.rng)
    expect(isGameState(disabled.state)).toBe(true)
  })

  it('rejects unknown and Chapter II/III costume IDs without changing state', () => {
    const state = createConsentedCamp()

    for (const id of ['chapter2.sera.field', 'chapter3.sera.field', 'unknown']) {
      const result = selectCampCostume(state, id)
      expect(result.success).toBe(false)
      expect(result.state).toBe(state)
    }
    expect(selectCampCostume(state, 'chapter1.sera.field')).toMatchObject({
      success: false,
      state,
    })
  })
})

describe('IRPG-427 deterministic joint synthesis', () => {
  it.each([
    ['gold', null],
    ['ashShard', 'ashShard'],
    ['beastHide', 'beastHide'],
    ['emberCore', 'emberCore'],
  ] as const)('rejects a one-short %s boundary without mutation', (_label, materialId) => {
    const state = fundSynthesis(createConsentedCamp())
    const cost = CAMP_JOINT_SYNTHESIS_DEFINITIONS[SYNTHESIS_ID].cost
    if (materialId === null) {
      state.player.gold = cost.gold - 1
    } else {
      state.camp.materials[materialId] = cost.materials[materialId] - 1
    }
    const before = structuredClone(state)

    const result = synthesizeJointBond(state, SYNTHESIS_ID)

    expect(result.success).toBe(false)
    expect(result.state).toBe(state)
    expect(state).toEqual(before)
  })

  it('deducts the exact fixed cost and claims the collection reward once without combat power', () => {
    const state = fundSynthesis(createConsentedCamp())
    const statsBefore = getHeroStats(state)
    const battleBefore = structuredClone(state.battle)
    const expeditionBefore = structuredClone(state.expeditionEvents)
    const rngBefore = structuredClone(state.rng)

    const first = synthesizeJointBond(state, SYNTHESIS_ID)

    expect(first.success).toBe(true)
    expect(first.state.player.gold).toBe(0)
    expect(first.state.camp.materials).toEqual({ ashShard: 0, beastHide: 0, emberCore: 0 })
    expect(first.state.camp.bond.claimedSynthesisRewardMask).toBe(1)
    expect(getHeroStats(first.state)).toEqual(statsBefore)
    expect(first.state.battle).toEqual(battleBefore)
    expect(first.state.expeditionEvents).toEqual(expeditionBefore)
    expect(first.state.rng).toEqual(rngBefore)

    const duplicate = synthesizeJointBond(first.state, SYNTHESIS_ID)
    expect(duplicate).toMatchObject({ success: false, state: first.state })
  })

  it('rejects battle, missing consent, and unknown Chapter IDs without consuming RNG or costs', () => {
    const state = fundSynthesis(createConsentedCamp())
    const inputs = [
      { state: { ...state, currentMode: 'BATTLE' as const }, id: SYNTHESIS_ID },
      {
        state: {
          ...state,
          camp: { ...state.camp, bond: { ...state.camp.bond, seraConsent: 'withdrawn' as const } },
        },
        id: SYNTHESIS_ID,
      },
      { state, id: 'chapter2.sera.ember-vow' },
      { state, id: 'chapter3.sera.ember-vow' },
    ]

    for (const input of inputs) {
      const before = structuredClone(input.state)
      const result = synthesizeJointBond(input.state, input.id)
      expect(result.success).toBe(false)
      expect(result.state).toBe(input.state)
      expect(input.state).toEqual(before)
    }
  })

  it('preserves the consent, costume, and reward ledgers through time and prestige', () => {
    const claimed = synthesizeJointBond(fundSynthesis(createConsentedCamp()), SYNTHESIS_ID)
    if (!claimed.success) throw new Error(claimed.message)
    const bond = structuredClone(claimed.state.camp.bond)

    expect(advanceGame(claimed.state, 10_000).state.camp.bond).toEqual(bond)
    expect(advanceOfflineGame(claimed.state, 10_000).state.camp.bond).toEqual(bond)

    claimed.state.battle.highestStage = 30
    const prestige = performPrestige(claimed.state)
    expect(prestige.success).toBe(true)
    expect(prestige.state.camp.bond).toEqual(bond)
    expect(synthesizeJointBond(prestige.state, SYNTHESIS_ID)).toMatchObject({
      success: false,
      state: prestige.state,
    })
  })
})
