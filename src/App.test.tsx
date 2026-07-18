import { render, screen } from '@testing-library/react'
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
    expect(screen.getByText('자동 원정 중')).toBeInTheDocument()
    expect(screen.getAllByText('동료 미영입').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: '불씨 여우 루미 영입, 무료' })).toBeDisabled()
    expect(screen.getByRole('progressbar', { name: '적 체력' })).toHaveAttribute(
      'aria-valuenow',
      '34',
    )
    expect(screen.getByRole('progressbar', { name: '생명력' })).toHaveAttribute(
      'aria-valuetext',
      expect.stringContaining('100%'),
    )
    expect(screen.getByRole('progressbar', { name: '경험치' })).toHaveAttribute(
      'aria-valuemin',
      '0',
    )
  })

  it('disables purchases that cannot be afforded', () => {
    render(<App />)

    expect(screen.getByRole('button', { name: /불씨 검 강화/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /전리품 감각 랭크 상승/ })).toBeDisabled()
  })
})
