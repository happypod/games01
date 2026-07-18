import { describe, expect, it } from 'vitest'
import {
  SKILL_DEFINITIONS,
  UPGRADE_DEFINITIONS,
  getEnemyDefinition,
} from '../../game/content'
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

describe('IRPG-409 progression card asset mapping', () => {
  it('maps every fixed upgrade and skill to unique production-ready card art', () => {
    const declaredById = new Map(manifestJson.assets.map((asset) => [asset.id, asset]))
    const expected = [
      ['불씨 검', UPGRADE_DEFINITIONS.weapon.assetId, 'equipment'],
      ['수호 갑옷', UPGRADE_DEFINITIONS.armor.assetId, 'equipment'],
      ['행운 부적', UPGRADE_DEFINITIONS.charm.assetId, 'equipment'],
      ['화염 강타', SKILL_DEFINITIONS.powerStrike.assetId, 'skill'],
      ['강철 의지', SKILL_DEFINITIONS.ironWill.assetId, 'skill'],
      ['전리품 감각', SKILL_DEFINITIONS.fortune.assetId, 'skill'],
    ] as const
    const sources = new Set<string>()
    const hashes = new Set<string>()

    for (const [name, assetId, kind] of expected) {
      const asset = declaredById.get(assetId)
      if (!asset) throw new Error(`Missing ${name} manifest asset: ${assetId}`)
      expect(asset).toMatchObject({
        kind,
        status: 'ready',
        width: 512,
        height: 512,
        promptRecord: 'docs/assets/prompts/equipment-skill-cards.md',
      })
      expect(asset.sha256).toMatch(/^[a-f0-9]{64}$/)
      sources.add(asset.src)
      hashes.add(asset.sha256 ?? '')
    }

    expect(sources.size).toBe(expected.length)
    expect(hashes.size).toBe(expected.length)
  })
})

describe('IRPG-410 battle result asset mapping', () => {
  it('maps victory and defeat to unique production-ready result art', () => {
    const declaredById = new Map(manifestJson.assets.map((asset) => [asset.id, asset]))
    const expected = [
      ['보스 승리', 'result.boss-victory'],
      ['패배', 'result.defeat'],
    ] as const
    const sources = new Set<string>()
    const hashes = new Set<string>()

    for (const [name, assetId] of expected) {
      const asset = declaredById.get(assetId)
      if (!asset) throw new Error(`Missing ${name} manifest asset: ${assetId}`)
      expect(asset).toMatchObject({
        kind: 'result',
        status: 'ready',
        format: 'webp',
        width: 1280,
        height: 720,
        promptRecord: 'docs/assets/prompts/battle-results.md',
      })
      expect(asset.bytes).toBeLessThanOrEqual(300 * 1024)
      expect(asset.sha256).toMatch(/^[a-f0-9]{64}$/)
      sources.add(asset.src)
      hashes.add(asset.sha256 ?? '')
    }

    expect(sources.size).toBe(expected.length)
    expect(hashes.size).toBe(expected.length)
  })
})
