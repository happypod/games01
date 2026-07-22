import { useCallback, useSyncExternalStore } from 'react'

export function useMediaQuery(query: string, fallback: boolean) {
  const subscribe = useCallback((onStoreChange: () => void) => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return () => undefined
    }

    const mediaQuery = window.matchMedia(query)
    mediaQuery.addEventListener('change', onStoreChange)
    return () => mediaQuery.removeEventListener('change', onStoreChange)
  }, [query])

  const getSnapshot = useCallback(
    () => typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(query).matches
      : fallback,
    [fallback, query],
  )

  const getServerSnapshot = useCallback(() => fallback, [fallback])
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
