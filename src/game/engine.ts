import {
  COMBAT_ROUND_MS,
  COMPANION_ATTACK_INTERVAL_MS,
  COMPANION_DEFINITIONS,
  CRITICAL_CHANCE,
  CRITICAL_DAMAGE_MULTIPLIER,
  MAX_OFFLINE_MS,
  MAX_STAGE,
  PRESTIGE_STAGE,
  SKILL_DEFINITIONS,
  UPGRADE_DEFINITIONS,
  getEnemyDefinition,
} from './content'
import {
  addSafeIntegers,
  getCompanionDamage,
  getCompanionTrainingCost,
  getHeroStats,
  getPrestigeReward,
  getSkillPointCost,
  getUpgradeCost,
  getXpToNextLevel,
  isCompanionUnlocked,
  isSkillUnlocked,
  toSafeInteger,
} from './formulas'
import {
  claimBossMilestone,
  getBossMilestoneReward,
  hasClaimedBossMilestone,
} from './bossMilestones'
import {
  createInitialExpeditionEventState,
  isValidExpeditionEventState,
  resolveReachedExpeditionMilestones,
} from './expedition'
import { createRngState, nextRandom, seedFromText } from './rng'
import {
  CAMP_STRUCTURE_MAX_LEVEL,
  CAMP_FOCUS_CRITICAL_BONUS,
  CAMP_GOLD_STEW_ROUNDS,
  CAMP_MERCHANT_OFFER_SLOTS,
  CAMP_MERCHANT_REFRESH_MS,
  CAMP_RECIPE_DEFINITIONS,
  CAMP_TRAINING_EFFECTS,
  getCampCraftDurationMs,
  getCampMaterialYield,
  getCampMerchantOfferCost,
  getCampMerchantOffers,
  getCampOfflineCapMs,
  getCampStructureUpgradeCost,
  getCampTrainingCost,
  getCampTrainingRankCap,
  getSeraTrustCost,
  createInitialCampState,
  type CampMerchantOfferSlot,
} from './camp'
import { CAMP_MATERIAL_IDS, SAVE_VERSION } from './types'
import type {
  AdvanceReport,
  AdvanceResult,
  CombatEvent,
  CombatEventBatch,
  CombatEventCursor,
  CombatEventSnapshot,
  BossMilestoneRewardSnapshot,
  CampConsumableId,
  CampRecipeId,
  CampStructureId,
  CampTrainingId,
  CompanionId,
  CommandResult,
  ExpeditionChoiceId,
  GameMode,
  GameState,
  SkillId,
  UpgradeId,
} from './types'

export const MAX_COMBAT_EVENTS = 100

const COMBAT_EVENT_ORDINAL = {
  skill: 10,
  critical: 20,
  companionAssist: 25,
  outcome: 30,
} as const

const COMBAT_EVENT_CURSOR_PATTERN = /^(0|[1-9]\d*)$/

interface MutableCombatEventBatch {
  totalEvents: number
  events: CombatEvent[]
}

interface RoundEventContext {
  roundSequence: CombatEventCursor
  rngState: number
  batch: MutableCombatEventBatch
}

function parseCombatEventCursor(cursor: CombatEventCursor): bigint {
  if (!COMBAT_EVENT_CURSOR_PATTERN.test(cursor)) {
    throw new RangeError('combat event cursor must be a canonical non-negative decimal string')
  }
  return BigInt(cursor)
}

function createCombatEventId(
  roundSequence: CombatEventCursor,
  rngState: number,
  ordinal: number,
  type: CombatEvent['type'],
): string {
  return `${roundSequence}:${rngState.toString(16).padStart(8, '0')}:${ordinal}:${type}`
}

function captureCombatEventSnapshot(state: GameState): CombatEventSnapshot {
  return {
    stage: state.battle.stage,
    highestStage: state.battle.highestStage,
    playerHp: Math.max(0, state.player.currentHp),
    enemyHp: Math.max(0, state.battle.enemyHp),
    gold: state.player.gold,
    xp: state.player.xp,
  }
}

function appendCombatEvent(batch: MutableCombatEventBatch, event: CombatEvent) {
  batch.totalEvents = addSafeIntegers(batch.totalEvents, 1)
  batch.events.push(event)
  if (batch.events.length > MAX_COMBAT_EVENTS) {
    batch.events.splice(0, batch.events.length - MAX_COMBAT_EVENTS)
  }
}

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`
  const entries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right))
  return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${stableSerialize(entry)}`).join(',')}}`
}

function compareCombatEvents(left: CombatEvent, right: CombatEvent): number {
  const roundComparison = parseCombatEventCursor(left.roundSequence) -
    parseCombatEventCursor(right.roundSequence)
  if (roundComparison !== 0n) return roundComparison < 0n ? -1 : 1
  return left.ordinal - right.ordinal
}

function validateCombatEventBatch(batch: CombatEventBatch) {
  const nextCursor = parseCombatEventCursor(batch.nextCursor)
  if (!Number.isSafeInteger(batch.totalEvents) || batch.totalEvents < batch.events.length) {
    throw new RangeError('combat event total must be a safe integer covering retained events')
  }
  for (const event of batch.events) {
    const roundSequence = parseCombatEventCursor(event.roundSequence)
    if (roundSequence > nextCursor) {
      throw new RangeError('combat event round cannot exceed its batch cursor')
    }
  }
}

export function mergeCombatEventBatches(
  left: CombatEventBatch,
  right: CombatEventBatch,
): CombatEventBatch {
  validateCombatEventBatch(left)
  validateCombatEventBatch(right)

  const eventsById = new Map<string, CombatEvent>()
  const idsByCoordinate = new Map<string, string>()
  for (const event of [...left.events, ...right.events]) {
    const coordinate = `${event.roundSequence}:${event.ordinal}`
    const coordinateId = idsByCoordinate.get(coordinate)
    if (coordinateId !== undefined && coordinateId !== event.id) {
      throw new Error(`combat event coordinate collision at ${coordinate}`)
    }

    const duplicate = eventsById.get(event.id)
    if (duplicate !== undefined && stableSerialize(duplicate) !== stableSerialize(event)) {
      throw new Error(`combat event payload collision for ${event.id}`)
    }

    idsByCoordinate.set(coordinate, event.id)
    if (duplicate === undefined) eventsById.set(event.id, event)
  }

  const events = [...eventsById.values()].sort(compareCombatEvents).slice(-MAX_COMBAT_EVENTS)
  const leftCursor = parseCombatEventCursor(left.nextCursor)
  const rightCursor = parseCombatEventCursor(right.nextCursor)
  return {
    nextCursor: (leftCursor > rightCursor ? leftCursor : rightCursor).toString(),
    totalEvents: addSafeIntegers(left.totalEvents, right.totalEvents),
    events,
  }
}

const emptyReport = (elapsedMs: number): AdvanceReport => ({
  elapsedMs,
  rounds: 0,
  criticalHits: 0,
  companionAttacks: 0,
  companionDamage: 0,
  kills: 0,
  defeats: 0,
  goldEarned: 0,
  xpEarned: 0,
  levelsGained: 0,
  stagesGained: 0,
})

const cloneState = (state: GameState): GameState => ({
  ...state,
  camp: {
    ...state.camp,
    structures: { ...state.camp.structures },
    training: { ...state.camp.training },
    materials: { ...state.camp.materials },
    consumables: { ...state.camp.consumables },
    craftJob: state.camp.craftJob === null ? null : { ...state.camp.craftJob },
    buffs: { ...state.camp.buffs },
    merchant: { ...state.camp.merchant },
    residents: {
      sera: { ...state.camp.residents.sera },
    },
  },
  expeditionEvents: {
    ...state.expeditionEvents,
    pending: state.expeditionEvents.pending.map((pending) => ({
      ...pending,
      resolvedChoices: pending.resolvedChoices.map((choice) => ({
        ...choice,
        effect: { ...choice.effect },
      })) as typeof pending.resolvedChoices,
    })),
  },
  rng: { ...state.rng },
  player: {
    ...state.player,
    upgrades: { ...state.player.upgrades },
    skills: { ...state.player.skills },
    companion: { ...state.player.companion },
  },
  battle: { ...state.battle },
  stats: { ...state.stats },
})

export function createInitialState(
  now = Date.now(),
  seed = seedFromText(`new-game:${now}`),
): GameState {
  const firstEnemy = getEnemyDefinition(1)
  return {
    schemaVersion: SAVE_VERSION,
    lastSavedAt: now,
    currentMode: 'BATTLE',
    camp: createInitialCampState(),
    claimedBossMilestoneMask: 0,
    expeditionEvents: createInitialExpeditionEventState(),
    rng: createRngState(seed),
    player: {
      level: 1,
      xp: 0,
      gold: 0,
      essence: 0,
      currentHp: 100,
      skillPoints: 0,
      upgrades: { weapon: 0, armor: 0, charm: 0 },
      skills: { powerStrike: 1, ironWill: 0, fortune: 0 },
      companion: { id: null, rank: 0 },
    },
    battle: {
      stage: 1,
      highestStage: 1,
      enemyHp: firstEnemy.maxHp,
      roundRemainderMs: 0,
      powerStrikeCooldownMs: 0,
      companionCooldownMs: 0,
      kills: 0,
      defeats: 0,
    },
    stats: {
      goldEarned: 0,
      enemiesDefeated: 0,
      prestiges: 0,
    },
  }
}

function grantExperience(state: GameState, amount: number, report: AdvanceReport) {
  state.player.xp = addSafeIntegers(state.player.xp, amount)
  report.xpEarned = addSafeIntegers(report.xpEarned, amount)

  let xpRequired = getXpToNextLevel(state.player.level)
  while (state.player.xp >= xpRequired && state.player.level < 999) {
    state.player.xp -= xpRequired
    state.player.level += 1
    state.player.skillPoints = addSafeIntegers(state.player.skillPoints, 1)
    report.levelsGained = addSafeIntegers(report.levelsGained, 1)
    xpRequired = getXpToNextLevel(state.player.level)
  }
}

function resolveEnemyDefeat(
  state: GameState,
  report: AdvanceReport,
  eventContext: RoundEventContext,
) {
  const enemy = getEnemyDefinition(state.battle.stage)
  const defeatedStage = state.battle.stage
  let hero = getHeroStats(state)
  const gold = toSafeInteger(enemy.goldReward * hero.goldMultiplier, 1)
  state.player.gold = addSafeIntegers(state.player.gold, gold)
  state.stats.goldEarned = addSafeIntegers(state.stats.goldEarned, gold)
  state.battle.kills = addSafeIntegers(state.battle.kills, 1)
  state.stats.enemiesDefeated = addSafeIntegers(state.stats.enemiesDefeated, 1)
  report.kills = addSafeIntegers(report.kills, 1)
  report.goldEarned = addSafeIntegers(report.goldEarned, gold)
  const materialYield = getCampMaterialYield(enemy)
  for (const id of CAMP_MATERIAL_IDS) {
    state.camp.materials[id] = addSafeIntegers(
      state.camp.materials[id],
      materialYield[id],
    )
  }

  let milestoneReward: BossMilestoneRewardSnapshot | null = null
  const configuredMilestone = enemy.isBoss ? getBossMilestoneReward(defeatedStage) : null
  if (
    configuredMilestone !== null &&
    !hasClaimedBossMilestone(state.claimedBossMilestoneMask, defeatedStage)
  ) {
    const goldBeforeMilestone = state.player.gold
    state.player.gold = addSafeIntegers(
      state.player.gold,
      configuredMilestone.configuredGold,
    )
    const appliedGold = state.player.gold - goldBeforeMilestone
    state.stats.goldEarned = addSafeIntegers(state.stats.goldEarned, appliedGold)
    report.goldEarned = addSafeIntegers(report.goldEarned, appliedGold)
    state.claimedBossMilestoneMask = claimBossMilestone(
      state.claimedBossMilestoneMask,
      defeatedStage,
    )
    milestoneReward = { ...configuredMilestone, appliedGold }
  }
  grantExperience(state, enemy.xpReward, report)

  const previousStage = state.battle.stage
  const previousHighestStage = state.battle.highestStage
  state.battle.stage = Math.min(MAX_STAGE, state.battle.stage + 1)
  state.battle.highestStage = Math.max(state.battle.highestStage, state.battle.stage)
  if (state.battle.stage > previousStage) {
    report.stagesGained = addSafeIntegers(report.stagesGained, 1)
  }

  hero = getHeroStats(state)
  state.expeditionEvents = resolveReachedExpeditionMilestones(
    state.expeditionEvents,
    state.rng.seed,
    previousHighestStage,
    state.battle.highestStage,
    hero.maxHp,
  )
  state.player.currentHp = Math.min(
    hero.maxHp,
    addSafeIntegers(state.player.currentHp, Math.round(hero.maxHp * 0.2)),
  )
  state.battle.enemyHp = getEnemyDefinition(state.battle.stage).maxHp

  const commonOutcome = {
    id: createCombatEventId(
      eventContext.roundSequence,
      eventContext.rngState,
      COMBAT_EVENT_ORDINAL.outcome,
      enemy.isBoss ? 'bossVictory' : 'kill',
    ),
    roundSequence: eventContext.roundSequence,
    ordinal: COMBAT_EVENT_ORDINAL.outcome,
    rngState: eventContext.rngState,
    stage: defeatedStage,
    defeatedStage,
    nextStage: state.battle.stage,
    gold,
    xp: enemy.xpReward,
    snapshot: captureCombatEventSnapshot(state),
  } as const
  appendCombatEvent(
    eventContext.batch,
    enemy.isBoss
      ? { ...commonOutcome, type: 'bossVictory', milestoneReward }
      : { ...commonOutcome, type: 'kill' },
  )
  if (enemy.isBoss && state.camp.buffs.bossFocusStage === defeatedStage) {
    state.camp.buffs.bossFocusStage = null
  }
}

function resolveCombatRound(
  state: GameState,
  report: AdvanceReport,
  roundSequence: CombatEventCursor,
  batch: MutableCombatEventBatch,
) {
  const enemy = getEnemyDefinition(state.battle.stage)
  if (enemy.isBoss && state.camp.buffs.bossFocusStage === 0) {
    state.camp.buffs.bossFocusStage = enemy.stage
  }
  const hero = getHeroStats(state)
  state.player.currentHp = Math.min(state.player.currentHp, hero.maxHp)
  state.battle.powerStrikeCooldownMs = Math.max(
    0,
    state.battle.powerStrikeCooldownMs - COMBAT_ROUND_MS,
  )
  state.battle.companionCooldownMs = state.player.companion.id === null
    ? 0
    : Math.max(0, state.battle.companionCooldownMs - COMBAT_ROUND_MS)

  const usesPowerStrike =
    state.player.skills.powerStrike > 0 && state.battle.powerStrikeCooldownMs === 0
  const draw = nextRandom(state.rng)
  state.rng = draw.rng
  const criticalChance = state.camp.buffs.bossFocusStage === enemy.stage
    ? CRITICAL_CHANCE + CAMP_FOCUS_CRITICAL_BONUS
    : CRITICAL_CHANCE
  const isCritical = draw.value < criticalChance
  const heroDamage = toSafeInteger(
    hero.attack *
      (usesPowerStrike ? hero.powerStrikeMultiplier : 1) *
      (isCritical ? CRITICAL_DAMAGE_MULTIPLIER : 1),
    1,
  )
  if (usesPowerStrike) state.battle.powerStrikeCooldownMs = 5_000
  if (isCritical) report.criticalHits = addSafeIntegers(report.criticalHits, 1)

  const enemyHpBeforeHeroAttack = state.battle.enemyHp
  state.battle.enemyHp -= heroDamage
  report.rounds = addSafeIntegers(report.rounds, 1)
  const appliedHeroDamage = Math.min(enemyHpBeforeHeroAttack, heroDamage)
  const eventContext: RoundEventContext = {
    roundSequence,
    rngState: state.rng.state,
    batch,
  }

  if (usesPowerStrike) {
    appendCombatEvent(batch, {
      id: createCombatEventId(
        roundSequence,
        eventContext.rngState,
        COMBAT_EVENT_ORDINAL.skill,
        'skill',
      ),
      type: 'skill',
      roundSequence,
      ordinal: COMBAT_EVENT_ORDINAL.skill,
      rngState: eventContext.rngState,
      stage: enemy.stage,
      skillId: 'powerStrike',
      damage: appliedHeroDamage,
      snapshot: captureCombatEventSnapshot(state),
    })
  }
  if (isCritical) {
    appendCombatEvent(batch, {
      id: createCombatEventId(
        roundSequence,
        eventContext.rngState,
        COMBAT_EVENT_ORDINAL.critical,
        'critical',
      ),
      type: 'critical',
      roundSequence,
      ordinal: COMBAT_EVENT_ORDINAL.critical,
      rngState: eventContext.rngState,
      stage: enemy.stage,
      damage: appliedHeroDamage,
      snapshot: captureCombatEventSnapshot(state),
    })
  }

  if (state.battle.enemyHp <= 0) {
    resolveEnemyDefeat(state, report, eventContext)
    return
  }

  if (state.player.companion.id !== null && state.battle.companionCooldownMs === 0) {
    const companionId = state.player.companion.id
    const companionDamage = getCompanionDamage(state)
    const appliedDamage = Math.min(state.battle.enemyHp, companionDamage)
    state.battle.enemyHp -= companionDamage
    state.battle.companionCooldownMs = COMPANION_ATTACK_INTERVAL_MS
    report.companionAttacks = addSafeIntegers(report.companionAttacks, 1)
    report.companionDamage = addSafeIntegers(report.companionDamage, appliedDamage)
    appendCombatEvent(batch, {
      id: createCombatEventId(
        roundSequence,
        eventContext.rngState,
        COMBAT_EVENT_ORDINAL.companionAssist,
        'companionAssist',
      ),
      type: 'companionAssist',
      roundSequence,
      ordinal: COMBAT_EVENT_ORDINAL.companionAssist,
      rngState: eventContext.rngState,
      stage: enemy.stage,
      companionId,
      damage: appliedDamage,
      snapshot: captureCombatEventSnapshot(state),
    })
  }

  if (state.battle.enemyHp <= 0) {
    resolveEnemyDefeat(state, report, eventContext)
    return
  }

  const enemyDamage = Math.max(1, enemy.attack - hero.defense)
  const appliedEnemyDamage = Math.min(state.player.currentHp, enemyDamage)
  state.player.currentHp -= enemyDamage
  if (state.player.currentHp <= 0) {
    const defeatedAtStage = state.battle.stage
    state.battle.defeats = addSafeIntegers(state.battle.defeats, 1)
    report.defeats = addSafeIntegers(report.defeats, 1)
    state.battle.stage = Math.max(1, state.battle.stage - 1)
    state.battle.enemyHp = getEnemyDefinition(state.battle.stage).maxHp
    state.player.currentHp = getHeroStats(state).maxHp
    state.battle.powerStrikeCooldownMs = 0
    state.battle.companionCooldownMs = 0
    appendCombatEvent(batch, {
      id: createCombatEventId(
        roundSequence,
        eventContext.rngState,
        COMBAT_EVENT_ORDINAL.outcome,
        'defeat',
      ),
      type: 'defeat',
      roundSequence,
      ordinal: COMBAT_EVENT_ORDINAL.outcome,
      rngState: eventContext.rngState,
      stage: defeatedAtStage,
      damage: appliedEnemyDamage,
      defeatedAtStage,
      returnStage: state.battle.stage,
      highestStage: state.battle.highestStage,
      snapshot: captureCombatEventSnapshot(state),
    })
    if (enemy.isBoss && state.camp.buffs.bossFocusStage === defeatedAtStage) {
      state.camp.buffs.bossFocusStage = null
    }
  }
}

function resolveRound(
  state: GameState,
  report: AdvanceReport,
  roundSequence: CombatEventCursor,
  batch: MutableCombatEventBatch,
) {
  resolveCombatRound(state, report, roundSequence, batch)
  if (state.camp.buffs.goldBoostRounds > 0) {
    state.camp.buffs.goldBoostRounds -= 1
  }
}

function advanceCampTimers(state: GameState, elapsedMs: number) {
  const job = state.camp.craftJob
  if (job !== null) {
    if (elapsedMs < job.remainingMs) {
      job.remainingMs -= elapsedMs
    } else {
      state.camp.consumables[job.recipeId] = addSafeIntegers(
        state.camp.consumables[job.recipeId],
        1,
      )
      state.camp.craftJob = null
    }
  }

  const merchant = state.camp.merchant
  if (elapsedMs < merchant.refreshRemainingMs) {
    merchant.refreshRemainingMs -= elapsedMs
    return
  }
  if (merchant.cycle === Number.MAX_SAFE_INTEGER) return
  const elapsedAfterRefresh = elapsedMs - merchant.refreshRemainingMs
  const additionalCycles = Math.floor(elapsedAfterRefresh / CAMP_MERCHANT_REFRESH_MS)
  const cycles = Math.min(
    Number.MAX_SAFE_INTEGER - merchant.cycle,
    1 + additionalCycles,
  )
  merchant.cycle += cycles
  if (merchant.cycle === Number.MAX_SAFE_INTEGER) {
    merchant.refreshRemainingMs = CAMP_MERCHANT_REFRESH_MS
    merchant.purchasedOfferMask = 0
    return
  }
  merchant.refreshRemainingMs = CAMP_MERCHANT_REFRESH_MS -
    (elapsedAfterRefresh % CAMP_MERCHANT_REFRESH_MS)
  merchant.purchasedOfferMask = 0
}

export function advanceGame(
  input: GameState,
  rawElapsedMs: number,
  startCursor: CombatEventCursor = '0',
): AdvanceResult {
  let cursor = parseCombatEventCursor(startCursor)
  const finiteElapsed = Number.isFinite(rawElapsedMs) ? Math.floor(rawElapsedMs) : 0
  const elapsedMs = Math.min(
    Math.max(MAX_OFFLINE_MS, getCampOfflineCapMs(input.camp)),
    Math.max(0, finiteElapsed),
  )
  const state = cloneState(input)
  const report = emptyReport(elapsedMs)
  advanceCampTimers(state, elapsedMs)
  if (state.currentMode === 'CAMP') {
    return {
      state,
      report,
      nextCursor: cursor.toString(),
      totalEvents: 0,
      events: [],
    }
  }
  const accumulatedMs = state.battle.roundRemainderMs + elapsedMs
  const rounds = Math.floor(accumulatedMs / COMBAT_ROUND_MS)
  state.battle.roundRemainderMs = accumulatedMs % COMBAT_ROUND_MS
  const eventBatch: MutableCombatEventBatch = { totalEvents: 0, events: [] }

  for (let index = 0; index < rounds; index += 1) {
    cursor += 1n
    resolveRound(state, report, cursor.toString(), eventBatch)
  }

  return {
    state,
    report,
    nextCursor: cursor.toString(),
    totalEvents: eventBatch.totalEvents,
    events: eventBatch.events,
  }
}

export function advanceOfflineGame(
  input: GameState,
  rawElapsedMs: number,
  startCursor: CombatEventCursor = '0',
): AdvanceResult {
  const result = advanceGame(
    input.currentMode === 'BATTLE' ? input : { ...input, currentMode: 'BATTLE' },
    rawElapsedMs,
    startCursor,
  )
  return input.currentMode === 'BATTLE'
    ? result
    : { ...result, state: { ...result.state, currentMode: input.currentMode } }
}

export function switchGameMode(input: GameState, mode: GameMode): CommandResult {
  if (input.currentMode === mode) {
    return {
      state: input,
      success: false,
      message: mode === 'CAMP' ? '이미 캠프에서 쉬고 있습니다.' : '이미 자동 전투 중입니다.',
    }
  }
  const state = cloneState(input)
  state.currentMode = mode
  return {
    state,
    success: true,
    message: mode === 'CAMP'
      ? '캠프에 진입했습니다. 화면을 보는 동안 자동 전투가 멈춥니다.'
      : '캠프를 떠나 자동 전투를 재개했습니다.',
  }
}

export function upgradeCampStructure(
  input: GameState,
  id: CampStructureId,
): CommandResult {
  if (input.currentMode !== 'CAMP') {
    return { state: input, success: false, message: '캠프에서만 시설을 확장할 수 있습니다.' }
  }
  const currentLevel = input.camp.structures[id]
  const cost = getCampStructureUpgradeCost(id, currentLevel)
  if (cost === null || currentLevel >= CAMP_STRUCTURE_MAX_LEVEL) {
    return { state: input, success: false, message: '이미 최고 시설 레벨입니다.' }
  }
  if (input.player.gold < cost) {
    return { state: input, success: false, message: `시설 확장에 골드 ${cost}이 필요합니다.` }
  }

  const state = cloneState(input)
  state.player.gold -= cost
  state.camp.structures[id] += 1
  return {
    state,
    success: true,
    message: `시설을 Lv.${state.camp.structures[id]}로 확장했습니다.`,
  }
}

export function trainAtCamp(
  input: GameState,
  id: CampTrainingId,
): CommandResult {
  if (input.currentMode !== 'CAMP') {
    return { state: input, success: false, message: '캠프 단련소에서만 영구 훈련할 수 있습니다.' }
  }
  const currentRank = input.camp.training[id]
  const rankCap = getCampTrainingRankCap(input.camp)
  if (currentRank >= rankCap) {
    return { state: input, success: false, message: '단련소를 확장해야 훈련을 계속할 수 있습니다.' }
  }
  const cost = getCampTrainingCost(id, currentRank)
  if (input.player.gold < cost) {
    return { state: input, success: false, message: `영구 훈련에 골드 ${cost}이 필요합니다.` }
  }

  const state = cloneState(input)
  const previousMaxHp = getHeroStats(state).maxHp
  state.player.gold -= cost
  state.camp.training[id] += 1
  if (id === 'vitality') {
    const gainedHp = getHeroStats(state).maxHp - previousMaxHp
    state.player.currentHp = Math.min(
      getHeroStats(state).maxHp,
      addSafeIntegers(state.player.currentHp, gainedHp),
    )
  }
  return {
    state,
    success: true,
    message: id === 'attack'
      ? `공격 훈련 완료 · 영구 공격력 +${CAMP_TRAINING_EFFECTS.attack}`
      : `체력 훈련 완료 · 영구 최대 체력 +${CAMP_TRAINING_EFFECTS.vitality}`,
  }
}

export function startCampCraft(
  input: GameState,
  recipeId: CampRecipeId,
): CommandResult {
  if (input.currentMode !== 'CAMP') {
    return { state: input, success: false, message: '캠프 작업대에서만 제작을 시작할 수 있습니다.' }
  }
  if (input.camp.craftJob !== null) {
    return { state: input, success: false, message: '작업대에서 이미 제작 중입니다.' }
  }
  const recipe = CAMP_RECIPE_DEFINITIONS[recipeId]
  for (const id of CAMP_MATERIAL_IDS) {
    if (input.camp.materials[id] < recipe.ingredients[id]) {
      return { state: input, success: false, message: `${recipe.name} 제작 재료가 부족합니다.` }
    }
  }

  const state = cloneState(input)
  for (const id of CAMP_MATERIAL_IDS) {
    state.camp.materials[id] -= recipe.ingredients[id]
  }
  state.camp.craftJob = {
    recipeId,
    remainingMs: getCampCraftDurationMs(state.camp, recipeId),
  }
  return { state, success: true, message: `${recipe.name} 제작을 시작했습니다.` }
}

export function consumeCampConsumable(
  input: GameState,
  id: CampConsumableId,
): CommandResult {
  if (input.currentMode !== 'CAMP') {
    return { state: input, success: false, message: '캠프에서만 전투 보급품을 준비할 수 있습니다.' }
  }
  if (input.camp.consumables[id] < 1) {
    return { state: input, success: false, message: '사용할 보급품이 없습니다.' }
  }
  if (id === 'goldStew' && input.camp.buffs.goldBoostRounds > 0) {
    return { state: input, success: false, message: '황금 스튜 효과가 이미 적용 중입니다.' }
  }
  if (id === 'focusTonic' && input.camp.buffs.bossFocusStage !== null) {
    return { state: input, success: false, message: '집중 물약 효과가 이미 준비되어 있습니다.' }
  }

  const state = cloneState(input)
  state.camp.consumables[id] -= 1
  if (id === 'goldStew') {
    state.camp.buffs.goldBoostRounds = CAMP_GOLD_STEW_ROUNDS
  } else {
    state.camp.buffs.bossFocusStage = 0
  }
  return {
    state,
    success: true,
    message: id === 'goldStew'
      ? '다음 1,800 전투 라운드의 골드 획득량이 50% 증가합니다.'
      : '다음 보스전의 치명타 확률이 35%로 준비되었습니다.',
  }
}

export function purchaseCampMerchantOffer(
  input: GameState,
  slot: CampMerchantOfferSlot,
): CommandResult {
  if (input.currentMode !== 'CAMP') {
    return { state: input, success: false, message: '캠프 상인에게서만 거래할 수 있습니다.' }
  }
  if (!CAMP_MERCHANT_OFFER_SLOTS.some((candidate) => candidate === slot)) {
    return { state: input, success: false, message: '존재하지 않는 상인 제안입니다.' }
  }
  const bit = 1 << slot
  if ((input.camp.merchant.purchasedOfferMask & bit) !== 0) {
    return { state: input, success: false, message: '이번 갱신에서 이미 받은 제안입니다.' }
  }
  const offer = getCampMerchantOffers(input.camp.merchant.cycle)[slot]
  if (offer.effect.type === 'rescueSera' && input.camp.residents.sera.status !== 'unmet') {
    return { state: input, success: false, message: '세라는 이미 안전한 캠프에 머물고 있습니다.' }
  }
  const cost = getCampMerchantOfferCost(input.camp, offer)
  if (input.player.gold < cost) {
    return { state: input, success: false, message: `상인 거래에 골드 ${cost}이 필요합니다.` }
  }

  const state = cloneState(input)
  state.player.gold -= cost
  state.camp.merchant.purchasedOfferMask |= bit
  if (offer.effect.type === 'material') {
    state.camp.materials[offer.effect.id] = addSafeIntegers(
      state.camp.materials[offer.effect.id],
      offer.effect.amount,
    )
  } else if (offer.effect.type === 'consumable') {
    state.camp.consumables[offer.effect.id] = addSafeIntegers(
      state.camp.consumables[offer.effect.id],
      offer.effect.amount,
    )
  } else {
    state.camp.residents.sera = { status: 'rescued', trust: 0 }
  }
  return { state, success: true, message: `${offer.name} 제안을 완료했습니다.` }
}

export function acceptSeraContract(input: GameState): CommandResult {
  if (input.currentMode !== 'CAMP') {
    return { state: input, success: false, message: '캠프에서만 동행 의사를 확인할 수 있습니다.' }
  }
  if (input.camp.residents.sera.status !== 'rescued') {
    return {
      state: input,
      success: false,
      message: input.camp.residents.sera.status === 'contracted'
        ? '세라와 이미 자발적 동행 계약을 맺었습니다.'
        : '먼저 구호대의 세라 구조 지원을 완료해야 합니다.',
    }
  }
  const state = cloneState(input)
  state.camp.residents.sera = { status: 'contracted', trust: 0 }
  return {
    state,
    success: true,
    message: '세라가 본인의 의사로 캠프 상점 조언 계약에 합류했습니다.',
  }
}

export function increaseSeraTrust(input: GameState): CommandResult {
  if (input.currentMode !== 'CAMP') {
    return { state: input, success: false, message: '캠프에서만 신뢰 활동을 진행할 수 있습니다.' }
  }
  const sera = input.camp.residents.sera
  if (sera.status !== 'contracted') {
    return { state: input, success: false, message: '자발적 동행 계약 뒤에 신뢰 활동을 시작할 수 있습니다.' }
  }
  const cost = getSeraTrustCost(sera.trust)
  if (cost === null) {
    return { state: input, success: false, message: '세라와의 신뢰가 이미 최고 단계입니다.' }
  }
  if (input.player.gold < cost) {
    return { state: input, success: false, message: `신뢰 활동에 골드 ${cost}이 필요합니다.` }
  }
  const state = cloneState(input)
  state.player.gold -= cost
  state.camp.residents.sera.trust += 1
  return {
    state,
    success: true,
    message: `세라 신뢰 ${state.camp.residents.sera.trust} · 상인 가격 ${state.camp.residents.sera.trust * 2}% 할인`,
  }
}

export function purchaseUpgrade(input: GameState, id: UpgradeId): CommandResult {
  const definition = UPGRADE_DEFINITIONS[id]
  const currentLevel = input.player.upgrades[id]
  if (currentLevel >= definition.maxLevel) {
    return { state: input, success: false, message: '이미 최대 단계입니다.' }
  }

  const cost = getUpgradeCost(id, currentLevel)
  if (input.player.gold < cost) {
    return { state: input, success: false, message: '골드가 부족합니다.' }
  }

  const state = cloneState(input)
  const previousMaxHp = getHeroStats(state).maxHp
  state.player.gold -= cost
  state.player.upgrades[id] += 1
  if (id === 'armor') {
    const nextMaxHp = getHeroStats(state).maxHp
    state.player.currentHp = Math.min(nextMaxHp, state.player.currentHp + nextMaxHp - previousMaxHp)
  }
  return { state, success: true, message: `${definition.name} 강화 완료` }
}

export function upgradeSkill(input: GameState, id: SkillId): CommandResult {
  const definition = SKILL_DEFINITIONS[id]
  const currentRank = input.player.skills[id]
  if (!isSkillUnlocked(input, id)) {
    return {
      state: input,
      success: false,
      message: `영웅 레벨 ${definition.unlockLevel}에 해금됩니다.`,
    }
  }
  if (currentRank >= definition.maxRank) {
    return { state: input, success: false, message: '이미 최대 랭크입니다.' }
  }

  const cost = getSkillPointCost(id, currentRank)
  if (input.player.skillPoints < cost) {
    return { state: input, success: false, message: '스킬 포인트가 부족합니다.' }
  }

  const state = cloneState(input)
  const previousMaxHp = getHeroStats(state).maxHp
  state.player.skillPoints -= cost
  state.player.skills[id] += 1
  if (id === 'ironWill') {
    const nextMaxHp = getHeroStats(state).maxHp
    state.player.currentHp = Math.min(nextMaxHp, state.player.currentHp + nextMaxHp - previousMaxHp)
  }
  return { state, success: true, message: `${definition.name} 랭크 상승` }
}

export function recruitCompanion(input: GameState, id: CompanionId): CommandResult {
  const definition = COMPANION_DEFINITIONS[id]
  if (input.player.companion.id !== null) {
    return { state: input, success: false, message: '이미 동료가 원정에 합류했습니다.' }
  }
  if (!isCompanionUnlocked(input, id)) {
    return {
      state: input,
      success: false,
      message: '첫 보스를 승리하고 스테이지 11을 열면 영입할 수 있습니다.',
    }
  }

  const state = cloneState(input)
  state.player.companion = { id, rank: 1 }
  state.battle.companionCooldownMs = 0
  return { state, success: true, message: `${definition.name}가 원정에 합류했습니다.` }
}

export function trainCompanion(input: GameState): CommandResult {
  const { id, rank } = input.player.companion
  if (id === null) {
    return { state: input, success: false, message: '먼저 동료를 영입해야 합니다.' }
  }
  const definition = COMPANION_DEFINITIONS[id]
  if (rank >= definition.maxRank) {
    return { state: input, success: false, message: '동료가 이미 최대 랭크입니다.' }
  }
  const cost = getCompanionTrainingCost(id, rank)
  if (input.player.gold < cost) {
    return { state: input, success: false, message: '동료 훈련에 필요한 골드가 부족합니다.' }
  }

  const state = cloneState(input)
  state.player.gold -= cost
  state.player.companion.rank += 1
  return { state, success: true, message: `${definition.name} 랭크 상승` }
}

export function selectStage(input: GameState, rawStage: number): CommandResult {
  const stage = Math.floor(rawStage)
  if (stage < 1 || stage > input.battle.highestStage || stage > MAX_STAGE) {
    return { state: input, success: false, message: '아직 선택할 수 없는 스테이지입니다.' }
  }
  const state = cloneState(input)
  if (
    state.camp.buffs.bossFocusStage !== null &&
    state.camp.buffs.bossFocusStage !== 0 &&
    state.camp.buffs.bossFocusStage !== stage
  ) {
    state.camp.buffs.bossFocusStage = null
  }
  state.battle.stage = stage
  state.battle.enemyHp = getEnemyDefinition(stage).maxHp
  state.player.currentHp = getHeroStats(state).maxHp
  state.battle.powerStrikeCooldownMs = 0
  return { state, success: true, message: `${stage} 스테이지로 이동` }
}

export function chooseExpeditionEvent(
  input: GameState,
  eventId: string,
  choiceId: ExpeditionChoiceId | string,
): CommandResult {
  if (
    !isValidExpeditionEventState(
      input.expeditionEvents,
      input.rng.seed,
      input.stats.prestiges,
      input.battle.highestStage,
    )
  ) {
    return { state: input, success: false, message: '원정 이벤트 데이터가 올바르지 않습니다.' }
  }

  const pendingIndex = input.expeditionEvents.pending.findIndex(
    (pending) => pending.eventId === eventId,
  )
  const pending = input.expeditionEvents.pending[pendingIndex]
  const choice = pending?.resolvedChoices.find(
    (resolvedChoice) => resolvedChoice.choiceId === choiceId,
  )
  if (pendingIndex < 0 || pending === undefined || choice === undefined) {
    return { state: input, success: false, message: '선택할 수 없는 원정 이벤트입니다.' }
  }

  const state = cloneState(input)
  if (choice.effect.type === 'grantGold') {
    const previousGold = state.player.gold
    state.player.gold = addSafeIntegers(state.player.gold, choice.effect.amount)
    const appliedGold = state.player.gold - previousGold
    state.stats.goldEarned = addSafeIntegers(state.stats.goldEarned, appliedGold)
  } else {
    const maxHp = getHeroStats(state).maxHp
    state.player.currentHp = Math.min(
      maxHp,
      addSafeIntegers(state.player.currentHp, choice.effect.amount),
    )
  }
  state.expeditionEvents = {
    ...state.expeditionEvents,
    pending: state.expeditionEvents.pending.filter((_, index) => index !== pendingIndex),
  }

  return { state, success: true, message: '원정 이벤트 선택을 적용했습니다.' }
}

export function performPrestige(input: GameState): CommandResult {
  if (input.battle.highestStage < PRESTIGE_STAGE) {
    return {
      state: input,
      success: false,
      message: `${PRESTIGE_STAGE} 스테이지부터 환생할 수 있습니다.`,
    }
  }

  if (input.stats.prestiges === Number.MAX_SAFE_INTEGER) {
    return {
      state: input,
      success: false,
      message: '환생 회차가 최대 안전 범위에 도달했습니다.',
    }
  }

  const reward = getPrestigeReward(input.battle.highestStage)
  const state = createInitialState(input.lastSavedAt)
  state.camp = cloneState(input).camp
  if (state.camp.buffs.bossFocusStage !== null && state.camp.buffs.bossFocusStage !== 0) {
    state.camp.buffs.bossFocusStage = null
  }
  state.claimedBossMilestoneMask = input.claimedBossMilestoneMask
  state.rng = { ...input.rng }
  state.player.essence = addSafeIntegers(input.player.essence, reward)
  state.player.companion = input.player.companion.id === null
    ? { id: null, rank: 0 }
    : { id: input.player.companion.id, rank: 1 }
  state.player.currentHp = getHeroStats(state).maxHp
  state.stats = {
    goldEarned: input.stats.goldEarned,
    enemiesDefeated: input.stats.enemiesDefeated,
    prestiges: addSafeIntegers(input.stats.prestiges, 1),
  }
  state.expeditionEvents = createInitialExpeditionEventState(state.stats.prestiges)
  const discardedEvents = input.expeditionEvents.pending.length
  const discardedMessage = discardedEvents > 0
    ? ` 대기 이벤트 ${discardedEvents}개를 보상 없이 폐기했습니다.`
    : ''
  return {
    state,
    success: true,
    message: `불씨 정수 ${reward}개를 획득했습니다.${discardedMessage}`,
  }
}
