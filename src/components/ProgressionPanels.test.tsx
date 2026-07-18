import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createInitialState } from '../game/engine'
import { getUpgradeCost } from '../game/formulas'
import type { GameState } from '../game/types'
import { SkillPanel } from './SkillPanel'
import { UpgradePanel } from './UpgradePanel'

vi.mock('./GameAsset', () => ({
  GameAsset: ({ assetId }: { assetId: string }) => (
    <div data-testid="mock-game-asset" data-asset-id={assetId} aria-hidden="true" />
  ),
}))

function createMixedState(): GameState {
  const state = createInitialState(0, 0x409)
  return {
    ...state,
    player: {
      ...state.player,
      level: 3,
      gold: 35,
      skillPoints: 1,
      upgrades: { weapon: 2, armor: 1, charm: 50 },
      skills: { powerStrike: 3, ironWill: 10, fortune: 0 },
    },
  }
}

describe('IRPG-409 illustrated progression panels', () => {
  it('keeps the six content mappings and reading order stable', () => {
    const state = createMixedState()
    const { container } = render(
      <div>
        <UpgradePanel state={state} onBuy={vi.fn()} />
        <SkillPanel state={state} onBuy={vi.fn()} />
      </div>,
    )

    expect([...container.querySelectorAll('[data-card-asset-id]')].map((node) =>
      node.getAttribute('data-card-asset-id'),
    )).toEqual([
      'equipment.ember-blade',
      'equipment.guard-armor',
      'equipment.fortune-charm',
      'skill.power-strike',
      'skill.iron-will',
      'skill.loot-sense',
    ])
    expect(screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent))
      .toEqual(['불씨 검', '수호 갑옷', '행운 부적', '화염 강타', '강철 의지', '전리품 감각'])
    for (const name of ['불씨 검', '수호 갑옷', '행운 부적', '화염 강타', '강철 의지', '전리품 감각']) {
      expect(screen.getByRole('article', { name })).toHaveAttribute('aria-describedby')
    }
    expect(container.querySelectorAll('.growth-card__art[aria-hidden="true"]')).toHaveLength(6)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('shows exact, one-short, locked, and MAX states with engine-compatible actions', () => {
    const state = createMixedState()
    const onUpgrade = vi.fn()
    const onSkill = vi.fn()
    const { container } = render(
      <div>
        <UpgradePanel state={state} onBuy={onUpgrade} />
        <SkillPanel state={state} onBuy={onSkill} />
      </div>,
    )

    const weapon = container.querySelector('[data-growth-card="upgrade-weapon"]') as HTMLElement
    const armor = container.querySelector('[data-growth-card="upgrade-armor"]') as HTMLElement
    const charm = container.querySelector('[data-growth-card="upgrade-charm"]') as HTMLElement
    const powerStrike = container.querySelector('[data-growth-card="skill-powerStrike"]') as HTMLElement
    const ironWill = container.querySelector('[data-growth-card="skill-ironWill"]') as HTMLElement
    const fortune = container.querySelector('[data-growth-card="skill-fortune"]') as HTMLElement

    expect(weapon).toHaveAttribute('data-growth-status', 'insufficient')
    expect(within(weapon).getByText('골드가 1 부족합니다.')).toBeVisible()
    expect(within(weapon).getByRole('button', {
      name: '불씨 검 강화 불가, 비용 36 골드, 골드 1 부족',
    })).toBeDisabled()

    expect(armor).toHaveAttribute('data-growth-status', 'available')
    fireEvent.click(within(armor).getByRole('button', { name: '수호 갑옷 강화, 비용 35 골드' }))
    expect(onUpgrade).toHaveBeenCalledTimes(1)
    expect(onUpgrade).toHaveBeenCalledWith('armor')

    expect(charm).toHaveAttribute('data-growth-status', 'max')
    expect(within(charm).getByRole('button', { name: '행운 부적 최대 강화' })).toBeDisabled()
    expect(within(charm).getByRole('button')).not.toHaveTextContent('G')

    expect(powerStrike).toHaveAttribute('data-growth-status', 'available')
    fireEvent.click(within(powerStrike).getByRole('button', { name: '화염 강타 각인, 비용 1 스킬 포인트' }))
    expect(onSkill).toHaveBeenCalledTimes(1)
    expect(onSkill).toHaveBeenCalledWith('powerStrike')

    expect(ironWill).toHaveAttribute('data-growth-status', 'max')
    expect(within(ironWill).getByRole('button', { name: '강철 의지 최대 랭크' })).toBeDisabled()
    expect(within(fortune).getByText('영웅 레벨 5에 해금됩니다.')).toBeVisible()
    expect(within(fortune).getByRole('button', { name: '전리품 감각 잠김, 영웅 레벨 5 필요, 비용 1 스킬 포인트' }))
      .toBeDisabled()
    expect(within(fortune).getByRole('button')).toHaveTextContent('1 SP')
  })

  it('calls the public command once at exact and cost-plus-one boundaries and never when one short', () => {
    const base = createInitialState(0, 0x409)
    const cost = getUpgradeCost('weapon', 0)
    const onBuy = vi.fn()
    const exact = {
      ...base,
      player: { ...base.player, gold: cost },
    }
    const { rerender } = render(<UpgradePanel state={exact} onBuy={onBuy} />)

    const exactButton = screen.getByRole('button', {
      name: `불씨 검 강화, 비용 ${cost} 골드`,
    })
    fireEvent.click(exactButton)
    expect(onBuy).toHaveBeenCalledTimes(1)

    rerender(
      <UpgradePanel
        state={{ ...exact, player: { ...exact.player, gold: cost - 1 } }}
        onBuy={onBuy}
      />,
    )
    const oneShort = screen.getByRole('button', {
      name: `불씨 검 강화 불가, 비용 ${cost} 골드, 골드 1 부족`,
    })
    expect(oneShort).toBeDisabled()
    fireEvent.click(oneShort)
    fireEvent.keyDown(oneShort, { key: 'Enter' })
    fireEvent.keyDown(oneShort, { key: ' ' })
    expect(onBuy).toHaveBeenCalledTimes(1)

    rerender(
      <UpgradePanel
        state={{ ...exact, player: { ...exact.player, gold: cost + 1 } }}
        onBuy={onBuy}
      />,
    )
    fireEvent.click(screen.getByRole('button', {
      name: `불씨 검 강화, 비용 ${cost} 골드`,
    }))
    expect(onBuy).toHaveBeenCalledTimes(2)
  })

  it('makes every action unavailable with a visible global reason', () => {
    const state = createInitialState(0, 0x409)
    const weaponCost = getUpgradeCost('weapon', 0)
    render(<UpgradePanel state={{ ...state, player: { ...state.player, gold: 999 } }} onBuy={vi.fn()} disabled />)

    expect(screen.getAllByText('읽기 전용이거나 저장 소유권을 확인 중입니다.'))
      .toHaveLength(3)
    expect(screen.getAllByRole('button').every((button) => button.hasAttribute('disabled')))
      .toBe(true)
    expect(screen.getByRole('button', {
      name: `불씨 검 강화 불가, 비용 ${weaponCost} 골드, 읽기 전용 또는 저장 확인 중`,
    })).toBeDisabled()
  })
})
