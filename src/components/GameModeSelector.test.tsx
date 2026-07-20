import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { GameMode } from '../game/types'
import { GameModeSelector } from './GameModeSelector'

function ControlledSelector({ initial = 'BATTLE' }: { initial?: GameMode }) {
  const [value, setValue] = useState<GameMode>(initial)
  return <GameModeSelector value={value} onChange={setValue} />
}

describe('GameModeSelector', () => {
  it('exposes the current mode through one labelled radio group', () => {
    render(<GameModeSelector value="BATTLE" onChange={vi.fn()} />)

    expect(screen.getByTestId('game-mode-selector'))
      .toHaveAccessibleName('전투 및 캠프 화면')
    const battle = screen.getByRole('radio', { name: '전투 · 전술 전장' })
    const camp = screen.getByRole('radio', { name: '캠프 · 관리' })
    expect(battle).toHaveAttribute('aria-checked', 'true')
    expect(battle).toHaveAttribute('tabindex', '0')
    expect(camp).toHaveAttribute('aria-checked', 'false')
    expect(camp).toHaveAttribute('tabindex', '-1')
  })

  it('requests only a different mode once per click', () => {
    const onChange = vi.fn()
    render(<GameModeSelector value="BATTLE" onChange={onChange} />)

    fireEvent.click(screen.getByRole('radio', { name: '전투 · 전술 전장' }))
    expect(onChange).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('radio', { name: '캠프 · 관리' }))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('CAMP')
  })

  it('uses arrow keys with wrapping and moves selection with focus', () => {
    render(<ControlledSelector />)
    const battle = screen.getByRole('radio', { name: '전투 · 전술 전장' })
    const camp = screen.getByRole('radio', { name: '캠프 · 관리' })

    battle.focus()
    fireEvent.keyDown(battle, { key: 'ArrowRight' })
    expect(camp).toHaveFocus()
    expect(camp).toHaveAttribute('aria-checked', 'true')

    fireEvent.keyDown(camp, { key: 'ArrowDown' })
    expect(battle).toHaveFocus()
    expect(battle).toHaveAttribute('aria-checked', 'true')

    fireEvent.keyDown(battle, { key: 'ArrowLeft' })
    expect(camp).toHaveFocus()
    expect(camp).toHaveAttribute('aria-checked', 'true')
  })

  it('supports Home and End navigation', () => {
    render(<ControlledSelector initial="CAMP" />)
    const battle = screen.getByRole('radio', { name: '전투 · 전술 전장' })
    const camp = screen.getByRole('radio', { name: '캠프 · 관리' })

    camp.focus()
    fireEvent.keyDown(camp, { key: 'Home' })
    expect(battle).toHaveFocus()
    expect(battle).toHaveAttribute('aria-checked', 'true')

    fireEvent.keyDown(battle, { key: 'End' })
    expect(camp).toHaveFocus()
    expect(camp).toHaveAttribute('aria-checked', 'true')
  })

  it.each([
    ['BATTLE', '전투 · 전술 전장', '캠프 · 관리'],
    ['CAMP', '캠프 · 관리', '전투 · 전술 전장'],
  ] as const)(
    'blocks the required change from %s while disabled',
    (value, currentLabel, targetLabel) => {
      const onChange = vi.fn()
      render(<GameModeSelector value={value} onChange={onChange} disabled />)

      const current = screen.getByRole('radio', { name: currentLabel })
      const target = screen.getByRole('radio', { name: targetLabel })
      expect(current).not.toHaveAttribute('aria-disabled')
      expect(target).toHaveAttribute('aria-disabled', 'true')

      fireEvent.click(target)
      expect(onChange).not.toHaveBeenCalled()

      current.focus()
      fireEvent.keyDown(current, { key: 'ArrowRight' })
      expect(current).toHaveFocus()
      expect(onChange).not.toHaveBeenCalled()
    },
  )
})
