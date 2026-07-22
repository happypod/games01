import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { getEnemyDefinition } from '../game/content'
import { createInitialState } from '../game/engine'
import type { GameState } from '../game/types'
import {
  TacticalIntelPanel,
  type TacticalIntelPanelProps,
} from './TacticalIntelPanel'

vi.mock('./GameAsset', () => ({
  GameAsset: ({ assetId, className }: { assetId: string; className?: string }) => (
    <span
      data-testid="intel-game-asset"
      data-asset-id={assetId}
      className={className}
      aria-hidden="true"
    />
  ),
}))

function createIntelState(): GameState {
  const state = createInitialState(0, 0x424)
  state.player.level = 5
  state.player.currentHp = 75
  state.player.skills = { powerStrike: 2, ironWill: 1, fortune: 1 }
  state.player.upgrades = { weapon: 3, armor: 2, charm: 1 }
  state.battle.stage = 2
  state.battle.highestStage = 3
  state.battle.enemyHp = getEnemyDefinition(2).maxHp
  state.camp.materials = { ashShard: 12, beastHide: 4, emberCore: 1 }
  state.camp.consumables = { goldStew: 2, focusTonic: 1, healingPotion: 3 }
  return state
}

function renderIntel(
  state = createIntelState(),
  overrides: Partial<Omit<TacticalIntelPanelProps, 'state'>> = {},
) {
  const actions = {
    onChooseStage: vi.fn(),
    onEquipQuickConsumable: vi.fn(),
  }
  const props = { ...actions, ...overrides, state }
  const view = render(<TacticalIntelPanel {...props} />)
  return { ...view, actions, props }
}

function selectTab(name: string) {
  fireEvent.click(screen.getByRole('tab', { name }))
}

describe('IRPG-424 TacticalIntelPanel', () => {
  it('pins current enemy rewards, fixed drops, and exact-once boss milestone status', () => {
    const state = createIntelState()
    const boss = getEnemyDefinition(10)
    state.battle.stage = 10
    state.battle.highestStage = 10
    state.battle.enemyHp = Math.floor(boss.maxHp / 2)

    const { rerender, props } = renderIntel(state)
    const enemyRegion = screen.getByRole('region', { name: /재의 거인/ })

    expect(enemyRegion).toHaveAttribute('data-enemy-stage', '10')
    expect(enemyRegion).toHaveAttribute('data-milestone-status', 'available')
    expect(within(enemyRegion).getByRole('progressbar', { name: '적 체력' }))
      .toHaveAttribute('aria-valuemax', String(boss.maxHp))
    expect(within(enemyRegion).getByText('재의 파편').nextSibling).toHaveTextContent('+1')
    expect(within(enemyRegion).getByText('불씨 핵').nextSibling).toHaveTextContent('+1')
    expect(within(enemyRegion).getByText('골드 +15 지급 가능')).toBeVisible()

    const claimed: GameState = { ...state, claimedBossMilestoneMask: 1 }
    rerender(<TacticalIntelPanel {...props} state={claimed} />)
    expect(screen.getByRole('region', { name: /재의 거인/ }))
      .toHaveAttribute('data-milestone-status', 'claimed')
    expect(screen.getByText('지급 완료')).toBeVisible()
  })

  it('uses five selection-follows-focus tabs with one active tabpanel', () => {
    renderIntel()
    const tabs = screen.getAllByRole('tab')
    const map = screen.getByRole('tab', { name: '지도' })
    const character = screen.getByRole('tab', { name: '캐릭터' })
    const bestiary = screen.getByRole('tab', { name: '도감' })

    expect(tabs).toHaveLength(5)
    expect(map).toHaveAttribute('aria-selected', 'true')
    expect(map).toHaveAttribute('tabindex', '0')
    expect(tabs.filter((tab) => tab.tabIndex === 0)).toEqual([map])
    expect(screen.getAllByRole('tabpanel')).toHaveLength(1)
    expect(screen.getByRole('tabpanel', { name: '지도' })).toBeVisible()

    map.focus()
    fireEvent.keyDown(map, { key: 'ArrowRight' })
    expect(character).toHaveFocus()
    expect(character).toHaveAttribute('aria-selected', 'true')
    expect(screen.getAllByRole('tabpanel')).toHaveLength(1)
    expect(screen.getByRole('tabpanel', { name: '캐릭터' })).toBeVisible()
    expect(screen.queryByRole('button', { name: '원정 지도 열기' })).not.toBeInTheDocument()

    fireEvent.keyDown(character, { key: 'End' })
    expect(bestiary).toHaveFocus()
    fireEvent.keyDown(bestiary, { key: 'Home' })
    expect(map).toHaveFocus()
    fireEvent.keyDown(map, { key: 'ArrowLeft' })
    expect(bestiary).toHaveFocus()
  })

  it('supports a controlled tab so external quick-slot actions can reveal the bag', () => {
    const state = createIntelState()
    const onActiveTabChange = vi.fn()
    const onChooseStage = vi.fn()
    const onEquipQuickConsumable = vi.fn()
    const { rerender } = render(
      <TacticalIntelPanel
        state={state}
        activeTab="inventory"
        onActiveTabChange={onActiveTabChange}
        onChooseStage={onChooseStage}
        onEquipQuickConsumable={onEquipQuickConsumable}
      />,
    )

    expect(screen.getByRole('tabpanel', { name: '가방' })).toBeVisible()
    fireEvent.click(screen.getByRole('tab', { name: '스킬' }))
    expect(onActiveTabChange).toHaveBeenCalledExactlyOnceWith('skills')
    expect(screen.getByRole('tabpanel', { name: '가방' })).toBeVisible()

    rerender(
      <TacticalIntelPanel
        state={state}
        activeTab="skills"
        onActiveTabChange={onActiveTabChange}
        onChooseStage={onChooseStage}
        onEquipQuickConsumable={onEquipQuickConsumable}
      />,
    )
    expect(screen.getByRole('tabpanel', { name: '스킬' })).toBeVisible()
    expect(screen.getByRole('tab', { name: '스킬' })).toHaveFocus()
  })

  it('reuses the stage map and routes only selectable stages', () => {
    const { actions } = renderIntel()
    const mapPanel = screen.getByRole('tabpanel', { name: '지도' })

    expect(within(mapPanel).getByRole('button', { name: '원정 지도 열기' })).toBeVisible()
    fireEvent.click(within(mapPanel).getByRole('button', { name: '스테이지 1, 완료' }))
    fireEvent.click(within(mapPanel).getByRole('button', {
      name: /스테이지 4, 잠김/,
    }))
    expect(actions.onChooseStage.mock.calls).toEqual([[1]])
  })

  it('keeps character and skill intelligence read-only while exposing live values', () => {
    const state = createIntelState()
    state.player.companion = { id: 'emberFox', rank: 2 }
    state.battle.companionCooldownMs = 1_500
    state.battle.powerStrikeCooldownMs = 2_200
    renderIntel(state)

    selectTab('캐릭터')
    let panel = screen.getByRole('tabpanel', { name: '캐릭터' })
    expect(within(panel).getByRole('heading', { name: '아렌 · Lv.5' })).toBeVisible()
    expect(within(panel).getByRole('heading', {
      name: '불씨 여우 루미 · Rank 2',
    })).toBeVisible()
    expect(within(panel).getByText('2초')).toBeVisible()
    expect(within(panel).queryByRole('button')).not.toBeInTheDocument()

    selectTab('스킬')
    panel = screen.getByRole('tabpanel', { name: '스킬' })
    expect(panel.querySelectorAll('[data-skill-id]')).toHaveLength(3)
    expect(within(panel).getByText('자동 시전 3초')).toBeVisible()
    expect(within(panel).queryByRole('button')).not.toBeInTheDocument()
  })

  it('shows equipment, materials, three consumables and equips or unequips the potion', () => {
    const state = createIntelState()
    const { actions, rerender, props } = renderIntel(state)
    selectTab('가방')
    let panel = screen.getByRole('tabpanel', { name: '가방' })

    expect(panel.querySelectorAll('[data-consumable-id]')).toHaveLength(3)
    expect(within(panel).getByText('불씨 검')).toBeVisible()
    expect(within(panel).getByText('재의 파편').nextSibling).toHaveTextContent('12')
    expect(within(panel).getByRole('heading', { name: '회복 물약 ×3' })).toBeVisible()

    let equip = within(panel).getByRole('button', { name: /빠른 슬롯 장착.*HP/ })
    expect(equip).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(equip)
    expect(actions.onEquipQuickConsumable).toHaveBeenCalledExactlyOnceWith('healingPotion')

    const equipped: GameState = {
      ...state,
      camp: { ...state.camp, quickConsumable: 'healingPotion' },
    }
    rerender(<TacticalIntelPanel {...props} state={equipped} />)
    panel = screen.getByRole('tabpanel', { name: '가방' })
    equip = within(panel).getByRole('button', { name: /장착 해제.*HP/ })
    expect(equip).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(equip)
    expect(actions.onEquipQuickConsumable).toHaveBeenLastCalledWith(null)
  })

  it('keeps lookup tabs available but command-disables equipment changes', () => {
    const state = createIntelState()
    const { actions } = renderIntel(state, {
      disabled: true,
      disabledReason: '읽기 전용 탭에서는 장착을 변경할 수 없습니다.',
    })

    selectTab('가방')
    const panel = screen.getByRole('tabpanel', { name: '가방' })
    const equip = within(panel).getByRole('button', { name: /빠른 슬롯 장착.*HP/ })
    expect(equip).toBeDisabled()
    expect(equip).toHaveAccessibleDescription(
      '읽기 전용 탭에서는 장착을 변경할 수 없습니다.',
    )
    fireEvent.click(equip)
    expect(actions.onEquipQuickConsumable).not.toHaveBeenCalled()

    const skills = screen.getByRole('tab', { name: '스킬' })
    expect(skills).not.toBeDisabled()
    fireEvent.click(skills)
    expect(screen.getByRole('tabpanel', { name: '스킬' })).toBeVisible()
  })

  it('derives five normal and three boss discoveries from highest stage only', () => {
    const state = createIntelState()
    state.battle.highestStage = 20
    renderIntel(state)
    selectTab('도감')

    const panel = screen.getByRole('tabpanel', { name: '도감' })
    const entries = panel.querySelectorAll('[data-bestiary-id]')
    expect(entries).toHaveLength(8)
    expect(panel.querySelectorAll('[data-discovered="true"]')).toHaveLength(7)
    expect(panel.querySelectorAll('[data-discovered="false"]')).toHaveLength(1)
    expect(within(panel).getByRole('article', {
      name: '월식의 기사, 최초 등장 스테이지 20',
    })).toBeVisible()
    expect(within(panel).getByRole('article', {
      name: '미발견 적, 스테이지 30에서 발견 가능',
    })).toHaveTextContent('미발견')
  })
})
