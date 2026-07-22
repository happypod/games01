import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GameAssetEntry, LoadedGameAsset } from '../assets/game/assetResolver'
import { GameAsset } from './GameAsset'

const resolverMocks = vi.hoisted(() => ({
  getAssetEntry: vi.fn(),
  getFallbackId: vi.fn(),
  loadGameAsset: vi.fn(),
}))

vi.mock('../assets/game/assetResolver', () => resolverMocks)

const heroEntry: GameAssetEntry = {
  id: 'hero.ashen-knight.default',
  kind: 'hero',
  status: 'ready',
  src: './files/hero/ashen-knight-default.webp',
  format: 'webp',
  width: 768,
  height: 768,
  bytes: 100,
  sourceType: 'original',
  author: 'test',
  license: 'project-owned',
}

const fallbackEntry: GameAssetEntry = {
  id: 'fallback.character',
  kind: 'fallback',
  status: 'ready',
  src: './files/fallback/character.svg',
  format: 'svg',
  width: 768,
  height: 768,
  bytes: 100,
  sourceType: 'original',
  author: 'test',
  license: 'project-owned',
}

function loadedAsset(
  requestedId: string,
  entry: GameAssetEntry,
  url: string | null,
  isFallback: boolean,
): LoadedGameAsset {
  return {
    requestedId,
    resolvedId: entry.id,
    entry,
    url,
    isFallback,
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve
  })
  return { promise, resolve }
}

async function waitForImage(container: HTMLElement): Promise<HTMLImageElement> {
  return waitFor(() => {
    const image = container.querySelector('img')
    expect(image).not.toBeNull()
    return image!
  })
}

describe('GameAsset', () => {
  beforeEach(() => {
    resolverMocks.getFallbackId.mockImplementation(() => 'fallback.character')
    resolverMocks.getAssetEntry.mockImplementation((id: string) => {
      if (id === heroEntry.id) return heroEntry
      if (id === fallbackEntry.id) return fallbackEntry
      return null
    })
    resolverMocks.loadGameAsset.mockReset()
  })

  it('keeps a fixed fallback until the requested image loads', async () => {
    resolverMocks.loadGameAsset.mockResolvedValue(
      loadedAsset(heroEntry.id, heroEntry, '/hero.webp', false),
    )
    const { container } = render(
      <GameAsset assetId={heroEntry.id} purpose="character" decorative loading="eager" />,
    )

    const wrapper = container.querySelector<HTMLElement>('.game-asset')!
    expect(wrapper).toHaveAttribute('data-state', 'loading')
    expect(wrapper.style.aspectRatio).toBe('768 / 768')

    const image = await waitForImage(container)
    expect(image).toHaveAttribute('alt', '')
    expect(image).toHaveAttribute('loading', 'eager')
    expect(image).toHaveStyle({ opacity: '0' })

    fireEvent.load(image)
    expect(wrapper).toHaveAttribute('data-state', 'loaded')
    expect(image).toHaveStyle({ opacity: '1' })
  })

  it('shows a purpose fallback when an unknown or failed asset resolves to it', async () => {
    resolverMocks.loadGameAsset.mockResolvedValue(
      loadedAsset('hero.unknown', fallbackEntry, '/fallback.svg', true),
    )
    const { container } = render(
      <GameAsset assetId="hero.unknown" purpose="character" fallbackLabel="아렌" decorative />,
    )

    const image = await waitForImage(container)
    fireEvent.load(image)
    expect(container.querySelector('.game-asset')).toHaveAttribute('data-state', 'fallback')
    expect(container.querySelector('.game-asset')).toHaveAttribute(
      'data-resolved-asset-id',
      fallbackEntry.id,
    )
    expect(screen.getByText('아렌')).toBeInTheDocument()
  })

  it('tries one fallback after an image error, then remains CSS-only without a loop', async () => {
    resolverMocks.loadGameAsset
      .mockResolvedValueOnce(loadedAsset(heroEntry.id, heroEntry, '/hero.webp', false))
      .mockResolvedValueOnce(
        loadedAsset(fallbackEntry.id, fallbackEntry, '/fallback.svg', true),
      )
    const { container } = render(
      <GameAsset assetId={heroEntry.id} purpose="character" decorative />,
    )

    const primary = await waitForImage(container)
    fireEvent.error(primary)
    await waitFor(() => {
      expect(container.querySelector('img')).toHaveAttribute('src', '/fallback.svg')
    })

    fireEvent.error(container.querySelector('img')!)
    await waitFor(() => expect(container.querySelector('img')).toBeNull())
    expect(container.querySelector('.game-asset')).toHaveAttribute('data-state', 'error')
    expect(resolverMocks.loadGameAsset).toHaveBeenCalledTimes(2)
  })

  it('ignores a stale load when the requested asset changes', async () => {
    const first = deferred<LoadedGameAsset>()
    resolverMocks.loadGameAsset
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce(loadedAsset('hero.second', heroEntry, '/second.webp', false))

    const { container, rerender } = render(
      <GameAsset assetId="hero.first" purpose="character" decorative />,
    )
    rerender(<GameAsset assetId="hero.second" purpose="character" decorative />)
    await waitFor(() => {
      expect(container.querySelector('img')).toHaveAttribute('src', '/second.webp')
    })

    first.resolve(loadedAsset('hero.first', heroEntry, '/first.webp', false))
    await Promise.resolve()
    expect(container.querySelector('img')).toHaveAttribute('src', '/second.webp')
  })

  it('ignores a stale image error after the requested asset changes', async () => {
    resolverMocks.loadGameAsset
      .mockResolvedValueOnce(loadedAsset('hero.first', heroEntry, '/first.webp', false))
      .mockResolvedValueOnce(loadedAsset('hero.second', heroEntry, '/second.webp', false))

    const { container, rerender } = render(
      <GameAsset assetId="hero.first" purpose="character" decorative />,
    )
    const firstImage = await waitForImage(container)

    rerender(<GameAsset assetId="hero.second" purpose="character" decorative />)
    await waitFor(() => {
      expect(container.querySelector('img')).toHaveAttribute('src', '/second.webp')
    })

    fireEvent.error(firstImage)
    expect(container.querySelector('img')).toHaveAttribute('src', '/second.webp')
    expect(resolverMocks.loadGameAsset).toHaveBeenCalledTimes(2)
  })

  it('keeps decorative art out of the accessibility tree and labels meaningful art once', async () => {
    resolverMocks.loadGameAsset.mockResolvedValue(
      loadedAsset(heroEntry.id, heroEntry, '/hero.webp', false),
    )
    const { container, rerender } = render(
      <GameAsset assetId={heroEntry.id} purpose="character" decorative />,
    )
    await waitFor(() => expect(container.querySelector('img')).not.toBeNull())
    expect(container.querySelector('.game-asset')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.queryByRole('img')).not.toBeInTheDocument()

    rerender(
      <GameAsset
        assetId={heroEntry.id}
        purpose="character"
        decorative={false}
        alt="방랑 기사 아렌"
      />,
    )
    expect(screen.getByRole('img', { name: '방랑 기사 아렌' })).toBeInTheDocument()
    expect(container.querySelector('img')).toHaveAttribute('alt', '')
    expect(container.querySelector('img')).toHaveAttribute('aria-hidden', 'true')
  })

  it('loads the checked-in hero and resolves an unknown character to the real manifest fallback', async () => {
    const resolver = await vi.importActual<
      typeof import('../assets/game/assetResolver')
    >('../assets/game/assetResolver')

    expect(resolver.getAssetEntry(heroEntry.id)).toMatchObject({
      id: heroEntry.id,
      kind: 'hero',
      width: 768,
      height: 768,
    })
    const hero = await resolver.loadGameAsset(heroEntry.id, 'character')
    expect(hero).toMatchObject({
      requestedId: heroEntry.id,
      resolvedId: heroEntry.id,
      isFallback: false,
    })
    expect(hero.url).toEqual(expect.any(String))

    const unknown = await resolver.loadGameAsset('hero.not-registered', 'character')
    expect(unknown).toMatchObject({
      requestedId: 'hero.not-registered',
      resolvedId: 'fallback.character',
      isFallback: true,
    })
    expect(unknown.url).toEqual(expect.any(String))
  })
})
