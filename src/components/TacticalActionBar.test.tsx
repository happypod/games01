import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { COMPANION_DEFINITIONS, SKILL_DEFINITIONS, UPGRADE_DEFINITIONS } from '../game/content'
import { createInitialState } from '../game/engine'
import { getCompanionTrainingCost } from '../game/formulas'
import type { CompanionId, GameState, SkillId, UpgradeId } from '../game/types'
import { TacticalActionBar } from './TacticalActionBar'

const TACTICAL_ACTION_SLOT_IDS = [
  'weapon',
  'armor',
  'charm',
  'powerStrike',
  'ironWill',
  'fortune',
  'companion',
  'quickConsumable',
] as const

type TacticalActionSlotId = (typeof TACTICAL_ACTION_SLOT_IDS)[number]

vi.mock('./GameAsset', () => ({
  GameAsset: ({
    assetId,
    loading,
    purpose,
  }: {
    assetId: string
    loading?: string
    purpose: string
  }) => (
    <span
      data-testid="action-slot-game-asset"
      data-asset-id={assetId}
      data-loading={loading}
      data-purpose={purpose}
      aria-hidden="true"
    />
  ),
}))

function renderActionBar(
  state: GameState = createInitialState(0, 0x424),
  options: {
    disabled?: boolean
    disabledReason?: string
    onBuyUpgrade?: (id: UpgradeId) => void
    onBuySkill?: (id: SkillId) => void
    onRecruitCompanion?: (id: CompanionId) => void
    onTrainCompanion?: () => void
    onUseEquippedConsumable?: () => void
    onOpenInventory?: () => void
  } = {},
) {
  const actions = {
    onBuyUpgrade: options.onBuyUpgrade ?? vi.fn(),
    onBuySkill: options.onBuySkill ?? vi.fn(),
    onRecruitCompanion: options.onRecruitCompanion ?? vi.fn(),
    onTrainCompanion: options.onTrainCompanion ?? vi.fn(),
    onUseEquippedConsumable: options.onUseEquippedConsumable ?? vi.fn(),
    onOpenInventory: options.onOpenInventory ?? vi.fn(),
  }
  const renderWith = (nextState: GameState, nextDisabled = options.disabled ?? false) => (
    <TacticalActionBar
      state={nextState}
      {...actions}
      disabled={nextDisabled}
      {...(options.disabledReason === undefined
        ? {}
        : { disabledReason: options.disabledReason })}
    />
  )
  const view = render(renderWith(state))

  return {
    ...view,
    ...actions,
    rerenderState: (nextState: GameState, nextDisabled?: boolean) =>
      view.rerender(renderWith(nextState, nextDisabled)),
  }
}

function getSlot(id: TacticalActionSlotId): HTMLButtonElement {
  const slot = document.querySelector<HTMLButtonElement>(`[data-action-slot="${id}"]`)
  if (slot === null) throw new Error(`Missing tactical action slot: ${id}`)
  return slot
}

describe('IRPG-424 TacticalActionBar', () => {
  it('keeps six eager card assets in the fixed equipment, skill, companion, and quick-slot order', () => {
    const { container } = renderActionBar()

    expect([...container.querySelectorAll('[data-action-slot]')].map((slot) =>
      slot.getAttribute('data-action-slot'),
    )).toEqual([...TACTICAL_ACTION_SLOT_IDS])

    const assets = screen.getAllByTestId('action-slot-game-asset')
    expect(assets.map((asset) => asset.getAttribute('data-asset-id'))).toEqual([
      UPGRADE_DEFINITIONS.weapon.assetId,
      UPGRADE_DEFINITIONS.armor.assetId,
      UPGRADE_DEFINITIONS.charm.assetId,
      SKILL_DEFINITIONS.powerStrike.assetId,
      SKILL_DEFINITIONS.ironWill.assetId,
      SKILL_DEFINITIONS.fortune.assetId,
      COMPANION_DEFINITIONS.emberFox.assetId,
    ])
    expect(assets.slice(0, 6).every((asset) =>
      asset.getAttribute('data-loading') === 'eager'
      && asset.getAttribute('data-purpose') === 'card',
    )).toBe(true)
    expect(assets[6]).toHaveAttribute('data-loading', 'lazy')
    expect(assets[6]).toHaveAttribute('data-purpose', 'character')
    expect(container.querySelectorAll('.tactical-action-bar__slot-icon')).toHaveLength(1)
    expect(getSlot('weapon')).toHaveAttribute('tabindex', '0')
    expect(TACTICAL_ACTION_SLOT_IDS.slice(1).every((id) => getSlot(id).tabIndex === -1))
      .toBe(true)
  })

  it('uses one wrapping roving tab stop with Arrow and Home/End navigation', () => {
    renderActionBar()
    const weapon = getSlot('weapon')
    const armor = getSlot('armor')
    const quick = getSlot('quickConsumable')

    weapon.focus()
    fireEvent.keyDown(weapon, { key: 'ArrowLeft' })
    expect(quick).toHaveFocus()
    expect(quick).toHaveAttribute('tabindex', '0')
    expect(weapon).toHaveAttribute('tabindex', '-1')

    fireEvent.keyDown(quick, { key: 'ArrowRight' })
    expect(weapon).toHaveFocus()
    fireEvent.keyDown(weapon, { key: 'ArrowDown' })
    expect(armor).toHaveFocus()
    fireEvent.keyDown(armor, { key: 'ArrowUp' })
    expect(weapon).toHaveFocus()
    fireEvent.keyDown(weapon, { key: 'End' })
    expect(quick).toHaveFocus()
    fireEvent.keyDown(quick, { key: 'Home' })
    expect(weapon).toHaveFocus()
    expect(TACTICAL_ACTION_SLOT_IDS.filter((id) => getSlot(id).tabIndex === 0))
      .toEqual(['weapon'])
  })

  it('keeps one detail open and invokes upgrade and skill commands exactly once', () => {
    const state = createInitialState(0, 0x424)
    state.player.level = 10
    state.player.gold = 999
    state.player.skillPoints = 9
    const { onBuyUpgrade, onBuySkill } = renderActionBar(state)

    fireEvent.click(getSlot('weapon'))
    let detail = screen.getByRole('dialog', { name: '불씨 검' })
    expect(detail).toHaveAttribute('aria-modal', 'false')
    expect(detail).toHaveAttribute('data-action-status', 'available')
    expect(within(detail).getByRole('heading', { name: '불씨 검' })).toHaveFocus()
    fireEvent.click(within(detail).getByRole('button', { name: /불씨 검 강화/ }))
    expect(onBuyUpgrade).toHaveBeenCalledTimes(1)
    expect(onBuyUpgrade).toHaveBeenLastCalledWith('weapon')

    fireEvent.click(getSlot('powerStrike'))
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    detail = screen.getByRole('dialog', { name: '화염 강타' })
    fireEvent.click(within(detail).getByRole('button', { name: /화염 강타 각인/ }))
    expect(onBuySkill).toHaveBeenCalledTimes(1)
    expect(onBuySkill).toHaveBeenLastCalledWith('powerStrike')
  })

  it('preserves locked, free recruit, train, shortage, max, and disabled companion rules', () => {
    const lockedState = createInitialState(0, 0x424)
    const view = renderActionBar(lockedState)

    fireEvent.click(getSlot('companion'))
    let detail = screen.getByRole('dialog', { name: COMPANION_DEFINITIONS.emberFox.name })
    expect(detail).toHaveAttribute('data-action-status', 'locked')
    expect(detail).toHaveTextContent(`스테이지 ${COMPANION_DEFINITIONS.emberFox.unlockStage}`)
    expect(within(detail).getByRole('button', { name: '무료 영입' })).toBeDisabled()

    const recruitable = structuredClone(lockedState)
    recruitable.battle.highestStage = COMPANION_DEFINITIONS.emberFox.unlockStage
    view.rerenderState(recruitable)
    detail = screen.getByRole('dialog', { name: COMPANION_DEFINITIONS.emberFox.name })
    expect(detail).toHaveAttribute('data-action-status', 'available')
    fireEvent.click(within(detail).getByRole('button', { name: '무료 영입' }))
    expect(view.onRecruitCompanion).toHaveBeenCalledTimes(1)
    expect(view.onRecruitCompanion).toHaveBeenCalledWith('emberFox')

    const recruited = structuredClone(recruitable)
    recruited.player.companion = { id: 'emberFox', rank: 1 }
    recruited.player.gold = getCompanionTrainingCost('emberFox', 1)
    view.rerenderState(recruited)
    detail = screen.getByRole('dialog', { name: COMPANION_DEFINITIONS.emberFox.name })
    expect(detail).toHaveAttribute('data-action-status', 'available')
    expect(detail).toHaveTextContent('협공 피해')
    fireEvent.click(within(detail).getByRole('button', { name: /동료 훈련/ }))
    expect(view.onTrainCompanion).toHaveBeenCalledTimes(1)

    const short = structuredClone(recruited)
    short.player.gold -= 1
    view.rerenderState(short)
    detail = screen.getByRole('dialog', { name: COMPANION_DEFINITIONS.emberFox.name })
    expect(detail).toHaveAttribute('data-action-status', 'insufficient')
    expect(within(detail).getByRole('button', { name: /동료 훈련/ })).toBeDisabled()

    const max = structuredClone(recruited)
    max.player.companion.rank = COMPANION_DEFINITIONS.emberFox.maxRank
    view.rerenderState(max)
    detail = screen.getByRole('dialog', { name: COMPANION_DEFINITIONS.emberFox.name })
    expect(detail).toHaveAttribute('data-action-status', 'max')
    expect(within(detail).getByRole('button', { name: 'MAX' })).toBeDisabled()

    view.rerenderState(recruited, true)
    detail = screen.getByRole('dialog', { name: COMPANION_DEFINITIONS.emberFox.name })
    expect(detail).toHaveAttribute('data-action-status', 'globally-disabled')
    expect(within(detail).getByRole('button', { name: /동료 훈련/ })).toBeDisabled()
  })

  it('opens inventory when unmounted and uses an available equipped potion exactly once', () => {
    const unmounted = createInitialState(0, 0x424)
    unmounted.player.currentHp = 50
    unmounted.camp.consumables.healingPotion = 2
    const view = renderActionBar(unmounted)

    fireEvent.click(getSlot('quickConsumable'))
    let detail = screen.getByRole('dialog', { name: '빠른 소모품' })
    expect(detail).toHaveAttribute('data-action-status', 'unmounted')
    expect(detail).toHaveTextContent('보유 2')
    fireEvent.click(within(detail).getByRole('button', { name: '인벤토리 열기' }))
    expect(view.onOpenInventory).toHaveBeenCalledTimes(1)
    expect(view.onUseEquippedConsumable).not.toHaveBeenCalled()

    const equipped = structuredClone(unmounted)
    equipped.camp.quickConsumable = 'healingPotion'
    view.rerenderState(equipped)
    fireEvent.click(getSlot('quickConsumable'))
    detail = screen.getByRole('dialog', { name: '회복 물약' })
    expect(detail).toHaveAttribute('data-action-status', 'available')
    expect(detail).toHaveTextContent('35 HP')
    fireEvent.click(within(detail).getByRole('button', { name: '회복 물약 사용' }))
    expect(view.onUseEquippedConsumable).toHaveBeenCalledTimes(1)
  })

  it('projects empty, full-health, and globally-disabled quick-item states without use', () => {
    const empty = createInitialState(0, 0x424)
    empty.player.currentHp = 50
    empty.camp.quickConsumable = 'healingPotion'
    const view = renderActionBar(empty)

    fireEvent.click(getSlot('quickConsumable'))
    let detail = screen.getByRole('dialog', { name: '회복 물약' })
    expect(detail).toHaveAttribute('data-action-status', 'empty')
    expect(detail).toHaveTextContent('장착은 유지되지만')
    expect(within(detail).getByRole('button', { name: '회복 물약 사용' })).toBeDisabled()

    const full = structuredClone(empty)
    full.player.currentHp = 100
    full.camp.consumables.healingPotion = 1
    view.rerenderState(full)
    detail = screen.getByRole('dialog', { name: '회복 물약' })
    expect(detail).toHaveAttribute('data-action-status', 'full')
    expect(detail).toHaveTextContent('체력이 가득')

    const disabled = structuredClone(empty)
    disabled.camp.consumables.healingPotion = 1
    view.rerenderState(disabled, true)
    detail = screen.getByRole('dialog', { name: '회복 물약' })
    expect(detail).toHaveAttribute('data-action-status', 'globally-disabled')
    expect(within(detail).getByRole('button', { name: '회복 물약 사용' })).toBeDisabled()
    expect(view.onUseEquippedConsumable).not.toHaveBeenCalled()
  })

  it('closes on Escape and outside input while restoring the active trigger focus', () => {
    renderActionBar()
    const trigger = getSlot('companion')
    trigger.focus()
    fireEvent.click(trigger)
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
    expect(trigger).toHaveAttribute('tabindex', '0')

    fireEvent.click(trigger)
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('restores focus from Close and leaves nested modal Escape ownership intact', () => {
    renderActionBar()
    const trigger = getSlot('weapon')

    fireEvent.click(trigger)
    let detail = screen.getByRole('dialog', { name: '불씨 검' })
    fireEvent.click(within(detail).getByRole('button', { name: '불씨 검 상세 닫기' }))
    expect(screen.queryByRole('dialog', { name: '불씨 검' })).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()

    fireEvent.click(trigger)
    detail = screen.getByRole('dialog', { name: '불씨 검' })
    const nestedModal = document.createElement('section')
    nestedModal.setAttribute('role', 'dialog')
    nestedModal.setAttribute('aria-modal', 'true')
    nestedModal.tabIndex = -1
    detail.append(nestedModal)
    nestedModal.focus()
    fireEvent.keyDown(nestedModal, { key: 'Escape' })
    expect(screen.getByRole('dialog', { name: '불씨 검' })).toBeInTheDocument()
  })
})
