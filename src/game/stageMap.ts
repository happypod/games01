import { MAX_STAGE } from './content'

export const STAGES_PER_REGION = 100

export const STAGE_REGION_IDS = [
  'ashen-border',
  'moonfall-pass',
  'forgotten-caldera',
] as const

export type StageRegionId = (typeof STAGE_REGION_IDS)[number]
export type StageRegionDirection = 'previous' | 'next'
export type StageNodeProgress = 'completed' | 'frontier' | 'locked'

export interface StageRegionDefinition {
  readonly id: StageRegionId
  readonly name: string
  readonly description: string
  readonly landmark: string
  readonly assetId:
    | 'region.ashen-border'
    | 'region.moonfall-pass'
    | 'region.forgotten-caldera'
  readonly startStage: number
  readonly endStage: number
}

export interface StageNodeView {
  readonly stage: number
  readonly regionId: StageRegionId
  readonly offset: number
  readonly progress: StageNodeProgress
  readonly isCurrent: boolean
  readonly isBoss: boolean
}

export const STAGE_REGIONS = [
  {
    id: 'ashen-border',
    name: '재의 변경',
    description: '재와 불씨가 바람에 흩날리는 황폐한 국경입니다.',
    landmark: '불씨 감시탑',
    assetId: 'region.ashen-border',
    startStage: 1,
    endStage: 100,
  },
  {
    id: 'moonfall-pass',
    name: '월락 고개',
    description: '달빛이 스러진 협곡과 폐허가 이어지는 고개입니다.',
    landmark: '월식 관문',
    assetId: 'region.moonfall-pass',
    startStage: 101,
    endStage: 200,
  },
  {
    id: 'forgotten-caldera',
    name: '잊힌 칼데라',
    description: '잊힌 용의 열기가 남아 있는 마지막 분화구입니다.',
    landmark: '용의 화구',
    assetId: 'region.forgotten-caldera',
    startStage: 201,
    endStage: 300,
  },
] as const satisfies readonly StageRegionDefinition[]

function normalizeStage(rawStage: number): number {
  if (Number.isNaN(rawStage)) return 1
  return Math.min(MAX_STAGE, Math.max(1, Math.floor(rawStage)))
}

function normalizeOffset(rawOffset: number): number {
  if (Number.isNaN(rawOffset)) return 0
  return Math.min(STAGES_PER_REGION - 1, Math.max(0, Math.floor(rawOffset)))
}

export function getStageRegionForStage(rawStage: number): StageRegionDefinition {
  const stage = normalizeStage(rawStage)
  const regionIndex = Math.floor((stage - 1) / STAGES_PER_REGION)
  return STAGE_REGIONS[regionIndex] ?? STAGE_REGIONS[0]
}

export function getStageOffsetInRegion(rawStage: number): number {
  const stage = normalizeStage(rawStage)
  return (stage - 1) % STAGES_PER_REGION
}

export function getRegionStageAtOffset(
  regionId: StageRegionId,
  rawOffset: number,
): number {
  const region = STAGE_REGIONS.find(({ id }) => id === regionId)
  return (region ?? STAGE_REGIONS[0]).startStage + normalizeOffset(rawOffset)
}

export function getAdjacentRegionId(
  regionId: StageRegionId,
  direction: StageRegionDirection,
): StageRegionId | null {
  const regionIndex = STAGE_REGIONS.findIndex(({ id }) => id === regionId)
  const adjacentIndex = regionIndex + (direction === 'previous' ? -1 : 1)
  return STAGE_REGIONS[adjacentIndex]?.id ?? null
}

export function getStageNodes(
  regionId: StageRegionId,
  rawCurrentStage: number,
  rawHighestStage: number,
): readonly StageNodeView[] {
  const currentStage = normalizeStage(rawCurrentStage)
  const highestStage = normalizeStage(rawHighestStage)

  return Array.from({ length: STAGES_PER_REGION }, (_, offset) => {
    const stage = getRegionStageAtOffset(regionId, offset)
    const progress: StageNodeProgress =
      stage < highestStage
        ? 'completed'
        : stage === highestStage
          ? 'frontier'
          : 'locked'

    return {
      stage,
      regionId,
      offset,
      progress,
      isCurrent: stage === currentStage,
      isBoss: stage % 10 === 0,
    }
  })
}
