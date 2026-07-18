import { describe, expect, it } from 'vitest'
import { getEnemyDefinition } from '../../game/content'
import manifestJson from './manifest.json'

describe('combat visual asset mapping', () => {
  it('maps every enemy archetype and boss to a declared stable asset ID', () => {
    const declaredIds = new Set(manifestJson.assets.map((asset) => asset.id))
    const expectedByStage = new Map([
      [1, 'enemy.ash-slime'],
      [2, 'enemy.twilight-wolf'],
      [3, 'enemy.abandoned-armor'],
      [4, 'enemy.charred-shaman'],
      [5, 'enemy.abyss-sentinel'],
      [10, 'boss.ash-giant'],
      [20, 'boss.eclipse-knight'],
      [30, 'boss.forgotten-dragon'],
    ])

    for (const [stage, expectedAssetId] of expectedByStage) {
      const assetId = getEnemyDefinition(stage).assetId
      expect(assetId).toBe(expectedAssetId)
      expect(declaredIds.has(assetId)).toBe(true)
    }
  })
})
