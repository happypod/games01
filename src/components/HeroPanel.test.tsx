import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createInitialState } from '../game/engine'
import { HeroPanel } from './HeroPanel'

describe('HeroPanel', () => {
  it('renders the stable hero portrait without duplicating the text alternative', async () => {
    const { container } = render(<HeroPanel state={createInitialState(1_700_000_000_000)} />)

    expect(screen.getByRole('heading', { name: '방랑 기사 아렌' })).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: '생명력' })).toBeInTheDocument()

    const portrait = container.querySelector('.hero-portrait')
    expect(portrait).toHaveAttribute('data-asset-id', 'hero.ashen-knight.default')
    expect(portrait).toHaveAttribute('aria-hidden', 'true')
    expect(screen.queryByRole('img', { name: '방랑 기사 아렌' })).not.toBeInTheDocument()

    await waitFor(() => expect(portrait?.querySelector('img')).not.toBeNull())
    expect(portrait?.querySelector('img')).toHaveAttribute('alt', '')
    expect(portrait?.querySelector('img')).toHaveAttribute('width', '768')
    expect(portrait?.querySelector('img')).toHaveAttribute('height', '768')
    expect(portrait?.querySelector('img')).toHaveAttribute('loading', 'eager')
  })
})
