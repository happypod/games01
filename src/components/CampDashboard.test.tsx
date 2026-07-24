import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createInitialState } from '../game/engine'
import type { GameState } from '../game/types'
import { CampDashboard } from './CampDashboard'

function createCampState(): GameState {
  const state = createInitialState(0, 0x423_0001)
  state.currentMode = 'CAMP'
  return state
}

function renderCampDashboard(state = createCampState(), disabled = false) {
  const actions = {
    onUpgradeStructure: vi.fn(),
    onTrain: vi.fn(),
    onStartCraft: vi.fn(),
    onUseConsumable: vi.fn(),
    onHealAtCamp: vi.fn(),
    onEquipQuickConsumable: vi.fn(),
    onPurchaseMerchantOffer: vi.fn(),
    onAcceptSeraContract: vi.fn(),
    onIncreaseSeraTrust: vi.fn(),
    onSetAdultContentAccess: vi.fn(() => ({ success: false, message: 'unused', reason: 'rejected' as const })),
    onSetSeraBondConsent: vi.fn(() => ({ success: false, message: 'unused', reason: 'rejected' as const })),
    onSelectCostume: vi.fn(() => ({ success: false, message: 'unused', reason: 'rejected' as const })),
    onSynthesizeJointBond: vi.fn(() => ({ success: false, message: 'unused', reason: 'rejected' as const })),
  }
  render(
    <CampDashboard
      state={state}
      notice="캠프에서 휴식 중입니다."
      disabled={disabled}
      {...actions}
    />,
  )
  return actions
}

describe('IRPG-423 CampDashboard recovery controls', () => {
  it('shows the exact healing cost and invokes the camp command once', () => {
    const state = createCampState()
    state.player.currentHp = 50
    state.camp.materials.ashShard = 3
    const actions = renderCampDashboard(state)

    const heal = screen.getByRole('button', {
      name: '치유 화로 · 재의 파편 3개로 완전 회복',
    })
    expect(heal).toBeEnabled()
    expect(heal).toHaveTextContent('HP 50 → 100')
    fireEvent.click(heal)
    expect(actions.onHealAtCamp).toHaveBeenCalledTimes(1)
  })

  it('explains full-health, material-shortage, and global disabled states', () => {
    const full = createCampState()
    const { rerender } = render(
      <CampDashboard
        state={full}
        notice=""
        disabled={false}
        onUpgradeStructure={vi.fn()}
        onTrain={vi.fn()}
        onStartCraft={vi.fn()}
        onUseConsumable={vi.fn()}
        onHealAtCamp={vi.fn()}
        onEquipQuickConsumable={vi.fn()}
        onPurchaseMerchantOffer={vi.fn()}
        onAcceptSeraContract={vi.fn()}
        onIncreaseSeraTrust={vi.fn()}
        onSetAdultContentAccess={vi.fn(() => ({ success: false, message: 'unused', reason: 'rejected' as const }))}
        onSetSeraBondConsent={vi.fn(() => ({ success: false, message: 'unused', reason: 'rejected' as const }))}
        onSelectCostume={vi.fn(() => ({ success: false, message: 'unused', reason: 'rejected' as const }))}
        onSynthesizeJointBond={vi.fn(() => ({ success: false, message: 'unused', reason: 'rejected' as const }))}
      />,
    )
    expect(screen.getByRole('button', { name: '치유 화로 · 체력이 가득 참' }))
      .toBeDisabled()

    const short = createCampState()
    short.player.currentHp = 1
    short.camp.materials.ashShard = 4
    rerender(
      <CampDashboard
        state={short}
        notice=""
        disabled={false}
        onUpgradeStructure={vi.fn()}
        onTrain={vi.fn()}
        onStartCraft={vi.fn()}
        onUseConsumable={vi.fn()}
        onHealAtCamp={vi.fn()}
        onEquipQuickConsumable={vi.fn()}
        onPurchaseMerchantOffer={vi.fn()}
        onAcceptSeraContract={vi.fn()}
        onIncreaseSeraTrust={vi.fn()}
        onSetAdultContentAccess={vi.fn(() => ({ success: false, message: 'unused', reason: 'rejected' as const }))}
        onSetSeraBondConsent={vi.fn(() => ({ success: false, message: 'unused', reason: 'rejected' as const }))}
        onSelectCostume={vi.fn(() => ({ success: false, message: 'unused', reason: 'rejected' as const }))}
        onSynthesizeJointBond={vi.fn(() => ({ success: false, message: 'unused', reason: 'rejected' as const }))}
      />,
    )
    expect(screen.getByRole('button', {
      name: '치유 화로 · 재의 파편 5개 필요 · 재료 부족',
    })).toBeDisabled()

    rerender(
      <CampDashboard
        state={short}
        notice=""
        disabled
        onUpgradeStructure={vi.fn()}
        onTrain={vi.fn()}
        onStartCraft={vi.fn()}
        onUseConsumable={vi.fn()}
        onHealAtCamp={vi.fn()}
        onEquipQuickConsumable={vi.fn()}
        onPurchaseMerchantOffer={vi.fn()}
        onAcceptSeraContract={vi.fn()}
        onIncreaseSeraTrust={vi.fn()}
        onSetAdultContentAccess={vi.fn(() => ({ success: false, message: 'unused', reason: 'rejected' as const }))}
        onSetSeraBondConsent={vi.fn(() => ({ success: false, message: 'unused', reason: 'rejected' as const }))}
        onSelectCostume={vi.fn(() => ({ success: false, message: 'unused', reason: 'rejected' as const }))}
        onSynthesizeJointBond={vi.fn(() => ({ success: false, message: 'unused', reason: 'rejected' as const }))}
      />,
    )
    expect(screen.getByRole('button', { name: '치유 화로 · 지금은 사용할 수 없음' }))
      .toBeDisabled()
  })

  it('lists the recovery recipe inside the workbench popup and toggles persisted quick-slot equipment', () => {
    const state = createCampState()
    state.camp.materials.ashShard = 4
    state.camp.materials.beastHide = 2
    state.camp.consumables.healingPotion = 1
    const actions = renderCampDashboard(state)

    fireEvent.click(screen.getByRole('button', { name: /불씨 작업대 열기/ }))
    const dialog = screen.getByRole('dialog', { name: '불씨 작업대' })
    const recipe = within(dialog).getByRole('button', { name: '회복 물약 제작' })
    expect(recipe).toBeEnabled()
    expect(recipe.closest('.camp-recipe-card')).toHaveTextContent(
      '재의 파편 4 · 야수 가죽 2',
    )
    expect(recipe.closest('.camp-recipe-card')).toHaveTextContent('2분 0초')

    const equip = screen.getByRole('button', { name: '회복 물약 빠른 슬롯 장착' })
    expect(equip).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(equip)
    expect(actions.onEquipQuickConsumable).toHaveBeenCalledTimes(1)
    expect(actions.onEquipQuickConsumable).toHaveBeenCalledWith('healingPotion')
  })

  it('keeps an empty equipped potion visible and permits explicit unequip', () => {
    const state = createCampState()
    state.camp.quickConsumable = 'healingPotion'
    state.camp.consumables.healingPotion = 0
    const actions = renderCampDashboard(state)

    const equipped = screen.getByRole('button', {
      name: '회복 물약 빠른 슬롯 장착 해제',
    })
    expect(equipped).toBeEnabled()
    expect(equipped).toHaveAttribute('aria-pressed', 'true')
    expect(equipped).toHaveTextContent('회복 물약 ×0')
    fireEvent.click(equipped)
    expect(actions.onEquipQuickConsumable).toHaveBeenCalledWith(null)
  })
})

describe('IRPG-803 R1 CampDashboard camp canvas as the default screen', () => {
  it('shows the 2.5D canvas directly with no card/canvas toggle', () => {
    renderCampDashboard()
    expect(screen.getByTestId('camp-canvas')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /조감도 보기/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
  })

  it('opens the Sera popup with roving-focus internal tabs once she is rescued', () => {
    const state = createCampState()
    state.camp.residents.sera.status = 'rescued'
    renderCampDashboard(state)

    fireEvent.click(screen.getByRole('button', { name: '세라 열기' }))
    const dialog = screen.getByRole('dialog', { name: '성인 정찰병 세라' })
    const bond = within(dialog).getByRole('tab', { name: '유대 훈련실' })
    const synthesis = within(dialog).getByRole('tab', { name: '합동 연성실' })

    expect(bond).toHaveAttribute('aria-selected', 'true')
    bond.focus()
    fireEvent.keyDown(bond, { key: 'End' })
    expect(synthesis).toHaveFocus()
    expect(synthesis).toHaveAttribute('aria-selected', 'true')
    expect(within(dialog).getByText('연성 자산 보호 잠금')).toBeVisible()
  })
})
