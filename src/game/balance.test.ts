import { describe, expect, it } from 'vitest'
import { UPGRADE_IDS } from './types'
import { advanceGame, createInitialState, purchaseUpgrade, upgradeSkill } from './engine'
import { getUpgradeCost } from './formulas'
import type { GameState, SkillId } from './types'

function spendAvailableResources(input: GameState): GameState {
  let state = input
  let purchased = true
  while (purchased) {
    purchased = false
    const affordable = UPGRADE_IDS
      .map((id) => ({ id, cost: getUpgradeCost(id, state.player.upgrades[id]) }))
      .filter(({ cost }) => cost <= state.player.gold)
      .sort((left, right) => left.cost - right.cost)[0]
    if (affordable) {
      state = purchaseUpgrade(state, affordable.id).state
      purchased = true
    }
  }

  const priority: SkillId[] = ['powerStrike', 'ironWill', 'fortune']
  for (const id of priority) {
    while (state.player.skillPoints > 0) {
      const result = upgradeSkill(state, id)
      if (!result.success) break
      state = result.state
    }
  }
  return state
}

describe('starter balance smoke test', () => {
  it('lets an active player reach the first prestige gate within 45 simulated minutes', () => {
    let state = createInitialState(0)
    for (let second = 0; second < 45 * 60; second += 1) {
      state = advanceGame(state, 1_000).state
      state = spendAvailableResources(state)
    }

    expect(state.battle.highestStage).toBeGreaterThanOrEqual(30)
    expect(Number.isFinite(state.player.gold)).toBe(true)
    expect(state.player.gold).toBeGreaterThanOrEqual(0)
  })
})
