import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createInitialState } from '../game/engine'
import { PrestigePanel } from './PrestigePanel'

describe('IRPG-206 prestige permanent bonus copy', () => {
  it('derives the 4.2% copy from the formula while keeping the stage gate locked', () => {
    const state = createInitialState(0, 0x206)
    render(<PrestigePanel state={state} onPrestige={vi.fn()} />)

    expect(screen.getByText(/정수 1개마다 공격력과 체력이 4.2% 증가합니다/)).toBeVisible()
    expect(screen.getByText('예상 보상')).toHaveTextContent('0 정수')
    expect(screen.getByRole('button', { name: '30 스테이지 필요' })).toBeDisabled()
  })

  it('keeps the stage-30 reward and invokes the public prestige command once', () => {
    const state = createInitialState(0, 0x206)
    state.battle.highestStage = 30
    const onPrestige = vi.fn()
    const view = render(<PrestigePanel state={state} onPrestige={onPrestige} />)

    expect(screen.getByText('예상 보상')).toHaveTextContent('5 정수')
    fireEvent.click(screen.getByRole('button', { name: '환생하기' }))
    expect(onPrestige).toHaveBeenCalledTimes(1)

    view.rerender(<PrestigePanel state={state} onPrestige={onPrestige} disabled />)
    expect(screen.getByRole('button', { name: '환생하기' })).toBeDisabled()
  })
})
