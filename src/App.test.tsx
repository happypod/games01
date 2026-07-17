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
    expect(screen.getByText('자동 원정 중')).toBeInTheDocument()
  })

  it('disables purchases that cannot be afforded', () => {
    render(<App />)

    expect(screen.getByRole('button', { name: /불씨 검 강화/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /전리품 감각 랭크 상승/ })).toBeDisabled()
  })
})
