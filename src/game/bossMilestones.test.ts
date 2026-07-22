import { describe, expect, it } from 'vitest'
import {
  BOSS_MILESTONE_COUNT,
  BOSS_MILESTONE_REWARD_TABLE_ID,
  MAX_BOSS_MILESTONE_MASK,
  claimBossMilestone,
  deriveLegacyBossMilestoneMask,
  getBossMilestoneReward,
  hasClaimedBossMilestone,
  isBossMilestoneMask,
} from './bossMilestones'

describe('IRPG-207 boss milestone contract', () => {
  it('exposes the complete versioned stage 10 through 300 gold table', () => {
    const rewards = Array.from({ length: BOSS_MILESTONE_COUNT }, (_, index) =>
      getBossMilestoneReward((index + 1) * 10),
    )

    expect(rewards).toHaveLength(30)
    expect(rewards[0]).toEqual({
      tableId: BOSS_MILESTONE_REWARD_TABLE_ID,
      kind: 'gold',
      milestoneStage: 10,
      configuredGold: 15,
    })
    expect(rewards[29]).toEqual({
      tableId: BOSS_MILESTONE_REWARD_TABLE_ID,
      kind: 'gold',
      milestoneStage: 300,
      configuredGold: 450,
    })
    expect(rewards.every((reward, index) =>
      reward?.configuredGold === 15 * (index + 1))).toBe(true)
  })

  it.each([0, 1, 9, 11, 299, 301, -10, 10.5, Number.NaN, Number.MAX_SAFE_INTEGER])(
    'does not define a reward for non-milestone stage %s',
    (stage) => {
      expect(getBossMilestoneReward(stage)).toBeNull()
    },
  )

  it('claims each arithmetic bit once without signed bitwise coercion', () => {
    let mask = 0
    for (let stage = 10; stage <= 300; stage += 10) {
      expect(hasClaimedBossMilestone(mask, stage)).toBe(false)
      const claimed = claimBossMilestone(mask, stage)
      expect(claimed).toBeGreaterThan(mask)
      expect(hasClaimedBossMilestone(claimed, stage)).toBe(true)
      expect(claimBossMilestone(claimed, stage)).toBe(claimed)
      mask = claimed
    }

    expect(mask).toBe(MAX_BOSS_MILESTONE_MASK)
    expect(isBossMilestoneMask(mask)).toBe(true)
  })

  it.each([
    [9, 0, 0],
    [10, 0, 1],
    [299, 0, 2 ** 29 - 1],
    [300, 0, MAX_BOSS_MILESTONE_MASK],
    [Number.MAX_SAFE_INTEGER, 0, MAX_BOSS_MILESTONE_MASK],
    [1, 1, MAX_BOSS_MILESTONE_MASK],
  ])(
    'derives the conservative legacy mask for highestStage=%s and prestiges=%s',
    (highestStage, prestiges, expectedMask) => {
      expect(deriveLegacyBossMilestoneMask(highestStage, prestiges)).toBe(expectedMask)
    },
  )

  it.each([
    -1,
    0.5,
    MAX_BOSS_MILESTONE_MASK + 1,
    Number.NaN,
    Number.POSITIVE_INFINITY,
  ])('rejects invalid current-schema mask %s', (mask) => {
    expect(isBossMilestoneMask(mask)).toBe(false)
  })
})
