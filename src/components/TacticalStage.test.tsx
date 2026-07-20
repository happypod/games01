import { fireEvent, render, screen, within } from '@testing-library/react'
import type { Ref } from 'react'
import { describe, expect, it, vi } from 'vitest'
import {
  createVisualFixtureCombatEventBatch,
  createVisualFixtureState,
} from '../debug/visualFixtures'
import {
  TACTICAL_DAMAGE_POPUP_DELAYS_MS,
  TACTICAL_DAMAGE_POPUP_DURATION_MS,
} from './tacticalScenePresentation'
import { TacticalStage } from './TacticalStage'

vi.mock('./GameAsset', () => ({
  GameAsset: ({
    assetId,
    className,
    containerRef,
  }: {
    assetId: string
    className?: string
    containerRef?: Ref<HTMLDivElement>
  }) => (
    <div
      ref={containerRef}
      className={className}
      data-testid="mock-game-asset"
      data-asset-id={assetId}
    />
  ),
}))

const success = {
  success: true,
  message: '선택 완료',
  reason: 'committed',
} as const

describe('IRPG-415/416 TacticalStage', () => {
  it('maps the current region, hero, boss, companion and ten-stage timeline', () => {
    const state = createVisualFixtureState('visual.dashboard.tactical-canvas')
    const onChooseStage = vi.fn()
    render(
      <TacticalStage
        state={state}
        batch={createVisualFixtureCombatEventBatch('visual.dashboard.tactical-canvas')}
        streamGeneration={1}
        notice="fixture 준비"
        onChooseStage={onChooseStage}
        onChooseExpeditionEvent={vi.fn(() => success)}
      />,
    )

    const canvas = screen.getByTestId('tactical-canvas')
    expect(canvas).toHaveAttribute('data-region-id', 'ashen-border')
    for (const id of [
      'region.ashen-border',
      'hero.ashen-knight.default',
      'boss.ash-giant',
      'companion.ember-fox.default',
    ]) {
      expect(canvas.querySelector(`[data-asset-id="${id}"]`)).not.toBeNull()
    }
    expect(within(canvas).getByRole('progressbar', { name: '영웅 체력' })).toBeVisible()
    expect(within(canvas).getByRole('progressbar', { name: '적 체력' })).toBeVisible()
    const timeline = within(canvas).getByRole('navigation', { name: '재의 변경 현재 10단계' })
    expect(within(timeline).getAllByRole('button')).toHaveLength(10)
    fireEvent.click(within(timeline).getByRole('button', { name: /스테이지 9/ }))
    expect(onChooseStage).toHaveBeenCalledOnce()
    expect(onChooseStage).toHaveBeenCalledWith(9)
  })

  it('presents an active combat scene from its event-time snapshot while commands stay live', () => {
    const state = createVisualFixtureState('visual.dashboard.tactical-canvas')
    const emptyBatch = { nextCursor: '0', totalEvents: 0, events: [] } as const
    const view = render(
      <TacticalStage
        state={state}
        batch={emptyBatch}
        streamGeneration={3}
        notice="live"
        onChooseStage={vi.fn()}
        onChooseExpeditionEvent={vi.fn(() => success)}
      />,
    )

    view.rerender(
      <TacticalStage
        state={state}
        batch={{
          nextCursor: '1',
          totalEvents: 1,
          events: [{
            id: '1:00000001:30:kill',
            roundSequence: '1',
            ordinal: 30,
            rngState: 1,
            stage: 19,
            type: 'kill',
            defeatedStage: 19,
            nextStage: 20,
            gold: 123,
            xp: 45,
            snapshot: {
              stage: 20,
              highestStage: 30,
              playerHp: 77,
              enemyHp: 88,
              gold: 123,
              xp: 45,
            },
          }],
        }}
        streamGeneration={3}
        notice="live"
        onChooseStage={vi.fn()}
        onChooseExpeditionEvent={vi.fn(() => success)}
      />,
    )

    const canvas = screen.getByTestId('tactical-canvas')
    expect(canvas).toHaveAttribute('data-presented-stage', '20')
    expect(canvas).toHaveAttribute('data-live-stage', '10')
    expect(canvas).toHaveAttribute(
      'data-enemy-asset-id',
      'boss.eclipse-knight.severe',
    )
    expect(within(canvas).getByRole('heading', { name: /스테이지 20/ })).toBeVisible()
    expect(within(canvas).getByRole('progressbar', { name: '영웅 체력' }))
      .toHaveAttribute('aria-valuenow', '77')
    expect(within(canvas).getByRole('progressbar', { name: '적 체력' }))
      .toHaveAttribute('aria-valuenow', '88')
    expect(within(canvas).getByRole('navigation', { name: /현재 10단계/ }))
      .toHaveTextContent('10')
    expect(within(canvas).getByText('적 처치')).toBeVisible()
  })

  it('projects one event-backed attack, two bounded popups and one ultimate flash', () => {
    const state = createVisualFixtureState('visual.dashboard.tactical-canvas')
    const stateBefore = JSON.stringify(state)
    const emptyBatch = { nextCursor: '0', totalEvents: 0, events: [] } as const
    const view = render(
      <TacticalStage
        state={state}
        batch={emptyBatch}
        streamGeneration={6}
        notice="live"
        onChooseStage={vi.fn()}
        onChooseExpeditionEvent={vi.fn(() => success)}
      />,
    )

    expect(screen.queryByTestId('tactical-damage-layer')).not.toBeInTheDocument()
    expect(screen.queryByTestId('tactical-ultimate-flash')).not.toBeInTheDocument()

    view.rerender(
      <TacticalStage
        state={state}
        batch={createVisualFixtureCombatEventBatch('visual.dashboard.tactical-canvas')}
        streamGeneration={6}
        notice="live"
        onChooseStage={vi.fn()}
        onChooseExpeditionEvent={vi.fn(() => success)}
      />,
    )

    const canvas = screen.getByTestId('tactical-canvas')
    const damageLayer = within(canvas).getByTestId('tactical-damage-layer')
    const popups = damageLayer.querySelectorAll('.tactical-damage-popup')
    expect(popups).toHaveLength(2)
    expect(popups[0]).toHaveAttribute('data-popup-kind', 'critical')
    expect(popups[0]).toHaveAttribute('data-popup-source', 'hero')
    expect(popups[0]).toHaveStyle({
      animationDuration: `${TACTICAL_DAMAGE_POPUP_DURATION_MS}ms`,
      animationDelay: `${TACTICAL_DAMAGE_POPUP_DELAYS_MS.primary}ms`,
    })
    expect(popups[1]).toHaveAttribute('data-popup-kind', 'companionAssist')
    expect(popups[1]).toHaveAttribute('data-popup-source', 'companion')
    expect(popups[1]).toHaveStyle({
      animationDuration: `${TACTICAL_DAMAGE_POPUP_DURATION_MS}ms`,
      animationDelay: `${TACTICAL_DAMAGE_POPUP_DELAYS_MS.companion}ms`,
    })
    expect(canvas.querySelector('.tactical-actor__asset--hero'))
      .toHaveClass('tactical-motion--hero-attack')
    expect(canvas.querySelector('.tactical-actor__asset--enemy'))
      .toHaveClass('tactical-motion--enemy-hit')
    expect(canvas.querySelector('.tactical-companion__asset'))
      .toHaveClass('tactical-motion--companion-assist')
    expect(within(canvas).getByTestId('tactical-ultimate-flash'))
      .toHaveAttribute('aria-hidden', 'true')
    expect(damageLayer).toHaveAttribute('aria-hidden', 'true')
    expect(within(damageLayer).queryByRole('status'))
      .not.toBeInTheDocument()
    expect(JSON.stringify(state)).toBe(stateBefore)
  })

  it('consumes scenes behind a pending expedition overlay without replaying them', () => {
    const pendingState = createVisualFixtureState('visual.events.tactical-overlay')
    const emptyBatch = { nextCursor: '0', totalEvents: 0, events: [] } as const
    const eventBatch = createVisualFixtureCombatEventBatch(
      'visual.dashboard.tactical-canvas',
    )
    const view = render(
      <TacticalStage
        state={pendingState}
        batch={emptyBatch}
        streamGeneration={8}
        notice="pending"
        onChooseStage={vi.fn()}
        onChooseExpeditionEvent={vi.fn(() => success)}
      />,
    )

    view.rerender(
      <TacticalStage
        state={pendingState}
        batch={eventBatch}
        streamGeneration={8}
        notice="pending"
        onChooseStage={vi.fn()}
        onChooseExpeditionEvent={vi.fn(() => success)}
      />,
    )
    expect(screen.getByTestId('tactical-canvas')).not.toHaveAttribute(
      'data-scene-id',
    )

    view.rerender(
      <TacticalStage
        state={{
          ...pendingState,
          expeditionEvents: { ...pendingState.expeditionEvents, pending: [] },
        }}
        batch={eventBatch}
        streamGeneration={8}
        notice="resolved"
        onChooseStage={vi.fn()}
        onChooseExpeditionEvent={vi.fn(() => success)}
      />,
    )
    expect(screen.getByTestId('tactical-canvas')).not.toHaveAttribute(
      'data-scene-id',
    )
    expect(screen.queryByTestId('tactical-damage-layer')).not.toBeInTheDocument()
    expect(screen.queryByTestId('tactical-ultimate-flash')).not.toBeInTheDocument()
  })

  it('renders three saved events as an inert battlefield overlay and guards rapid duplicate input', () => {
    const state = createVisualFixtureState('visual.events.tactical-overlay')
    const onChoose = vi.fn(() => success)
    render(
      <TacticalStage
        state={state}
        batch={createVisualFixtureCombatEventBatch('visual.events.tactical-overlay')}
        streamGeneration={2}
        notice="선택 대기"
        onChooseStage={vi.fn()}
        onChooseExpeditionEvent={onChoose}
      />,
    )

    const canvas = screen.getByTestId('tactical-canvas')
    expect(canvas.querySelector('.tactical-canvas__base')).toHaveAttribute('inert')
    const cards = canvas.querySelectorAll('.expedition-event-card')
    expect(cards).toHaveLength(3)
    const buttons = within(canvas).getAllByRole('button', { name: /최대 \+/ })
    expect(buttons).toHaveLength(6)
    fireEvent.click(buttons[0]!)
    fireEvent.click(buttons[0]!)
    expect(onChoose).toHaveBeenCalledOnce()
  })

  it('returns focus to the live battlefield when the last expedition card is removed', () => {
    const state = createVisualFixtureState('visual.events.tactical-overlay')
    state.expeditionEvents = {
      ...state.expeditionEvents,
      pending: state.expeditionEvents.pending.slice(0, 1),
    }
    const batch = createVisualFixtureCombatEventBatch('visual.events.tactical-overlay')
    const onChoose = vi.fn(() => success)
    const view = render(
      <TacticalStage
        state={state}
        batch={batch}
        streamGeneration={4}
        notice="choose"
        onChooseStage={vi.fn()}
        onChooseExpeditionEvent={onChoose}
      />,
    )

    const choice = screen.getByTestId('tactical-canvas')
      .querySelector<HTMLButtonElement>('.expedition-event-card__choices button')
    expect(choice).not.toBeNull()
    choice!.focus()
    fireEvent.click(choice!)

    view.rerender(
      <TacticalStage
        state={{
          ...state,
          expeditionEvents: { ...state.expeditionEvents, pending: [] },
        }}
        batch={batch}
        streamGeneration={4}
        notice="resolved"
        onChooseStage={vi.fn()}
        onChooseExpeditionEvent={onChoose}
      />,
    )

    expect(screen.getByRole('heading', { name: /스테이지 30/ })).toHaveFocus()
    expect(screen.getByTestId('tactical-canvas').querySelector('.tactical-canvas__base'))
      .not.toHaveAttribute('inert')
  })
})
