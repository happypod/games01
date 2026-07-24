import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createInitialState } from '../game/engine'
import type { GameState } from '../game/types'
import { CampCanvas } from './CampCanvas'

vi.mock('./GameAsset', () => ({
  GameAsset: ({ assetId }: { assetId: string }) => (
    <span data-testid="camp-canvas-game-asset" data-asset-id={assetId} aria-hidden="true" />
  ),
}))

function createCanvasState(): GameState {
  const state = createInitialState(0, 0x55)
  state.player.gold = 10_000
  return state
}

describe('IRPG-803 CampCanvas', () => {
  it('renders every facility as a focusable button labelled with its name and level', () => {
    const state = createCanvasState()
    render(
      <CampCanvas
        state={state}
        disabled={false}
        onUpgradeStructure={vi.fn()}
        onOpenBondTraining={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: /원정 텐트/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /불씨 작업대/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /단련소/ })).toBeInTheDocument()
    expect(screen.getAllByTestId('camp-canvas-game-asset').length).toBeGreaterThanOrEqual(3)
  })

  it('calls onUpgradeStructure with the matching id when a facility button is activated', () => {
    const state = createCanvasState()
    const onUpgradeStructure = vi.fn()
    render(
      <CampCanvas
        state={state}
        disabled={false}
        onUpgradeStructure={onUpgradeStructure}
        onOpenBondTraining={vi.fn()}
      />,
    )

    screen.getByRole('button', { name: /단련소/ }).click()
    expect(onUpgradeStructure).toHaveBeenCalledWith('trainingGround')
    expect(onUpgradeStructure).toHaveBeenCalledTimes(1)
  })

  it('disables a facility button exactly when the card UI would (insufficient gold)', () => {
    const state = createCanvasState()
    state.player.gold = 0
    render(
      <CampCanvas
        state={state}
        disabled={false}
        onUpgradeStructure={vi.fn()}
        onOpenBondTraining={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: /단련소.*골드 부족/ })).toBeDisabled()
  })

  it('disables every button when the shared disabled prop is set', () => {
    const state = createCanvasState()
    render(
      <CampCanvas
        state={state}
        disabled
        onUpgradeStructure={vi.fn()}
        onOpenBondTraining={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: /원정 텐트/ })).toBeDisabled()
  })

  it('hides the Sera actor while she is unmet', () => {
    const state = createCanvasState()
    expect(state.camp.residents.sera.status).toBe('unmet')
    render(
      <CampCanvas
        state={state}
        disabled={false}
        onUpgradeStructure={vi.fn()}
        onOpenBondTraining={vi.fn()}
      />,
    )

    expect(screen.queryByRole('button', { name: /세라/ })).not.toBeInTheDocument()
  })

  it('shows the Sera actor once rescued and opens bond training on activation', () => {
    const state = createCanvasState()
    state.camp.residents.sera.status = 'rescued'
    const onOpenBondTraining = vi.fn()
    render(
      <CampCanvas
        state={state}
        disabled={false}
        onUpgradeStructure={vi.fn()}
        onOpenBondTraining={onOpenBondTraining}
      />,
    )

    const seraButton = screen.getByRole('button', { name: /세라/ })
    seraButton.click()
    expect(onOpenBondTraining).toHaveBeenCalledTimes(1)
  })
})
