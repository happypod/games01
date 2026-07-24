import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createInitialState } from '../game/engine'
import type { GameState } from '../game/types'
import { CampCanvas } from './CampCanvas'

vi.mock('./GameAsset', () => ({
  GameAsset: ({ assetId }: { assetId: string }) => (
    <span data-testid="camp-canvas-game-asset" data-asset-id={assetId} aria-hidden="true" />
  ),
}))

function createCanvasState(): GameState {
  const state = createInitialState(0, 0x55)
  state.player.gold = 10_000
  return state
}

function renderCanvas(state = createCanvasState(), disabled = false) {
  const actions = {
    onUpgradeStructure: vi.fn(),
    onTrain: vi.fn(),
    onStartCraft: vi.fn(),
    onPurchaseMerchantOffer: vi.fn(),
    onAcceptSeraContract: vi.fn(),
    onIncreaseSeraTrust: vi.fn(),
    onSetAdultContentAccess: vi.fn(() => ({ success: false, message: 'unused', reason: 'rejected' as const })),
    onSetSeraBondConsent: vi.fn(() => ({ success: false, message: 'unused', reason: 'rejected' as const })),
    onSelectCostume: vi.fn(() => ({ success: false, message: 'unused', reason: 'rejected' as const })),
    onSynthesizeJointBond: vi.fn(() => ({ success: false, message: 'unused', reason: 'rejected' as const })),
  }
  render(<CampCanvas state={state} disabled={disabled} {...actions} />)
  return actions
}

describe('IRPG-803 R1 CampCanvas (popup-driven buildings)', () => {
  it('renders every building as a focusable button with no popup open by default', () => {
    renderCanvas()
    expect(screen.getByRole('button', { name: /원정 텐트 열기/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /불씨 작업대 열기/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /단련소 열기/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '떠돌이 상인 열기' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens the tent popup on click and only calls onUpgradeStructure from inside it', () => {
    const actions = renderCanvas()
    const tentButton = screen.getByRole('button', { name: /원정 텐트 열기/ })
    tentButton.focus()
    fireEvent.click(tentButton)
    expect(actions.onUpgradeStructure).not.toHaveBeenCalled()

    const dialog = screen.getByRole('dialog', { name: '원정 텐트' })
    fireEvent.click(within(dialog).getByRole('button', { name: /확장/ }))
    expect(actions.onUpgradeStructure).toHaveBeenCalledWith('tent')
  })

  it('opens the workbench popup hosting storage summary and recipes', () => {
    const state = createCanvasState()
    state.camp.materials = { ashShard: 10, beastHide: 10, emberCore: 10 }
    renderCanvas(state)

    fireEvent.click(screen.getByRole('button', { name: /불씨 작업대 열기/ }))
    const dialog = screen.getByRole('dialog', { name: '불씨 작업대' })
    expect(within(dialog).getByText('캠프 대형 보관함 & 임시 전리품')).toBeVisible()
    expect(within(dialog).getByRole('button', { name: '회복 물약 제작' })).toBeEnabled()
  })

  it('opens the training ground popup and calls onTrain', () => {
    const actions = renderCanvas()
    fireEvent.click(screen.getByRole('button', { name: /단련소 열기/ }))
    const dialog = screen.getByRole('dialog', { name: '단련소' })
    fireEvent.click(within(dialog).getByRole('button', { name: /공격 훈련/ }))
    expect(actions.onTrain).toHaveBeenCalledWith('attack')
  })

  it('opens the merchant popup and calls onPurchaseMerchantOffer', () => {
    const actions = renderCanvas()
    fireEvent.click(screen.getByRole('button', { name: '떠돌이 상인 열기' }))
    const dialog = screen.getByRole('dialog', { name: /떠돌이 상인/ })
    fireEvent.click(within(dialog).getByRole('button', { name: /재 파편 꾸러미/ }))
    expect(actions.onPurchaseMerchantOffer).toHaveBeenCalledWith(0)
  })

  it('closes a popup on Escape and returns focus to the triggering building button', () => {
    renderCanvas()
    const tentButton = screen.getByRole('button', { name: /원정 텐트 열기/ })
    tentButton.focus()
    fireEvent.click(tentButton)
    const dialog = screen.getByRole('dialog', { name: '원정 텐트' })
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(tentButton).toHaveFocus()
  })

  it('hides the Sera building while unmet and disables every building when disabled is set', () => {
    renderCanvas(createCanvasState(), true)
    expect(screen.queryByRole('button', { name: '세라 열기' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /원정 텐트 열기/ })).toBeDisabled()
  })

  it('shows the Sera building once rescued and opens her popup', () => {
    const state = createCanvasState()
    state.camp.residents.sera.status = 'rescued'
    renderCanvas(state)

    fireEvent.click(screen.getByRole('button', { name: '세라 열기' }))
    expect(screen.getByRole('dialog', { name: '성인 정찰병 세라' })).toBeInTheDocument()
  })
})
