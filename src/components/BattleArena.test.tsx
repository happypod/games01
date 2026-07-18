import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createInitialState } from '../game/engine'
import { BattleArena } from './BattleArena'

describe('BattleArena companion contribution', () => {
  it('announces when the free recruitment is available', () => {
    const state = createInitialState(1_000)
    state.battle.highestStage = 11

    render(<BattleArena state={state} onChooseStage={vi.fn()} />)

    expect(screen.getByText('무료 영입 가능')).toBeInTheDocument()
    expect(screen.getByText('동료 원정대에서 불씨 여우 루미를 영입하세요.')).toBeInTheDocument()
  })

  it('shows the active companion damage and cooldown without a live announcement', () => {
    const state = createInitialState(1_000)
    state.player.companion = { id: 'emberFox', rank: 1 }
    state.battle.companionCooldownMs = 2_000

    const { container } = render(
      <BattleArena state={state} onChooseStage={vi.fn()} />,
    )

    expect(screen.getByText('불씨 여우 루미')).toBeInTheDocument()
    expect(screen.getByText('Rank 1 · 협공 피해 2')).toBeInTheDocument()
    expect(screen.getByText('2초', { exact: true })).toBeInTheDocument()
    expect(container.querySelector('.companion-cycle')).not.toHaveAttribute('aria-live')
  })
})
