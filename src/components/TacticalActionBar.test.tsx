import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SKILL_DEFINITIONS, UPGRADE_DEFINITIONS } from '../game/content'
import { createInitialState } from '../game/engine'
import type { GameState, SkillId, UpgradeId } from '../game/types'
import { TacticalActionBar } from './TacticalActionBar'

const TACTICAL_ACTION_SLOT_IDS = [
  'weapon',
  'armor',
  'charm',
  'powerStrike',
  'ironWill',
  'fortune',
  'goldStew',
  'focusTonic',
] as const

type TacticalActionSlotId = (typeof TACTICAL_ACTION_SLOT_IDS)[number]

vi.mock('./GameAsset', () => ({
  GameAsset: ({ assetId, loading }: { assetId: string; loading?: string }) => (
    <span
      data-testid="action-slot-game-asset"
      data-asset-id={assetId}
      data-loading={loading}
      aria-hidden="true"
    />
  ),
}))

function renderActionBar(
  state: GameState = createInitialState(0, 0x422),
  options: {
    disabled?: boolean
    disabledReason?: string
    onBuyUpgrade?: (id: UpgradeId) => void
    onBuySkill?: (id: SkillId) => void
    onEnterCamp?: () => void
  } = {},
) {
  const onBuyUpgrade: (id: UpgradeId) => void = options.onBuyUpgrade ?? vi.fn()
  const onBuySkill: (id: SkillId) => void = options.onBuySkill ?? vi.fn()
  const onEnterCamp: () => void = options.onEnterCamp ?? vi.fn()
  const view = render(
    <TacticalActionBar
      state={state}
      onBuyUpgrade={onBuyUpgrade}
      onBuySkill={onBuySkill}
      onEnterCamp={onEnterCamp}
      {...(options.disabled === undefined ? {} : { disabled: options.disabled })}
      {...(options.disabledReason === undefined
        ? {}
        : { disabledReason: options.disabledReason })}
    />,
  )

  return { ...view, onBuyUpgrade, onBuySkill, onEnterCamp }
}

function getSlot(id: TacticalActionSlotId): HTMLButtonElement {
  const slot = document.querySelector<HTMLButtonElement>(`[data-action-slot="${id}"]`)
  if (slot === null) throw new Error(`Missing tactical action slot: ${id}`)
  return slot
}

describe('IRPG-422 TacticalActionBar', () => {
  it('mounts all six production card assets immediately in the fixed eight-slot order', () => {
    const { container } = renderActionBar()

    expect([...container.querySelectorAll('[data-action-slot]')].map((slot) =>
      slot.getAttribute('data-action-slot'),
    )).toEqual([...TACTICAL_ACTION_SLOT_IDS])
    expect([...screen.getAllByTestId('action-slot-game-asset')].map((asset) =>
      asset.getAttribute('data-asset-id'),
    )).toEqual([
      UPGRADE_DEFINITIONS.weapon.assetId,
      UPGRADE_DEFINITIONS.armor.assetId,
      UPGRADE_DEFINITIONS.charm.assetId,
      SKILL_DEFINITIONS.powerStrike.assetId,
      SKILL_DEFINITIONS.ironWill.assetId,
      SKILL_DEFINITIONS.fortune.assetId,
    ])
    expect(screen.getAllByTestId('action-slot-game-asset').every((asset) =>
      asset.getAttribute('data-loading') === 'eager',
    )).toBe(true)
    expect(container.querySelectorAll('.tactical-action-bar__slot-icon')).toHaveLength(2)
    expect(getSlot('weapon')).toHaveAttribute('tabindex', '0')
    expect(TACTICAL_ACTION_SLOT_IDS.slice(1).every((id) => getSlot(id).tabIndex === -1))
      .toBe(true)
  })

  it('uses one roving tab stop with wrapping arrow and Home/End navigation', () => {
    renderActionBar()
    const weapon = getSlot('weapon')
    const armor = getSlot('armor')
    const focusTonic = getSlot('focusTonic')

    weapon.focus()
    fireEvent.keyDown(weapon, { key: 'ArrowLeft' })
    expect(focusTonic).toHaveFocus()
    expect(focusTonic).toHaveAttribute('tabindex', '0')
    expect(weapon).toHaveAttribute('tabindex', '-1')

    fireEvent.keyDown(focusTonic, { key: 'ArrowRight' })
    expect(weapon).toHaveFocus()

    fireEvent.keyDown(weapon, { key: 'ArrowDown' })
    expect(armor).toHaveFocus()
    fireEvent.keyDown(armor, { key: 'ArrowUp' })
    expect(weapon).toHaveFocus()

    fireEvent.keyDown(weapon, { key: 'End' })
    expect(focusTonic).toHaveFocus()
    fireEvent.keyDown(focusTonic, { key: 'Home' })
    expect(weapon).toHaveFocus()
    expect(TACTICAL_ACTION_SLOT_IDS.filter((id) => getSlot(id).tabIndex === 0))
      .toEqual(['weapon'])
  })

  it('keeps one non-modal detail open and calls upgrade and skill commands exactly once', () => {
    const base = createInitialState(0, 0x422)
    const state = {
      ...base,
      player: {
        ...base.player,
        level: 10,
        gold: 999,
        skillPoints: 9,
      },
    }
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
    expect(detail).toHaveTextContent('AUTO · 준비')
    fireEvent.click(within(detail).getByRole('button', { name: /화염 강타 각인/ }))
    expect(onBuySkill).toHaveBeenCalledTimes(1)
    expect(onBuySkill).toHaveBeenLastCalledWith('powerStrike')
  })

  it('projects insufficient, max, locked and globally disabled states without firing commands', () => {
    const base = createInitialState(0, 0x422)
    const mixedState: GameState = {
      ...base,
      player: {
        ...base.player,
        level: 3,
        gold: 0,
        skillPoints: 0,
        upgrades: {
          ...base.player.upgrades,
          charm: UPGRADE_DEFINITIONS.charm.maxLevel,
        },
        skills: {
          powerStrike: 0,
          ironWill: SKILL_DEFINITIONS.ironWill.maxRank,
          fortune: 0,
        },
      },
    }
    const { onBuyUpgrade, onBuySkill, rerender } = renderActionBar(mixedState)

    fireEvent.click(getSlot('armor'))
    expect(screen.getByRole('dialog', { name: '수호 갑옷' }))
      .toHaveAttribute('data-action-status', 'insufficient')
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: /수호 갑옷 강화/ }))
      .toBeDisabled()

    fireEvent.click(getSlot('charm'))
    expect(screen.getByRole('dialog', { name: '행운 부적' }))
      .toHaveAttribute('data-action-status', 'max')

    fireEvent.click(getSlot('fortune'))
    const locked = screen.getByRole('dialog', { name: '전리품 감각' })
    expect(locked).toHaveAttribute('data-action-status', 'locked')
    expect(locked).toHaveTextContent('PASSIVE')

    rerender(
      <TacticalActionBar
        state={{
          ...mixedState,
          player: { ...mixedState.player, gold: 999 },
        }}
        onBuyUpgrade={onBuyUpgrade}
        onBuySkill={onBuySkill}
        onEnterCamp={vi.fn()}
        disabled
        disabledReason="저장 소유권 확인 중"
      />,
    )
    fireEvent.click(getSlot('weapon'))
    const globallyDisabled = screen.getByRole('dialog', { name: '불씨 검' })
    expect(globallyDisabled).toHaveAttribute('data-action-status', 'globally-disabled')
    expect(globallyDisabled).toHaveTextContent('저장 소유권 확인 중')
    fireEvent.click(within(globallyDisabled).getByRole('button', { name: /불씨 검 강화/ }))

    expect(onBuyUpgrade).not.toHaveBeenCalled()
    expect(onBuySkill).not.toHaveBeenCalled()
  })

  it('shows consumable counts and active buffs while routing the action to camp only', () => {
    const base = createInitialState(0, 0x422)
    const state: GameState = {
      ...base,
      camp: {
        ...base.camp,
        consumables: { goldStew: 2, focusTonic: 1 },
        buffs: { goldBoostRounds: 120, bossFocusStage: 0 },
      },
    }
    const { onEnterCamp } = renderActionBar(state)

    fireEvent.click(getSlot('goldStew'))
    let detail = screen.getByRole('dialog', { name: '황금 스튜' })
    expect(detail).toHaveTextContent('보유 2')
    expect(detail).toHaveTextContent('현재 효과가 120라운드 남았습니다.')
    fireEvent.click(within(detail).getByRole('button', { name: '캠프에서 준비' }))
    expect(onEnterCamp).toHaveBeenCalledTimes(1)

    fireEvent.click(getSlot('focusTonic'))
    detail = screen.getByRole('dialog', { name: '집중 물약' })
    expect(detail).toHaveTextContent('보유 1')
    expect(detail).toHaveTextContent('다음 보스전을 위한 집중 효과가 준비되어 있습니다.')
    fireEvent.click(within(detail).getByRole('button', { name: '캠프에서 준비' }))
    expect(onEnterCamp).toHaveBeenCalledTimes(2)
  })

  it('closes on Escape with trigger focus restoration and closes on outside pointer input', () => {
    renderActionBar()
    const trigger = getSlot('armor')
    trigger.focus()
    fireEvent.click(trigger)
    expect(screen.getByRole('dialog', { name: '수호 갑옷' })).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
    expect(trigger).toHaveAttribute('tabindex', '0')
    expect(getSlot('weapon')).toHaveAttribute('tabindex', '-1')

    fireEvent.click(trigger)
    expect(screen.getByRole('dialog', { name: '수호 갑옷' })).toBeInTheDocument()
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('restores trigger focus from the close action and leaves nested modal Escape ownership intact', () => {
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
