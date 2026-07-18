import {
  COMBAT_ROUND_MS,
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
  getHeroStats,
  getPrestigeReward,
  getSkillPointCost,
  getUpgradeCost,
  getXpToNextLevel,
  isSkillUnlocked,
} from './formulas'
import { createRngState, nextRandom, seedFromText } from './rng'
import { SAVE_VERSION } from './types'
import type {
  AdvanceReport,
  AdvanceResult,
  CommandResult,
  GameState,
  SkillId,
  UpgradeId,
} from './types'

const emptyReport = (elapsedMs: number): AdvanceReport => ({
  elapsedMs,
  rounds: 0,
  criticalHits: 0,
  kills: 0,
  defeats: 0,
  goldEarned: 0,
  xpEarned: 0,
  levelsGained: 0,
  stagesGained: 0,
})

const cloneState = (state: GameState): GameState => ({
  ...state,
  rng: { ...state.rng },
  player: {
    ...state.player,
    upgrades: { ...state.player.upgrades },
    skills: { ...state.player.skills },
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
    },
    battle: {
      stage: 1,
      highestStage: 1,
      enemyHp: firstEnemy.maxHp,
      roundRemainderMs: 0,
      powerStrikeCooldownMs: 0,
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
  state.player.xp += amount
  report.xpEarned += amount

  let xpRequired = getXpToNextLevel(state.player.level)
  while (state.player.xp >= xpRequired && state.player.level < 999) {
    state.player.xp -= xpRequired
    state.player.level += 1
    state.player.skillPoints += 1
    report.levelsGained += 1
    xpRequired = getXpToNextLevel(state.player.level)
  }
}

function resolveRound(state: GameState, report: AdvanceReport) {
  const enemy = getEnemyDefinition(state.battle.stage)
  let hero = getHeroStats(state)
  state.player.currentHp = Math.min(state.player.currentHp, hero.maxHp)
  state.battle.powerStrikeCooldownMs = Math.max(
    0,
    state.battle.powerStrikeCooldownMs - COMBAT_ROUND_MS,
  )

  const usesPowerStrike =
    state.player.skills.powerStrike > 0 && state.battle.powerStrikeCooldownMs === 0
  const draw = nextRandom(state.rng)
  state.rng = draw.rng
  const isCritical = draw.value < CRITICAL_CHANCE
  const heroDamage = Math.max(
    1,
    Math.round(
      hero.attack *
        (usesPowerStrike ? hero.powerStrikeMultiplier : 1) *
        (isCritical ? CRITICAL_DAMAGE_MULTIPLIER : 1),
    ),
  )
  if (usesPowerStrike) state.battle.powerStrikeCooldownMs = 5_000
  if (isCritical) report.criticalHits += 1

  state.battle.enemyHp -= heroDamage
  report.rounds += 1

  if (state.battle.enemyHp <= 0) {
    const gold = Math.max(1, Math.round(enemy.goldReward * hero.goldMultiplier))
    state.player.gold = Math.min(Number.MAX_SAFE_INTEGER, state.player.gold + gold)
    state.stats.goldEarned = Math.min(Number.MAX_SAFE_INTEGER, state.stats.goldEarned + gold)
    state.battle.kills += 1
    state.stats.enemiesDefeated += 1
    report.kills += 1
    report.goldEarned += gold
    grantExperience(state, enemy.xpReward, report)

    const previousStage = state.battle.stage
    state.battle.stage = Math.min(MAX_STAGE, state.battle.stage + 1)
    state.battle.highestStage = Math.max(state.battle.highestStage, state.battle.stage)
    if (state.battle.stage > previousStage) report.stagesGained += 1

    hero = getHeroStats(state)
    state.player.currentHp = Math.min(
      hero.maxHp,
      state.player.currentHp + Math.round(hero.maxHp * 0.2),
    )
    state.battle.enemyHp = getEnemyDefinition(state.battle.stage).maxHp
    return
  }

  const enemyDamage = Math.max(1, enemy.attack - hero.defense)
  state.player.currentHp -= enemyDamage
  if (state.player.currentHp <= 0) {
    state.battle.defeats += 1
    report.defeats += 1
    state.battle.stage = Math.max(1, state.battle.stage - 1)
    state.battle.enemyHp = getEnemyDefinition(state.battle.stage).maxHp
    state.player.currentHp = getHeroStats(state).maxHp
    state.battle.powerStrikeCooldownMs = 0
  }
}

export function advanceGame(input: GameState, rawElapsedMs: number): AdvanceResult {
  const finiteElapsed = Number.isFinite(rawElapsedMs) ? Math.floor(rawElapsedMs) : 0
  const elapsedMs = Math.min(MAX_OFFLINE_MS, Math.max(0, finiteElapsed))
  const state = cloneState(input)
  const report = emptyReport(elapsedMs)
  const accumulatedMs = state.battle.roundRemainderMs + elapsedMs
  const rounds = Math.floor(accumulatedMs / COMBAT_ROUND_MS)
  state.battle.roundRemainderMs = accumulatedMs % COMBAT_ROUND_MS

  for (let index = 0; index < rounds; index += 1) {
    resolveRound(state, report)
  }

  return { state, report }
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

export function selectStage(input: GameState, rawStage: number): CommandResult {
  const stage = Math.floor(rawStage)
  if (stage < 1 || stage > input.battle.highestStage || stage > MAX_STAGE) {
    return { state: input, success: false, message: '아직 선택할 수 없는 스테이지입니다.' }
  }
  const state = cloneState(input)
  state.battle.stage = stage
  state.battle.enemyHp = getEnemyDefinition(stage).maxHp
  state.player.currentHp = getHeroStats(state).maxHp
  state.battle.powerStrikeCooldownMs = 0
  return { state, success: true, message: `${stage} 스테이지로 이동` }
}

export function performPrestige(input: GameState): CommandResult {
  if (input.battle.highestStage < PRESTIGE_STAGE) {
    return {
      state: input,
      success: false,
      message: `${PRESTIGE_STAGE} 스테이지부터 환생할 수 있습니다.`,
    }
  }

  const reward = getPrestigeReward(input.battle.highestStage)
  const state = createInitialState(input.lastSavedAt)
  state.rng = { ...input.rng }
  state.player.essence = input.player.essence + reward
  state.player.currentHp = getHeroStats(state).maxHp
  state.stats = {
    goldEarned: input.stats.goldEarned,
    enemiesDefeated: input.stats.enemiesDefeated,
    prestiges: input.stats.prestiges + 1,
  }
  return { state, success: true, message: `불씨 정수 ${reward}개를 획득했습니다.` }
}
