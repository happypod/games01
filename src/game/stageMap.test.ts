import { describe, expect, it } from 'vitest'
import {
  STAGE_REGIONS,
  getAdjacentRegionId,
  getRegionStageAtOffset,
  getStageNodes,
  getStageOffsetInRegion,
  getStageRegionForStage,
} from './stageMap'

describe('stage map regions', () => {
  it('defines three contiguous 100-stage regions with their landmarks and assets', () => {
    expect(STAGE_REGIONS).toEqual([
      expect.objectContaining({
        id: 'ashen-border',
        name: '재의 변경',
        landmark: '불씨 감시탑',
        assetId: 'region.ashen-border',
        startStage: 1,
        endStage: 100,
      }),
      expect.objectContaining({
        id: 'moonfall-pass',
        name: '월락 고개',
        landmark: '월식 관문',
        assetId: 'region.moonfall-pass',
        startStage: 101,
        endStage: 200,
      }),
      expect.objectContaining({
        id: 'forgotten-caldera',
        name: '잊힌 칼데라',
        landmark: '용의 화구',
        assetId: 'region.forgotten-caldera',
        startStage: 201,
        endStage: 300,
      }),
    ])
    expect(STAGE_REGIONS.every(({ description }) => description.length > 0)).toBe(true)
  })

  it.each([
    [1, 'ashen-border'],
    [10, 'ashen-border'],
    [100, 'ashen-border'],
    [101, 'moonfall-pass'],
    [200, 'moonfall-pass'],
    [201, 'forgotten-caldera'],
    [300, 'forgotten-caldera'],
  ] as const)('maps stage %s to %s', (stage, expectedRegionId) => {
    expect(getStageRegionForStage(stage).id).toBe(expectedRegionId)
  })

  it('normalizes invalid, fractional, and out-of-range stage inputs', () => {
    expect(getStageRegionForStage(Number.NaN).id).toBe('ashen-border')
    expect(getStageRegionForStage(Number.NEGATIVE_INFINITY).id).toBe('ashen-border')
    expect(getStageRegionForStage(-5).id).toBe('ashen-border')
    expect(getStageRegionForStage(100.99).id).toBe('ashen-border')
    expect(getStageRegionForStage(101.01).id).toBe('moonfall-pass')
    expect(getStageRegionForStage(999).id).toBe('forgotten-caldera')
    expect(getStageRegionForStage(Number.POSITIVE_INFINITY).id).toBe(
      'forgotten-caldera',
    )
  })
})

describe('stage map nodes', () => {
  it('creates exactly 100 nodes for the requested region', () => {
    const nodes = getStageNodes('moonfall-pass', 105, 105)

    expect(nodes).toHaveLength(100)
    expect(nodes[0]).toMatchObject({
      stage: 101,
      regionId: 'moonfall-pass',
      offset: 0,
    })
    expect(nodes[99]).toMatchObject({
      stage: 200,
      regionId: 'moonfall-pass',
      offset: 99,
    })
  })

  it('derives completed, frontier, and locked states while keeping current separate', () => {
    const nodes = getStageNodes('moonfall-pass', 103, 105)

    expect(nodes[2]).toMatchObject({
      stage: 103,
      progress: 'completed',
      isCurrent: true,
    })
    expect(nodes[4]).toMatchObject({
      stage: 105,
      progress: 'frontier',
      isCurrent: false,
    })
    expect(nodes[5]).toMatchObject({
      stage: 106,
      progress: 'locked',
      isCurrent: false,
    })
  })

  it('keeps stage 300 as the frontier when it is the highest stage', () => {
    const nodes = getStageNodes('forgotten-caldera', 300, 300)

    expect(nodes[98]).toMatchObject({ stage: 299, progress: 'completed' })
    expect(nodes[99]).toMatchObject({
      stage: 300,
      progress: 'frontier',
      isCurrent: true,
      isBoss: true,
    })
  })

  it('marks only stages divisible by ten as boss nodes', () => {
    const nodes = getStageNodes('ashen-border', 1, 1)

    expect(nodes.filter(({ isBoss }) => isBoss).map(({ stage }) => stage)).toEqual([
      10,
      20,
      30,
      40,
      50,
      60,
      70,
      80,
      90,
      100,
    ])
  })

  it('normalizes current and highest stage inputs independently', () => {
    const low = getStageNodes('ashen-border', Number.NaN, -20)
    const high = getStageNodes(
      'forgotten-caldera',
      Number.POSITIVE_INFINITY,
      Number.POSITIVE_INFINITY,
    )

    expect(low[0]).toMatchObject({
      stage: 1,
      progress: 'frontier',
      isCurrent: true,
    })
    expect(low[1]).toMatchObject({ stage: 2, progress: 'locked' })
    expect(high[99]).toMatchObject({
      stage: 300,
      progress: 'frontier',
      isCurrent: true,
    })
  })
})

describe('stage map keyboard navigation helpers', () => {
  it('preserves a zero-based relative offset between regions', () => {
    expect(getStageOffsetInRegion(1)).toBe(0)
    expect(getStageOffsetInRegion(100)).toBe(99)
    expect(getStageOffsetInRegion(101)).toBe(0)
    expect(getStageOffsetInRegion(205)).toBe(4)
    expect(getRegionStageAtOffset('ashen-border', 4)).toBe(5)
    expect(getRegionStageAtOffset('moonfall-pass', 4)).toBe(105)
    expect(getRegionStageAtOffset('forgotten-caldera', 4)).toBe(205)
  })

  it('clamps invalid or out-of-range offsets inside the requested region', () => {
    expect(getRegionStageAtOffset('moonfall-pass', Number.NaN)).toBe(101)
    expect(getRegionStageAtOffset('moonfall-pass', -1)).toBe(101)
    expect(getRegionStageAtOffset('moonfall-pass', 4.9)).toBe(105)
    expect(getRegionStageAtOffset('moonfall-pass', 100)).toBe(200)
    expect(getRegionStageAtOffset('moonfall-pass', Number.POSITIVE_INFINITY)).toBe(
      200,
    )
  })

  it('returns adjacent region IDs and stops at the map edges', () => {
    expect(getAdjacentRegionId('ashen-border', 'previous')).toBeNull()
    expect(getAdjacentRegionId('ashen-border', 'next')).toBe('moonfall-pass')
    expect(getAdjacentRegionId('moonfall-pass', 'previous')).toBe('ashen-border')
    expect(getAdjacentRegionId('moonfall-pass', 'next')).toBe('forgotten-caldera')
    expect(getAdjacentRegionId('forgotten-caldera', 'previous')).toBe(
      'moonfall-pass',
    )
    expect(getAdjacentRegionId('forgotten-caldera', 'next')).toBeNull()
  })
})
