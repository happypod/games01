import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { App } from './App'

describe('App', () => {
  beforeEach(() => window.localStorage.clear())

  it('renders the playable first-run shell', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: '꺼지지 않는 원정' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '성장 장비' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '스킬 각인' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '동료 원정대' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: '전투 · 전술 전장' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    expect(within(screen.getByRole('toolbar', { name: '전술 슬롯바' })).getAllByRole('button'))
      .toHaveLength(8)
    expect(screen.getByText('자동 원정 중')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '불씨 여우 루미 영입, 무료' })).toBeDisabled()
    expect(screen.getByRole('progressbar', { name: '적 체력' })).toHaveAttribute(
      'aria-valuenow',
      '34',
    )
    expect(screen.getByRole('progressbar', { name: '영웅 체력' })).toHaveAttribute(
      'aria-valuetext',
      expect.stringContaining('100%'),
    )

    fireEvent.click(screen.getByRole('button', { name: '승패 결과' }))
    const resultPanel = screen.getByTestId('tactical-utility-panel')
    expect(resultPanel).toHaveAttribute('data-utility-panel', 'results')
    expect(within(resultPanel).getByText(/아직 보스 승리 또는 패배 결과가 없습니다/))
      .toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '3지역 원정 지도 열기' }))
    expect(screen.getByRole('heading', { name: '3지역 원정 지도' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '원정 지도 열기' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
  })

  it('disables purchases that cannot be afforded', () => {
    render(<App />)

    expect(screen.getByRole('button', { name: /불씨 검 강화/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /전리품 감각 잠김/ })).toBeDisabled()
  })
})
