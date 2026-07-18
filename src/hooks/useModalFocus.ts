import { useEffect, useRef, type RefObject } from 'react'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function getFocusableElements(dialog: HTMLElement) {
  return Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => !element.hidden && element.getAttribute('aria-hidden') !== 'true',
  )
}

export function useModalFocus<T extends HTMLElement>(
  onClose: () => void,
  active = true,
): RefObject<T | null> {
  const dialogRef = useRef<T>(null)

  useEffect(() => {
    if (!active) return
    const dialog = dialogRef.current
    if (dialog === null) return
    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    const initialFocus =
      dialog.querySelector<HTMLElement>('[data-initial-focus]') ?? getFocusableElements(dialog)[0]
    initialFocus?.focus()

    const handleFocusIn = (event: FocusEvent) => {
      if (!dialog.contains(event.target as Node)) {
        (initialFocus ?? dialog).focus()
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab') return

      const focusable = getFocusableElements(dialog)
      const first = focusable[0]
      const last = focusable.at(-1)
      if (first === undefined || last === undefined) {
        event.preventDefault()
        dialog.focus()
        return
      }
      if (
        event.shiftKey &&
        (document.activeElement === dialog ||
          document.activeElement === first ||
          !dialog.contains(document.activeElement))
      ) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    dialog.addEventListener('keydown', handleKeyDown)
    document.addEventListener('focusin', handleFocusIn, true)
    return () => {
      dialog.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('focusin', handleFocusIn, true)
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [active, onClose])

  return dialogRef
}
