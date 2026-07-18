export const VISUAL_ASSET_KINDS = [
  'hero',
  'enemy',
  'boss',
  'region',
  'equipment',
  'skill',
  'result',
  'event',
  'fallback',
] as const

export type VisualAssetKind = (typeof VISUAL_ASSET_KINDS)[number]

export const VISUAL_ASSET_STATUSES = ['ready', 'placeholder'] as const
export type VisualAssetStatus = (typeof VISUAL_ASSET_STATUSES)[number]

export const VISUAL_ASSET_FORMATS = ['webp', 'svg'] as const
export type VisualAssetFormat = (typeof VISUAL_ASSET_FORMATS)[number]

export const VISUAL_ASSET_SOURCE_TYPES = ['original', 'generated', 'licensed'] as const
export type VisualAssetSourceType = (typeof VISUAL_ASSET_SOURCE_TYPES)[number]

export const VISUAL_ASSET_LICENSES = [
  'project-owned',
  'CC0-1.0',
  'CC-BY-4.0',
  'commercial-redistribution',
] as const
export type VisualAssetLicense = (typeof VISUAL_ASSET_LICENSES)[number]

export interface VisualAssetEntry {
  id: string
  kind: VisualAssetKind
  status: VisualAssetStatus
  src: string
  format: VisualAssetFormat
  width: number
  height: number
  bytes: number
  sourceType: VisualAssetSourceType
  author: string
  license: VisualAssetLicense
  attribution?: string
  proofPath?: string
  sourceUrl?: string
  generator?: string
  promptRecord?: string
}

export interface VisualAssetManifest {
  version: 1
  assets: VisualAssetEntry[]
}
