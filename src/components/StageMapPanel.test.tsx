import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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
  it('mounts no region asset until opened and shows the current region only', () => {
    const { container } = renderMap()

    const toggle = screen.getByRole('button', { name: '원정 지도 열기' })
    expect(toggle).not.toHaveAttribute('aria-controls')
    expect(screen.queryByTestId('stage-map-region-art')).not.toBeInTheDocument()
    openMap()

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
