import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { LayoutMode } from '../hooks/useLayoutPreference'
import { LayoutModeSelector } from './LayoutModeSelector'

function ControlledSelector({ initial = 'dashboard' }: { initial?: LayoutMode }) {
  const [value, setValue] = useState<LayoutMode>(initial)
  return <LayoutModeSelector value={value} onChange={setValue} />
}

describe('LayoutModeSelector', () => {
  it('exposes an exclusively selected, labelled radio group', () => {
    render(<LayoutModeSelector value="dashboard" onChange={vi.fn()} />)

    expect(screen.getByTestId('layout-mode-selector')).toHaveAccessibleName('화면 레이아웃')
    const dashboard = screen.getByRole('radio', { name: '유형 1 · 대시보드' })
    const tactical = screen.getByRole('radio', { name: '유형 2 · 전술 전장' })
    expect(dashboard).toHaveAttribute('aria-checked', 'true')
    expect(dashboard).toHaveAttribute('tabindex', '0')
    expect(tactical).toHaveAttribute('aria-checked', 'false')
    expect(tactical).toHaveAttribute('tabindex', '-1')
  })

  it('requests a new value once when clicked', () => {
    const onChange = vi.fn()
    render(<LayoutModeSelector value="dashboard" onChange={onChange} />)

    fireEvent.click(screen.getByRole('radio', { name: '유형 2 · 전술 전장' }))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('tactical')

    fireEvent.click(screen.getByRole('radio', { name: '유형 1 · 대시보드' }))
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('uses arrow keys with wrapping and moves selection with focus', () => {
    render(<ControlledSelector />)
    const dashboard = screen.getByRole('radio', { name: '유형 1 · 대시보드' })
    const tactical = screen.getByRole('radio', { name: '유형 2 · 전술 전장' })

    dashboard.focus()
    fireEvent.keyDown(dashboard, { key: 'ArrowRight' })
    expect(tactical).toHaveFocus()
    expect(tactical).toHaveAttribute('aria-checked', 'true')

    fireEvent.keyDown(tactical, { key: 'ArrowRight' })
    expect(dashboard).toHaveFocus()
    expect(dashboard).toHaveAttribute('aria-checked', 'true')

    fireEvent.keyDown(dashboard, { key: 'ArrowLeft' })
    expect(tactical).toHaveFocus()
    expect(tactical).toHaveAttribute('aria-checked', 'true')
  })

  it('supports Home and End navigation', () => {
    render(<ControlledSelector initial="tactical" />)
    const dashboard = screen.getByRole('radio', { name: '유형 1 · 대시보드' })
    const tactical = screen.getByRole('radio', { name: '유형 2 · 전술 전장' })

    tactical.focus()
    fireEvent.keyDown(tactical, { key: 'Home' })
    expect(dashboard).toHaveFocus()
    expect(dashboard).toHaveAttribute('aria-checked', 'true')

    fireEvent.keyDown(dashboard, { key: 'End' })
    expect(tactical).toHaveFocus()
    expect(tactical).toHaveAttribute('aria-checked', 'true')
  })
})
