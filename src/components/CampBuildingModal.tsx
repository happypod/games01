import type { ReactNode, RefObject } from 'react'
import { createPortal } from 'react-dom'
import { useModalFocus } from '../hooks/useModalFocus'

export interface CampBuildingModalProps {
  titleId: string
  title: string
  eyebrow: string
  onClose: () => void
  fallbackFocusRef?: RefObject<HTMLElement | null>
  children: ReactNode
}

// IRPG-803 R1: shared modal shell for every camp building popup so focus-trap,
// Escape handling, and backdrop behaviour only exist once (see useModalFocus).
export function CampBuildingModal({
  titleId,
  title,
  eyebrow,
  onClose,
  fallbackFocusRef,
  children,
}: CampBuildingModalProps) {
  const dialogRef = useModalFocus<HTMLElement>(onClose, true, fallbackFocusRef)

  return createPortal(
    <div
      className="modal-backdrop camp-building-modal-backdrop"
      role="presentation"
      data-modal-layer="true"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        ref={dialogRef}
        className="camp-building-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="camp-building-modal"
        tabIndex={-1}
      >
        <header className="camp-building-modal__header">
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h2 id={titleId}>{title}</h2>
          </div>
          <button
            type="button"
            className="camp-building-modal__close"
            onClick={onClose}
            aria-label={`${title} 닫기`}
          >
            ✕
          </button>
        </header>
        <div className="camp-building-modal__body">{children}</div>
      </section>
    </div>,
    document.body,
  )
}
