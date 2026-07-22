export const BOSS_MILESTONE_REWARD_TABLE_ID = 'boss-milestone-v1' as const
export const BOSS_MILESTONE_INTERVAL = 10 as const
export const BOSS_MILESTONE_COUNT = 30 as const
export const BOSS_MILESTONE_MAX_STAGE = 300 as const
export const MAX_BOSS_MILESTONE_MASK = 2 ** BOSS_MILESTONE_COUNT - 1

export interface BossMilestoneRewardDefinition {
  readonly tableId: typeof BOSS_MILESTONE_REWARD_TABLE_ID
  readonly kind: 'gold'
  readonly milestoneStage: number
  readonly configuredGold: number
}

function getMilestoneIndex(stage: number): number | null {
  if (
    !Number.isSafeInteger(stage) ||
    stage < BOSS_MILESTONE_INTERVAL ||
    stage > BOSS_MILESTONE_MAX_STAGE ||
    stage % BOSS_MILESTONE_INTERVAL !== 0
  ) {
    return null
  }
  return stage / BOSS_MILESTONE_INTERVAL - 1
}

export function getBossMilestoneReward(
  stage: number,
): BossMilestoneRewardDefinition | null {
  const index = getMilestoneIndex(stage)
  if (index === null) return null
  return {
    tableId: BOSS_MILESTONE_REWARD_TABLE_ID,
    kind: 'gold',
    milestoneStage: stage,
    configuredGold: 15 * (index + 1),
  }
}

export function hasClaimedBossMilestone(mask: number, stage: number): boolean {
  const index = getMilestoneIndex(stage)
  if (index === null) return false
  const bit = 2 ** index
  return Math.floor(mask / bit) % 2 === 1
}

export function claimBossMilestone(mask: number, stage: number): number {
  const index = getMilestoneIndex(stage)
  if (index === null || hasClaimedBossMilestone(mask, stage)) return mask
  return mask + 2 ** index
}

export function deriveLegacyBossMilestoneMask(
  highestStage: number,
  prestiges: number,
): number {
  if (prestiges > 0) return MAX_BOSS_MILESTONE_MASK
  const normalizedHighestStage = Math.min(
    BOSS_MILESTONE_MAX_STAGE,
    Math.max(0, Math.floor(highestStage)),
  )
  const milestoneCount = Math.min(
    BOSS_MILESTONE_COUNT,
    Math.floor(normalizedHighestStage / BOSS_MILESTONE_INTERVAL),
  )
  return 2 ** milestoneCount - 1
}

export function isBossMilestoneMask(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= MAX_BOSS_MILESTONE_MASK
  )
}
