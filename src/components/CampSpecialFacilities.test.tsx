import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createInitialState } from '../game/engine'
import type { GameState } from '../game/types'
import type { GameCommandFeedback } from '../hooks/useGame'
import { CampSpecialFacilities, type CampSpecialFacilityId } from './CampSpecialFacilities'

const committedFeedback = {
  success: true,
  message: 'committed',
  reason: 'committed' as const,
}
const rejectedFeedback = {
  success: false,
  message: 'rejected',
  reason: 'rejected' as const,
}

function createCampState(): GameState {
  const state = createInitialState(0, 0x425_0428)
  state.currentMode = 'CAMP'
  state.player.gold = 2_000
  state.camp.materials = { ashShard: 20, beastHide: 10, emberCore: 2 }
  state.camp.residents.sera = { status: 'contracted', trust: 1 }
  return state
}

function renderFacility(
  activeFacility: CampSpecialFacilityId,
  state = createCampState(),
  synthesisFeedback: GameCommandFeedback = committedFeedback,
) {
  const actions = {
    onSetAdultContentAccess: vi.fn(() => committedFeedback),
    onSetSeraBondConsent: vi.fn(() => committedFeedback),
    onSelectCostume: vi.fn(() => committedFeedback),
    onSynthesizeJointBond: vi.fn(() => synthesisFeedback),
    onIncreaseSeraTrust: vi.fn(),
  }
  render(
    <CampSpecialFacilities
      activeFacility={activeFacility}
      state={state}
      disabled={false}
      {...actions}
    />,
  )
  return actions
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('IRPG-425/428 CampSpecialFacilities', () => {
  it('does not mount protected costume or synthesis assets before authorization', () => {
    const state = createCampState()
    const { rerender } = render(
      <CampSpecialFacilities
        activeFacility="costumeRoom"
        state={state}
        disabled={false}
        onSetAdultContentAccess={vi.fn(() => committedFeedback)}
        onSetSeraBondConsent={vi.fn(() => committedFeedback)}
        onSelectCostume={vi.fn(() => committedFeedback)}
        onSynthesizeJointBond={vi.fn(() => committedFeedback)}
        onIncreaseSeraTrust={vi.fn()}
      />,
    )

    expect(screen.getByText('의상 자산 보호 잠금')).toBeVisible()
    expect(document.querySelector('[data-asset-id="costume.chapter1.sera.ember-bond"]'))
      .not.toBeInTheDocument()

    rerender(
      <CampSpecialFacilities
        activeFacility="jointSynthesis"
        state={state}
        disabled={false}
        onSetAdultContentAccess={vi.fn(() => committedFeedback)}
        onSetSeraBondConsent={vi.fn(() => committedFeedback)}
        onSelectCostume={vi.fn(() => committedFeedback)}
        onSynthesizeJointBond={vi.fn(() => committedFeedback)}
        onIncreaseSeraTrust={vi.fn()}
      />,
    )

    expect(screen.getByText('연성 자산 보호 잠금')).toBeVisible()
    expect(document.querySelector('[data-asset-id="hero.ashen-knight.default"]'))
      .not.toBeInTheDocument()
    expect(document.querySelector('[data-asset-id="costume.chapter1.sera.ember-bond"]'))
      .not.toBeInTheDocument()
  })

  it('requires separate adult confirmation and Sera consent, then exposes both off paths', () => {
    const state = createCampState()
    const actions = renderFacility('bondTraining', state)

    const acknowledgement = screen.getByRole('checkbox', {
      name: /나는 18세 이상이며, 등장인물은 모두 성인이고/,
    })
    const confirm = screen.getByRole('button', { name: '성인 콘텐츠 접근 확인' })
    expect(confirm).toBeDisabled()
    fireEvent.click(acknowledgement)
    fireEvent.click(confirm)
    expect(actions.onSetAdultContentAccess).toHaveBeenCalledWith(true)

    state.camp.bond.adultAccessConfirmed = true
    const { unmount } = render(
      <CampSpecialFacilities
        activeFacility="bondTraining"
        state={state}
        disabled={false}
        {...actions}
      />,
    )
    fireEvent.click(screen.getAllByRole('button', { name: '세라의 자율 동의 확인' }).at(-1)!)
    expect(actions.onSetSeraBondConsent).toHaveBeenCalledWith('granted')
    unmount()

    state.camp.bond.seraConsent = 'granted'
    render(
      <CampSpecialFacilities
        activeFacility="bondTraining"
        state={state}
        disabled={false}
        {...actions}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: '동의 철회' }))
    expect(actions.onSetSeraBondConsent).toHaveBeenCalledWith('withdrawn')
    fireEvent.click(screen.getByRole('button', { name: '성인 콘텐츠 접근 끄기' }))
    expect(actions.onSetAdultContentAccess).toHaveBeenLastCalledWith(false)
  })

  it('allows adult access to be turned off before Sera signs a camp contract', () => {
    const state = createCampState()
    state.camp.residents.sera = { status: 'rescued', trust: 0 }
    state.camp.bond.adultAccessConfirmed = true
    const actions = renderFacility('bondTraining', state)

    expect(screen.getByText(/자발적 캠프 계약을 먼저 완료/)).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: '성인 콘텐츠 접근 끄기' }))
    expect(actions.onSetAdultContentAccess).toHaveBeenCalledWith(false)
  })

  it('renders only the manifest-mapped Chapter I costume after consent', () => {
    const state = createCampState()
    state.camp.bond.adultAccessConfirmed = true
    state.camp.bond.seraConsent = 'granted'
    const actions = renderFacility('costumeRoom', state)

    const costume = document.querySelector('[data-asset-id="costume.chapter1.sera.ember-bond"]')
    expect(costume).toBeInTheDocument()
    const choice = screen.getByRole('radio', { name: /세라의 잿불 정찰복/ })
    expect(choice).toBeChecked()
    expect(actions.onSelectCostume).not.toHaveBeenCalled()
    expect(document.querySelector('[data-asset-id*="chapter2"], [data-asset-id*="chapter3"]'))
      .not.toBeInTheDocument()
  })

  it('starts the reveal only after a committed synthesis and restores focus from the reward dialog', async () => {
    vi.useFakeTimers()
    const state = createCampState()
    state.camp.bond.adultAccessConfirmed = true
    state.camp.bond.seraConsent = 'granted'
    const actions = renderFacility('jointSynthesis', state)

    const start = screen.getByRole('button', { name: '합동 연성 시작' })
    start.focus()
    fireEvent.click(start)
    expect(actions.onSynthesizeJointBond).toHaveBeenCalledWith('chapter1.sera.ember-vow')
    expect(screen.getByTestId('joint-synthesis')).toHaveAttribute('data-synthesis-phase', 'fusing')
    expect(screen.queryByTestId('synthesis-reward-dialog')).not.toBeInTheDocument()

    await act(async () => vi.advanceTimersByTimeAsync(720))
    const dialog = screen.getByTestId('synthesis-reward-dialog')
    expect(dialog).toHaveAttribute('data-reward-id', 'chapter1.weapon.ember-vow-card')
    fireEvent.click(screen.getByRole('button', { name: '보상 확인' }))
    expect(screen.getByTestId('joint-synthesis')).toHaveFocus()
  })

  it('never animates or opens a reward when the command is rejected', () => {
    const state = createCampState()
    state.camp.bond.adultAccessConfirmed = true
    state.camp.bond.seraConsent = 'granted'
    renderFacility('jointSynthesis', state, rejectedFeedback)

    fireEvent.click(screen.getByRole('button', { name: '합동 연성 시작' }))
    expect(screen.getByTestId('joint-synthesis')).toHaveAttribute('data-synthesis-phase', 'idle')
    expect(screen.queryByTestId('synthesis-reward-dialog')).not.toBeInTheDocument()
  })

  it('opens the static reward immediately when reduced motion is requested', () => {
    vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })))
    const state = createCampState()
    state.camp.bond.adultAccessConfirmed = true
    state.camp.bond.seraConsent = 'granted'
    renderFacility('jointSynthesis', state)

    fireEvent.click(screen.getByRole('button', { name: '합동 연성 시작' }))
    expect(screen.getByTestId('joint-synthesis')).toHaveAttribute('data-synthesis-phase', 'reward')
    expect(screen.getByTestId('synthesis-reward-dialog')).toBeVisible()
  })
})
