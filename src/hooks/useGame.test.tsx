import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createInitialState } from '../game/engine'
import { SAVE_SLOT_KEYS, parseSaveEnvelope } from '../game/persistence'
import { createPortableSave, parsePortableSave } from '../game/saveTransfer'
import { useGame } from './useGame'

describe('useGame persistence safety', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.useFakeTimers({ now: new Date('2026-01-01T00:00:00Z') })
  })

  afterEach(() => {
    Reflect.deleteProperty(navigator, 'locks')
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('keeps combat events in memory and resets them on import and new game', async () => {
    const request = vi.fn(
      async (
        _name: string,
        _options: LockOptions,
        callback: (lock: Lock | null) => Promise<void> | void,
      ) => callback({ name: 'emberwatch.writer.v1', mode: 'exclusive' } as Lock),
    )
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: { request } as unknown as LockManager,
    })

    const { result, rerender, unmount } = renderHook(() => useGame())
    await act(async () => vi.advanceTimersByTimeAsync(0))

    expect(result.current.readOnly).toBe(false)
    await act(async () => vi.advanceTimersByTimeAsync(1_000))

    expect(result.current.combatEventBatch.nextCursor).toBe('1')
    expect(result.current.combatEventBatch.totalEvents).toBeGreaterThan(0)
    const firstBatch = result.current.combatEventBatch
    rerender()
    expect(result.current.combatEventBatch).toEqual(firstBatch)

    const importedState = createInitialState(Date.now(), 0x1234_5678)
    importedState.player.gold = 777
    const parsed = parsePortableSave(createPortableSave(importedState, Date.now()) ?? '')
    if (!parsed.success) throw new Error(parsed.message)
    act(() => {
      expect(result.current.restoreSave(parsed.preview).success).toBe(true)
    })
    expect(result.current.state.player.gold).toBe(777)
    expect(result.current.combatEventBatch).toEqual({
      nextCursor: '0',
      totalEvents: 0,
      events: [],
    })

    await act(async () => vi.advanceTimersByTimeAsync(1_000))
    expect(result.current.combatEventBatch.nextCursor).toBe('1')
    act(() => result.current.reset())
    expect(result.current.combatEventBatch).toEqual({
      nextCursor: '0',
      totalEvents: 0,
      events: [],
    })
    unmount()
  })

  it('latches writes off after a bootstrap read error', async () => {
    const originalGetItem = Storage.prototype.getItem
    vi.spyOn(Storage.prototype, 'getItem')
      .mockImplementationOnce(() => {
        throw new Error('simulated transient read failure')
      })
      .mockImplementation(function (this: Storage, key: string) {
        return originalGetItem.call(this, key)
      })
    const setItem = vi.spyOn(Storage.prototype, 'setItem')

    const { result, unmount } = renderHook(() => useGame())
    expect(result.current.saveHealthy).toBe(false)

    await act(async () => vi.advanceTimersByTimeAsync(6_000))

    expect(setItem).not.toHaveBeenCalled()
    expect(result.current.saveHealthy).toBe(false)
    unmount()
  })

  it('uses a no-write reader mode when Web Locks is unavailable', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem')

    const { result, unmount } = renderHook(() => useGame())

    expect(result.current.lockSupported).toBe(false)
    expect(result.current.ready).toBe(true)
    expect(result.current.readOnly).toBe(true)
    expect(result.current.notice).toContain('읽기 전용')

    await act(async () => vi.advanceTimersByTimeAsync(10_000))
    expect(setItem).not.toHaveBeenCalled()
    unmount()
  })

  it('does not advance save revision when progression commands are rejected', async () => {
    const request = vi.fn(
      async (
        _name: string,
        _options: LockOptions,
        callback: (lock: Lock | null) => Promise<void> | void,
      ) => callback({ name: 'emberwatch.writer.v1', mode: 'exclusive' } as Lock),
    )
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: { request } as unknown as LockManager,
    })

    const { result, unmount } = renderHook(() => useGame())
    await act(async () => vi.advanceTimersByTimeAsync(0))
    expect(result.current.readOnly).toBe(false)

    const stateBefore = structuredClone(result.current.state)
    const slotsBefore = SAVE_SLOT_KEYS.map((key) => window.localStorage.getItem(key))
    const revisionsBefore = slotsBefore.map((raw) =>
      raw === null ? null : parseSaveEnvelope(raw)?.revision ?? null,
    )

    act(() => {
      result.current.buyUpgrade('weapon')
      result.current.buySkill('fortune')
    })

    expect(result.current.state).toEqual(stateBefore)
    expect(result.current.state.rng).toEqual(stateBefore.rng)
    const slotsAfter = SAVE_SLOT_KEYS.map((key) => window.localStorage.getItem(key))
    expect(slotsAfter).toEqual(slotsBefore)
    expect(slotsAfter.map((raw) =>
      raw === null ? null : parseSaveEnvelope(raw)?.revision ?? null,
    )).toEqual(revisionsBefore)
    unmount()
  })
})
