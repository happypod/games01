import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  createVisualFixtureCombatEventBatch,
  createVisualFixtureState,
} from '../debug/visualFixtures'
import { TacticalStage } from './TacticalStage'

vi.mock('./GameAsset', () => ({
  GameAsset: ({ assetId, className }: { assetId: string; className?: string }) => (
    <div className={className} data-testid="mock-game-asset" data-asset-id={assetId} />
  ),
}))

const success = {
  success: true,
  message: '선택 완료',
  reason: 'committed',
} as const

describe('IRPG-415 TacticalStage', () => {
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
    expect(within(canvas).getByRole('heading', { name: /스테이지 20/ })).toBeVisible()
    expect(within(canvas).getByRole('progressbar', { name: '영웅 체력' }))
      .toHaveAttribute('aria-valuenow', '77')
    expect(within(canvas).getByRole('progressbar', { name: '적 체력' }))
      .toHaveAttribute('aria-valuenow', '88')
    expect(within(canvas).getByRole('navigation', { name: /현재 10단계/ }))
      .toHaveTextContent('10')
    expect(within(canvas).getByText('적 처치')).toBeVisible()
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
