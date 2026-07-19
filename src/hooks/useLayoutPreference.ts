import { useCallback, useState } from 'react'

export const LAYOUT_PREFERENCE_STORAGE_KEY = 'emberwatch.ui.layout.v1'

export type LayoutMode = 'dashboard' | 'tactical'

export interface LayoutPreferenceStorage {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
}

function isLayoutMode(value: unknown): value is LayoutMode {
  return value === 'dashboard' || value === 'tactical'
}

function getBrowserStorage(): LayoutPreferenceStorage | null {
  if (typeof window === 'undefined') return null

  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function readLayoutPreference(
  storage: LayoutPreferenceStorage | null,
): LayoutMode {
  if (storage === null) return 'dashboard'

  try {
    const stored = storage.getItem(LAYOUT_PREFERENCE_STORAGE_KEY)
    return isLayoutMode(stored) ? stored : 'dashboard'
  } catch {
    return 'dashboard'
  }
}

export function useLayoutPreference(
  storage: LayoutPreferenceStorage | null = getBrowserStorage(),
) {
  const [layoutMode, setLayoutModeState] = useState<LayoutMode>(() =>
    readLayoutPreference(storage),
  )

  const setLayoutMode = useCallback((nextLayoutMode: LayoutMode) => {
    if (!isLayoutMode(nextLayoutMode)) return

    setLayoutModeState(nextLayoutMode)
    try {
      storage?.setItem(LAYOUT_PREFERENCE_STORAGE_KEY, nextLayoutMode)
    } catch {
      // UI preference failures must never block the game or its save pipeline.
    }
  }, [storage])

  return [layoutMode, setLayoutMode] as const
}
