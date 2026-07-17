import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useGame } from './useGame'

describe('useGame persistence safety', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.useFakeTimers({ now: new Date('2026-01-01T00:00:00Z') })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
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
})
