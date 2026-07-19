import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createInitialState } from '../game/engine'
import { getUpgradeCost } from '../game/formulas'
import type { GameState } from '../game/types'
import { GrowthTabs, type GrowthTabsProps } from './GrowthTabs'

vi.mock('./GameAsset', () => ({
  GameAsset: ({ assetId }: { assetId: string }) => (
    <div data-testid="mock-game-asset" data-asset-id={assetId} aria-hidden="true" />
  ),
}))

afterEach(() => vi.unstubAllGlobals())

function createGrowthState(): GameState {
  const state = createInitialState(0, 0x414)
  return {
    ...state,
    player: {
      ...state.player,
      level: 5,
      gold: 1_000,
      skillPoints: 3,
    },
    battle: {
      ...state.battle,
      stage: 11,
      highestStage: 11,
    },
  }
}

function renderGrowthTabs(
  state = createGrowthState(),
  overrides: Partial<Omit<GrowthTabsProps, 'state'>> = {},
) {
  const actions = {
    onBuyUpgrade: vi.fn(),
    onBuySkill: vi.fn(),
    onRecruitCompanion: vi.fn(),
    onTrainCompanion: vi.fn(),
  }
  const props = { ...actions, ...overrides, state }
  const view = render(<GrowthTabs {...props} />)
  return { ...view, actions, props }
}

describe('GrowthTabs', () => {
  it('exposes an accessible roving tablist while keeping every panel mounted', () => {
    const { container } = renderGrowthTabs()
    const tablist = screen.getByRole('tablist', { name: '성장 메뉴' })
    const equipment = within(tablist).getByRole('tab', { name: /장비/ })
    const skill = within(tablist).getByRole('tab', { name: '스킬' })
    const companion = within(tablist).getByRole('tab', { name: '동료' })

    expect(equipment).toHaveAttribute('aria-selected', 'true')
    expect(equipment).toHaveAttribute('tabindex', '0')
    expect(equipment).toHaveAttribute('aria-controls', 'growth-tabpanel-equipment')
    expect(skill).toHaveAttribute('aria-selected', 'false')
    expect(skill).toHaveAttribute('tabindex', '-1')
    expect(skill).toHaveAttribute('aria-controls', 'growth-tabpanel-skill')
    expect(companion).toHaveAttribute('aria-selected', 'false')
    expect(companion).toHaveAttribute('tabindex', '-1')
    expect(companion).toHaveAttribute('aria-controls', 'growth-tabpanel-companion')
    expect(within(equipment).getByText('강화 가능')).toHaveClass('sr-only')

    const equipmentPanel = screen.getByRole('tabpanel', { name: /장비/ })
    const skillPanel = screen.getByRole('tabpanel', { name: '스킬' })
    const companionPanel = screen.getByRole('tabpanel', { name: '동료' })
    expect(equipmentPanel).toHaveAttribute('data-active', 'true')
    expect(skillPanel).toHaveAttribute('data-active', 'false')
    expect(companionPanel).toHaveAttribute('data-active', 'false')
    for (const panel of [equipmentPanel, skillPanel, companionPanel]) {
      expect(panel).not.toHaveAttribute('hidden')
      expect(panel).toBeInTheDocument()
    }

    const progressionPanels = container.querySelector('.progression-panels')
    expect(progressionPanels).toContainElement(equipmentPanel)
    expect(progressionPanels).toContainElement(skillPanel)
    expect(progressionPanels).not.toContainElement(companionPanel)
  })

  it('uses selection-follows-focus for arrows, wrapping, Home, and End', () => {
    renderGrowthTabs()
    const equipment = screen.getByRole('tab', { name: /장비/ })
    const skill = screen.getByRole('tab', { name: '스킬' })
    const companion = screen.getByRole('tab', { name: '동료' })

    equipment.focus()
    fireEvent.keyDown(equipment, { key: 'ArrowRight' })
    expect(skill).toHaveFocus()
    expect(skill).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel', { name: '스킬' })).toHaveAttribute('data-active', 'true')

    fireEvent.keyDown(skill, { key: 'ArrowLeft' })
    expect(equipment).toHaveFocus()
    fireEvent.keyDown(equipment, { key: 'ArrowLeft' })
    expect(companion).toHaveFocus()
    expect(companion).toHaveAttribute('aria-selected', 'true')

    fireEvent.keyDown(companion, { key: 'Home' })
    expect(equipment).toHaveFocus()
    expect(equipment).toHaveAttribute('aria-selected', 'true')
    fireEvent.keyDown(equipment, { key: 'End' })
    expect(companion).toHaveFocus()
    expect(companion).toHaveAttribute('aria-selected', 'true')
    expect(screen.getAllByRole('tab').filter((tab) => tab.tabIndex === 0)).toEqual([companion])
  })

  it('routes each panel action exactly once without cross-calling other commands', () => {
    const state = createGrowthState()
    const { actions, rerender, props } = renderGrowthTabs(state)

    const equipmentPanel = screen.getByRole('tabpanel', { name: /장비/ })
    fireEvent.click(within(equipmentPanel).getByRole('button', {
      name: `불씨 검 강화, 비용 ${getUpgradeCost('weapon', 0)} 골드`,
    }))
    expect(actions.onBuyUpgrade).toHaveBeenCalledExactlyOnceWith('weapon')

    fireEvent.click(screen.getByRole('tab', { name: '스킬' }))
    const skillPanel = screen.getByRole('tabpanel', { name: '스킬' })
    fireEvent.click(within(skillPanel).getByRole('button', {
      name: '화염 강타 각인, 비용 1 스킬 포인트',
    }))
    expect(actions.onBuySkill).toHaveBeenCalledExactlyOnceWith('powerStrike')

    fireEvent.click(screen.getByRole('tab', { name: '동료' }))
    const companionPanel = screen.getByRole('tabpanel', { name: '동료' })
    fireEvent.click(within(companionPanel).getByRole('button', {
      name: '불씨 여우 루미 영입, 무료',
    }))
    expect(actions.onRecruitCompanion).toHaveBeenCalledExactlyOnceWith('emberFox')

    const recruitedState: GameState = {
      ...state,
      player: {
        ...state.player,
        companion: { id: 'emberFox', rank: 1 },
      },
    }
    rerender(<GrowthTabs {...props} state={recruitedState} />)
    fireEvent.click(within(companionPanel).getByRole('button', {
      name: '불씨 여우 루미 훈련, 비용 100 골드',
    }))
    expect(actions.onTrainCompanion).toHaveBeenCalledTimes(1)
    expect(actions.onBuyUpgrade).toHaveBeenCalledTimes(1)
    expect(actions.onBuySkill).toHaveBeenCalledTimes(1)
    expect(actions.onRecruitCompanion).toHaveBeenCalledTimes(1)
  })

  it('preserves pointer selection across game-state rerenders', () => {
    const state = createGrowthState()
    const { rerender, props } = renderGrowthTabs(state)
    const companion = screen.getByRole('tab', { name: '동료' })

    fireEvent.click(companion)
    expect(companion).toHaveAttribute('aria-selected', 'true')
    rerender(
      <GrowthTabs
        {...props}
        state={{
          ...state,
          battle: { ...state.battle, enemyHp: state.battle.enemyHp - 1 },
        }}
      />,
    )

    expect(companion).toHaveAttribute('aria-selected', 'true')
    expect(companion).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('tabpanel', { name: '동료' })).toHaveAttribute('data-active', 'true')
  })

  it('forwards the global disabled state without disabling tab navigation', () => {
    const { actions } = renderGrowthTabs(createGrowthState(), { disabled: true })

    for (const panel of screen.getAllByRole('tabpanel')) {
      for (const button of within(panel).getAllByRole('button')) {
        expect(button).toBeDisabled()
        fireEvent.click(button)
      }
    }
    expect(screen.getAllByRole('tab').every((tab) => !tab.hasAttribute('disabled'))).toBe(true)
    expect(actions.onBuyUpgrade).not.toHaveBeenCalled()
    expect(actions.onBuySkill).not.toHaveBeenCalled()
    expect(actions.onRecruitCompanion).not.toHaveBeenCalled()
    expect(actions.onTrainCompanion).not.toHaveBeenCalled()
  })

  it('uses ordinary stacked sections instead of inactive tab semantics below 1024px', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: false,
      media: '(min-width: 1024px)',
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })))

    renderGrowthTabs()

    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
    expect(screen.queryAllByRole('tab')).toHaveLength(0)
    expect(screen.queryAllByRole('tabpanel')).toHaveLength(0)
    for (const id of ['equipment', 'skill', 'companion']) {
      expect(document.querySelector(`#growth-tabpanel-${id}`))
        .toHaveAttribute('data-active', 'true')
    }
    expect(screen.getByRole('region', { name: '성장 장비' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: '스킬 각인' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: '동료 원정대' })).toBeInTheDocument()
  })
})
