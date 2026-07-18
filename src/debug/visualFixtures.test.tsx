import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getEnemyDefinition } from '../game/content'
import { seedFromText } from '../game/rng'
import type { GameState } from '../game/types'
import { DebugSessionApp } from './DebugSessionApp'
import {
  createVisualFixtureState,
  hashVisualGameState,
  VISUAL_FIXTURE_IDS,
  VISUAL_FIXTURE_NOW,
  VISUAL_FIXTURE_REGISTRY,
  VISUAL_FIXTURE_VARIANTS,
  VISUAL_VARIANT_IDS,
  type VisualFixtureId,
} from './visualFixtures'

const EXPECTED_FIXTURES = {
  'visual.combat.hero-default': {
    stage: 1,
    hash: 'fnv1a32-v1:3edb9452',
    seed: 1137774350,
  },
  'visual.combat.enemy-default': {
    stage: 5,
    hash: 'fnv1a32-v1:eab1e0bd',
    seed: 184967352,
  },
  'visual.combat.boss-default': {
    stage: 10,
    hash: 'fnv1a32-v1:b725d877',
    seed: 2839317265,
  },
  'visual.combat.fallback': {
    stage: 1,
    hash: 'fnv1a32-v1:026af434',
    seed: 847540328,
  },
  'visual.map.stage-frontier': {
    stage: 105,
    hash: 'fnv1a32-v1:f9a209ad',
    seed: 2652276946,
  },
  'visual.cards.mixed-states': {
    stage: 3,
    hash: 'fnv1a32-v1:ad431c22',
    seed: 2691896847,
  },
  'visual.cards.fallback': {
    stage: 3,
    hash: 'fnv1a32-v1:6e071ccc',
    seed: 1091907769,
  },
} as const

function reverseObjectKeys(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(reverseObjectKeys)

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .reverse()
      .map(([key, entry]) => [key, reverseObjectKeys(entry)]),
  )
}

describe('IRPG-506 named visual fixtures', () => {
  it('pins the fixture states and their canonical metadata', () => {
    expect(VISUAL_FIXTURE_IDS).toEqual(Object.keys(EXPECTED_FIXTURES))
    expect(VISUAL_FIXTURE_NOW).toBe(1_767_225_600_000)
    expect(VISUAL_FIXTURE_VARIANTS).toEqual([
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
    ])

    for (const id of VISUAL_FIXTURE_IDS) {
      const expected = EXPECTED_FIXTURES[id]
      const definition = VISUAL_FIXTURE_REGISTRY[id]
      const state = createVisualFixtureState(id)

      expect(definition).toMatchObject({
        id,
        ownerTicket: id === 'visual.map.stage-frontier'
          ? 'IRPG-408'
          : id.startsWith('visual.cards.')
            ? 'IRPG-409'
            : 'IRPG-506',
        stage: expected.stage,
        seedKey: `irpg-506:${id}:v1`,
        canonicalHash: expected.hash,
        variants: VISUAL_VARIANT_IDS,
      })
      expect(state).toMatchObject({
        lastSavedAt: VISUAL_FIXTURE_NOW,
        rng: {
          seed: expected.seed,
          state: expected.seed,
          draws: 0,
        },
        battle: {
          stage: expected.stage,
          highestStage: expected.stage,
          enemyHp: getEnemyDefinition(expected.stage).maxHp,
          roundRemainderMs: 0,
        },
      })
      expect(seedFromText(definition.seedKey)).toBe(expected.seed)
      expect(hashVisualGameState(state)).toBe(expected.hash)
    }

    expect(VISUAL_FIXTURE_REGISTRY['visual.combat.fallback'].failureRoute)
      .toBe('hero-and-enemy-corrupt')
    expect(VISUAL_FIXTURE_REGISTRY['visual.cards.fallback'].failureRoute)
      .toBe('cards-corrupt')
    expect(VISUAL_FIXTURE_REGISTRY['visual.cards.mixed-states']).toMatchObject({
      captureTarget: '.progression-panels',
      setupAction: 'open-growth-cards',
    })

    const cardState = createVisualFixtureState('visual.cards.mixed-states')
    expect(cardState.player).toMatchObject({
      level: 3,
      gold: 35,
      skillPoints: 1,
      currentHp: 316,
      upgrades: { weapon: 2, armor: 1, charm: 50 },
      skills: { powerStrike: 3, ironWill: 10, fortune: 0 },
    })
  })

  it('sorts every object level before hashing and returns fresh states', () => {
    const id: VisualFixtureId = 'visual.combat.enemy-default'
    const first = createVisualFixtureState(id)
    const reordered = reverseObjectKeys(first) as GameState

    expect(JSON.stringify(reordered)).not.toBe(JSON.stringify(first))
    expect(hashVisualGameState(reordered)).toBe(hashVisualGameState(first))

    first.player.gold = 999
    expect(hashVisualGameState(first)).not.toBe(VISUAL_FIXTURE_REGISTRY[id].canonicalHash)
    expect(createVisualFixtureState(id).player.gold).toBe(0)
  })
})

describe('IRPG-506 visual fixture UI adapter', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(VISUAL_FIXTURE_NOW)
    window.localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
    window.localStorage.clear()
  })

  it('applies a named fixture through the accessible isolated panel', () => {
    const onExit = vi.fn()
    const rawBefore = JSON.stringify({ ...window.localStorage })
    render(<DebugSessionApp onExit={onExit} />)

    const select = screen.getByLabelText('시각 회귀 fixture')
    expect(select).toHaveValue('visual.combat.hero-default')

    fireEvent.change(select, { target: { value: 'visual.combat.enemy-default' } })
    fireEvent.click(screen.getByRole('button', { name: 'fixture 적용' }))

    const root = screen.getByTestId('visual-fixture-root')
    const expected = EXPECTED_FIXTURES['visual.combat.enemy-default']
    expect(root).toHaveAttribute('data-visual-fixture-id', 'visual.combat.enemy-default')
    expect(root).toHaveAttribute('data-canonical-state-hash', expected.hash)
    expect(root).toHaveAttribute('data-expected-canonical-state-hash', expected.hash)
    expect(screen.getByTestId('visual-fixture-id')).toHaveTextContent(
      'visual.combat.enemy-default',
    )
    expect(screen.getByTestId('visual-fixture-hash')).toHaveTextContent(expected.hash)
    expect(screen.getByRole('region', { name: '스테이지 5' })).toBeVisible()
    expect(screen.getByText('일반 적 기본 · 스테이지 5 fixture를 적용했습니다.'))
      .toBeVisible()
    expect(JSON.stringify({ ...window.localStorage })).toBe(rawBefore)
    expect(onExit).not.toHaveBeenCalled()
  })
})
