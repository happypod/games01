import { createInitialState } from '../game/engine'
import { getEnemyDefinition } from '../game/content'
import { createExpeditionPendingEvent } from '../game/expedition'
import { getHeroStats } from '../game/formulas'
import { seedFromText } from '../game/rng'
import type {
  CombatEvent,
  CombatEventBatch,
  CombatEventSnapshot,
  GameState,
} from '../game/types'
import { setDebugStage } from './debugSession'

export const VISUAL_FIXTURE_NOW = Date.parse('2026-01-01T00:00:00.000Z')

export const VISUAL_FIXTURE_IDS = [
  'visual.combat.hero-default',
  'visual.combat.enemy-default',
  'visual.combat.boss-default',
  'visual.combat.fallback',
  'visual.map.stage-frontier',
  'visual.cards.mixed-states',
  'visual.cards.fallback',
  'visual.events.pending-three',
  'visual.events.fallback',
  'visual.combat.event-log',
  'visual.result.boss-victory',
  'visual.result.defeat',
  'visual.dashboard.one-view',
  'visual.dashboard.tactical-canvas',
  'visual.dashboard.tactical-damaged',
  'visual.dashboard.tactical-severe',
  'visual.events.tactical-overlay',
  'visual.camp.resting',
  'visual.camp.bond-synthesis-reward',
] as const

export type VisualFixtureId = (typeof VISUAL_FIXTURE_IDS)[number]

export const VISUAL_VARIANT_IDS = [
  'mobile-default',
  'mobile-reduced',
  'desktop-default',
  'desktop-reduced',
] as const

export type VisualVariantId = (typeof VISUAL_VARIANT_IDS)[number]

export interface VisualFixtureVariant {
  readonly id: VisualVariantId
  readonly viewport: {
    readonly width: 360 | 1440
    readonly height: 800 | 900
  }
  readonly motion: 'default' | 'reduced'
  readonly colorScheme: 'dark'
  readonly deviceScaleFactor: 1
}

export interface VisualFixtureDefinition {
  readonly id: VisualFixtureId
  readonly label: string
  readonly ownerTicket: 'IRPG-506' | 'IRPG-408' | 'IRPG-409' | 'IRPG-410' | 'IRPG-411' | 'IRPG-412' | 'IRPG-414' | 'IRPG-415' | 'IRPG-416' | 'IRPG-417' | 'IRPG-418' | 'IRPG-422' | 'IRPG-428'
  readonly stage: 1 | 3 | 5 | 10 | 20 | 30 | 105
  readonly seedKey: string
  readonly canonicalHash: `fnv1a32-v1:${string}`
  readonly canonicalEventHash?: `fnv1a32-v1:${string}`
  readonly captureTarget: '.tactical-layout' | '.tactical-canvas' | '.tactical-action-bar' | '.tactical-utility-dock__panel' | '.camp-dashboard' | '.camp-special-facilities' | '.bond-reward-backdrop' | '.stage-map-panel' | '.expedition-event-panel' | '.combat-result-dialog'
  readonly failureRoute: 'none' | 'hero-and-enemy-corrupt' | 'cards-corrupt' | 'events-corrupt'
  readonly setupAction: 'none' | 'open-stage-map' | 'assert-action-bar-assets' | 'open-expedition-events' | 'open-combat-log' | 'open-boss-victory-result' | 'open-defeat-result' | 'assert-tactical-surface' | 'open-bond-synthesis-reward'
  readonly variants: readonly VisualVariantId[]
}

export const VISUAL_FIXTURE_VARIANTS: readonly VisualFixtureVariant[] = [
  {
    id: 'mobile-default',
    viewport: { width: 360, height: 800 },
    motion: 'default',
    colorScheme: 'dark',
    deviceScaleFactor: 1,
  },
  {
    id: 'mobile-reduced',
    viewport: { width: 360, height: 800 },
    motion: 'reduced',
    colorScheme: 'dark',
    deviceScaleFactor: 1,
  },
  {
    id: 'desktop-default',
    viewport: { width: 1440, height: 900 },
    motion: 'default',
    colorScheme: 'dark',
    deviceScaleFactor: 1,
  },
  {
    id: 'desktop-reduced',
    viewport: { width: 1440, height: 900 },
    motion: 'reduced',
    colorScheme: 'dark',
    deviceScaleFactor: 1,
  },
]

export const VISUAL_FIXTURE_REGISTRY: Readonly<
  Record<VisualFixtureId, VisualFixtureDefinition>
> = {
  'visual.combat.hero-default': {
    id: 'visual.combat.hero-default',
    label: '영웅 기본 · 스테이지 1',
    ownerTicket: 'IRPG-506',
    stage: 1,
    seedKey: 'irpg-506:visual.combat.hero-default:v1',
    canonicalHash: 'fnv1a32-v1:0eac24f7',
    captureTarget: '.tactical-canvas',
    failureRoute: 'none',
    setupAction: 'none',
    variants: VISUAL_VARIANT_IDS,
  },
  'visual.combat.enemy-default': {
    id: 'visual.combat.enemy-default',
    label: '일반 적 기본 · 스테이지 5',
    ownerTicket: 'IRPG-506',
    stage: 5,
    seedKey: 'irpg-506:visual.combat.enemy-default:v1',
    canonicalHash: 'fnv1a32-v1:f7d195d4',
    captureTarget: '.tactical-canvas',
    failureRoute: 'none',
    setupAction: 'none',
    variants: VISUAL_VARIANT_IDS,
  },
  'visual.combat.boss-default': {
    id: 'visual.combat.boss-default',
    label: '보스 기본 · 스테이지 10',
    ownerTicket: 'IRPG-506',
    stage: 10,
    seedKey: 'irpg-506:visual.combat.boss-default:v1',
    canonicalHash: 'fnv1a32-v1:605b3cc5',
    captureTarget: '.tactical-canvas',
    failureRoute: 'none',
    setupAction: 'none',
    variants: VISUAL_VARIANT_IDS,
  },
  'visual.combat.fallback': {
    id: 'visual.combat.fallback',
    label: '영웅·적 fallback · 스테이지 1',
    ownerTicket: 'IRPG-506',
    stage: 1,
    seedKey: 'irpg-506:visual.combat.fallback:v1',
    canonicalHash: 'fnv1a32-v1:93765b49',
    captureTarget: '.tactical-canvas',
    failureRoute: 'hero-and-enemy-corrupt',
    setupAction: 'none',
    variants: VISUAL_VARIANT_IDS,
  },
  'visual.map.stage-frontier': {
    id: 'visual.map.stage-frontier',
    label: '3지역 지도 · 스테이지 105 최전선',
    ownerTicket: 'IRPG-408',
    stage: 105,
    seedKey: 'irpg-506:visual.map.stage-frontier:v1',
    canonicalHash: 'fnv1a32-v1:4fd6eb58',
    captureTarget: '.stage-map-panel',
    failureRoute: 'none',
    setupAction: 'open-stage-map',
    variants: VISUAL_VARIANT_IDS,
  },
  'visual.cards.mixed-states': {
    id: 'visual.cards.mixed-states',
    label: '장비·스킬 혼합 상태',
    ownerTicket: 'IRPG-409',
    stage: 3,
    seedKey: 'irpg-506:visual.cards.mixed-states:v1',
    canonicalHash: 'fnv1a32-v1:66c1b5df',
    captureTarget: '.tactical-action-bar',
    failureRoute: 'none',
    setupAction: 'assert-action-bar-assets',
    variants: VISUAL_VARIANT_IDS,
  },
  'visual.cards.fallback': {
    id: 'visual.cards.fallback',
    label: '장비·스킬 fallback 상태',
    ownerTicket: 'IRPG-409',
    stage: 3,
    seedKey: 'irpg-506:visual.cards.fallback:v1',
    canonicalHash: 'fnv1a32-v1:f4b369a1',
    captureTarget: '.tactical-action-bar',
    failureRoute: 'cards-corrupt',
    setupAction: 'assert-action-bar-assets',
    variants: VISUAL_VARIANT_IDS,
  },
  'visual.events.pending-three': {
    id: 'visual.events.pending-three',
    label: '원정 이벤트 3종 대기 상태',
    ownerTicket: 'IRPG-412',
    stage: 30,
    seedKey: 'irpg-506:visual.events.pending-three:v1',
    canonicalHash: 'fnv1a32-v1:a717ed48',
    captureTarget: '.expedition-event-panel',
    failureRoute: 'none',
    setupAction: 'open-expedition-events',
    variants: VISUAL_VARIANT_IDS,
  },
  'visual.events.fallback': {
    id: 'visual.events.fallback',
    label: '원정 이벤트 이미지 fallback 상태',
    ownerTicket: 'IRPG-412',
    stage: 30,
    seedKey: 'irpg-506:visual.events.fallback:v1',
    canonicalHash: 'fnv1a32-v1:c13422cc',
    captureTarget: '.expedition-event-panel',
    failureRoute: 'events-corrupt',
    setupAction: 'open-expedition-events',
    variants: VISUAL_VARIANT_IDS,
  },
  'visual.combat.event-log': {
    id: 'visual.combat.event-log',
    label: '최근 전투 이벤트 6종 로그',
    ownerTicket: 'IRPG-411',
    stage: 10,
    seedKey: 'irpg-506:visual.combat.event-log:v1',
    canonicalHash: 'fnv1a32-v1:daa9c233',
    canonicalEventHash: 'fnv1a32-v1:e0a7de25',
    captureTarget: '.tactical-utility-dock__panel',
    failureRoute: 'none',
    setupAction: 'open-combat-log',
    variants: VISUAL_VARIANT_IDS,
  },
  'visual.result.boss-victory': {
    id: 'visual.result.boss-victory',
    label: '보스 승리 보상 결과',
    ownerTicket: 'IRPG-410',
    stage: 10,
    seedKey: 'irpg-506:visual.result.boss-victory:v1',
    canonicalHash: 'fnv1a32-v1:4ffaa837',
    canonicalEventHash: 'fnv1a32-v1:b6a6c062',
    captureTarget: '.combat-result-dialog',
    failureRoute: 'none',
    setupAction: 'open-boss-victory-result',
    variants: VISUAL_VARIANT_IDS,
  },
  'visual.result.defeat': {
    id: 'visual.result.defeat',
    label: '원정 패배 결과',
    ownerTicket: 'IRPG-410',
    stage: 10,
    seedKey: 'irpg-506:visual.result.defeat:v1',
    canonicalHash: 'fnv1a32-v1:dd04ef33',
    canonicalEventHash: 'fnv1a32-v1:492c61f7',
    captureTarget: '.combat-result-dialog',
    failureRoute: 'none',
    setupAction: 'open-defeat-result',
    variants: VISUAL_VARIANT_IDS,
  },
  'visual.dashboard.one-view': {
    id: 'visual.dashboard.one-view',
    label: '전술 명령 원 뷰 · 스테이지 10',
    ownerTicket: 'IRPG-422',
    stage: 10,
    seedKey: 'irpg-414:visual.dashboard.one-view:v1',
    canonicalHash: 'fnv1a32-v1:d5945218',
    canonicalEventHash: 'fnv1a32-v1:aa4f41fb',
    captureTarget: '.tactical-layout',
    failureRoute: 'none',
    setupAction: 'none',
    variants: VISUAL_VARIANT_IDS,
  },
  'visual.dashboard.tactical-canvas': {
    id: 'visual.dashboard.tactical-canvas',
    label: '통합 전술 캔버스 · 스테이지 10',
    ownerTicket: 'IRPG-415',
    stage: 10,
    seedKey: 'irpg-415:visual.dashboard.tactical-canvas:v1',
    canonicalHash: 'fnv1a32-v1:d9ecb816',
    canonicalEventHash: 'fnv1a32-v1:c306eb11',
    captureTarget: '.tactical-canvas',
    failureRoute: 'none',
    setupAction: 'assert-tactical-surface',
    variants: VISUAL_VARIANT_IDS,
  },
  'visual.dashboard.tactical-damaged': {
    id: 'visual.dashboard.tactical-damaged',
    label: '전술 캔버스 · 월식 기사 손상',
    ownerTicket: 'IRPG-416',
    stage: 20,
    seedKey: 'irpg-416:visual.dashboard.tactical-damaged:v1',
    canonicalHash: 'fnv1a32-v1:f5217a5d',
    captureTarget: '.tactical-canvas',
    failureRoute: 'none',
    setupAction: 'assert-tactical-surface',
    variants: VISUAL_VARIANT_IDS,
  },
  'visual.dashboard.tactical-severe': {
    id: 'visual.dashboard.tactical-severe',
    label: '전술 캔버스 · 월식 기사 심각 손상',
    ownerTicket: 'IRPG-416',
    stage: 20,
    seedKey: 'irpg-416:visual.dashboard.tactical-severe:v1',
    canonicalHash: 'fnv1a32-v1:69b446bd',
    captureTarget: '.tactical-canvas',
    failureRoute: 'none',
    setupAction: 'assert-tactical-surface',
    variants: VISUAL_VARIANT_IDS,
  },
  'visual.events.tactical-overlay': {
    id: 'visual.events.tactical-overlay',
    label: '통합 전술 원정 대기 · 전장 우선 노출',
    ownerTicket: 'IRPG-417',
    stage: 30,
    seedKey: 'irpg-415:visual.events.tactical-overlay:v1',
    canonicalHash: 'fnv1a32-v1:1a37d40c',
    canonicalEventHash: 'fnv1a32-v1:15091bd6',
    captureTarget: '.tactical-canvas',
    failureRoute: 'none',
    setupAction: 'assert-tactical-surface',
    variants: VISUAL_VARIANT_IDS,
  },
  'visual.camp.resting': {
    id: 'visual.camp.resting',
    label: '캠프 휴식 · 전경 전투 정지',
    ownerTicket: 'IRPG-418',
    stage: 10,
    seedKey: 'irpg-418:visual.camp.resting:v1',
    canonicalHash: 'fnv1a32-v1:a02864a1',
    captureTarget: '.camp-dashboard',
    failureRoute: 'none',
    setupAction: 'none',
    variants: VISUAL_VARIANT_IDS,
  },
  'visual.camp.bond-synthesis-reward': {
    id: 'visual.camp.bond-synthesis-reward',
    label: 'CHAPTER I 합동 연성 · 보상 확정',
    ownerTicket: 'IRPG-428',
    stage: 10,
    seedKey: 'irpg-428:visual.camp.bond-synthesis-reward:v1',
    canonicalHash: 'fnv1a32-v1:6248249c',
    captureTarget: '.bond-reward-backdrop',
    failureRoute: 'none',
    setupAction: 'open-bond-synthesis-reward',
    variants: VISUAL_VARIANT_IDS,
  },
}

function canonicalStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    const serialized = JSON.stringify(value)
    if (serialized === undefined) throw new TypeError('visual state must be JSON-serializable')
    return serialized
  }
  if (Array.isArray(value)) return `[${value.map(canonicalStringify).join(',')}]`

  const record = value as Record<string, unknown>
  const entries = Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalStringify(record[key])}`)
  return `{${entries.join(',')}}`
}

export function hashVisualGameState(state: GameState): `fnv1a32-v1:${string}` {
  let hash = 0x811c9dc5
  for (const character of canonicalStringify(state)) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 0x01000193)
  }
  return `fnv1a32-v1:${(hash >>> 0).toString(16).padStart(8, '0')}`
}

export function hashVisualCombatEventBatch(
  batch: CombatEventBatch,
): `fnv1a32-v1:${string}` {
  let hash = 0x811c9dc5
  for (const character of canonicalStringify(batch)) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 0x01000193)
  }
  return `fnv1a32-v1:${(hash >>> 0).toString(16).padStart(8, '0')}`
}

function createVisualCombatEvent(
  round: number,
  ordinal: 10 | 20 | 25 | 30,
  type: CombatEvent['type'],
): CombatEvent {
  const stage = type === 'kill' ? 9 : 10
  const snapshot: CombatEventSnapshot = {
    stage: type === 'kill' || type === 'bossVictory' ? stage + 1 : type === 'defeat' ? 9 : stage,
    highestStage: 11,
    playerHp: type === 'defeat' ? 318 : 342,
    enemyHp: type === 'kill' || type === 'bossVictory' ? 180 : type === 'defeat' ? 96 : 48,
    gold: 1_240 + round,
    xp: 72,
  }
  const base = {
    id: `visual-log-${round}-${ordinal}-${type}`,
    roundSequence: String(round),
    ordinal,
    rngState: 0x4110_0000 + round,
    stage,
    snapshot,
  }
  if (type === 'skill') {
    return { ...base, type, ordinal: 10, skillId: 'powerStrike', damage: 84 + round }
  }
  if (type === 'critical') return { ...base, type, ordinal: 20, damage: 126 + round }
  if (type === 'companionAssist') {
    return { ...base, type, ordinal: 25, companionId: 'emberFox', damage: 63 + round }
  }
  if (type === 'kill' || type === 'bossVictory') {
    const outcome = {
      ...base,
      ordinal: 30,
      defeatedStage: stage,
      nextStage: stage + 1,
      gold: type === 'bossVictory' ? 240 : 82,
      xp: type === 'bossVictory' ? 120 : 44,
    } as const
    return type === 'bossVictory'
      ? { ...outcome, type, milestoneReward: null }
      : { ...outcome, type }
  }
  return {
    ...base,
    type: 'defeat',
    ordinal: 30,
    damage: 96,
    defeatedAtStage: 10,
    returnStage: 9,
    highestStage: 11,
  }
}

export function createVisualFixtureCombatEventBatch(id: VisualFixtureId): CombatEventBatch {
  if (id === 'visual.result.boss-victory') {
    const event: CombatEvent = {
      id: 'visual-result-boss-victory-51-30',
      type: 'bossVictory',
      roundSequence: '51',
      ordinal: 30,
      rngState: 0x4100_0051,
      stage: 10,
      defeatedStage: 10,
      nextStage: 11,
      gold: 240,
      xp: 120,
      milestoneReward: {
        tableId: 'boss-milestone-v1',
        kind: 'gold',
        milestoneStage: 10,
        configuredGold: 15,
        appliedGold: 15,
      },
      snapshot: {
        stage: 11,
        highestStage: 11,
        playerHp: 342,
        enemyHp: 180,
        gold: 1_495,
        xp: 120,
      },
    }
    return { nextCursor: '51', totalEvents: 1, events: [event] }
  }

  if (id === 'visual.result.defeat') {
    const event: CombatEvent = {
      id: 'visual-result-defeat-52-30',
      type: 'defeat',
      roundSequence: '52',
      ordinal: 30,
      rngState: 0x4100_0052,
      stage: 10,
      damage: 96,
      defeatedAtStage: 10,
      returnStage: 9,
      highestStage: 11,
      snapshot: {
        stage: 9,
        highestStage: 11,
        playerHp: 318,
        enemyHp: 96,
        gold: 1_240,
        xp: 72,
      },
    }
    return { nextCursor: '52', totalEvents: 1, events: [event] }
  }

  if (id === 'visual.combat.event-log') {
    const outcomeTypes = ['kill', 'bossVictory', 'defeat'] as const
    const events = Array.from({ length: 6 }, (_, index) => {
      const round = 41 + index
      return [
        createVisualCombatEvent(round, 10, 'skill'),
        createVisualCombatEvent(round, 20, 'critical'),
        createVisualCombatEvent(round, 25, 'companionAssist'),
        createVisualCombatEvent(round, 30, outcomeTypes[index % outcomeTypes.length]!),
      ]
    }).flat()
    return { nextCursor: '46', totalEvents: events.length, events }
  }

  if (id === 'visual.dashboard.one-view' || id === 'visual.dashboard.tactical-canvas') {
    const outcomeTypes = ['kill', 'bossVictory', 'defeat'] as const
    const firstRound = id === 'visual.dashboard.one-view' ? 61 : 71
    const events = Array.from({ length: 3 }, (_, index) => {
      const round = firstRound + index
      return [
        createVisualCombatEvent(round, 10, 'skill'),
        createVisualCombatEvent(round, 20, 'critical'),
        createVisualCombatEvent(round, 25, 'companionAssist'),
        createVisualCombatEvent(round, 30, outcomeTypes[index]!),
      ]
    }).flat()
    return {
      nextCursor: String(firstRound + 2),
      totalEvents: events.length,
      events,
    }
  }

  return { nextCursor: '0', totalEvents: 0, events: [] }
}

export function isVisualFixtureId(value: string): value is VisualFixtureId {
  return VISUAL_FIXTURE_IDS.some((id) => id === value)
}

export function buildUncheckedVisualFixtureState(id: VisualFixtureId): GameState {
  const definition = VISUAL_FIXTURE_REGISTRY[id]
  const seed = seedFromText(definition.seedKey)
  const initial = createInitialState(VISUAL_FIXTURE_NOW, seed)
  let state = definition.stage === 1
    ? initial
    : setDebugStage(initial, definition.stage)
  if (id === 'visual.cards.mixed-states' || id === 'visual.cards.fallback') {
    state = {
      ...state,
      player: {
        ...state.player,
        level: 3,
        xp: 0,
        gold: 35,
        skillPoints: 1,
        upgrades: { weapon: 2, armor: 1, charm: 50 },
        skills: { powerStrike: 3, ironWill: 10, fortune: 0 },
      },
    }
    state = {
      ...state,
      player: { ...state.player, currentHp: getHeroStats(state).maxHp },
    }
  }
  if (id === 'visual.events.pending-three' || id === 'visual.events.fallback') {
    const maxHpAtOffer = getHeroStats(state).maxHp
    state = {
      ...state,
      expeditionEvents: {
        ...state.expeditionEvents,
        pending: [0, 1, 2].map((milestoneIndex) =>
          createExpeditionPendingEvent(
            state.rng.seed,
            state.stats.prestiges,
            milestoneIndex,
            maxHpAtOffer,
          ),
        ),
        overflowCount: 0,
      },
    }
  }
  const isTacticalDamageFixture =
    id === 'visual.dashboard.tactical-damaged' ||
    id === 'visual.dashboard.tactical-severe'
  const isCampFixture = id === 'visual.camp.resting' ||
    id === 'visual.camp.bond-synthesis-reward'
  if (
    id === 'visual.dashboard.one-view' ||
    id === 'visual.dashboard.tactical-canvas' ||
    isTacticalDamageFixture ||
    isCampFixture
  ) {
    state = {
      ...state,
      claimedBossMilestoneMask: 1,
      player: {
        ...state.player,
        level: 8,
        xp: 72,
        gold: 860,
        essence: 12,
        skillPoints: 2,
        upgrades: { weapon: 4, armor: 3, charm: 2 },
        skills: { powerStrike: 2, ironWill: 1, fortune: 1 },
        companion: { id: 'emberFox', rank: 2 },
      },
      battle: {
        ...state.battle,
        highestStage: isTacticalDamageFixture ? 20 : 11,
        powerStrikeCooldownMs: 1_000,
        companionCooldownMs: 2_000,
        kills: 18,
        defeats: 2,
      },
      stats: {
        goldEarned: 4_200,
        enemiesDefeated: 42,
        prestiges: 0,
      },
    }
    const maxHpAtOffer = getHeroStats(state).maxHp
    state = {
      ...state,
      player: {
        ...state.player,
        currentHp: Math.floor(maxHpAtOffer * 0.82),
      },
      expeditionEvents: {
        ...state.expeditionEvents,
        milestoneMask: 1,
        pending: id === 'visual.dashboard.one-view'
          ? [createExpeditionPendingEvent(
            state.rng.seed,
            state.stats.prestiges,
            0,
            maxHpAtOffer,
          )]
          : [],
        overflowCount: 0,
      },
    }
  }
  if (isTacticalDamageFixture) {
    const enemy = getEnemyDefinition(state.battle.stage)
    state = {
      ...state,
      battle: {
        ...state.battle,
        enemyHp: Math.floor(
          enemy.maxHp * (id === 'visual.dashboard.tactical-damaged' ? 0.5 : 0.15),
        ),
      },
    }
  }
  if (isCampFixture) {
    state = {
      ...state,
      currentMode: 'CAMP',
    }
  }
  if (id === 'visual.camp.bond-synthesis-reward') {
    state = {
      ...state,
      player: {
        ...state.player,
        gold: 2_000,
      },
      camp: {
        ...state.camp,
        materials: { ashShard: 12, beastHide: 6, emberCore: 1 },
        residents: {
          ...state.camp.residents,
          sera: { status: 'contracted', trust: 3 },
        },
        bond: {
          ...state.camp.bond,
          adultAccessConfirmed: true,
          seraConsent: 'granted',
        },
      },
    }
  }
  if (id === 'visual.events.tactical-overlay') {
    const maxHpAtOffer = getHeroStats(state).maxHp
    state = {
      ...state,
      expeditionEvents: {
        ...state.expeditionEvents,
        pending: [0, 1, 2].map((milestoneIndex) =>
          createExpeditionPendingEvent(
            state.rng.seed,
            state.stats.prestiges,
            milestoneIndex,
            maxHpAtOffer,
          ),
        ),
        overflowCount: 0,
      },
    }
  }
  return state
}

export function createVisualFixtureState(id: VisualFixtureId): GameState {
  const definition = VISUAL_FIXTURE_REGISTRY[id]
  const state = buildUncheckedVisualFixtureState(id)
  const actualHash = hashVisualGameState(state)

  if (actualHash !== definition.canonicalHash) {
    throw new Error(
      `${definition.id} canonical hash mismatch: expected ${definition.canonicalHash}, received ${actualHash}`,
    )
  }

  return state
}
