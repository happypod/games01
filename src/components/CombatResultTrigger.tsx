import { useLayoutEffect, useRef, type RefObject } from 'react'

interface CombatResultTriggerProps {
  resultId: string
  label: string
  fallbackFocusRef: RefObject<HTMLElement | null>
  onOpen: (resultId: string) => void
}

export function CombatResultTrigger({
  resultId,
  label,
  fallbackFocusRef,
  onOpen,
}: CombatResultTriggerProps) {
  const buttonRef = useRef<HTMLButtonElement>(null)

  useLayoutEffect(() => () => {
    const button = buttonRef.current
    const fallback = fallbackFocusRef.current
    if (button === document.activeElement && fallback?.isConnected) fallback.focus()
  }, [fallbackFocusRef])

  return (
    <button
      ref={buttonRef}
      type="button"
      aria-haspopup="dialog"
      onClick={() => onOpen(resultId)}
    >
      {label}
    </button>
  )
}
