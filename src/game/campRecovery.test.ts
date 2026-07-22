import { describe, expect, it } from 'vitest'
import {
  CAMP_RECIPE_DEFINITIONS,
  getCampCraftDurationMs,
  getCampHealingAshCost,
  getHealingPotionRecoveryAmount,
} from './camp'
import {
  advanceGame,
  consumeCampConsumable,
  createInitialState,
  equipQuickConsumable,
  healAtCamp,
  selectStage,
  startCampCraft,
  useEquippedConsumable,
} from './engine'
import { getHeroStats } from './formulas'

describe('IRPG-423 deterministic camp recovery and battle quick slot', () => {
  it('derives the healing brazier ash cost from the missing-health ratio at 1..5 boundaries', () => {
    const state = createInitialState(0, 0x4230_0001)
    state.currentMode = 'CAMP'
    const maxHp = getHeroStats(state).maxHp
    const cases = [
      { currentHp: maxHp, cost: null },
      { currentHp: maxHp - 1, cost: 1 },
      { currentHp: Math.ceil(maxHp * 0.8), cost: 1 },
      { currentHp: Math.ceil(maxHp * 0.8) - 1, cost: 2 },
      { currentHp: Math.ceil(maxHp * 0.6) - 1, cost: 3 },
      { currentHp: 0, cost: 5 },
    ]

    for (const { currentHp, cost } of cases) {
      state.player.currentHp = currentHp
      expect(getCampHealingAshCost(state)).toBe(cost)
    }
  })

  it('heals to full for the exact ash cost in camp without touching combat or RNG', () => {
    const state = createInitialState(0, 0x4230_0002)
    state.currentMode = 'CAMP'
    state.player.currentHp = 59
    const ashCost = getCampHealingAshCost(state)
    expect(ashCost).toBe(3)
    state.camp.materials.ashShard = ashCost!
    const snapshot = structuredClone(state)

    const result = healAtCamp(state)

    expect(result.success).toBe(true)
    expect(result.state).not.toBe(state)
    expect(state).toEqual(snapshot)
    expect(result.state.player.currentHp).toBe(getHeroStats(result.state).maxHp)
    expect(result.state.camp.materials.ashShard).toBe(0)
    expect(result.state.rng).toEqual(snapshot.rng)
    expect(result.state.battle).toEqual(snapshot.battle)
    expect(result.state.stats).toEqual(snapshot.stats)
  })

  it('rejects brazier use atomically outside camp, at full health, or one ash short', () => {
    const battle = createInitialState(0, 0x4230_0003)
    battle.player.currentHp = 1
    expect(healAtCamp(battle)).toMatchObject({ success: false, state: battle })

    const full = createInitialState(0, 0x4230_0004)
    full.currentMode = 'CAMP'
    expect(healAtCamp(full)).toMatchObject({ success: false, state: full })

    const short = createInitialState(0, 0x4230_0005)
    short.currentMode = 'CAMP'
    short.player.currentHp = 1
    const cost = getCampHealingAshCost(short)!
    short.camp.materials.ashShard = cost - 1
    const snapshot = structuredClone(short)
    expect(healAtCamp(short)).toMatchObject({ success: false, state: short })
    expect(short).toEqual(snapshot)
  })

  it('starts the fixed healing-potion recipe and completes it exactly once at the timer boundary', () => {
    const state = createInitialState(0, 0x4230_0006)
    state.currentMode = 'CAMP'
    const recipe = CAMP_RECIPE_DEFINITIONS.healingPotion
    state.camp.materials = { ...recipe.ingredients }

    const started = startCampCraft(state, 'healingPotion')
    expect(started.success).toBe(true)
    expect(started.state.camp.materials).toEqual({ ashShard: 0, beastHide: 0, emberCore: 0 })
    expect(started.state.camp.craftJob).toEqual({
      recipeId: 'healingPotion',
      remainingMs: getCampCraftDurationMs(state.camp, 'healingPotion'),
    })

    const before = advanceGame(
      started.state,
      started.state.camp.craftJob!.remainingMs - 1,
    ).state
    expect(before.camp.craftJob?.remainingMs).toBe(1)
    expect(before.camp.consumables.healingPotion).toBe(0)

    const completed = advanceGame(before, 1).state
    expect(completed.camp.craftJob).toBeNull()
    expect(completed.camp.consumables.healingPotion).toBe(1)
    expect(advanceGame(completed, recipe.baseDurationMs * 2).state.camp.consumables.healingPotion)
      .toBe(1)
  })

  it('equips in battle or camp, consumes one potion in battle, and keeps the empty quick slot binding', () => {
    for (const currentMode of ['BATTLE', 'CAMP'] as const) {
      const state = createInitialState(0, 0x4230_0007)
      state.currentMode = currentMode
      state.camp.consumables.healingPotion = 1
      const equipped = equipQuickConsumable(state, 'healingPotion')
      expect(equipped.success).toBe(true)
      expect(equipped.state.camp.quickConsumable).toBe('healingPotion')
      expect(equipped.state.camp.consumables.healingPotion).toBe(1)
      expect(equipped.state.rng).toEqual(state.rng)
      expect(equipped.state.battle).toEqual(state.battle)
    }

    const battle = createInitialState(0, 0x4230_0008)
    battle.camp.consumables.healingPotion = 1
    const equipped = equipQuickConsumable(battle, 'healingPotion').state
    equipped.player.currentHp = 40
    const snapshot = structuredClone(equipped)
    const recovery = getHealingPotionRecoveryAmount(equipped)

    const used = useEquippedConsumable(equipped)

    expect(used.success).toBe(true)
    expect(used.state.player.currentHp).toBe(
      Math.min(getHeroStats(equipped).maxHp, snapshot.player.currentHp + recovery),
    )
    expect(used.state.camp.consumables.healingPotion).toBe(0)
    expect(used.state.camp.quickConsumable).toBe('healingPotion')
    expect(used.state.rng).toEqual(snapshot.rng)
    expect(used.state.battle).toEqual(snapshot.battle)
    expect(used.state.stats).toEqual(snapshot.stats)
  })

  it('rejects missing, empty, full-health, and camp quick-slot use without side effects', () => {
    const missing = createInitialState(0, 0x4230_0009)
    missing.player.currentHp = 1
    expect(useEquippedConsumable(missing)).toMatchObject({ success: false, state: missing })

    const empty = createInitialState(0, 0x4230_0010)
    empty.camp.quickConsumable = 'healingPotion'
    empty.player.currentHp = 1
    expect(useEquippedConsumable(empty)).toMatchObject({ success: false, state: empty })

    const full = createInitialState(0, 0x4230_0011)
    full.camp.consumables.healingPotion = 1
    full.camp.quickConsumable = 'healingPotion'
    expect(useEquippedConsumable(full)).toMatchObject({ success: false, state: full })

    const camp = structuredClone(full)
    camp.currentMode = 'CAMP'
    camp.player.currentHp = 1
    expect(useEquippedConsumable(camp)).toMatchObject({ success: false, state: camp })

    const unowned = createInitialState(0, 0x4230_0012)
    expect(equipQuickConsumable(unowned, 'healingPotion')).toMatchObject({
      success: false,
      state: unowned,
    })
  })

  it('does not route healing potion through camp buff preparation', () => {
    const state = createInitialState(0, 0x4230_0013)
    state.currentMode = 'CAMP'
    state.camp.consumables.healingPotion = 1
    const snapshot = structuredClone(state)

    expect(consumeCampConsumable(state, 'healingPotion')).toMatchObject({
      success: false,
      state,
    })
    expect(state).toEqual(snapshot)
    expect(state.camp.buffs.bossFocusStage).toBeNull()
  })

  it('preserves HP and both cooldowns on stage selection and rejects non-finite stages', () => {
    const state = createInitialState(0, 0x4230_0014)
    state.player.currentHp = 37
    state.battle.highestStage = 5
    state.battle.powerStrikeCooldownMs = 3_500
    state.battle.companionCooldownMs = 2_000
    const selected = selectStage(state, 4)

    expect(selected.success).toBe(true)
    expect(selected.state.player.currentHp).toBe(37)
    expect(selected.state.battle.powerStrikeCooldownMs).toBe(3_500)
    expect(selected.state.battle.companionCooldownMs).toBe(2_000)
    expect(selected.state.rng).toEqual(state.rng)

    const overCap = structuredClone(state)
    overCap.player.currentHp = Number.MAX_SAFE_INTEGER
    const clamped = selectStage(overCap, 4)
    expect(clamped.state.player.currentHp).toBe(getHeroStats(clamped.state).maxHp)
    expect(clamped.state.battle.powerStrikeCooldownMs).toBe(3_500)
    expect(clamped.state.battle.companionCooldownMs).toBe(2_000)

    for (const invalid of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(selectStage(state, invalid)).toMatchObject({ success: false, state })
    }
  })
})
