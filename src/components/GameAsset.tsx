import { useEffect, useRef, useState, type CSSProperties, type SyntheticEvent } from 'react'
import {
  getAssetEntry,
  getFallbackId,
  loadGameAsset,
  type GameAssetPurpose,
  type LoadedGameAsset,
} from '../assets/game/assetResolver'

interface GameAssetProps {
  assetId: string
  purpose?: GameAssetPurpose
  alt?: string
  decorative?: boolean
  fallbackLabel?: string
  className?: string
  fit?: 'contain' | 'cover'
  loading?: 'eager' | 'lazy'
  style?: CSSProperties
}

interface AssetRenderState {
  requestKey: string
  generation: number
  pending: boolean
  asset: LoadedGameAsset | null
}

const CSS_FALLBACK_BACKGROUND =
  'radial-gradient(circle at 50% 42%, rgba(238, 125, 61, 0.2), transparent 38%), linear-gradient(145deg, rgba(89, 48, 37, 0.75), rgba(24, 20, 18, 0.92))'

export function GameAsset({
  assetId,
  purpose,
  alt,
  decorative,
  fallbackLabel,
  className,
  fit = 'cover',
  loading = 'lazy',
  style,
}: GameAssetProps) {
  const requestedEntry = getAssetEntry(assetId)
  const fallbackId = getFallbackId(purpose ?? assetId)
  const fallbackEntry = getAssetEntry(fallbackId)
  const reservedEntry = requestedEntry ?? fallbackEntry
  const reservedWidth = reservedEntry?.width ?? 1
  const reservedHeight = reservedEntry?.height ?? 1
  const accessibleLabel = alt?.trim()
  const isDecorative = decorative ?? (accessibleLabel === undefined || accessibleLabel.length === 0)
  const exposesMeaning = !isDecorative && accessibleLabel !== undefined && accessibleLabel.length > 0
  const requestKey = `${assetId}\u0000${purpose ?? assetId}`
  const generationRef = useRef(0)
  const fallbackAttemptedRef = useRef(false)
  const [loadedImageKey, setLoadedImageKey] = useState<string | null>(null)
  const [renderState, setRenderState] = useState<AssetRenderState>({
    requestKey: '',
    generation: 0,
    pending: false,
    asset: null,
  })

  useEffect(() => {
    const generation = generationRef.current + 1
    generationRef.current = generation
    fallbackAttemptedRef.current = false

    void loadGameAsset(assetId, purpose ?? assetId)
      .then((asset) => {
        if (generationRef.current !== generation) return
        fallbackAttemptedRef.current = asset.isFallback
        setRenderState({ requestKey, generation, pending: false, asset })
      })
      .catch(() => {
        if (generationRef.current !== generation) return
        fallbackAttemptedRef.current = true
        setRenderState({ requestKey, generation, pending: false, asset: null })
      })

    return () => {
      if (generationRef.current === generation) generationRef.current += 1
    }
  }, [assetId, purpose, requestKey])

  const handleImageLoad = (event: SyntheticEvent<HTMLImageElement>) => {
    if (renderState.generation !== generationRef.current) return
    if (event.currentTarget.getAttribute('src') !== renderState.asset?.url) return
    setLoadedImageKey(`${requestKey}\u0000${renderState.asset.url}`)
  }

  const handleImageError = (event: SyntheticEvent<HTMLImageElement>) => {
    const generation = renderState.generation
    const asset = renderState.asset
    if (generation !== generationRef.current || asset === null) return
    if (renderState.requestKey !== requestKey) return
    if (event.currentTarget.getAttribute('src') !== asset.url) return

    setLoadedImageKey(null)
    if (asset.isFallback || fallbackAttemptedRef.current) {
      setRenderState({
        requestKey,
        generation,
        pending: false,
        asset: { ...asset, url: null, isFallback: true },
      })
      return
    }

    fallbackAttemptedRef.current = true
    setRenderState((current) => ({ ...current, pending: true }))
    void loadGameAsset(fallbackId, purpose ?? assetId)
      .then((fallbackAsset) => {
        if (generationRef.current !== generation) return
        setRenderState({ requestKey, generation, pending: false, asset: fallbackAsset })
      })
      .catch(() => {
        if (generationRef.current !== generation) return
        setRenderState({ requestKey, generation, pending: false, asset: null })
      })
  }

  const resolvedAsset = renderState.requestKey === requestKey ? renderState.asset : null
  const hasImage = resolvedAsset?.url !== null && resolvedAsset?.url !== undefined
  const imageLoaded =
    hasImage && loadedImageKey === `${requestKey}\u0000${resolvedAsset.url}`
  const requestPending = renderState.requestKey !== requestKey || renderState.pending
  const dataState = requestPending
    ? 'loading'
    : !hasImage
      ? 'error'
      : imageLoaded
        ? resolvedAsset.isFallback
          ? 'fallback'
          : 'loaded'
        : 'loading'
  const wrapperClassName = ['game-asset', className].filter(Boolean).join(' ')

  return (
    <div
      className={wrapperClassName}
      role={exposesMeaning ? 'img' : undefined}
      aria-label={exposesMeaning ? accessibleLabel : undefined}
      aria-hidden={exposesMeaning ? undefined : 'true'}
      data-asset-id={assetId}
      data-resolved-asset-id={resolvedAsset?.resolvedId ?? undefined}
      data-fallback-id={fallbackId}
      data-state={dataState}
      style={{
        position: 'relative',
        isolation: 'isolate',
        overflow: 'hidden',
        aspectRatio: `${reservedWidth} / ${reservedHeight}`,
        background: CSS_FALLBACK_BACKGROUND,
        ...style,
      }}
    >
      <span
        className="game-asset__fallback"
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 0,
          display: 'grid',
          placeItems: 'center',
          color: 'rgba(255, 180, 110, 0.72)',
          fontSize: 'clamp(1rem, 8vw, 2.25rem)',
          textAlign: 'center',
        }}
      >
        <span>{fallbackLabel ?? '◆'}</span>
      </span>
      {hasImage && (
        <img
          key={`${requestKey}\u0000${resolvedAsset.url}`}
          src={resolvedAsset.url ?? undefined}
          alt=""
          aria-hidden="true"
          width={resolvedAsset.entry?.width ?? reservedWidth}
          height={resolvedAsset.entry?.height ?? reservedHeight}
          decoding="async"
          loading={loading}
          draggable={false}
          onLoad={handleImageLoad}
          onError={handleImageError}
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 1,
            display: 'block',
            width: '100%',
            height: '100%',
            objectFit: fit,
            opacity: imageLoaded ? 1 : 0,
          }}
        />
      )}
    </div>
  )
}
