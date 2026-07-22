import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createInitialState } from '../game/engine'
import { DebugPanel } from './DebugPanel'
import type { DebugSpeed } from './debugSession'

function createCallbacks() {
  return {
    onSpeedChange: vi.fn(),
    onSetStage: vi.fn(),
    onSetResources: vi.fn(),
    onApplyOffline: vi.fn(),
    onReset: vi.fn(),
    onExit: vi.fn(),
  }
}

function input(container: HTMLElement, selector: string) {
  const element = container.querySelector<HTMLInputElement>(selector)
  if (!element) throw new Error(`missing test input: ${selector}`)
  return element
}

function submitInput(element: HTMLInputElement) {
  const form = element.closest('form')
  if (!form) throw new Error(`input ${element.id} is not inside a form`)
  fireEvent.submit(form)
}

describe('IRPG-507 DebugPanel', () => {
  afterEach(() => vi.restoreAllMocks())

  it('reports status for valid stage, resource, and offline commands', () => {
    const callbacks = createCallbacks()
    const { container } = render(
      <DebugPanel
        state={createInitialState(0, 1)}
        speed={1}
        {...callbacks}
      />,
    )

    expect(screen.getByRole('status')).toBeInTheDocument()

    const stage = input(container, '#debug-stage')
    fireEvent.change(stage, { target: { value: '42' } })
    submitInput(stage)
    expect(callbacks.onSetStage).toHaveBeenCalledWith(42)
    expect(screen.getByRole('status')).toBeInTheDocument()

    const gold = input(container, '#debug-gold')
    const skillPoints = input(container, '#debug-skill-points')
    const essence = input(container, '#debug-essence')
    fireEvent.change(gold, { target: { value: '9007199254740991' } })
    fireEvent.change(skillPoints, { target: { value: '17' } })
    fireEvent.change(essence, { target: { value: '3' } })
    submitInput(gold)
    expect(callbacks.onSetResources).toHaveBeenCalledWith(
      Number.MAX_SAFE_INTEGER,
      17,
      3,
    )
    expect(screen.getByRole('status')).toBeInTheDocument()

    const offline = input(container, '#debug-offline')
    fireEvent.change(offline, { target: { value: '480' } })
    submitInput(offline)
    expect(callbacks.onApplyOffline).toHaveBeenCalledWith(480)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('exposes 1x, 10x, and 100x as controlled speed commands', () => {
    const callbacks = createCallbacks()
    const state = createInitialState(0, 1)
    const { rerender } = render(
      <DebugPanel state={state} speed={1} {...callbacks} />,
    )

    const selectSpeed = (current: DebugSpeed, next: DebugSpeed) => {
      rerender(<DebugPanel state={state} speed={current} {...callbacks} />)
      fireEvent.click(screen.getByRole('radio', { name: `${next}x` }))
    }

    selectSpeed(1, 10)
    selectSpeed(10, 100)
    selectSpeed(100, 1)

    expect(callbacks.onSpeedChange.mock.calls).toEqual([[10], [100], [1]])
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('switches to an alert and suppresses the callback for malformed input', () => {
    const callbacks = createCallbacks()
    const { container } = render(
      <DebugPanel
        state={createInitialState(0, 1)}
        speed={1}
        {...callbacks}
      />,
    )
    const stage = input(container, '#debug-stage')

    fireEvent.change(stage, { target: { value: '' } })
    submitInput(stage)

    expect(callbacks.onSetStage).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()

    fireEvent.change(stage, { target: { value: '3' } })
    submitInput(stage)
    expect(callbacks.onSetStage).toHaveBeenCalledWith(3)
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('requires confirmation before reset and exit callbacks', () => {
    const callbacks = createCallbacks()
    const confirm = vi.spyOn(window, 'confirm')
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true)
    const { container } = render(
      <DebugPanel
        state={createInitialState(0, 1)}
        speed={1}
        {...callbacks}
      />,
    )
    const [resetButton, exitButton] = Array.from(
      container.querySelectorAll<HTMLButtonElement>('.debug-panel__actions button'),
    )
    if (!resetButton || !exitButton) throw new Error('missing debug action buttons')

    fireEvent.click(resetButton)
    fireEvent.click(resetButton)
    fireEvent.click(exitButton)
    fireEvent.click(exitButton)

    expect(confirm).toHaveBeenCalledTimes(4)
    expect(callbacks.onReset).toHaveBeenCalledTimes(1)
    expect(callbacks.onExit).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })
})
