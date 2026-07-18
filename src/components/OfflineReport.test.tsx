import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import type { AdvanceReport } from '../game/types'
import { OfflineReport } from './OfflineReport'

const REPORT: AdvanceReport = {
  elapsedMs: 60_000,
  rounds: 60,
  criticalHits: 9,
  kills: 3,
  defeats: 0,
  goldEarned: 27,
  xpEarned: 21,
  levelsGained: 1,
  stagesGained: 3,
}

function OfflineReportHarness() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>보고서 열기</button>
      {open && <OfflineReport report={REPORT} onClose={() => setOpen(false)} />}
    </>
  )
}

describe('OfflineReport', () => {
  it('focuses its action, closes with Escape, and restores the opener', () => {
    render(<OfflineReportHarness />)
    const opener = screen.getByRole('button', { name: '보고서 열기' })
    opener.focus()
    fireEvent.click(opener)

    const dialog = screen.getByRole('dialog')
    expect(screen.getByRole('button', { name: '보상 확인' })).toHaveFocus()
    fireEvent.keyDown(dialog, { key: 'Escape' })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(opener).toHaveFocus()
  })
})
