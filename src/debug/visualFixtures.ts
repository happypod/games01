import { createInitialState } from '../game/engine'
import { seedFromText } from '../game/rng'
import type { GameState } from '../game/types'
import { setDebugStage } from './debugSession'

export const VISUAL_FIXTURE_NOW = Date.parse('2026-01-01T00:00:00.000Z')

export const VISUAL_FIXTURE_IDS = [
  'visual.combat.hero-default',
  'visual.combat.enemy-default',
  'visual.combat.boss-default',
  'visual.combat.fallback',
  'visual.map.stage-frontier',
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
  readonly ownerTicket: 'IRPG-506' | 'IRPG-408'
  readonly stage: 1 | 5 | 10 | 105
  readonly seedKey: string
  readonly canonicalHash: `fnv1a32-v1:${string}`
  readonly captureTarget: '.dashboard' | '.battle' | '.stage-map-panel'
  readonly failureRoute: 'none' | 'hero-and-enemy-corrupt'
  readonly setupAction: 'none' | 'open-stage-map'
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
    canonicalHash: 'fnv1a32-v1:3edb9452',
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
    canonicalHash: 'fnv1a32-v1:eab1e0bd',
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
    canonicalHash: 'fnv1a32-v1:b725d877',
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
    canonicalHash: 'fnv1a32-v1:026af434',
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
    canonicalHash: 'fnv1a32-v1:f9a209ad',
    captureTarget: '.stage-map-panel',
    failureRoute: 'none',
    setupAction: 'open-stage-map',
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

export function isVisualFixtureId(value: string): value is VisualFixtureId {
  return VISUAL_FIXTURE_IDS.some((id) => id === value)
}

export function createVisualFixtureState(id: VisualFixtureId): GameState {
  const definition = VISUAL_FIXTURE_REGISTRY[id]
  const seed = seedFromText(definition.seedKey)
  const initial = createInitialState(VISUAL_FIXTURE_NOW, seed)
  const state = definition.stage === 1
    ? initial
    : setDebugStage(initial, definition.stage)
  const actualHash = hashVisualGameState(state)

  if (actualHash !== definition.canonicalHash) {
    throw new Error(
      `${definition.id} canonical hash mismatch: expected ${definition.canonicalHash}, received ${actualHash}`,
    )
  }

  return state
}
