import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EXPEDITION_EVENT_DEFINITIONS_V1 } from '../game/content'
import { createExpeditionPendingEvent } from '../game/expedition'
import type { ExpeditionPendingEvent } from '../game/types'
import { ExpeditionEventPanel } from './ExpeditionEventPanel'

vi.mock('./GameAsset', () => ({
  GameAsset: ({ assetId }: { assetId: string }) => (
    <div data-testid="event-game-asset" data-asset-id={assetId} aria-hidden="true" />
  ),
}))

const SAVED_SEED = 0x0412_0107

function createPending(count = 3): ExpeditionPendingEvent[] {
  return Array.from({ length: count }, (_, index) =>
    createExpeditionPendingEvent(SAVED_SEED, 0, index, 200),
  )
}

function firstChoiceButton(event: ExpeditionPendingEvent) {
  const definition = EXPEDITION_EVENT_DEFINITIONS_V1[event.definitionId]
  const choice = event.resolvedChoices[0]!
  const label = definition.choices.find(({ id }) => id === choice.choiceId)!.label
  const preview = choice.effect.type === 'grantGold'
    ? `골드 최대 +${choice.effect.amount}`
    : `체력 최대 +${choice.effect.amount}`
  return screen.getByRole('button', { name: `${definition.name}, ${label}, ${preview}` })
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('IRPG-412 expedition event cards', () => {
  it('renders up to three stored offers in order with exact saved effect previews', () => {
    const pending = createPending()
    const { container } = render(
      <ExpeditionEventPanel
        pending={pending}
        onChoose={vi.fn(() => ({
          success: false,
          message: 'unused',
          reason: 'rejected' as const,
        }))}
      />,
    )

    expect(screen.getByRole('heading', { name: '원정 선택 이벤트' })).toBeVisible()
    expect(screen.getByText('대기 중 3/3')).toBeVisible()
    expect(screen.getAllByRole('article')).toHaveLength(3)
    expect([...container.querySelectorAll('[data-event-asset-id]')].map((node) =>
      node.getAttribute('data-event-asset-id'),
    )).toEqual(pending.map(({ definitionId }) => definitionId))

    for (const event of pending) {
      const definition = EXPEDITION_EVENT_DEFINITIONS_V1[event.definitionId]
      const article = screen.getByRole('article', { name: definition.name })
      expect(article).toHaveAttribute('data-expedition-event-id', event.eventId)
      expect(article).toHaveAccessibleDescription(definition.description)
      expect(within(article).getByText(`스테이지 ${event.milestoneStage}에서 발견`))
        .toBeVisible()
      expect(within(article).getByRole('group', { name: `${definition.name} 선택지` }))
        .toBeVisible()
      for (const choice of event.resolvedChoices) {
        const preview = choice.effect.type === 'grantGold'
          ? `골드 최대 +${choice.effect.amount}`
          : `체력 최대 +${choice.effect.amount}`
        expect(within(article).getByText(preview)).toBeVisible()
      }
    }
    expect(screen.getByText(
      '보유 한도와 현재 체력에 따라 실제 증가량은 줄어들 수 있습니다.',
    )).toBeVisible()
    expect(container.querySelector('[aria-live]')).not.toBeInTheDocument()
    expect(container.querySelector('[data-card-asset-id]')).not.toBeInTheDocument()
  })

  it('does not mount event assets before its viewport surface activates', () => {
    const callbacks: IntersectionObserverCallback[] = []
    class TestIntersectionObserver implements IntersectionObserver {
      readonly root = null
      readonly rootMargin = '0px'
      readonly scrollMargin = '0px'
      readonly thresholds = [0]
      constructor(next: IntersectionObserverCallback) {
        callbacks.push(next)
      }
      disconnect() {}
      observe() {}
      takeRecords() { return [] }
      unobserve() {}
    }
    vi.stubGlobal('IntersectionObserver', TestIntersectionObserver)

    const view = render(
      <ExpeditionEventPanel
        pending={[]}
        onChoose={vi.fn(() => ({
          success: false,
          message: 'unused',
          reason: 'rejected' as const,
        }))}
      />,
    )
    expect(screen.queryAllByTestId('event-game-asset')).toHaveLength(0)
    expect(callbacks).toHaveLength(0)
    view.rerender(
      <ExpeditionEventPanel
        pending={createPending()}
        onChoose={vi.fn(() => ({
          success: false,
          message: 'unused',
          reason: 'rejected' as const,
        }))}
      />,
    )
    expect(screen.queryAllByTestId('event-game-asset')).toHaveLength(0)
    expect(callbacks).toHaveLength(3)

    for (let index = 0; index < callbacks.length; index += 1) {
      act(() => {
        callbacks[index]?.(
          [{ isIntersecting: true } as IntersectionObserverEntry],
          {} as IntersectionObserver,
        )
      })
      expect(screen.getAllByTestId('event-game-asset')).toHaveLength(index + 1)
      expect(screen.getAllByTestId('event-game-asset').map((asset) =>
        asset.getAttribute('data-asset-id'),
      )).toEqual(createPending().slice(0, index + 1).map(({ definitionId }) => definitionId))
    }
  })

  it('blocks rapid repeated activation and focuses removedIndex modulo remaining', async () => {
    const pending = createPending()
    const onChoose = vi.fn(() => ({
      success: true,
      message: '원정 이벤트 선택을 적용했습니다.',
      reason: 'committed' as const,
    }))
    const view = render(<ExpeditionEventPanel pending={pending} onChoose={onChoose} />)
    const middleButton = firstChoiceButton(pending[1]!)
    middleButton.focus()

    fireEvent.click(middleButton)
    fireEvent.click(middleButton)
    expect(onChoose).toHaveBeenCalledTimes(1)
    expect(onChoose).toHaveBeenCalledWith(
      pending[1]!.eventId,
      pending[1]!.resolvedChoices[0]!.choiceId,
    )

    const remaining = [pending[0]!, pending[2]!]
    view.rerender(<ExpeditionEventPanel pending={remaining} onChoose={onChoose} />)
    await waitFor(() => expect(firstChoiceButton(pending[2]!)).toHaveFocus())
    expect(screen.getByText('원정 이벤트 선택을 적용했습니다.')).toBeVisible()
  })

  it('focuses the section heading after the last success and keeps rejection focus', async () => {
    const [event] = createPending(1)
    const accepted = vi.fn(() => ({
      success: true,
      message: '적용 완료',
      reason: 'committed' as const,
    }))
    const view = render(<ExpeditionEventPanel pending={[event!]} onChoose={accepted} />)
    const choice = firstChoiceButton(event!)
    choice.focus()
    fireEvent.click(choice)
    view.rerender(<ExpeditionEventPanel pending={[]} onChoose={accepted} />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '원정 선택 이벤트' })).toHaveFocus()
    })
    expect(screen.getByText(/대기 중인 원정 이벤트가 없습니다/)).toBeVisible()

    const rejected = vi.fn(() => ({
      success: false,
      message: '이미 완료된 이벤트입니다.',
      reason: 'rejected' as const,
    }))
    view.rerender(<ExpeditionEventPanel pending={[event!]} onChoose={rejected} />)
    const retry = firstChoiceButton(event!)
    retry.focus()
    fireEvent.click(retry)
    expect(rejected).toHaveBeenCalledTimes(1)
    expect(retry).toHaveFocus()
    expect(screen.getByText('이미 완료된 이벤트입니다.')).toBeVisible()
  })

  it('restores focus when a focused offer disappears through an external snapshot', async () => {
    const pending = createPending()
    const onChoose = vi.fn(() => ({
      success: false,
      message: 'unused',
      reason: 'rejected' as const,
    }))
    const view = render(<ExpeditionEventPanel pending={pending} onChoose={onChoose} />)
    firstChoiceButton(pending[1]!).focus()

    view.rerender(
      <ExpeditionEventPanel pending={[pending[0]!, pending[2]!]} onChoose={onChoose} />,
    )
    await waitFor(() => expect(firstChoiceButton(pending[2]!)).toHaveFocus())
    expect(onChoose).not.toHaveBeenCalled()

    view.rerender(<ExpeditionEventPanel pending={[]} onChoose={onChoose} />)
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '원정 선택 이벤트' })).toHaveFocus()
    })
  })

  it('shows a connected disabled reason without invoking the command', () => {
    const [event] = createPending(1)
    const onChoose = vi.fn(() => ({
      success: true,
      message: 'unexpected',
      reason: 'committed' as const,
    }))
    const reason = '다른 탭이 진행을 저장 중이라 선택할 수 없습니다.'
    render(
      <ExpeditionEventPanel
        pending={[event!]}
        onChoose={onChoose}
        disabled
        disabledReason={reason}
      />,
    )

    const choice = firstChoiceButton(event!)
    expect(choice).toBeDisabled()
    expect(choice).toHaveAccessibleDescription(expect.stringContaining(reason))
    fireEvent.click(choice)
    expect(onChoose).not.toHaveBeenCalled()
    expect(screen.getByText(reason)).not.toHaveAttribute('role')
  })

  it('keeps exact stored effects when immutable v1 presentation metadata is unavailable', () => {
    const source = createPending(1)[0]!
    const unknown = {
      ...source,
      definitionId: 'event.unknown',
      definitionVersion: 99,
    } as unknown as ExpeditionPendingEvent
    render(
      <ExpeditionEventPanel
        pending={[unknown]}
        onChoose={vi.fn(() => ({
          success: false,
          message: '거부',
          reason: 'rejected' as const,
        }))}
      />,
    )

    expect(screen.getByRole('article', { name: '미확인 원정 이벤트' })).toBeVisible()
    expect(screen.getByText(/표시 정보를 찾지 못했습니다/)).toBeVisible()
    expect(screen.getByTestId('event-game-asset')).toHaveAttribute(
      'data-asset-id',
      'event.unknown',
    )
    for (const choice of unknown.resolvedChoices) {
      const preview = choice.effect.type === 'grantGold'
        ? `골드 최대 +${choice.effect.amount}`
        : `체력 최대 +${choice.effect.amount}`
      expect(screen.getByText(preview)).toBeVisible()
    }
  })

  it('shows four-digit stored amounts without compact abbreviation', () => {
    const source = createPending(1)[0]!
    const [gold, recovery] = source.resolvedChoices
    const large = {
      ...source,
      resolvedChoices: [
        { ...gold!, effect: { type: 'grantGold' as const, amount: 1_234 } },
        { ...recovery!, effect: { type: 'restoreHp' as const, amount: 5_678 } },
      ],
    } as ExpeditionPendingEvent
    render(
      <ExpeditionEventPanel
        pending={[large]}
        onChoose={vi.fn(() => ({
          success: false,
          message: 'unused',
          reason: 'rejected' as const,
        }))}
      />,
    )

    expect(screen.getByText('골드 최대 +1,234')).toBeVisible()
    expect(screen.getByText('체력 최대 +5,678')).toBeVisible()
    expect(screen.queryByText(/1\.2K|5\.7K/)).not.toBeInTheDocument()
  })
})
