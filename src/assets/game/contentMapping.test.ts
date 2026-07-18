import { describe, expect, it } from 'vitest'
import { getEnemyDefinition } from '../../game/content'
import manifestJson from './manifest.json'

describe('combat visual asset mapping', () => {
  it('maps every named enemy and boss to a unique production-ready portrait', () => {
    const declaredById = new Map(manifestJson.assets.map((asset) => [asset.id, asset]))
    const expectedByStage = [
      { stage: 1, name: '잿빛 슬라임', assetId: 'enemy.ash-slime', kind: 'enemy' },
      { stage: 2, name: '황혼 늑대', assetId: 'enemy.twilight-wolf', kind: 'enemy' },
      { stage: 3, name: '버려진 갑주', assetId: 'enemy.abandoned-armor', kind: 'enemy' },
      { stage: 4, name: '그을린 주술사', assetId: 'enemy.charred-shaman', kind: 'enemy' },
      { stage: 5, name: '심연의 파수꾼', assetId: 'enemy.abyss-sentinel', kind: 'enemy' },
      { stage: 10, name: '재의 거인', assetId: 'boss.ash-giant', kind: 'boss' },
      { stage: 20, name: '월식의 기사', assetId: 'boss.eclipse-knight', kind: 'boss' },
      { stage: 30, name: '잊힌 용', assetId: 'boss.forgotten-dragon', kind: 'boss' },
    ] as const
    const portraitSources = new Set<string>()

    for (const expected of expectedByStage) {
      const enemy = getEnemyDefinition(expected.stage)
      expect(enemy).toMatchObject({
        name: expected.name,
        assetId: expected.assetId,
        isBoss: expected.kind === 'boss',
      })

      const asset = declaredById.get(expected.assetId)
      if (!asset) throw new Error(`Missing manifest asset: ${expected.assetId}`)

      expect(asset).toMatchObject({
        kind: expected.kind,
        status: 'ready',
        width: 768,
        height: 768,
        promptRecord: 'docs/assets/prompts/enemy-boss-portraits.md',
      })
      portraitSources.add(asset.src)
    }

    expect(portraitSources.size).toBe(expectedByStage.length)
  })
})
