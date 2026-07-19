import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { StageMapPanel } from './StageMapPanel'

vi.mock('./GameAsset', () => ({
  GameAsset: ({ assetId }: { assetId: string }) => (
    <div data-testid="stage-map-region-art" data-asset-id={assetId} />
  ),
}))

function renderMap(options?: {
  currentStage?: number
  highestStage?: number
  disabled?: boolean
  disabledReason?: string
}) {
  const onChooseStage = vi.fn()
  const view = render(
    <StageMapPanel
      currentStage={options?.currentStage ?? 105}
      highestStage={options?.highestStage ?? 105}
      onChooseStage={onChooseStage}
      {...(options?.disabled === undefined ? {} : { disabled: options.disabled })}
      {...(options?.disabledReason === undefined
        ? {}
        : { disabledReason: options.disabledReason })}
    />,
  )
  return { ...view, onChooseStage }
}

function openMap() {
  fireEvent.click(screen.getByRole('button', { name: '원정 지도 열기' }))
}

describe('StageMapPanel', () => {
  it('shows only the current ten-stage block while the full map is closed', () => {
    const { container } = renderMap({ currentStage: 105, highestStage: 107 })

    const compactMap = container.querySelector<HTMLElement>('.stage-map-compact')
    expect(compactMap).not.toBeNull()
    if (compactMap === null) return

    expect(within(compactMap).getByText('월락 고개')).toBeInTheDocument()
    expect(within(compactMap).getByText('101–110')).toBeInTheDocument()
    expect(within(compactMap).getAllByRole('button')).toHaveLength(10)
    expect(container.querySelectorAll('.stage-map-node')).toHaveLength(0)
    expect(screen.queryByTestId('stage-map-region-art')).not.toBeInTheDocument()

    expect(within(compactMap).getByRole('button', { name: '스테이지 104, 완료' }))
      .toHaveAttribute('data-stage-state', 'completed')
    expect(within(compactMap).getByRole('button', {
      name: '스테이지 105, 현재 위치, 완료',
    })).toHaveAttribute('aria-current', 'step')
    expect(within(compactMap).getByRole('button', { name: '스테이지 107, 최전선' }))
      .toHaveAttribute('data-stage-state', 'frontier')
    expect(within(compactMap).getByRole('button', {
      name: '스테이지 108, 잠김, 스테이지 108 도달 시 해제, 현재 최고 107',
    })).toHaveAttribute('aria-disabled', 'true')
    expect(within(compactMap).getByRole('button', {
      name: '스테이지 110, 보스, 잠김, 스테이지 110 도달 시 해제, 현재 최고 107',
    })).toHaveAttribute('data-boss', 'true')
  })

  it('moves the compact timeline to the next block at a ten-stage boundary', () => {
    const onChooseStage = vi.fn()
    const view = render(
      <StageMapPanel currentStage={110} highestStage={110} onChooseStage={onChooseStage} />,
    )

    let timeline = screen.getByRole('group', { name: '월락 고개 현재 10단계' })
    expect(within(timeline).getAllByRole('button').map((button) => button.textContent))
      .toEqual(['101', '102', '103', '104', '105', '106', '107', '108', '109', '110B'])

    view.rerender(
      <StageMapPanel currentStage={111} highestStage={111} onChooseStage={onChooseStage} />,
    )
    timeline = screen.getByRole('group', { name: '월락 고개 현재 10단계' })
    expect(within(timeline).getAllByRole('button').map((button) => button.textContent))
      .toEqual(['111', '112', '113', '114', '115', '116', '117', '118', '119', '120B'])
  })

  it('selects available compact stages once and blocks locked or read-only commands', () => {
    const { container, onChooseStage, rerender } = renderMap({
      currentStage: 105,
      highestStage: 105,
    })
    const compactMap = container.querySelector<HTMLElement>('.stage-map-compact')
    expect(compactMap).not.toBeNull()
    if (compactMap === null) return

    fireEvent.click(within(compactMap).getByRole('button', { name: '스테이지 104, 완료' }))
    fireEvent.click(within(compactMap).getByRole('button', {
      name: '스테이지 105, 현재 위치, 최전선',
    }))
    fireEvent.click(within(compactMap).getByRole('button', {
      name: '스테이지 106, 잠김, 스테이지 106 도달 시 해제, 현재 최고 105',
    }))
    expect(onChooseStage.mock.calls).toEqual([[104], [105]])

    rerender(
      <StageMapPanel
        currentStage={105}
        highestStage={105}
        onChooseStage={onChooseStage}
        disabled
        disabledReason="읽기 전용 탭에서는 이동할 수 없습니다."
      />,
    )
    const readOnlyCurrent = screen.getByRole('button', {
      name: '스테이지 105, 현재 위치, 최전선, 현재 스테이지 이동 불가',
    })
    expect(readOnlyCurrent).not.toBeDisabled()
    expect(readOnlyCurrent).toHaveAttribute('aria-disabled', 'true')
    expect(readOnlyCurrent).toHaveAccessibleDescription(
      '읽기 전용 탭에서는 이동할 수 없습니다.',
    )
    fireEvent.click(readOnlyCurrent)
    expect(onChooseStage.mock.calls).toEqual([[104], [105]])
  })

  it('mounts no region asset until opened and shows the current region only', () => {
    const { container } = renderMap()

    const toggle = screen.getByRole('button', { name: '원정 지도 열기' })
    expect(toggle).not.toHaveAttribute('aria-controls')
    expect(screen.queryByTestId('stage-map-region-art')).not.toBeInTheDocument()
    openMap()

    expect(container.querySelector('.stage-map-compact')).not.toBeInTheDocument()
    expect(toggle).toHaveAttribute('aria-controls', 'stage-map-content')
    expect(screen.getByTestId('stage-map-region-art')).toHaveAttribute(
      'data-asset-id',
      'region.moonfall-pass',
    )
    expect(screen.getByRole('tab', { name: /월락 고개/ })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.getByRole('tab', { name: /월락 고개/ })).toHaveAttribute(
      'aria-controls',
      'stage-map-region-moonfall-pass',
    )
    expect(screen.getByRole('tab', { name: /재의 변경/ })).not.toHaveAttribute(
      'aria-controls',
    )
    expect(container.querySelectorAll('.stage-map-node')).toHaveLength(100)
    expect(screen.getByTestId('stage-map-node-104')).toHaveAttribute(
      'data-stage-state',
      'completed',
    )
    expect(screen.getByTestId('stage-map-node-105')).toHaveAttribute(
      'aria-current',
      'step',
    )
    expect(screen.getByTestId('stage-map-node-105')).toHaveAttribute(
      'data-stage-state',
      'frontier',
    )
    expect(screen.getByTestId('stage-map-node-106')).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    expect(screen.getByTestId('stage-map-node-110')).toHaveAttribute(
      'data-boss',
      'true',
    )
  })

  it('blocks locked nodes while allowing completed and frontier selection', () => {
    const { onChooseStage } = renderMap()
    openMap()

    fireEvent.click(screen.getByTestId('stage-map-node-106'))
    expect(onChooseStage).not.toHaveBeenCalled()

    fireEvent.click(screen.getByTestId('stage-map-node-104'))
    expect(screen.getByTestId('stage-map-node-104')).toHaveAttribute('tabindex', '0')
    fireEvent.click(screen.getByTestId('stage-map-node-105'))
    expect(onChooseStage.mock.calls).toEqual([[104], [105]])
    expect(screen.getByTestId('stage-map-node-105')).toHaveAttribute('tabindex', '0')
  })

  it('uses one roving node and preserves offsets across page navigation', async () => {
    const { container } = renderMap()
    openMap()

    const stage105 = screen.getByTestId('stage-map-node-105')
    stage105.focus()
    fireEvent.keyDown(stage105, { key: 'ArrowRight' })
    await waitFor(() => expect(screen.getByTestId('stage-map-node-106')).toHaveFocus())
    expect(container.querySelectorAll('.stage-map-node[tabindex="0"]')).toHaveLength(1)

    fireEvent.keyDown(screen.getByTestId('stage-map-node-106'), { key: 'Home' })
    await waitFor(() => expect(screen.getByTestId('stage-map-node-101')).toHaveFocus())

    fireEvent.keyDown(screen.getByTestId('stage-map-node-101'), { key: 'End' })
    await waitFor(() => expect(screen.getByTestId('stage-map-node-200')).toHaveFocus())

    fireEvent.keyDown(screen.getByTestId('stage-map-node-200'), { key: 'PageDown' })
    await waitFor(() => expect(screen.getByTestId('stage-map-node-300')).toHaveFocus())
    expect(screen.getByRole('tab', { name: /잊힌 칼데라/ })).toHaveAttribute(
      'aria-selected',
      'true',
    )

    fireEvent.keyDown(screen.getByTestId('stage-map-node-300'), { key: 'PageDown' })
    expect(screen.getByTestId('stage-map-node-300')).toHaveFocus()
  })

  it('wraps selection-follows-focus region tabs and keeps the relative node offset', () => {
    renderMap()
    openMap()

    const moonfallTab = screen.getByRole('tab', { name: /월락 고개/ })
    moonfallTab.focus()
    fireEvent.keyDown(moonfallTab, { key: 'ArrowRight' })

    const calderaTab = screen.getByRole('tab', { name: /잊힌 칼데라/ })
    expect(calderaTab).toHaveFocus()
    expect(calderaTab).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByTestId('stage-map-node-205')).toHaveAttribute('tabindex', '0')

    fireEvent.keyDown(calderaTab, { key: 'ArrowRight' })
    const borderTab = screen.getByRole('tab', { name: /재의 변경/ })
    expect(borderTab).toHaveFocus()
    expect(borderTab).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByTestId('stage-map-node-5')).toHaveAttribute('tabindex', '0')
  })

  it('does not move the chosen tab or roving focus when combat state updates', async () => {
    const onChooseStage = vi.fn()
    const view = render(
      <StageMapPanel
        currentStage={105}
        highestStage={105}
        onChooseStage={onChooseStage}
      />,
    )
    openMap()
    const stage105 = screen.getByTestId('stage-map-node-105')
    stage105.focus()
    fireEvent.keyDown(stage105, { key: 'PageDown' })
    await waitFor(() => expect(screen.getByTestId('stage-map-node-205')).toHaveFocus())

    view.rerender(
      <StageMapPanel
        currentStage={106}
        highestStage={106}
        onChooseStage={onChooseStage}
      />,
    )

    expect(screen.getByRole('tab', { name: /잊힌 칼데라/ })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.getByTestId('stage-map-node-205')).toHaveFocus()
    expect(screen.getByTestId('stage-map-node-205')).toHaveAttribute('tabindex', '0')
  })

  it('keeps all nodes focusable but command-disabled in read-only state', () => {
    const reason = '읽기 전용 탭에서는 이동할 수 없습니다.'
    const { onChooseStage } = renderMap({
      currentStage: 2,
      highestStage: 3,
      disabled: true,
      disabledReason: reason,
    })
    openMap()

    const stage2 = screen.getByTestId('stage-map-node-2')
    expect(stage2).not.toBeDisabled()
    expect(stage2).toHaveAttribute('aria-disabled', 'true')
    expect(stage2).toHaveAccessibleDescription(reason)
    fireEvent.click(stage2)
    expect(onChooseStage).not.toHaveBeenCalled()
  })
})
