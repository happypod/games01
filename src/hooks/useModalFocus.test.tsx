import { fireEvent, render, screen } from '@testing-library/react'
import { useCallback, useRef, useState, type RefObject } from 'react'
import { describe, expect, it } from 'vitest'
import { useModalFocus } from './useModalFocus'

interface TestDialogProps {
  fallbackFocusRef: RefObject<HTMLHeadingElement | null>
  onClose: () => void
  onRemoveOpener: () => void
}

function TestDialog({ fallbackFocusRef, onClose, onRemoveOpener }: TestDialogProps) {
  const dialogRef = useModalFocus<HTMLElement>(onClose, true, fallbackFocusRef)

  return (
    <section
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="test-dialog-title"
      tabIndex={-1}
    >
      <h2 id="test-dialog-title">전투 결과 상세</h2>
      <button type="button" data-initial-focus onClick={onRemoveOpener}>
        결과 항목 제거
      </button>
      <button type="button" onClick={onClose}>닫기</button>
    </section>
  )
}

function ModalFocusHarness() {
  const [open, setOpen] = useState(false)
  const [showOpener, setShowOpener] = useState(true)
  const fallbackFocusRef = useRef<HTMLHeadingElement>(null)
  const close = useCallback(() => setOpen(false), [])
  const removeOpener = useCallback(() => setShowOpener(false), [])

  return (
    <>
      <h2 ref={fallbackFocusRef} tabIndex={-1}>최근 전투 결과</h2>
      {showOpener && (
        <button type="button" onClick={() => setOpen(true)}>
          상세 결과 열기
        </button>
      )}
      {open && (
        <TestDialog
          fallbackFocusRef={fallbackFocusRef}
          onClose={close}
          onRemoveOpener={removeOpener}
        />
      )}
    </>
  )
}

describe('useModalFocus fallback restoration', () => {
  it('restores focus to the connected opener before considering the fallback', () => {
    render(<ModalFocusHarness />)
    const opener = screen.getByRole('button', { name: '상세 결과 열기' })
    opener.focus()
    fireEvent.click(opener)

    const dialog = screen.getByRole('dialog', { name: '전투 결과 상세' })
    expect(screen.getByRole('button', { name: '결과 항목 제거' })).toHaveFocus()
    fireEvent.keyDown(dialog, { key: 'Escape' })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(opener).toHaveFocus()
  })

  it('focuses the fallback heading when the opener was removed before close', () => {
    render(<ModalFocusHarness />)
    const opener = screen.getByRole('button', { name: '상세 결과 열기' })
    opener.focus()
    fireEvent.click(opener)

    fireEvent.click(screen.getByRole('button', { name: '결과 항목 제거' }))
    expect(opener.isConnected).toBe(false)

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '최근 전투 결과' })).toHaveFocus()
  })
})
