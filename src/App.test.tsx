import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { App } from './App'

describe('App', () => {
  beforeEach(() => window.localStorage.clear())

  it('renders the playable first-run shell', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: '꺼지지 않는 원정' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '전술 정보실' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '3지역 원정 지도' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: '전투 · 전술 전장' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    expect(within(screen.getByRole('toolbar', { name: '전술 슬롯바' })).getAllByRole('button'))
      .toHaveLength(8)
    expect(screen.getByText('자동 원정 중')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^불씨 여우 루미, 미영입,/ }))
    expect(within(screen.getByRole('dialog', { name: '불씨 여우 루미' }))
      .getByRole('button', { name: '무료 영입' })).toBeDisabled()
    expect(within(screen.getByTestId('tactical-canvas'))
      .getByRole('progressbar', { name: '적 체력' })).toHaveAttribute('aria-valuenow', '34')
    expect(screen.getByRole('progressbar', { name: '영웅 체력' })).toHaveAttribute(
      'aria-valuetext',
      expect.stringContaining('100%'),
    )

    fireEvent.click(screen.getByRole('button', { name: '승패 결과' }))
    const resultPanel = screen.getByTestId('tactical-utility-panel')
    expect(resultPanel).toHaveAttribute('data-utility-panel', 'results')
    expect(within(resultPanel).getByText(/아직 보스 승리 또는 패배 결과가 없습니다/))
      .toBeInTheDocument()

    expect(screen.getByRole('button', { name: '원정 지도 열기' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
  })

  it('disables purchases that cannot be afforded', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: /^불씨 검, Lv.0,/ }))
    expect(within(screen.getByRole('dialog', { name: '불씨 검' }))
      .getByRole('button', { name: /불씨 검 강화/ })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: /^전리품 감각, PASSIVE,/ }))
    expect(within(screen.getByRole('dialog', { name: '전리품 감각' }))
      .getByRole('button', { name: /잠김/ })).toBeDisabled()
  })
})
