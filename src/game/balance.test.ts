import { beforeAll, describe, expect, it } from 'vitest'
import {
  ENEMY_HP_GROWTH,
  FIRST_PRESTIGE_HP_GROWTH,
  getEnemyDefinition,
} from './content'
import {
  advanceGame,
  chooseExpeditionEvent,
  createInitialState,
  performPrestige,
  purchaseUpgrade,
  recruitCompanion,
  trainCompanion,
  upgradeSkill,
} from './engine'
import {
  ESSENCE_STAT_BONUS_PER_POINT,
  getHeroStats,
  getUpgradeCost,
} from './formulas'
import {
  SAVE_SLOT_A_KEY,
  SAVE_SLOT_B_KEY,
  bootstrapGame,
  saveGameAtRevision,
} from './persistence'
import { UPGRADE_IDS } from './types'
import type {
  CombatEvent,
  ExpeditionChoiceId,
  ExpeditionDefinitionId,
  GameState,
  RngState,
  SkillId,
  StorageLike,
  UpgradeId,
} from './types'

type EquipmentStrategy = 'cheapest' | 'offense' | 'balanced'

interface PlaytestProfile {
  name: string
  seed: number
  decisionCadenceSeconds: number
  equipment: EquipmentStrategy
  skills: readonly SkillId[]
}

interface PlaytestResult {
  name: string
  firstUpgradeSeconds: number
  firstBossSeconds: number
  firstBossClearSeconds: number
  prestigeGateSeconds: number
  equipmentPurchases: number
  skillPurchases: number
  criticalHits: number
  defeats: number
  longestStallSeconds: number
  finalGold: number
  milestoneRewardCount: number
  milestoneConfiguredGold: number
  milestoneAppliedGold: number
  finalState: GameState
}

interface CompanionPlaytestResult {
  name: string
  recruitSeconds: number
  prestigeGateSeconds: number
  trainingPurchases: number
  companionAttacks: number
  companionDamage: number
  finalRank: number
  milestoneRewardCount: number
  milestoneConfiguredGold: number
  milestoneAppliedGold: number
  finalState: GameState
}

type ReattainmentCohort = 'solo' | 'companion'

type ExpeditionChoicePlan = readonly [ExpeditionChoiceId, ExpeditionChoiceId]

interface ExpeditionChoiceTracker {
  readonly plan: ExpeditionChoicePlan
  readonly rngBeforeChoice: RngState[]
  readonly rngAfterChoice: RngState[]
  readonly applications: ExpeditionChoiceApplication[]
  applied: number
}

interface ExpeditionChoiceApplication {
  readonly definitionId: ExpeditionDefinitionId
  readonly milestoneStage: number
  readonly choiceId: ExpeditionChoiceId
  readonly effectType: 'grantGold' | 'restoreHp'
  readonly amount: number
}

interface ExpeditionProgress {
  elapsedSeconds: number
  finalState: GameState
  reachedTarget: boolean
  inputHashAfterRun: string
  milestoneRewardCount: number
  milestoneConfiguredGold: number
  milestoneAppliedGold: number
}

interface PairedReattainmentResult {
  name: string
  firstSeconds: number
  secondSeconds: number
  ratioPercent: number
  reward: number
  firstFinalState: GameState
  postPrestigeState: GameState
  secondFinalState: GameState
  firstFinalHash: string
  firstInputHashAfterPrestige: string
  postPrestigeHash: string
  postPrestigeInputHashAfterRun: string
  secondFinalHash: string
  firstMilestoneRewardCount: number
  firstMilestoneConfiguredGold: number
  firstMilestoneAppliedGold: number
  secondMilestoneRewardCount: number
  secondMilestoneConfiguredGold: number
  secondMilestoneAppliedGold: number
  firstExpeditionChoices: number
  secondExpeditionChoices: number
  expeditionChoiceRngUnchanged: boolean
  firstExpeditionApplications: readonly ExpeditionChoiceApplication[]
  secondExpeditionApplications: readonly ExpeditionChoiceApplication[]
}

interface MilestoneRewardTotals {
  count: number
  configuredGold: number
  appliedGold: number
}

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>()

  getItem(key: string) {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string) {
    this.values.set(key, value)
  }

  removeItem(key: string) {
    this.values.delete(key)
  }
}

const PLAYTEST_PROFILES: readonly PlaytestProfile[] = [
  { name: 'C5-A', seed: 0x10203040, decisionCadenceSeconds: 5, equipment: 'cheapest', skills: ['powerStrike', 'ironWill', 'fortune'] },
  { name: 'C10-S', seed: 0x22334455, decisionCadenceSeconds: 10, equipment: 'cheapest', skills: ['ironWill', 'powerStrike', 'fortune'] },
  { name: 'C15-G', seed: 0x3456789a, decisionCadenceSeconds: 15, equipment: 'cheapest', skills: ['fortune', 'powerStrike', 'ironWill'] },
  { name: 'O5-A', seed: 0x456789ab, decisionCadenceSeconds: 5, equipment: 'offense', skills: ['powerStrike', 'fortune', 'ironWill'] },
  { name: 'O10-S', seed: 0x56789abc, decisionCadenceSeconds: 10, equipment: 'offense', skills: ['ironWill', 'powerStrike', 'fortune'] },
  { name: 'O15-G', seed: 0x6789abcd, decisionCadenceSeconds: 15, equipment: 'offense', skills: ['fortune', 'ironWill', 'powerStrike'] },
  { name: 'B5-A', seed: 0x789abcde, decisionCadenceSeconds: 5, equipment: 'balanced', skills: ['powerStrike', 'ironWill', 'fortune'] },
  { name: 'B10-S', seed: 0x89abcdef, decisionCadenceSeconds: 10, equipment: 'balanced', skills: ['ironWill', 'fortune', 'powerStrike'] },
  { name: 'B15-G', seed: 0x9abcdef0, decisionCadenceSeconds: 15, equipment: 'balanced', skills: ['fortune', 'powerStrike', 'ironWill'] },
  { name: 'C20-M', seed: 0xcafebabe, decisionCadenceSeconds: 20, equipment: 'cheapest', skills: ['powerStrike', 'fortune', 'ironWill'] },
]

const EXPEDITION_CHOICE_PLANS = [
  { name: 'gold-gold', choices: ['gold', 'gold'] },
  { name: 'gold-recovery', choices: ['gold', 'recovery'] },
  { name: 'recovery-gold', choices: ['recovery', 'gold'] },
  { name: 'recovery-recovery', choices: ['recovery', 'recovery'] },
] as const satisfies readonly {
  name: string
  choices: ExpeditionChoicePlan
}[]

const EXPECTED_PLAYTEST_SUMMARIES: readonly Omit<PlaytestResult, 'finalState'>[] = [
  { name: 'C5-A', firstUpgradeSeconds: 5, firstBossSeconds: 31, firstBossClearSeconds: 86, prestigeGateSeconds: 2015, equipmentPurchases: 37, skillPurchases: 12, criticalHits: 301, defeats: 51, longestStallSeconds: 673, finalGold: 181, milestoneRewardCount: 2, milestoneConfiguredGold: 45, milestoneAppliedGold: 45 },
  { name: 'C10-S', firstUpgradeSeconds: 10, firstBossSeconds: 31, firstBossClearSeconds: 92, prestigeGateSeconds: 2090, equipmentPurchases: 36, skillPurchases: 12, criticalHits: 296, defeats: 51, longestStallSeconds: 931, finalGold: 1288, milestoneRewardCount: 2, milestoneConfiguredGold: 45, milestoneAppliedGold: 45 },
  { name: 'C15-G', firstUpgradeSeconds: 15, firstBossSeconds: 36, firstBossClearSeconds: 91, prestigeGateSeconds: 1848, equipmentPurchases: 36, skillPurchases: 11, criticalHits: 271, defeats: 54, longestStallSeconds: 860, finalGold: 1744, milestoneRewardCount: 2, milestoneConfiguredGold: 45, milestoneAppliedGold: 45 },
  { name: 'O5-A', firstUpgradeSeconds: 10, firstBossSeconds: 31, firstBossClearSeconds: 101, prestigeGateSeconds: 1850, equipmentPurchases: 37, skillPurchases: 12, criticalHits: 278, defeats: 56, longestStallSeconds: 842, finalGold: 651, milestoneRewardCount: 2, milestoneConfiguredGold: 45, milestoneAppliedGold: 45 },
  { name: 'O10-S', firstUpgradeSeconds: 10, firstBossSeconds: 35, firstBossClearSeconds: 80, prestigeGateSeconds: 1990, equipmentPurchases: 36, skillPurchases: 12, criticalHits: 342, defeats: 51, longestStallSeconds: 824, finalGold: 1326, milestoneRewardCount: 2, milestoneConfiguredGold: 45, milestoneAppliedGold: 45 },
  { name: 'O15-G', firstUpgradeSeconds: 15, firstBossSeconds: 32, firstBossClearSeconds: 85, prestigeGateSeconds: 2103, equipmentPurchases: 37, skillPurchases: 12, criticalHits: 332, defeats: 58, longestStallSeconds: 954, finalGold: 2304, milestoneRewardCount: 2, milestoneConfiguredGold: 45, milestoneAppliedGold: 45 },
  { name: 'B5-A', firstUpgradeSeconds: 5, firstBossSeconds: 31, firstBossClearSeconds: 130, prestigeGateSeconds: 2112, equipmentPurchases: 37, skillPurchases: 12, criticalHits: 310, defeats: 54, longestStallSeconds: 745, finalGold: 970, milestoneRewardCount: 2, milestoneConfiguredGold: 45, milestoneAppliedGold: 45 },
  { name: 'B10-S', firstUpgradeSeconds: 10, firstBossSeconds: 36, firstBossClearSeconds: 152, prestigeGateSeconds: 2214, equipmentPurchases: 37, skillPurchases: 12, criticalHits: 301, defeats: 52, longestStallSeconds: 857, finalGold: 974, milestoneRewardCount: 2, milestoneConfiguredGold: 45, milestoneAppliedGold: 45 },
  { name: 'B15-G', firstUpgradeSeconds: 15, firstBossSeconds: 36, firstBossClearSeconds: 74, prestigeGateSeconds: 1958, equipmentPurchases: 37, skillPurchases: 12, criticalHits: 262, defeats: 56, longestStallSeconds: 895, finalGold: 1461, milestoneRewardCount: 2, milestoneConfiguredGold: 45, milestoneAppliedGold: 45 },
  { name: 'C20-M', firstUpgradeSeconds: 20, firstBossSeconds: 41, firstBossClearSeconds: 96, prestigeGateSeconds: 2001, equipmentPurchases: 37, skillPurchases: 12, criticalHits: 308, defeats: 58, longestStallSeconds: 1019, finalGold: 1019, milestoneRewardCount: 2, milestoneConfiguredGold: 45, milestoneAppliedGold: 45 },
]

function summarizePlaytest(result: PlaytestResult): Omit<PlaytestResult, 'finalState'> {
  return {
    name: result.name,
    firstUpgradeSeconds: result.firstUpgradeSeconds,
    firstBossSeconds: result.firstBossSeconds,
    firstBossClearSeconds: result.firstBossClearSeconds,
    prestigeGateSeconds: result.prestigeGateSeconds,
    equipmentPurchases: result.equipmentPurchases,
    skillPurchases: result.skillPurchases,
    criticalHits: result.criticalHits,
    defeats: result.defeats,
    longestStallSeconds: result.longestStallSeconds,
    finalGold: result.finalGold,
    milestoneRewardCount: result.milestoneRewardCount,
    milestoneConfiguredGold: result.milestoneConfiguredGold,
    milestoneAppliedGold: result.milestoneAppliedGold,
  }
}

function hashValue(value: unknown): string {
  let hash = 0x811c9dc5
  for (const character of JSON.stringify(value)) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

function hashState(state: GameState): string {
  return hashValue(state)
}

function createExpeditionChoiceTracker(
  plan: ExpeditionChoicePlan,
): ExpeditionChoiceTracker {
  return {
    plan,
    rngBeforeChoice: [],
    rngAfterChoice: [],
    applications: [],
    applied: 0,
  }
}

function applyPlannedExpeditionChoices(
  input: GameState,
  tracker: ExpeditionChoiceTracker | undefined,
): GameState {
  if (tracker === undefined) return input

  let state = input
  while (tracker.applied < tracker.plan.length) {
    const pending = state.expeditionEvents.pending[0]
    if (pending === undefined) break

    const choiceId = tracker.plan[tracker.applied]!
    const resolvedChoice = pending.resolvedChoices.find((choice) =>
      choice.choiceId === choiceId)
    if (resolvedChoice === undefined) {
      throw new Error(`missing ${choiceId} choice for ${pending.eventId}`)
    }
    const beforeRng = { ...state.rng }
    const chosen = chooseExpeditionEvent(state, pending.eventId, choiceId)
    if (!chosen.success) {
      throw new Error(`failed to choose ${choiceId} for ${pending.eventId}`)
    }

    const afterRng = { ...chosen.state.rng }
    tracker.rngBeforeChoice.push(beforeRng)
    tracker.rngAfterChoice.push(afterRng)
    tracker.applications.push({
      definitionId: pending.definitionId,
      milestoneStage: pending.milestoneStage,
      choiceId,
      effectType: resolvedChoice.effect.type,
      amount: resolvedChoice.effect.amount,
    })
    if (JSON.stringify(afterRng) !== JSON.stringify(beforeRng)) {
      throw new Error(`expedition choice ${pending.eventId}:${choiceId} changed combat RNG`)
    }
    tracker.applied += 1
    state = chosen.state
  }
  return state
}

function didTrackerPreserveCombatRng(tracker: ExpeditionChoiceTracker): boolean {
  return tracker.rngBeforeChoice.length === tracker.plan.length &&
    tracker.rngAfterChoice.length === tracker.plan.length &&
    tracker.rngBeforeChoice.every((rng, index) =>
      JSON.stringify(rng) === JSON.stringify(tracker.rngAfterChoice[index]))
}

function collectMilestoneRewards(events: readonly CombatEvent[]): MilestoneRewardTotals {
  return events.reduce<MilestoneRewardTotals>((total, event) => {
    if (event.type !== 'bossVictory' || event.milestoneReward === null) return total
    return {
      count: total.count + 1,
      configuredGold: total.configuredGold + event.milestoneReward.configuredGold,
      appliedGold: total.appliedGold + event.milestoneReward.appliedGold,
    }
  }, { count: 0, configuredGold: 0, appliedGold: 0 })
}

function addMilestoneRewards(
  total: MilestoneRewardTotals,
  next: MilestoneRewardTotals,
): MilestoneRewardTotals {
  return {
    count: total.count + next.count,
    configuredGold: total.configuredGold + next.configuredGold,
    appliedGold: total.appliedGold + next.appliedGold,
  }
}

function assertNumericInvariants(state: GameState, profileName: string, second: number) {
  const values = [
    state.claimedBossMilestoneMask,
    state.expeditionEvents.definitionVersion,
    state.expeditionEvents.runPrestige,
    state.expeditionEvents.milestoneMask,
    state.expeditionEvents.overflowCount,
    ...state.expeditionEvents.pending.flatMap((event) => [
      event.definitionVersion,
      event.milestoneIndex,
      event.milestoneStage,
      event.maxHpAtOffer,
      ...event.resolvedChoices.map(({ effect }) => effect.amount),
    ]),
    state.player.level,
    state.player.gold,
    state.player.xp,
    state.player.essence,
    state.player.currentHp,
    state.player.skillPoints,
    ...Object.values(state.player.upgrades),
    ...Object.values(state.player.skills),
    state.player.companion.rank,
    state.battle.enemyHp,
    state.battle.stage,
    state.battle.highestStage,
    state.battle.roundRemainderMs,
    state.battle.powerStrikeCooldownMs,
    state.battle.companionCooldownMs,
    state.battle.kills,
    state.battle.defeats,
    state.stats.goldEarned,
    state.stats.enemiesDefeated,
    state.stats.prestiges,
    state.rng.seed,
    state.rng.state,
    state.rng.draws,
  ]
  if (values.some((value) => !Number.isSafeInteger(value) || value < 0)) {
    throw new Error(`${profileName} violated a numeric invariant at ${second}s`)
  }
}

function chooseUpgrade(state: GameState, strategy: EquipmentStrategy): UpgradeId | null {
  const affordable = UPGRADE_IDS
    .map((id) => ({ id, level: state.player.upgrades[id], cost: getUpgradeCost(id, state.player.upgrades[id]) }))
    .filter(({ cost }) => cost <= state.player.gold)
  if (affordable.length === 0) return null

  if (strategy === 'offense') {
    return (['weapon', 'charm', 'armor'] as const).find((id) =>
      affordable.some((candidate) => candidate.id === id),
    ) ?? null
  }
  if (strategy === 'balanced') {
    affordable.sort((left, right) => left.level - right.level || left.cost - right.cost)
    return affordable[0]?.id ?? null
  }
  affordable.sort((left, right) => left.cost - right.cost)
  return affordable[0]?.id ?? null
}

function spendAvailableResources(input: GameState, profile: PlaytestProfile) {
  let state = input
  let equipmentPurchases = 0
  let skillPurchases = 0

  while (true) {
    const id = chooseUpgrade(state, profile.equipment)
    if (id === null) break
    const result = purchaseUpgrade(state, id)
    if (!result.success) break
    state = result.state
    equipmentPurchases += 1
  }

  for (const id of profile.skills) {
    while (state.player.skillPoints > 0) {
      const result = upgradeSkill(state, id)
      if (!result.success) break
      state = result.state
      skillPurchases += 1
    }
  }

  return { state, equipmentPurchases, skillPurchases }
}

function runPlaytest(
  profile: PlaytestProfile,
  expeditionChoices?: ExpeditionChoiceTracker,
): PlaytestResult {
  let state = createInitialState(0, profile.seed)
  let firstUpgradeSeconds = 0
  let firstBossSeconds = 0
  let firstBossClearSeconds = 0
  let equipmentPurchases = 0
  let skillPurchases = 0
  let criticalHits = 0
  let lastHighestStage = state.battle.highestStage
  let lastProgressSeconds = 0
  let longestStallSeconds = 0
  let milestoneRewards: MilestoneRewardTotals = {
    count: 0,
    configuredGold: 0,
    appliedGold: 0,
  }

  for (let second = 1; second <= 60 * 60; second += 1) {
    const advanced = advanceGame(state, 1_000)
    state = advanced.state
    state = applyPlannedExpeditionChoices(state, expeditionChoices)
    milestoneRewards = addMilestoneRewards(
      milestoneRewards,
      collectMilestoneRewards(advanced.events),
    )
    criticalHits += advanced.report.criticalHits
    assertNumericInvariants(state, profile.name, second)
    if (state.battle.highestStage > lastHighestStage) {
      longestStallSeconds = Math.max(longestStallSeconds, second - lastProgressSeconds)
      lastProgressSeconds = second
      lastHighestStage = state.battle.highestStage
    }
    if (firstBossSeconds === 0 && state.battle.highestStage >= 10) firstBossSeconds = second
    if (firstBossClearSeconds === 0 && state.battle.highestStage >= 11) {
      firstBossClearSeconds = second
    }

    if (second % profile.decisionCadenceSeconds === 0) {
      const spent = spendAvailableResources(state, profile)
      state = spent.state
      assertNumericInvariants(state, profile.name, second)
      equipmentPurchases += spent.equipmentPurchases
      skillPurchases += spent.skillPurchases
      if (firstUpgradeSeconds === 0 && spent.equipmentPurchases > 0) {
        firstUpgradeSeconds = second
      }
    }

    if (state.battle.highestStage >= 30) {
      return {
        name: profile.name,
        firstUpgradeSeconds,
        firstBossSeconds,
        firstBossClearSeconds,
        prestigeGateSeconds: second,
        equipmentPurchases,
        skillPurchases,
        criticalHits,
        defeats: state.battle.defeats,
        longestStallSeconds: Math.max(longestStallSeconds, second - lastProgressSeconds),
        finalGold: state.player.gold,
        milestoneRewardCount: milestoneRewards.count,
        milestoneConfiguredGold: milestoneRewards.configuredGold,
        milestoneAppliedGold: milestoneRewards.appliedGold,
        finalState: state,
      }
    }
  }

  throw new Error(`${profile.name} did not reach the prestige gate within 60 minutes`)
}

function runCompanionPlaytest(
  profile: PlaytestProfile,
  expeditionChoices?: ExpeditionChoiceTracker,
): CompanionPlaytestResult {
  let state = createInitialState(0, profile.seed)
  let recruitSeconds = 0
  let trainingPurchases = 0
  let companionAttacks = 0
  let companionDamage = 0
  let milestoneRewards: MilestoneRewardTotals = {
    count: 0,
    configuredGold: 0,
    appliedGold: 0,
  }

  for (let second = 1; second <= 60 * 60; second += 1) {
    const advanced = advanceGame(state, 1_000)
    state = advanced.state
    state = applyPlannedExpeditionChoices(state, expeditionChoices)
    milestoneRewards = addMilestoneRewards(
      milestoneRewards,
      collectMilestoneRewards(advanced.events),
    )
    companionAttacks += advanced.report.companionAttacks
    companionDamage += advanced.report.companionDamage
    assertNumericInvariants(state, `${profile.name}-companion`, second)

    if (state.player.companion.id === null && state.battle.highestStage >= 11) {
      const recruited = recruitCompanion(state, 'emberFox')
      if (!recruited.success) throw new Error(`${profile.name} failed to recruit emberFox`)
      state = recruited.state
      recruitSeconds = second
    }

    if (second % profile.decisionCadenceSeconds === 0) {
      while (state.player.companion.id !== null) {
        const trained = trainCompanion(state)
        if (!trained.success) break
        state = trained.state
        trainingPurchases += 1
      }
      const spent = spendAvailableResources(state, profile)
      state = spent.state
      assertNumericInvariants(state, `${profile.name}-companion`, second)
    }

    if (state.battle.highestStage >= 30) {
      return {
        name: profile.name,
        recruitSeconds,
        prestigeGateSeconds: second,
        trainingPurchases,
        companionAttacks,
        companionDamage,
        finalRank: state.player.companion.rank,
        milestoneRewardCount: milestoneRewards.count,
        milestoneConfiguredGold: milestoneRewards.configuredGold,
        milestoneAppliedGold: milestoneRewards.appliedGold,
        finalState: state,
      }
    }
  }

  throw new Error(`${profile.name} companion run did not reach the prestige gate within 60 minutes`)
}

function summarizeCompanionPlaytest(
  result: CompanionPlaytestResult,
): Omit<CompanionPlaytestResult, 'finalState'> {
  return {
    name: result.name,
    recruitSeconds: result.recruitSeconds,
    prestigeGateSeconds: result.prestigeGateSeconds,
    trainingPurchases: result.trainingPurchases,
    companionAttacks: result.companionAttacks,
    companionDamage: result.companionDamage,
    finalRank: result.finalRank,
    milestoneRewardCount: result.milestoneRewardCount,
    milestoneConfiguredGold: result.milestoneConfiguredGold,
    milestoneAppliedGold: result.milestoneAppliedGold,
  }
}

function continueReattainmentExpedition(
  input: GameState,
  profile: PlaytestProfile,
  cohort: ReattainmentCohort,
  elapsedSeconds = 0,
  stopAtSeconds = 60 * 60,
  expeditionChoices?: ExpeditionChoiceTracker,
): ExpeditionProgress {
  let state = input
  let milestoneRewards: MilestoneRewardTotals = {
    count: 0,
    configuredGold: 0,
    appliedGold: 0,
  }

  for (let second = elapsedSeconds + 1; second <= stopAtSeconds; second += 1) {
    const advanced = advanceGame(state, 1_000)
    state = advanced.state
    state = applyPlannedExpeditionChoices(state, expeditionChoices)
    milestoneRewards = addMilestoneRewards(
      milestoneRewards,
      collectMilestoneRewards(advanced.events),
    )
    assertNumericInvariants(state, `${profile.name}-${cohort}-reattainment`, second)

    if (
      cohort === 'companion' &&
      state.player.companion.id === null &&
      state.battle.highestStage >= 11
    ) {
      const recruited = recruitCompanion(state, 'emberFox')
      if (!recruited.success) {
        throw new Error(`${profile.name} failed to recruit emberFox during reattainment`)
      }
      state = recruited.state
    }

    if (second % profile.decisionCadenceSeconds === 0) {
      if (cohort === 'companion') {
        while (state.player.companion.id !== null) {
          const trained = trainCompanion(state)
          if (!trained.success) break
          state = trained.state
        }
      }
      state = spendAvailableResources(state, profile).state
      assertNumericInvariants(state, `${profile.name}-${cohort}-reattainment`, second)
    }

    if (state.battle.highestStage >= 30) {
      return {
        elapsedSeconds: second,
        finalState: state,
        reachedTarget: true,
        inputHashAfterRun: hashState(input),
        milestoneRewardCount: milestoneRewards.count,
        milestoneConfiguredGold: milestoneRewards.configuredGold,
        milestoneAppliedGold: milestoneRewards.appliedGold,
      }
    }
  }

  return {
    elapsedSeconds: stopAtSeconds,
    finalState: state,
    reachedTarget: false,
    inputHashAfterRun: hashState(input),
    milestoneRewardCount: milestoneRewards.count,
    milestoneConfiguredGold: milestoneRewards.configuredGold,
    milestoneAppliedGold: milestoneRewards.appliedGold,
  }
}

function runPairedReattainment(
  profile: PlaytestProfile,
  cohort: ReattainmentCohort,
  expeditionChoicePlan?: ExpeditionChoicePlan,
): PairedReattainmentResult {
  const firstExpeditionChoices = expeditionChoicePlan === undefined
    ? undefined
    : createExpeditionChoiceTracker(expeditionChoicePlan)
  const first = cohort === 'companion'
    ? runCompanionPlaytest(profile, firstExpeditionChoices)
    : runPlaytest(profile, firstExpeditionChoices)
  const firstFinalHash = hashState(first.finalState)
  const prestiged = performPrestige(first.finalState)
  if (!prestiged.success) throw new Error(`${profile.name} failed to prestige`)

  const postPrestigeHash = hashState(prestiged.state)
  const secondExpeditionChoices = expeditionChoicePlan === undefined
    ? undefined
    : createExpeditionChoiceTracker(expeditionChoicePlan)
  const second = continueReattainmentExpedition(
    prestiged.state,
    profile,
    cohort,
    0,
    60 * 60,
    secondExpeditionChoices,
  )
  if (!second.reachedTarget) {
    throw new Error(`${profile.name} did not reattain stage 30 within 60 minutes`)
  }

  return {
    name: profile.name,
    firstSeconds: first.prestigeGateSeconds,
    secondSeconds: second.elapsedSeconds,
    ratioPercent: (second.elapsedSeconds / first.prestigeGateSeconds) * 100,
    reward: prestiged.state.player.essence - first.finalState.player.essence,
    firstFinalState: first.finalState,
    postPrestigeState: prestiged.state,
    secondFinalState: second.finalState,
    firstFinalHash,
    firstInputHashAfterPrestige: hashState(first.finalState),
    postPrestigeHash,
    postPrestigeInputHashAfterRun: second.inputHashAfterRun,
    secondFinalHash: hashState(second.finalState),
    firstMilestoneRewardCount: first.milestoneRewardCount,
    firstMilestoneConfiguredGold: first.milestoneConfiguredGold,
    firstMilestoneAppliedGold: first.milestoneAppliedGold,
    secondMilestoneRewardCount: second.milestoneRewardCount,
    secondMilestoneConfiguredGold: second.milestoneConfiguredGold,
    secondMilestoneAppliedGold: second.milestoneAppliedGold,
    firstExpeditionChoices: firstExpeditionChoices?.applied ?? 0,
    secondExpeditionChoices: secondExpeditionChoices?.applied ?? 0,
    expeditionChoiceRngUnchanged:
      firstExpeditionChoices === undefined || secondExpeditionChoices === undefined
        ? true
        : didTrackerPreserveCombatRng(firstExpeditionChoices) &&
          didTrackerPreserveCombatRng(secondExpeditionChoices),
    firstExpeditionApplications: firstExpeditionChoices?.applications ?? [],
    secondExpeditionApplications: secondExpeditionChoices?.applications ?? [],
  }
}

function summarizePairedReattainment(result: PairedReattainmentResult) {
  return {
    name: result.name,
    firstSeconds: result.firstSeconds,
    secondSeconds: result.secondSeconds,
    ratioPercent: Number(result.ratioPercent.toFixed(2)),
  }
}

function median(values: readonly number[]) {
  const sorted = [...values].sort((left, right) => left - right)
  const midpoint = sorted.length / 2
  return (sorted[midpoint - 1]! + sorted[midpoint]!) / 2
}

interface ExpeditionChoiceMatrixRow {
  readonly planName: string
  readonly plan: ExpeditionChoicePlan
  readonly cohort: ReattainmentCohort
  readonly results: readonly PairedReattainmentResult[]
}

function runExpeditionChoiceMatrix(): ExpeditionChoiceMatrixRow[] {
  return EXPEDITION_CHOICE_PLANS.flatMap(({ name, choices }) =>
    (['solo', 'companion'] as const).map((cohort) => ({
      planName: name,
      plan: choices,
      cohort,
      results: PLAYTEST_PROFILES.map((profile) =>
        runPairedReattainment(profile, cohort, choices)),
    })),
  )
}

function summarizeExpeditionChoiceMatrix(rows: readonly ExpeditionChoiceMatrixRow[]) {
  return rows.map(({ planName, plan, cohort, results }) => ({
    planName,
    plan,
    cohort,
    firstSeconds: results.map(({ firstSeconds }) => firstSeconds),
    secondSeconds: results.map(({ secondSeconds }) => secondSeconds),
    ratios: results.map(({ ratioPercent }) => Number(ratioPercent.toFixed(4))),
    firstFinalHashes: results.map(({ firstFinalHash }) => firstFinalHash),
    postPrestigeHashes: results.map(({ postPrestigeHash }) => postPrestigeHash),
    secondFinalHashes: results.map(({ secondFinalHash }) => secondFinalHash),
    firstChoices: results.map(({ firstExpeditionChoices }) => firstExpeditionChoices),
    secondChoices: results.map(({ secondExpeditionChoices }) => secondExpeditionChoices),
    firstApplications: results.map(({ firstExpeditionApplications }) =>
      firstExpeditionApplications),
    secondApplications: results.map(({ secondExpeditionApplications }) =>
      secondExpeditionApplications),
  }))
}

describe('first prestige balance playtest', () => {
  it('keeps the median of ten deterministic play sessions between 30 and 45 minutes', () => {
    const results = PLAYTEST_PROFILES.map((profile) => runPlaytest(profile))
    const sortedTimes = results.map(({ prestigeGateSeconds }) => prestigeGateSeconds).sort((a, b) => a - b)
    const medianSeconds = (sortedTimes[4]! + sortedTimes[5]!) / 2

    expect(PLAYTEST_PROFILES).toHaveLength(10)
    expect(results.map(summarizePlaytest)).toEqual(EXPECTED_PLAYTEST_SUMMARIES)
    expect(sortedTimes[0]).toBe(1848)
    expect(sortedTimes.at(-1)).toBe(2214)
    expect(medianSeconds).toBe(2008)
    expect(medianSeconds).toBeGreaterThanOrEqual(30 * 60)
    expect(medianSeconds).toBeLessThanOrEqual(45 * 60)
    expect(results.every(({ firstUpgradeSeconds }) => firstUpgradeSeconds > 0 && firstUpgradeSeconds <= 120)).toBe(true)
    expect(results.every(({ firstBossSeconds }) => firstBossSeconds >= 30 && firstBossSeconds <= 60)).toBe(true)
    expect(results.every(({ firstBossClearSeconds }) => firstBossClearSeconds >= 60 && firstBossClearSeconds <= 180)).toBe(true)
    expect(results.every(({ longestStallSeconds }) => longestStallSeconds < 20 * 60)).toBe(true)
    expect(results.every(({ criticalHits }) => criticalHits > 0)).toBe(true)
    expect(results.every(({ finalState }) => finalState.battle.highestStage >= 30)).toBe(true)
    expect(results.every(({ finalGold }) => Number.isSafeInteger(finalGold) && finalGold >= 0)).toBe(true)
  })

  it('replays every fixed playtest profile exactly', () => {
    const first = PLAYTEST_PROFILES.map((profile) => runPlaytest(profile))
    expect(PLAYTEST_PROFILES.map((profile) => runPlaytest(profile))).toEqual(first)
    expect(first.map(({ finalState }) => hashState(finalState))).toEqual([
      'cba30d15',
      '5f0bab70',
      'caeda56b',
      'fbc60656',
      '12fa1c24',
      'fb03098d',
      '000bea4d',
      '052586a7',
      '4a01fc00',
      '19efc11a',
    ])
  })

  it('keeps recruit-and-train companion profiles deterministic and inside the prestige target', () => {
    const results = PLAYTEST_PROFILES.map((profile) => runCompanionPlaytest(profile))
    const replay = PLAYTEST_PROFILES.map((profile) => runCompanionPlaytest(profile))
    const sortedTimes = results
      .map(({ prestigeGateSeconds }) => prestigeGateSeconds)
      .sort((left, right) => left - right)
    const medianSeconds = (sortedTimes[4]! + sortedTimes[5]!) / 2

    expect(replay).toEqual(results)
    expect(results.map(summarizeCompanionPlaytest)).toEqual([
      { name: 'C5-A', recruitSeconds: 86, prestigeGateSeconds: 1911, trainingPurchases: 4, companionAttacks: 618, companionDamage: 17525, finalRank: 5, milestoneRewardCount: 2, milestoneConfiguredGold: 45, milestoneAppliedGold: 45 },
      { name: 'C10-S', recruitSeconds: 92, prestigeGateSeconds: 2004, trainingPurchases: 4, companionAttacks: 645, companionDamage: 18226, finalRank: 5, milestoneRewardCount: 2, milestoneConfiguredGold: 45, milestoneAppliedGold: 45 },
      { name: 'C15-G', recruitSeconds: 91, prestigeGateSeconds: 1756, trainingPurchases: 4, companionAttacks: 568, companionDamage: 16405, finalRank: 5, milestoneRewardCount: 2, milestoneConfiguredGold: 45, milestoneAppliedGold: 45 },
      { name: 'O5-A', recruitSeconds: 101, prestigeGateSeconds: 1788, trainingPurchases: 4, companionAttacks: 578, companionDamage: 17248, finalRank: 5, milestoneRewardCount: 2, milestoneConfiguredGold: 45, milestoneAppliedGold: 45 },
      { name: 'O10-S', recruitSeconds: 80, prestigeGateSeconds: 1899, trainingPurchases: 4, companionAttacks: 618, companionDamage: 17544, finalRank: 5, milestoneRewardCount: 2, milestoneConfiguredGold: 45, milestoneAppliedGold: 45 },
      { name: 'O15-G', recruitSeconds: 85, prestigeGateSeconds: 1938, trainingPurchases: 4, companionAttacks: 630, companionDamage: 18382, finalRank: 5, milestoneRewardCount: 2, milestoneConfiguredGold: 45, milestoneAppliedGold: 45 },
      { name: 'B5-A', recruitSeconds: 130, prestigeGateSeconds: 1854, trainingPurchases: 4, companionAttacks: 582, companionDamage: 15714, finalRank: 5, milestoneRewardCount: 2, milestoneConfiguredGold: 45, milestoneAppliedGold: 45 },
      { name: 'B10-S', recruitSeconds: 152, prestigeGateSeconds: 2040, trainingPurchases: 4, companionAttacks: 636, companionDamage: 17694, finalRank: 5, milestoneRewardCount: 2, milestoneConfiguredGold: 45, milestoneAppliedGold: 45 },
      { name: 'B15-G', recruitSeconds: 74, prestigeGateSeconds: 1873, trainingPurchases: 4, companionAttacks: 613, companionDamage: 17823, finalRank: 5, milestoneRewardCount: 2, milestoneConfiguredGold: 45, milestoneAppliedGold: 45 },
      { name: 'C20-M', recruitSeconds: 96, prestigeGateSeconds: 1644, trainingPurchases: 4, companionAttacks: 528, companionDamage: 14843, finalRank: 5, milestoneRewardCount: 2, milestoneConfiguredGold: 45, milestoneAppliedGold: 45 },
    ])
    expect(results.map(({ finalState }) => hashState(finalState))).toEqual([
      '03a17c78',
      'bc3abc7c',
      'ef43ca67',
      'de13a29e',
      'e44f8e0e',
      'db6681c4',
      '5184cef6',
      'e40fd55b',
      '1f743422',
      '5b122ba4',
    ])
    expect(medianSeconds).toBeGreaterThanOrEqual(30 * 60)
    expect(medianSeconds).toBeLessThanOrEqual(45 * 60)
    expect(medianSeconds).toBe(1886)
    expect(results.every(({ recruitSeconds }) => recruitSeconds >= 60 && recruitSeconds <= 180)).toBe(true)
    expect(results.every(({ trainingPurchases }) => trainingPurchases > 0)).toBe(true)
    expect(results.every(({ finalRank }) => finalRank >= 2 && finalRank <= 5)).toBe(true)
    expect(results.every(({ companionAttacks }) => companionAttacks > 0)).toBe(true)
    expect(results.every(({ companionDamage }) => companionDamage > 0)).toBe(true)
    expect(results.every(({ prestigeGateSeconds }) => prestigeGateSeconds <= 60 * 60)).toBe(true)
  })

  it('tapers the first-prestige adjustment back to the long-term HP curve', () => {
    expect(getEnemyDefinition(30).maxHp).toBe(
      Math.round(34 * FIRST_PRESTIGE_HP_GROWTH ** 29 * 4.8),
    )

    const normalizedPacingMultiplier = (stage: number) =>
      getEnemyDefinition(stage).maxHp / (34 * ENEMY_HP_GROWTH ** (stage - 1))
    const stage30Multiplier = normalizedPacingMultiplier(30) / 4.8
    const stage31Multiplier = normalizedPacingMultiplier(31)
    const stage45Multiplier = normalizedPacingMultiplier(45)
    const stage59Multiplier = normalizedPacingMultiplier(59)
    expect(stage30Multiplier).toBeGreaterThan(stage31Multiplier)
    expect(stage31Multiplier).toBeGreaterThan(stage45Multiplier)
    expect(stage45Multiplier).toBeGreaterThan(stage59Multiplier)
    expect(stage59Multiplier).toBeGreaterThan(1)

    for (const stage of [60, 100, 200]) {
      const bossMultiplier = stage % 10 === 0 ? 4.8 : 1
      expect(getEnemyDefinition(stage).maxHp).toBe(
        Math.round(34 * ENEMY_HP_GROWTH ** (stage - 1) * bossMultiplier),
      )
    }
  })
})

describe('post-prestige stage 30 reattainment', () => {
  let soloResults: PairedReattainmentResult[] = []
  let companionResults: PairedReattainmentResult[] = []

  beforeAll(() => {
    soloResults = PLAYTEST_PROFILES.map((profile) =>
      runPairedReattainment(profile, 'solo'))
    companionResults = PLAYTEST_PROFILES.map((profile) =>
      runPairedReattainment(profile, 'companion'))
  })

  it('keeps all paired ratios in the 50-70% target with exact canonical timings', () => {
    expect(soloResults.map(summarizePairedReattainment)).toEqual([
      { name: 'C5-A', firstSeconds: 2015, secondSeconds: 1179, ratioPercent: 58.51 },
      { name: 'C10-S', firstSeconds: 2090, secondSeconds: 1225, ratioPercent: 58.61 },
      { name: 'C15-G', firstSeconds: 1848, secondSeconds: 1281, ratioPercent: 69.32 },
      { name: 'O5-A', firstSeconds: 1850, secondSeconds: 1215, ratioPercent: 65.68 },
      { name: 'O10-S', firstSeconds: 1990, secondSeconds: 1376, ratioPercent: 69.15 },
      { name: 'O15-G', firstSeconds: 2103, secondSeconds: 1345, ratioPercent: 63.96 },
      { name: 'B5-A', firstSeconds: 2112, secondSeconds: 1214, ratioPercent: 57.48 },
      { name: 'B10-S', firstSeconds: 2214, secondSeconds: 1401, ratioPercent: 63.28 },
      { name: 'B15-G', firstSeconds: 1958, secondSeconds: 1267, ratioPercent: 64.71 },
      { name: 'C20-M', firstSeconds: 2001, secondSeconds: 1247, ratioPercent: 62.32 },
    ])
    expect(companionResults.map(summarizePairedReattainment)).toEqual([
      { name: 'C5-A', firstSeconds: 1911, secondSeconds: 1195, ratioPercent: 62.53 },
      { name: 'C10-S', firstSeconds: 2004, secondSeconds: 1218, ratioPercent: 60.78 },
      { name: 'C15-G', firstSeconds: 1756, secondSeconds: 1083, ratioPercent: 61.67 },
      { name: 'O5-A', firstSeconds: 1788, secondSeconds: 1079, ratioPercent: 60.35 },
      { name: 'O10-S', firstSeconds: 1899, secondSeconds: 1217, ratioPercent: 64.09 },
      { name: 'O15-G', firstSeconds: 1938, secondSeconds: 1225, ratioPercent: 63.21 },
      { name: 'B5-A', firstSeconds: 1854, secondSeconds: 1199, ratioPercent: 64.67 },
      { name: 'B10-S', firstSeconds: 2040, secondSeconds: 1237, ratioPercent: 60.64 },
      { name: 'B15-G', firstSeconds: 1873, secondSeconds: 1225, ratioPercent: 65.4 },
      { name: 'C20-M', firstSeconds: 1644, secondSeconds: 1086, ratioPercent: 66.06 },
    ])

    const soloRatios = soloResults.map(({ ratioPercent }) => ratioPercent)
    const companionRatios = companionResults.map(({ ratioPercent }) => ratioPercent)
    expect(soloRatios.every((ratio) => ratio >= 50 && ratio <= 70)).toBe(true)
    expect(companionRatios.every((ratio) => ratio >= 50 && ratio <= 70)).toBe(true)
    expect(median(soloRatios)).toBeCloseTo(63.617692881636, 10)
    expect(median(companionRatios)).toBeCloseTo(62.871099856947, 10)
    expect(median(soloRatios)).toBeCloseTo(63.6, 1)
    expect(median(companionRatios)).toBeCloseTo(62.9, 1)
  })

  it('preserves the prestige reward, reset contract, companion, RNG, and inputs', () => {
    expect(soloResults.map(({ firstSeconds }) => firstSeconds)).toEqual(
      EXPECTED_PLAYTEST_SUMMARIES.map(({ prestigeGateSeconds }) => prestigeGateSeconds),
    )
    expect(companionResults.map(({ firstSeconds }) => firstSeconds)).toEqual([
      1911, 2004, 1756, 1788, 1899, 1938, 1854, 2040, 1873, 1644,
    ])

    for (const result of [...soloResults, ...companionResults]) {
      expect(result.firstMilestoneRewardCount).toBe(2)
      expect(result.firstMilestoneConfiguredGold).toBe(45)
      expect(result.firstMilestoneAppliedGold).toBe(45)
      expect(result.secondMilestoneRewardCount).toBe(0)
      expect(result.secondMilestoneConfiguredGold).toBe(0)
      expect(result.secondMilestoneAppliedGold).toBe(0)
      expect(result.firstFinalState.claimedBossMilestoneMask).toBe(3)
      expect(result.postPrestigeState.claimedBossMilestoneMask).toBe(3)
      expect(result.secondFinalState.claimedBossMilestoneMask).toBe(3)
      expect(result.reward).toBe(5)
      expect(result.firstInputHashAfterPrestige).toBe(result.firstFinalHash)
      expect(result.postPrestigeInputHashAfterRun).toBe(result.postPrestigeHash)
      expect(result.postPrestigeState.rng).toEqual(result.firstFinalState.rng)
      expect(result.secondFinalState.rng.seed).toBe(result.firstFinalState.rng.seed)
      expect(result.secondFinalState.rng.draws).toBeGreaterThan(
        result.postPrestigeState.rng.draws,
      )
      expect(result.secondFinalState.rng.draws).toBe(
        result.postPrestigeState.rng.draws + result.secondSeconds,
      )
      expect(result.postPrestigeState.player).toMatchObject({
        level: 1,
        xp: 0,
        gold: 0,
        essence: 5,
        skillPoints: 0,
        upgrades: { weapon: 0, armor: 0, charm: 0 },
        skills: { powerStrike: 1, ironWill: 0, fortune: 0 },
      })
      expect(result.postPrestigeState.battle).toMatchObject({
        stage: 1,
        highestStage: 1,
        roundRemainderMs: 0,
        powerStrikeCooldownMs: 0,
        companionCooldownMs: 0,
        kills: 0,
        defeats: 0,
      })
      expect(result.postPrestigeState.stats.prestiges).toBe(1)
      expect(result.postPrestigeState.player.currentHp).toBe(
        getHeroStats(result.postPrestigeState).maxHp,
      )
    }

    expect(soloResults.every(({ postPrestigeState }) =>
      postPrestigeState.player.companion.id === null &&
      postPrestigeState.player.companion.rank === 0)).toBe(true)
    expect(companionResults.every(({ postPrestigeState }) =>
      postPrestigeState.player.companion.id === 'emberFox' &&
      postPrestigeState.player.companion.rank === 1)).toBe(true)
  })

  it('replays every paired final state and RNG sequence exactly', () => {
    expect(soloResults.map(({ secondFinalHash }) => secondFinalHash)).toEqual([
      '1486a880',
      '735729d9',
      '1032c6dc',
      '6b5b0f5d',
      '426c4948',
      'fd9f4c82',
      'fb4ed0eb',
      '339fa80c',
      '482fe828',
      '0aff6a9b',
    ])
    expect(companionResults.map(({ secondFinalHash }) => secondFinalHash)).toEqual([
      'adafc366',
      '95cc57a5',
      '221db998',
      'cfaae177',
      '82251a7b',
      '7c33c9e2',
      '6788847a',
      '54a78f22',
      '1041071c',
      '620a398c',
    ])
    expect(PLAYTEST_PROFILES.map((profile) =>
      runPairedReattainment(profile, 'solo'))).toEqual(soloResults)
    expect(PLAYTEST_PROFILES.map((profile) =>
      runPairedReattainment(profile, 'companion'))).toEqual(companionResults)
  })

  it('resumes a companion reattainment from the latest A/B checkpoint exactly', () => {
    const profile = PLAYTEST_PROFILES[0]!
    const uninterrupted = companionResults[0]!
    const storage = new MemoryStorage()

    const firstCommit = saveGameAtRevision(storage, uninterrupted.postPrestigeState, null)
    if (firstCommit.status !== 'saved') throw new Error('failed to write first A/B checkpoint')
    expect(firstCommit.revision).toBe(1)

    const paused = continueReattainmentExpedition(
      uninterrupted.postPrestigeState,
      profile,
      'companion',
      0,
      600,
    )
    expect(paused.reachedTarget).toBe(false)
    const secondCommit = saveGameAtRevision(storage, paused.finalState, firstCommit.revision)
    if (secondCommit.status !== 'saved') throw new Error('failed to write second A/B checkpoint')
    expect(secondCommit.revision).toBe(2)
    expect(storage.getItem(SAVE_SLOT_A_KEY)).not.toBeNull()
    expect(storage.getItem(SAVE_SLOT_B_KEY)).not.toBeNull()

    const loaded = bootstrapGame(storage, paused.finalState.lastSavedAt, 'reader')
    expect(loaded.revision).toBe(2)
    expect(loaded.offlineReport).toBeNull()
    expect(loaded.state).toEqual(paused.finalState)

    const resumed = continueReattainmentExpedition(
      loaded.state,
      profile,
      'companion',
      paused.elapsedSeconds,
    )
    expect(resumed.reachedTarget).toBe(true)
    expect(resumed.elapsedSeconds).toBe(uninterrupted.secondSeconds)
    expect(resumed.finalState.rng).toEqual(uninterrupted.secondFinalState.rng)
    expect(hashState(resumed.finalState)).toBe(uninterrupted.secondFinalHash)
    expect(resumed.finalState).toEqual(uninterrupted.secondFinalState)
  })

  it('applies the 4.2% essence effect at 0, 5, and safe-integer saturation', () => {
    expect(ESSENCE_STAT_BONUS_PER_POINT).toBe(0.042)

    const zeroEssence = createInitialState(0, 1)
    expect(getHeroStats(zeroEssence)).toMatchObject({ attack: 10, maxHp: 100 })

    const fiveEssence = structuredClone(zeroEssence)
    fiveEssence.player.essence = 5
    expect(getHeroStats(fiveEssence)).toMatchObject({ attack: 12, maxHp: 121 })

    const maximumEssence = structuredClone(zeroEssence)
    maximumEssence.player.essence = Number.MAX_SAFE_INTEGER
    const maximumStats = getHeroStats(maximumEssence)
    expect(maximumStats.maxHp).toBe(Number.MAX_SAFE_INTEGER)
    expect([maximumStats.attack, maximumStats.maxHp].every((value) =>
      Number.isSafeInteger(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER)).toBe(true)
  })
})

describe('IRPG-107 expedition choice balance matrix', () => {
  let matrix: ExpeditionChoiceMatrixRow[] = []

  beforeAll(() => {
    matrix = runExpeditionChoiceMatrix()
  }, 60_000)

  it('keeps four first-two choice plans inside the IRPG-204 and IRPG-206 KPIs', () => {
    expect(matrix).toHaveLength(EXPEDITION_CHOICE_PLANS.length * 2)

    const kpiSummary = matrix.map(({ planName, cohort, results }) => {
      const firstTimes = results.map(({ firstSeconds }) => firstSeconds)
      const ratios = results.map(({ ratioPercent }) => ratioPercent)
      return {
        planName,
        cohort,
        firstMedianSeconds: median(firstTimes),
        minimumRatio: Number(Math.min(...ratios).toFixed(4)),
        maximumRatio: Number(Math.max(...ratios).toFixed(4)),
      }
    })
    expect(kpiSummary).toEqual([
      { planName: 'gold-gold', cohort: 'solo', firstMedianSeconds: 2006.5, minimumRatio: 54.3562, maximumRatio: 66.6498 },
      { planName: 'gold-gold', cohort: 'companion', firstMedianSeconds: 1884, minimumRatio: 55.5556, maximumRatio: 69.1657 },
      { planName: 'gold-recovery', cohort: 'solo', firstMedianSeconds: 2013.5, minimumRatio: 56.8411, maximumRatio: 68.284 },
      { planName: 'gold-recovery', cohort: 'companion', firstMedianSeconds: 1863.5, minimumRatio: 57.3692, maximumRatio: 67.3877 },
      { planName: 'recovery-gold', cohort: 'solo', firstMedianSeconds: 2008, minimumRatio: 58.5112, maximumRatio: 69.3182 },
      { planName: 'recovery-gold', cohort: 'companion', firstMedianSeconds: 1865.5, minimumRatio: 57.3692, maximumRatio: 69.9886 },
      { planName: 'recovery-recovery', cohort: 'solo', firstMedianSeconds: 2008, minimumRatio: 58.5112, maximumRatio: 69.3182 },
      { planName: 'recovery-recovery', cohort: 'companion', firstMedianSeconds: 1886, minimumRatio: 60.3468, maximumRatio: 66.0584 },
    ])

    const ratioOutliers = matrix.flatMap(({ planName, cohort, results }) =>
      results
        .filter(({ ratioPercent }) => ratioPercent < 50 || ratioPercent > 70)
        .map(({
          name,
          firstSeconds,
          secondSeconds,
          ratioPercent,
          firstExpeditionApplications,
          secondExpeditionApplications,
        }) => ({
          planName,
          cohort,
          name,
          firstSeconds,
          secondSeconds,
          ratioPercent: Number(ratioPercent.toFixed(4)),
          firstExpeditionApplications,
          secondExpeditionApplications,
        })),
    )
    expect(ratioOutliers).toEqual([])

    for (const row of matrix) {
      expect(row.results).toHaveLength(PLAYTEST_PROFILES.length)
      const firstTimes = row.results.map(({ firstSeconds }) => firstSeconds)
      const ratios = row.results.map(({ ratioPercent }) => ratioPercent)

      expect(median(firstTimes)).toBeGreaterThanOrEqual(30 * 60)
      expect(median(firstTimes)).toBeLessThanOrEqual(45 * 60)
      expect(firstTimes.every((seconds) => seconds > 0 && seconds <= 60 * 60)).toBe(true)
      expect(row.results.every(({ secondSeconds }) =>
        secondSeconds > 0 && secondSeconds <= 60 * 60)).toBe(true)
      expect(ratios.every((ratio) => ratio >= 50 && ratio <= 70)).toBe(true)

      for (const result of row.results) {
        expect(result.firstExpeditionChoices).toBe(2)
        expect(result.secondExpeditionChoices).toBe(2)
        expect(result.expeditionChoiceRngUnchanged).toBe(true)
        expect(result.firstFinalState.expeditionEvents).toMatchObject({
          runPrestige: 0,
          milestoneMask: 7,
          overflowCount: 0,
        })
        expect(result.firstFinalState.expeditionEvents.pending).toHaveLength(1)
        expect(result.postPrestigeState.expeditionEvents).toEqual({
          definitionVersion: 1,
          runPrestige: 1,
          milestoneMask: 0,
          pending: [],
          overflowCount: 0,
        })
        expect(result.secondFinalState.expeditionEvents).toMatchObject({
          runPrestige: 1,
          milestoneMask: 7,
          overflowCount: 0,
        })
        expect(result.secondFinalState.expeditionEvents.pending).toHaveLength(1)
      }
    }

    for (const { name } of EXPEDITION_CHOICE_PLANS) {
      const planResults = matrix
        .filter(({ planName }) => planName === name)
        .flatMap(({ results }) => results)
      expect(planResults).toHaveLength(20)
      expect(planResults.every(({ firstSeconds, secondSeconds }) =>
        firstSeconds <= 60 * 60 && secondSeconds <= 60 * 60)).toBe(true)
    }
  })

  it('replays all 80 paired sessions with one canonical aggregate hash', () => {
    const canonicalSummary = summarizeExpeditionChoiceMatrix(matrix)
    const canonicalHash = hashValue(canonicalSummary)
    expect(canonicalHash).toBe('11a9a6cd')

    const replaySummary = summarizeExpeditionChoiceMatrix(runExpeditionChoiceMatrix())
    expect(hashValue(replaySummary)).toBe(canonicalHash)
    expect(replaySummary).toEqual(canonicalSummary)
  }, 60_000)
})
