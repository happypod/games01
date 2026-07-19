import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  LAYOUT_PREFERENCE_STORAGE_KEY,
  readLayoutPreference,
  useLayoutPreference,
  type LayoutPreferenceStorage,
} from './useLayoutPreference'

function createStorage(initialValue: string | null = null) {
  let value = initialValue
  const storage: LayoutPreferenceStorage = {
    getItem: vi.fn(() => value),
    setItem: vi.fn((_key, nextValue) => {
      value = nextValue
    }),
  }
  return storage
}

describe('useLayoutPreference', () => {
  it('uses dashboard by default and ignores invalid stored values', () => {
    expect(readLayoutPreference(createStorage())).toBe('dashboard')
    expect(readLayoutPreference(createStorage('unknown-layout'))).toBe('dashboard')
    expect(readLayoutPreference(null)).toBe('dashboard')
  })

  it.each(['dashboard', 'tactical'] as const)(
    'restores the valid %s preference',
    (storedMode) => {
      const storage = createStorage(storedMode)
      const { result } = renderHook(() => useLayoutPreference(storage))

      expect(result.current[0]).toBe(storedMode)
      expect(storage.getItem).toHaveBeenCalledWith(LAYOUT_PREFERENCE_STORAGE_KEY)
    },
  )

  it('falls back safely when reading storage throws', () => {
    const storage: LayoutPreferenceStorage = {
      getItem: vi.fn(() => {
        throw new Error('storage unavailable')
      }),
      setItem: vi.fn(),
    }

    const { result } = renderHook(() => useLayoutPreference(storage))

    expect(result.current[0]).toBe('dashboard')
  })

  it('updates the UI state and writes only to the isolated preference key', () => {
    const storage = createStorage()
    const { result } = renderHook(() => useLayoutPreference(storage))

    act(() => result.current[1]('tactical'))

    expect(result.current[0]).toBe('tactical')
    expect(storage.setItem).toHaveBeenCalledTimes(1)
    expect(storage.setItem).toHaveBeenCalledWith(
      LAYOUT_PREFERENCE_STORAGE_KEY,
      'tactical',
    )
  })

  it('keeps the UI usable when writing storage throws', () => {
    const storage: LayoutPreferenceStorage = {
      getItem: vi.fn(() => 'dashboard'),
      setItem: vi.fn(() => {
        throw new Error('quota exceeded')
      }),
    }
    const { result } = renderHook(() => useLayoutPreference(storage))

    expect(() => {
      act(() => result.current[1]('tactical'))
    }).not.toThrow()
    expect(result.current[0]).toBe('tactical')
  })
})
