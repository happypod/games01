import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getEnemyDefinition } from '../game/content'
import { getHeroStats } from '../game/formulas'
import { seedFromText } from '../game/rng'
import type { GameState } from '../game/types'
import { DebugSessionApp } from './DebugSessionApp'
import {
  createVisualFixtureCombatEventBatch,
  createVisualFixtureState,
  hashVisualCombatEventBatch,
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
    hash: 'fnv1a32-v1:173f7ed1',
    seed: 1137774350,
  },
  'visual.combat.enemy-default': {
    stage: 5,
    hash: 'fnv1a32-v1:b35df990',
    seed: 184967352,
  },
  'visual.combat.boss-default': {
    stage: 10,
    hash: 'fnv1a32-v1:96c283ab',
    seed: 2839317265,
  },
  'visual.combat.fallback': {
    stage: 1,
    hash: 'fnv1a32-v1:6ca0199b',
    seed: 847540328,
  },
  'visual.map.stage-frontier': {
    stage: 105,
    hash: 'fnv1a32-v1:5aba4e1a',
    seed: 2652276946,
  },
  'visual.cards.mixed-states': {
    stage: 3,
    hash: 'fnv1a32-v1:2bb88fcb',
    seed: 2691896847,
  },
  'visual.cards.fallback': {
    stage: 3,
    hash: 'fnv1a32-v1:8ae4f1e5',
    seed: 1091907769,
  },
  'visual.events.pending-three': {
    stage: 30,
    hash: 'fnv1a32-v1:f0f95ff0',
    seed: 1635907649,
  },
  'visual.events.fallback': {
    stage: 30,
    hash: 'fnv1a32-v1:cb85638c',
    seed: 3134554997,
  },
  'visual.combat.event-log': {
    stage: 10,
    hash: 'fnv1a32-v1:bd740bd5',
    seed: 4251790753,
  },
  'visual.result.boss-victory': {
    stage: 10,
    hash: 'fnv1a32-v1:4646250d',
    seed: 2519199221,
  },
  'visual.result.defeat': {
    stage: 10,
    hash: 'fnv1a32-v1:9590030d',
    seed: 1543179630,
  },
  'visual.dashboard.one-view': {
    stage: 10,
    hash: 'fnv1a32-v1:8cf7930a',
    seed: 1799040046,
  },
  'visual.dashboard.tactical-canvas': {
    stage: 10,
    hash: 'fnv1a32-v1:a5562f7c',
    seed: 878861757,
  },
  'visual.dashboard.tactical-damaged': {
    stage: 20,
    hash: 'fnv1a32-v1:8ab5609d',
    seed: 863484587,
  },
  'visual.dashboard.tactical-severe': {
    stage: 20,
    hash: 'fnv1a32-v1:007bd4fd',
    seed: 1109974916,
  },
  'visual.events.tactical-overlay': {
    stage: 30,
    hash: 'fnv1a32-v1:69958a74',
    seed: 2255225468,
  },
  'visual.camp.resting': {
    stage: 10,
    hash: 'fnv1a32-v1:8ca52a75',
    seed: 3095968417,
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
    expect(VISUAL_FIXTURE_IDS).toHaveLength(18)
    expect(VISUAL_FIXTURE_IDS.length * VISUAL_FIXTURE_VARIANTS.length).toBe(72)
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
        ownerTicket: id === 'visual.camp.resting'
          ? 'IRPG-418'
          : id === 'visual.events.tactical-overlay'
          ? 'IRPG-417'
          : id === 'visual.dashboard.tactical-damaged' ||
          id === 'visual.dashboard.tactical-severe'
          ? 'IRPG-416'
          : id === 'visual.dashboard.tactical-canvas'
          ? 'IRPG-415'
          : id === 'visual.dashboard.one-view'
          ? 'IRPG-422'
          : id === 'visual.map.stage-frontier'
          ? 'IRPG-408'
          : id.startsWith('visual.cards.')
            ? 'IRPG-409'
            : id.startsWith('visual.events.')
              ? 'IRPG-412'
            : id.startsWith('visual.result.')
              ? 'IRPG-410'
            : id === 'visual.combat.event-log'
              ? 'IRPG-411'
            : 'IRPG-506',
        stage: expected.stage,
        seedKey: id === 'visual.dashboard.tactical-damaged' ||
          id === 'visual.dashboard.tactical-severe'
          ? `irpg-416:${id}:v1`
          : id === 'visual.dashboard.tactical-canvas'
          ? 'irpg-415:visual.dashboard.tactical-canvas:v1'
          : id === 'visual.events.tactical-overlay'
            ? 'irpg-415:visual.events.tactical-overlay:v1'
          : id === 'visual.camp.resting'
            ? 'irpg-418:visual.camp.resting:v1'
          : id === 'visual.dashboard.one-view'
          ? 'irpg-414:visual.dashboard.one-view:v1'
          : `irpg-506:${id}:v1`,
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
          highestStage: id === 'visual.dashboard.one-view' ||
            id === 'visual.dashboard.tactical-canvas' ||
            id === 'visual.camp.resting'
            ? 11
            : expected.stage,
          enemyHp: id === 'visual.dashboard.tactical-damaged'
            ? Math.floor(getEnemyDefinition(expected.stage).maxHp * 0.5)
            : id === 'visual.dashboard.tactical-severe'
              ? Math.floor(getEnemyDefinition(expected.stage).maxHp * 0.15)
              : getEnemyDefinition(expected.stage).maxHp,
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
      captureTarget: '.tactical-action-bar',
      setupAction: 'assert-action-bar-assets',
    })
    expect(VISUAL_FIXTURE_REGISTRY['visual.events.pending-three']).toMatchObject({
      captureTarget: '.expedition-event-panel',
      failureRoute: 'none',
      setupAction: 'open-expedition-events',
    })
    expect(VISUAL_FIXTURE_REGISTRY['visual.events.fallback']).toMatchObject({
      captureTarget: '.expedition-event-panel',
      failureRoute: 'events-corrupt',
      setupAction: 'open-expedition-events',
    })
    const eventDefinition = VISUAL_FIXTURE_REGISTRY['visual.combat.event-log']
    const eventBatch = createVisualFixtureCombatEventBatch('visual.combat.event-log')
    expect(eventDefinition).toMatchObject({
      captureTarget: '.tactical-utility-dock__panel',
      setupAction: 'open-combat-log',
      canonicalEventHash: 'fnv1a32-v1:e0a7de25',
    })
    expect(eventBatch).toMatchObject({ nextCursor: '46', totalEvents: 24 })
    expect(eventBatch.events).toHaveLength(24)
    expect(new Set(eventBatch.events.map(({ type }) => type))).toEqual(new Set([
      'skill',
      'critical',
      'companionAssist',
      'kill',
      'bossVictory',
      'defeat',
    ]))
    expect(eventBatch.events
      .filter((event) => event.type === 'bossVictory')
      .every(({ milestoneReward }) => milestoneReward === null)).toBe(true)
    expect(hashVisualCombatEventBatch(eventBatch)).toBe(eventDefinition.canonicalEventHash)
    expect(hashVisualCombatEventBatch(createVisualFixtureCombatEventBatch(
      'visual.combat.hero-default',
    ))).not.toBe(eventDefinition.canonicalEventHash)

    const dashboardDefinition = VISUAL_FIXTURE_REGISTRY['visual.dashboard.one-view']
    const dashboardBatch = createVisualFixtureCombatEventBatch('visual.dashboard.one-view')
    expect(dashboardDefinition).toMatchObject({
      ownerTicket: 'IRPG-422',
      captureTarget: '.tactical-layout',
      setupAction: 'none',
      canonicalEventHash: 'fnv1a32-v1:aa4f41fb',
    })
    expect(dashboardBatch).toMatchObject({ nextCursor: '63', totalEvents: 12 })
    expect(dashboardBatch.events).toHaveLength(12)
    expect(new Set(dashboardBatch.events.map(({ type }) => type))).toEqual(new Set([
      'skill',
      'critical',
      'companionAssist',
      'kill',
      'bossVictory',
      'defeat',
    ]))
    expect(hashVisualCombatEventBatch(dashboardBatch))
      .toBe(dashboardDefinition.canonicalEventHash)

    const tacticalDefinition = VISUAL_FIXTURE_REGISTRY[
      'visual.dashboard.tactical-canvas'
    ]
    const tacticalBatch = createVisualFixtureCombatEventBatch(
      'visual.dashboard.tactical-canvas',
    )
    expect(tacticalDefinition).toMatchObject({
      ownerTicket: 'IRPG-415',
      captureTarget: '.tactical-canvas',
      setupAction: 'assert-tactical-surface',
      canonicalEventHash: 'fnv1a32-v1:c306eb11',
    })
    expect(tacticalBatch).toMatchObject({ nextCursor: '73', totalEvents: 12 })
    expect(tacticalBatch.events).toHaveLength(12)
    expect(tacticalBatch.events.slice(-4).map(({ type }) => type)).toEqual([
      'skill',
      'critical',
      'companionAssist',
      'defeat',
    ])
    expect(hashVisualCombatEventBatch(tacticalBatch))
      .toBe(tacticalDefinition.canonicalEventHash)

    const tacticalOverlayDefinition = VISUAL_FIXTURE_REGISTRY[
      'visual.events.tactical-overlay'
    ]
    const tacticalOverlayBatch = createVisualFixtureCombatEventBatch(
      'visual.events.tactical-overlay',
    )
    expect(tacticalOverlayDefinition).toMatchObject({
      ownerTicket: 'IRPG-417',
      captureTarget: '.tactical-canvas',
      setupAction: 'assert-tactical-surface',
      canonicalEventHash: 'fnv1a32-v1:15091bd6',
    })
    expect(tacticalOverlayBatch).toEqual({
      nextCursor: '0',
      totalEvents: 0,
      events: [],
    })
    expect(hashVisualCombatEventBatch(tacticalOverlayBatch))
      .toBe(tacticalOverlayDefinition.canonicalEventHash)

    const victoryDefinition = VISUAL_FIXTURE_REGISTRY['visual.result.boss-victory']
    const victoryBatch = createVisualFixtureCombatEventBatch(
      'visual.result.boss-victory',
    )
    expect(victoryDefinition).toMatchObject({
      ownerTicket: 'IRPG-410',
      captureTarget: '.combat-result-dialog',
      setupAction: 'open-boss-victory-result',
      canonicalEventHash: 'fnv1a32-v1:b6a6c062',
    })
    expect(victoryBatch).toMatchObject({
      nextCursor: '51',
      totalEvents: 1,
      events: [{
        type: 'bossVictory',
        defeatedStage: 10,
        nextStage: 11,
        gold: 240,
        xp: 120,
        milestoneReward: {
          milestoneStage: 10,
          configuredGold: 15,
          appliedGold: 15,
        },
      }],
    })
    expect(hashVisualCombatEventBatch(victoryBatch))
      .toBe(victoryDefinition.canonicalEventHash)

    const defeatDefinition = VISUAL_FIXTURE_REGISTRY['visual.result.defeat']
    const defeatBatch = createVisualFixtureCombatEventBatch('visual.result.defeat')
    expect(defeatDefinition).toMatchObject({
      ownerTicket: 'IRPG-410',
      captureTarget: '.combat-result-dialog',
      setupAction: 'open-defeat-result',
      canonicalEventHash: 'fnv1a32-v1:492c61f7',
    })
    expect(defeatBatch).toMatchObject({
      nextCursor: '52',
      totalEvents: 1,
      events: [{
        type: 'defeat',
        defeatedAtStage: 10,
        returnStage: 9,
        highestStage: 11,
      }],
    })
    expect(hashVisualCombatEventBatch(defeatBatch))
      .toBe(defeatDefinition.canonicalEventHash)

    const cardState = createVisualFixtureState('visual.cards.mixed-states')
    expect(cardState.player).toMatchObject({
      level: 3,
      gold: 35,
      skillPoints: 1,
      currentHp: 316,
      upgrades: { weapon: 2, armor: 1, charm: 50 },
      skills: { powerStrike: 3, ironWill: 10, fortune: 0 },
    })

    for (const id of [
      'visual.events.pending-three',
      'visual.events.fallback',
      'visual.events.tactical-overlay',
    ] as const) {
      const eventState = createVisualFixtureState(id)
      expect(eventState.expeditionEvents).toMatchObject({
        definitionVersion: 1,
        runPrestige: 0,
        milestoneMask: 7,
        overflowCount: 0,
      })
      expect(eventState.expeditionEvents.pending).toHaveLength(3)
      expect(new Set(eventState.expeditionEvents.pending.map(({ definitionId }) => definitionId)))
        .toEqual(new Set(['event.ember-shrine', 'event.wandering-smith', 'event.ash-camp']))
    }

    const dashboardState = createVisualFixtureState('visual.dashboard.one-view')
    expect(dashboardState).toMatchObject({
      claimedBossMilestoneMask: 1,
      player: {
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
        stage: 10,
        highestStage: 11,
        powerStrikeCooldownMs: 1_000,
        companionCooldownMs: 2_000,
        kills: 18,
        defeats: 2,
      },
      stats: { goldEarned: 4_200, enemiesDefeated: 42, prestiges: 0 },
      expeditionEvents: { milestoneMask: 1, overflowCount: 0 },
    })
    expect(dashboardState.player.currentHp)
      .toBe(Math.floor(getHeroStats(dashboardState).maxHp * 0.82))
    expect(dashboardState.expeditionEvents.pending).toHaveLength(1)
    expect(dashboardState.expeditionEvents.pending[0]?.definitionId)
      .toBe('event.wandering-smith')

    const tacticalState = createVisualFixtureState('visual.dashboard.tactical-canvas')
    expect(tacticalState).toMatchObject({
      claimedBossMilestoneMask: 1,
      player: {
        level: 8,
        gold: 860,
        companion: { id: 'emberFox', rank: 2 },
      },
      battle: { stage: 10, highestStage: 11 },
      expeditionEvents: { milestoneMask: 1, pending: [], overflowCount: 0 },
    })
    expect(tacticalState.player.currentHp)
      .toBe(Math.floor(getHeroStats(tacticalState).maxHp * 0.82))

    const damagedState = createVisualFixtureState(
      'visual.dashboard.tactical-damaged',
    )
    const severeState = createVisualFixtureState(
      'visual.dashboard.tactical-severe',
    )
    expect(damagedState.battle).toMatchObject({ stage: 20, highestStage: 20 })
    expect(severeState.battle).toMatchObject({ stage: 20, highestStage: 20 })
    expect(damagedState.battle.enemyHp).toBe(
      Math.floor(getEnemyDefinition(20).maxHp * 0.5),
    )
    expect(severeState.battle.enemyHp).toBe(
      Math.floor(getEnemyDefinition(20).maxHp * 0.15),
    )
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
  }, 15_000)

  it('injects the non-persistent combat event fixture independently of GameState', () => {
    render(<DebugSessionApp onExit={vi.fn()} />)
    const stateBefore = hashVisualGameState(createVisualFixtureState('visual.combat.event-log'))

    fireEvent.change(screen.getByLabelText('시각 회귀 fixture'), {
      target: { value: 'visual.combat.event-log' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'fixture 적용' }))

    const root = screen.getByTestId('visual-fixture-root')
    expect(root).toHaveAttribute('data-canonical-state-hash', stateBefore)
    expect(root).toHaveAttribute('data-canonical-event-hash', 'fnv1a32-v1:e0a7de25')
    expect(root).toHaveAttribute(
      'data-expected-canonical-event-hash',
      'fnv1a32-v1:e0a7de25',
    )
    expect(screen.queryByTestId('combat-log-list')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '전투 로그' }))
    expect(screen.getByTestId('combat-log-preview').getElementsByTagName('li'))
      .toHaveLength(5)
    fireEvent.click(screen.getByRole('button', { name: '전투 로그 펼치기' }))
    expect(screen.getByTestId('combat-log-list').getElementsByTagName('li')).toHaveLength(20)
    expect(hashVisualGameState(createVisualFixtureState('visual.combat.event-log')))
      .toBe(stateBefore)
    expect(window.localStorage).toHaveLength(0)
  })

  it('keeps all six mapped card assets inside the tactical action bar capture target', () => {
    render(<DebugSessionApp onExit={vi.fn()} />)

    fireEvent.change(screen.getByLabelText('시각 회귀 fixture'), {
      target: { value: 'visual.cards.mixed-states' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'fixture 적용' }))

    const root = screen.getByTestId('visual-fixture-root')
    const captureTarget = root.querySelector('.tactical-action-bar')
    expect(root).toHaveAttribute('data-visual-fixture-id', 'visual.cards.mixed-states')
    expect(root.querySelector('.tactical-battlefield')).toContainElement(
      captureTarget as HTMLElement,
    )
    expect(captureTarget?.querySelectorAll('[data-action-kind="equipment"] [data-asset-id]'))
      .toHaveLength(3)
    expect(captureTarget?.querySelectorAll('[data-action-kind="skill"] [data-asset-id]'))
      .toHaveLength(3)
  })

  it('renders the deterministic tactical one-view fixture surface', () => {
    render(<DebugSessionApp onExit={vi.fn()} />)

    fireEvent.change(screen.getByLabelText('시각 회귀 fixture'), {
      target: { value: 'visual.dashboard.one-view' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'fixture 적용' }))

    const root = screen.getByTestId('visual-fixture-root')
    expect(root).toHaveAttribute('data-visual-fixture-id', 'visual.dashboard.one-view')
    expect(root).toHaveAttribute('data-canonical-state-hash', 'fnv1a32-v1:8cf7930a')
    expect(root).toHaveAttribute('data-canonical-event-hash', 'fnv1a32-v1:aa4f41fb')
    expect(root.querySelector('.tactical-layout')).toBeInTheDocument()
    expect(root.querySelector('.game-dashboard')).not.toBeInTheDocument()
    expect(root.querySelectorAll('.tactical-timeline__nodes button')).toHaveLength(10)
    expect(root.querySelectorAll('[data-action-slot]')).toHaveLength(8)
    fireEvent.click(screen.getByRole('button', { name: '전투 로그' }))
    expect(screen.getByTestId('combat-log-preview').getElementsByTagName('li'))
      .toHaveLength(5)
    expect(screen.getByRole('tablist', { name: '성장 메뉴' })).toBeInTheDocument()
    expect(screen.getByTestId('tactical-event-count-status')).toHaveTextContent(
      '원정 이벤트 1건 대기 중',
    )
  })

  it.each([
    ['visual.result.boss-victory', '스테이지 10 보스 승리 상세 보기', 'bossVictory'],
    ['visual.result.defeat', '스테이지 10 패배 · 스테이지 9 복귀 상세 보기', 'defeat'],
  ] as const)('injects and opens the %s result fixture', (id, buttonName, resultType) => {
    render(<DebugSessionApp onExit={vi.fn()} />)

    fireEvent.change(screen.getByLabelText('시각 회귀 fixture'), {
      target: { value: id },
    })
    fireEvent.click(screen.getByRole('button', { name: 'fixture 적용' }))

    const definition = VISUAL_FIXTURE_REGISTRY[id]
    const root = screen.getByTestId('visual-fixture-root')
    expect(root).toHaveAttribute('data-visual-fixture-id', id)
    expect(root).toHaveAttribute('data-canonical-event-hash', definition.canonicalEventHash)
    fireEvent.click(screen.getByRole('button', { name: '승패 결과' }))
    fireEvent.click(screen.getByRole('button', { name: buttonName }))
    expect(screen.getByTestId('combat-result-dialog')).toHaveAttribute(
      'data-result-type',
      resultType,
    )
    expect(window.localStorage).toHaveLength(0)
  })
})
