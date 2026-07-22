import { act, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createInitialState } from '../game/engine'
import {
  LEGACY_SAVE_KEY,
  SAVE_SLOT_A_KEY,
  SAVE_SLOT_B_KEY,
  saveGameAtRevision,
} from '../game/persistence'
import { DebugSessionApp } from './DebugSessionApp'

const PERSISTENT_KEYS = [LEGACY_SAVE_KEY, SAVE_SLOT_A_KEY, SAVE_SLOT_B_KEY] as const

function rawSaveSnapshot() {
  return Object.fromEntries(
    PERSISTENT_KEYS.map((key) => [key, window.localStorage.getItem(key)]),
  )
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

describe('IRPG-507 DebugSessionApp save isolation', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(10_000)
    window.localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    window.localStorage.clear()
  })

  it('keeps legacy and A/B raw bytes unchanged across ticks, actions, and reset', () => {
    const first = createInitialState(1_000, 0x1234_5678)
    first.player.gold = 111
    const second = structuredClone(first)
    second.lastSavedAt = 2_000
    second.player.gold = 222
    expect(saveGameAtRevision(window.localStorage, first, null)).toMatchObject({
      status: 'saved',
      revision: 1,
    })
    expect(saveGameAtRevision(window.localStorage, second, 1)).toMatchObject({
      status: 'saved',
      revision: 2,
    })
    const before = rawSaveSnapshot()
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const onExit = vi.fn()

    const { container } = render(<DebugSessionApp onExit={onExit} />)
    expect(rawSaveSnapshot()).toEqual(before)

    act(() => vi.advanceTimersByTime(1_000))
    expect(rawSaveSnapshot()).toEqual(before)

    const stage = input(container, '#debug-stage')
    fireEvent.change(stage, { target: { value: '25' } })
    submitInput(stage)

    const gold = input(container, '#debug-gold')
    const skillPoints = input(container, '#debug-skill-points')
    const essence = input(container, '#debug-essence')
    fireEvent.change(gold, { target: { value: '9999' } })
    fireEvent.change(skillPoints, { target: { value: '77' } })
    fireEvent.change(essence, { target: { value: '8' } })
    submitInput(gold)

    const offline = input(container, '#debug-offline')
    fireEvent.change(offline, { target: { value: '1' } })
    submitInput(offline)
    expect(rawSaveSnapshot()).toEqual(before)

    const resetButton = container.querySelector<HTMLButtonElement>(
      '.debug-panel__actions button',
    )
    if (!resetButton) throw new Error('missing debug reset button')
    fireEvent.click(resetButton)

    expect(confirm).toHaveBeenCalledTimes(1)
    expect(rawSaveSnapshot()).toEqual(before)
    expect(setItem).not.toHaveBeenCalled()
    expect(onExit).not.toHaveBeenCalled()
    expect(input(container, '#debug-stage')).toHaveValue('1')
    expect(input(container, '#debug-gold')).toHaveValue('222')
    expect(input(container, '#debug-skill-points')).toHaveValue('0')
    expect(input(container, '#debug-essence')).toHaveValue('0')
    expect(input(container, '#debug-offline')).toHaveValue('0')
  })
})
