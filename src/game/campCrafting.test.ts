import { describe, expect, it } from 'vitest'
import {
  CAMP_GOLD_STEW_ROUNDS,
  CAMP_RECIPE_DEFINITIONS,
  getCampCraftDurationMs,
} from './camp'
import { getEnemyDefinition } from './content'
import {
  advanceGame,
  createInitialState,
  performPrestige,
  selectStage,
  startCampCraft,
  switchGameMode,
  consumeCampConsumable,
} from './engine'
import { createRngState, nextRandom } from './rng'

function findFocusOnlySeed(): number {
  for (let seed = 1; seed < 100_000; seed += 1) {
    const draw = nextRandom(createRngState(seed))
    if (draw.value >= 0.15 && draw.value < 0.35) return seed
  }
  throw new Error('focus-only seed not found')
}

describe('IRPG-420 deterministic materials, crafting, and consumables', () => {
  it('grants fixed materials once per kill without extra RNG draws or chunk drift', () => {
    const initial = createInitialState(0, 0x4200_0001)
    initial.player.upgrades.weapon = 100
    initial.player.skills.powerStrike = 0

    const single = advanceGame(initial, 5_000).state
    let chunked = initial
    for (let second = 0; second < 5; second += 1) {
      chunked = advanceGame(chunked, 1_000).state
    }

    expect(single).toEqual(chunked)
    expect(single.camp.materials).toEqual({ ashShard: 5, beastHide: 1, emberCore: 0 })
    expect(single.rng.draws).toBe(5)

    const boss = createInitialState(0, 0x4200_0002)
    boss.player.upgrades.weapon = 100
    boss.player.skills.powerStrike = 0
    boss.battle.stage = 10
    boss.battle.highestStage = 10
    boss.battle.enemyHp = 1
    expect(advanceGame(boss, 1_000).state.camp.materials)
      .toEqual({ ashShard: 1, beastHide: 0, emberCore: 1 })
  })

  it('pays materials and creates one immutable-duration craft job atomically', () => {
    const state = createInitialState(0, 0x4200_0003)
    state.currentMode = 'CAMP'
    const recipe = CAMP_RECIPE_DEFINITIONS.goldStew
    state.camp.materials = { ...recipe.ingredients, ashShard: recipe.ingredients.ashShard - 1 }
    expect(startCampCraft(state, 'goldStew')).toMatchObject({ success: false, state })

    state.camp.materials = { ...recipe.ingredients }
    const started = startCampCraft(state, 'goldStew')
    expect(started.success).toBe(true)
    expect(started.state.camp.materials).toEqual({ ashShard: 0, beastHide: 0, emberCore: 0 })
    expect(started.state.camp.craftJob).toEqual({
      recipeId: 'goldStew',
      remainingMs: getCampCraftDurationMs(state.camp, 'goldStew'),
    })
    expect(startCampCraft(started.state, 'focusTonic')).toMatchObject({
      success: false,
      state: started.state,
    })

    const upgradedAfterStart = structuredClone(started.state)
    upgradedAfterStart.camp.structures.workbench = 5
    expect(upgradedAfterStart.camp.craftJob?.remainingMs)
      .toBe(started.state.camp.craftJob?.remainingMs)
  })

  it('completes a craft exactly once at the 1ms boundary in battle or camp', () => {
    for (const currentMode of ['BATTLE', 'CAMP'] as const) {
      const state = createInitialState(0, 0x4200_0004)
      state.currentMode = currentMode
      state.camp.craftJob = { recipeId: 'goldStew', remainingMs: 1_000 }

      const before = advanceGame(state, 999).state
      expect(before.camp.craftJob?.remainingMs).toBe(1)
      expect(before.camp.consumables.goldStew).toBe(0)

      const completed = advanceGame(before, 1).state
      expect(completed.camp.craftJob).toBeNull()
      expect(completed.camp.consumables.goldStew).toBe(1)
      expect(advanceGame(completed, 10_000).state.camp.consumables.goldStew).toBe(1)
    }
  })

  it('consumes gold stew for exactly 1,800 completed combat rounds', () => {
    const state = createInitialState(0, 0x4200_0005)
    state.currentMode = 'CAMP'
    state.camp.consumables.goldStew = 2
    const used = consumeCampConsumable(state, 'goldStew')
    expect(used.success).toBe(true)
    expect(used.state.camp.buffs.goldBoostRounds).toBe(CAMP_GOLD_STEW_ROUNDS)
    expect(consumeCampConsumable(used.state, 'goldStew')).toMatchObject({
      success: false,
      state: used.state,
    })

    const battle = switchGameMode(used.state, 'BATTLE').state
    const partial = advanceGame(battle, 999).state
    expect(partial.camp.buffs.goldBoostRounds).toBe(CAMP_GOLD_STEW_ROUNDS)
    const first = advanceGame(partial, 1).state
    expect(first.camp.buffs.goldBoostRounds).toBe(CAMP_GOLD_STEW_ROUNDS - 1)
    const final = advanceGame(first, (CAMP_GOLD_STEW_ROUNDS - 1) * 1_000).state
    expect(final.camp.buffs.goldBoostRounds).toBe(0)
    expect(advanceGame(final, 1_000).state.camp.buffs.goldBoostRounds).toBe(0)
  })

  it('boosts ordinary enemy gold but not the first-boss milestone reward', () => {
    const seed = 0x4200_0006
    const normal = createInitialState(0, seed)
    normal.player.upgrades.weapon = 100
    normal.player.skills.powerStrike = 0
    normal.battle.stage = 10
    normal.battle.highestStage = 10
    normal.battle.enemyHp = 1
    const boosted = structuredClone(normal)
    boosted.camp.buffs.goldBoostRounds = 1

    const normalResult = advanceGame(normal, 1_000)
    const boostedResult = advanceGame(boosted, 1_000)
    const enemyGold = getEnemyDefinition(10).goldReward
    expect(boostedResult.report.goldEarned - normalResult.report.goldEarned)
      .toBe(Math.round(enemyGold * 1.5) - Math.round(enemyGold))
    expect(boostedResult.state.claimedBossMilestoneMask)
      .toBe(normalResult.state.claimedBossMilestoneMask)
  })

  it('uses the same RNG draw with a 35% threshold only for the next bound boss', () => {
    const seed = findFocusOnlySeed()
    const normal = createInitialState(0, seed)
    normal.player.skills.powerStrike = 0
    normal.battle.stage = 10
    normal.battle.highestStage = 10
    normal.battle.enemyHp = getEnemyDefinition(10).maxHp

    const prepared = structuredClone(normal)
    prepared.currentMode = 'CAMP'
    prepared.camp.consumables.focusTonic = 2
    const used = consumeCampConsumable(prepared, 'focusTonic')
    expect(used.success).toBe(true)
    expect(consumeCampConsumable(used.state, 'focusTonic')).toMatchObject({
      success: false,
      state: used.state,
    })
    const focused = switchGameMode(used.state, 'BATTLE').state

    const normalRound = advanceGame(normal, 1_000)
    const focusedRound = advanceGame(focused, 1_000)
    expect(normalRound.report.criticalHits).toBe(0)
    expect(focusedRound.report.criticalHits).toBe(1)
    expect(focusedRound.state.rng).toEqual(normalRound.state.rng)
    expect(focusedRound.state.camp.buffs.bossFocusStage).toBe(10)

    focusedRound.state.player.upgrades.weapon = 100
    focusedRound.state.battle.enemyHp = 1
    expect(advanceGame(focusedRound.state, 1_000).state.camp.buffs.bossFocusStage).toBeNull()
  })

  it('keeps an unbound tonic through regular enemies and clears abandoned bound bosses', () => {
    const state = createInitialState(0, 0x4200_0007)
    state.player.upgrades.weapon = 100
    state.player.skills.powerStrike = 0
    state.battle.stage = 9
    state.battle.highestStage = 10
    state.battle.enemyHp = 1
    state.camp.buffs.bossFocusStage = 0
    const reachedBoss = advanceGame(state, 1_000).state
    expect(reachedBoss.battle.stage).toBe(10)
    expect(reachedBoss.camp.buffs.bossFocusStage).toBe(0)

    reachedBoss.battle.enemyHp = getEnemyDefinition(10).maxHp
    const bound = advanceGame(reachedBoss, 1_000).state
    expect(bound.camp.buffs.bossFocusStage).toBe(10)
    expect(selectStage(bound, 9).state.camp.buffs.bossFocusStage).toBeNull()

    bound.battle.highestStage = 30
    expect(performPrestige(bound).state.camp.buffs.bossFocusStage).toBeNull()
  })
})
