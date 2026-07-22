import manifestJson from './manifest.json'
import type {
  VisualAssetEntry,
  VisualAssetFormat,
  VisualAssetKind,
  VisualAssetManifest,
  VisualAssetStatus,
} from './types'

export type GameAssetKind = VisualAssetKind
export type GameAssetStatus = VisualAssetStatus
export type GameAssetFormat = VisualAssetFormat
export type GameAssetEntry = VisualAssetEntry
export type GameAssetPurpose = 'character' | 'region' | 'card' | 'result'
export type FallbackAssetId =
  | 'fallback.character'
  | 'fallback.region'
  | 'fallback.card'
  | 'fallback.result'

export interface LoadedGameAsset {
  readonly requestedId: string
  readonly resolvedId: string | null
  readonly entry: GameAssetEntry | null
  readonly url: string | null
  readonly isFallback: boolean
}

const manifest = manifestJson as unknown as VisualAssetManifest
const entriesById = new Map(manifest.assets.map((entry) => [entry.id, entry]))
const assetModules = import.meta.glob<string>('./files/**/*.{webp,svg}', {
  import: 'default',
  query: '?url',
})

function normalizeModulePath(src: string): string {
  return src.replaceAll('\\', '/')
}

function inferPurpose(purposeOrAssetId: string): GameAssetPurpose {
  if (
    purposeOrAssetId === 'character' ||
    purposeOrAssetId === 'region' ||
    purposeOrAssetId === 'card' ||
    purposeOrAssetId === 'result'
  ) {
    return purposeOrAssetId
  }

  const namespace = purposeOrAssetId.split('.', 1)[0]
  if (
    namespace === 'hero' ||
    namespace === 'companion' ||
    namespace === 'enemy' ||
    namespace === 'boss'
  ) return 'character'
  if (namespace === 'region') return 'region'
  if (namespace === 'result') return 'result'
  if (namespace === 'fallback') {
    const fallbackPurpose = purposeOrAssetId.slice('fallback.'.length)
    if (
      fallbackPurpose === 'character' ||
      fallbackPurpose === 'region' ||
      fallbackPurpose === 'card' ||
      fallbackPurpose === 'result'
    ) {
      return fallbackPurpose
    }
  }
  return 'card'
}

function failedAsset(
  requestedId: string,
  entry: GameAssetEntry | null,
  isFallback: boolean,
): LoadedGameAsset {
  return {
    requestedId,
    resolvedId: entry?.id ?? null,
    entry,
    url: null,
    isFallback,
  }
}

async function loadEntry(
  requestedId: string,
  entry: GameAssetEntry,
  isFallback: boolean,
): Promise<LoadedGameAsset> {
  const loader = assetModules[normalizeModulePath(entry.src)]
  if (loader === undefined) return failedAsset(requestedId, entry, isFallback)

  try {
    const url = await loader()
    if (typeof url !== 'string' || url.length === 0) {
      return failedAsset(requestedId, entry, isFallback)
    }
    return {
      requestedId,
      resolvedId: entry.id,
      entry,
      url,
      isFallback,
    }
  } catch {
    return failedAsset(requestedId, entry, isFallback)
  }
}

export function getAssetEntry(id: string): GameAssetEntry | null {
  return entriesById.get(id) ?? null
}

export function getFallbackId(purposeOrAssetId: string): FallbackAssetId {
  return `fallback.${inferPurpose(purposeOrAssetId)}`
}

export async function loadGameAsset(
  id: string,
  purposeOrAssetId: string = id,
): Promise<LoadedGameAsset> {
  const fallbackId = getFallbackId(purposeOrAssetId)
  const requestedEntry = getAssetEntry(id)

  if (requestedEntry !== null) {
    const primary = await loadEntry(id, requestedEntry, id.startsWith('fallback.'))
    if (primary.url !== null) return primary
    if (requestedEntry.id === fallbackId || requestedEntry.kind === 'fallback') return primary
  }

  const fallbackEntry = getAssetEntry(fallbackId)
  if (fallbackEntry === null) return failedAsset(id, null, true)
  return loadEntry(id, fallbackEntry, true)
}
