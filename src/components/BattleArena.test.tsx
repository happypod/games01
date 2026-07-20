import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createInitialState } from '../game/engine'
import { getEnemyDefinition } from '../game/content'
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

describe('IRPG-416 Type 1 damage portrait integration', () => {
  it('selects the damaged eclipse knight portrait from the current live HP', () => {
    const state = createInitialState(1_000)
    const enemy = getEnemyDefinition(20)
    state.battle.stage = 20
    state.battle.highestStage = 20
    state.battle.enemyHp = Math.floor(enemy.maxHp * 0.5)

    const { container } = render(
      <BattleArena state={state} onChooseStage={vi.fn()} />,
    )

    expect(container.querySelector('.enemy-portrait__asset')).toHaveAttribute(
      'data-asset-id',
      'boss.eclipse-knight.damaged',
    )
    expect(container.querySelector('.battle')).toHaveAttribute(
      'data-enemy-damage-state',
      'damaged',
    )
    expect(screen.getByText('갑옷 균열')).toBeVisible()
  })

  it('does not add an armor-state label to enemies without damage portraits', () => {
    const state = createInitialState(1_000)

    const { container } = render(
      <BattleArena state={state} onChooseStage={vi.fn()} />,
    )

    expect(container.querySelector('.battle')).not.toHaveAttribute(
      'data-enemy-damage-state',
    )
    expect(container.querySelector('.enemy-damage-state')).toBeNull()
  })
})
