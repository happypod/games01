import { createInitialState } from '../game/engine'
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
  readonly ownerTicket: 'IRPG-506' | 'IRPG-408' | 'IRPG-409' | 'IRPG-410' | 'IRPG-411' | 'IRPG-412'
  readonly stage: 1 | 3 | 5 | 10 | 30 | 105
  readonly seedKey: string
  readonly canonicalHash: `fnv1a32-v1:${string}`
  readonly canonicalEventHash?: `fnv1a32-v1:${string}`
  readonly captureTarget: '.dashboard' | '.battle' | '.stage-map-panel' | '.progression-panels' | '.expedition-event-panel' | '.combat-log-panel' | '.combat-result-dialog'
  readonly failureRoute: 'none' | 'hero-and-enemy-corrupt' | 'cards-corrupt' | 'events-corrupt'
  readonly setupAction: 'none' | 'open-stage-map' | 'open-growth-cards' | 'open-expedition-events' | 'open-combat-log' | 'open-boss-victory-result' | 'open-defeat-result'
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
    canonicalHash: 'fnv1a32-v1:81143bec',
    captureTarget: '.dashboard',
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
    canonicalHash: 'fnv1a32-v1:9c0d00a1',
    captureTarget: '.battle',
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
    canonicalHash: 'fnv1a32-v1:b9b459fe',
    captureTarget: '.battle',
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
    canonicalHash: 'fnv1a32-v1:fda0f6fa',
    captureTarget: '.dashboard',
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
    canonicalHash: 'fnv1a32-v1:927ce627',
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
    canonicalHash: 'fnv1a32-v1:4fd4aca2',
    captureTarget: '.progression-panels',
    failureRoute: 'none',
    setupAction: 'open-growth-cards',
    variants: VISUAL_VARIANT_IDS,
  },
  'visual.cards.fallback': {
    id: 'visual.cards.fallback',
    label: '장비·스킬 fallback 상태',
    ownerTicket: 'IRPG-409',
    stage: 3,
    seedKey: 'irpg-506:visual.cards.fallback:v1',
    canonicalHash: 'fnv1a32-v1:2205d268',
    captureTarget: '.progression-panels',
    failureRoute: 'cards-corrupt',
    setupAction: 'open-growth-cards',
    variants: VISUAL_VARIANT_IDS,
  },
  'visual.events.pending-three': {
    id: 'visual.events.pending-three',
    label: '원정 이벤트 3종 대기 상태',
    ownerTicket: 'IRPG-412',
    stage: 30,
    seedKey: 'irpg-506:visual.events.pending-three:v1',
    canonicalHash: 'fnv1a32-v1:fd5059e1',
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
    canonicalHash: 'fnv1a32-v1:18b9b92d',
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
    canonicalHash: 'fnv1a32-v1:c78a61d4',
    canonicalEventHash: 'fnv1a32-v1:e0a7de25',
    captureTarget: '.combat-log-panel',
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
    canonicalHash: 'fnv1a32-v1:c1f94bec',
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
    canonicalHash: 'fnv1a32-v1:2d65716c',
    canonicalEventHash: 'fnv1a32-v1:492c61f7',
    captureTarget: '.combat-result-dialog',
    failureRoute: 'none',
    setupAction: 'open-defeat-result',
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

  return { nextCursor: '0', totalEvents: 0, events: [] }
}

export function isVisualFixtureId(value: string): value is VisualFixtureId {
  return VISUAL_FIXTURE_IDS.some((id) => id === value)
}

export function createVisualFixtureState(id: VisualFixtureId): GameState {
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
  const actualHash = hashVisualGameState(state)

  if (actualHash !== definition.canonicalHash) {
    throw new Error(
      `${definition.id} canonical hash mismatch: expected ${definition.canonicalHash}, received ${actualHash}`,
    )
  }

  return state
}
