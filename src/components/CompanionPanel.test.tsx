import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createInitialState } from '../game/engine'
import { CompanionPanel } from './CompanionPanel'

describe('CompanionPanel', () => {
  it('explains the boss gate and enables the free recruitment at stage 11', () => {
    const state = createInitialState(1_000)
    const onRecruit = vi.fn()
    const { rerender } = render(
      <CompanionPanel state={state} onRecruit={onRecruit} onTrain={vi.fn()} />,
    )

    const recruit = screen.getByRole('button', { name: '불씨 여우 루미 영입, 무료' })
    expect(recruit).toBeDisabled()
    expect(screen.getByText('최고 스테이지 11에서 무료 영입')).toBeInTheDocument()

    state.battle.highestStage = 11
    rerender(<CompanionPanel state={state} onRecruit={onRecruit} onTrain={vi.fn()} />)
    expect(recruit).toBeEnabled()
    expect(screen.getByText('첫 보스 승리 보상 · 무료 영입 가능')).toBeInTheDocument()
    fireEvent.click(recruit)
    expect(onRecruit).toHaveBeenCalledWith('emberFox')
  })

  it('shows damage, cooldown, training cost and read-only reasons', () => {
    const state = createInitialState(1_000)
    state.battle.highestStage = 11
    state.battle.companionCooldownMs = 2_000
    state.player.companion = { id: 'emberFox', rank: 1 }
    state.player.gold = 100
    const onTrain = vi.fn()
    const { rerender } = render(
      <CompanionPanel state={state} onRecruit={vi.fn()} onTrain={onTrain} />,
    )

    expect(screen.getByText('협공 피해 2 · 2초 후 공격')).toBeInTheDocument()
    const train = screen.getByRole('button', {
      name: '불씨 여우 루미 훈련, 비용 100 골드',
    })
    expect(train).toBeEnabled()
    fireEvent.click(train)
    expect(onTrain).toHaveBeenCalledOnce()

    rerender(
      <CompanionPanel state={state} onRecruit={vi.fn()} onTrain={onTrain} disabled />,
    )
    expect(train).toBeDisabled()
    expect(screen.getByText(/읽기 전용이거나 저장 소유권을 확인 중/)).toBeInTheDocument()
  })

  it('disables unaffordable and maximum-rank training', () => {
    const state = createInitialState(1_000)
    state.battle.highestStage = 11
    state.player.companion = { id: 'emberFox', rank: 1 }
    state.player.gold = 99
    const { rerender } = render(
      <CompanionPanel state={state} onRecruit={vi.fn()} onTrain={vi.fn()} />,
    )

    expect(screen.getByRole('button', { name: /훈련, 비용 100 골드/ })).toBeDisabled()
    expect(screen.getByText('골드가 1 부족합니다.')).toBeInTheDocument()

    state.player.companion.rank = 5
    rerender(<CompanionPanel state={state} onRecruit={vi.fn()} onTrain={vi.fn()} />)
    expect(screen.getByRole('button', { name: '불씨 여우 루미 최대 랭크' })).toBeDisabled()
    expect(screen.getByText('최대 랭크입니다.')).toBeInTheDocument()
  })
})
