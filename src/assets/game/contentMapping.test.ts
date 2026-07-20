import { describe, expect, it } from 'vitest'
import {
  COMPANION_DEFINITIONS,
  EXPEDITION_EVENT_DEFINITIONS,
  SKILL_DEFINITIONS,
  UPGRADE_DEFINITIONS,
  getEnemyDefinition,
  getEnemyPresentationAssetId,
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

describe('IRPG-416 eclipse knight damage presentation', () => {
  it.each([
    [100, 100, 'boss.eclipse-knight'],
    [70, 100, 'boss.eclipse-knight'],
    [69.999, 100, 'boss.eclipse-knight.damaged'],
    [30, 100, 'boss.eclipse-knight.damaged'],
    [29.999, 100, 'boss.eclipse-knight.severe'],
    [0, 100, 'boss.eclipse-knight.severe'],
  ] as const)('maps %s/%s HP to %s', (currentHp, maximumHp, expected) => {
    expect(
      getEnemyPresentationAssetId('boss.eclipse-knight', currentHp, maximumHp),
    ).toBe(expected)
  })

  it.each([
    [Number.NaN, 100],
    [50, Number.NaN],
    [50, 0],
    [-1, 100],
    [101, 100],
  ] as const)('falls back to the base portrait for invalid HP %s/%s', (currentHp, maximumHp) => {
    expect(
      getEnemyPresentationAssetId('boss.eclipse-knight', currentHp, maximumHp),
    ).toBe('boss.eclipse-knight')
  })

  it('leaves every other enemy and boss portrait unchanged', () => {
    expect(getEnemyPresentationAssetId('boss.ash-giant', 1, 100)).toBe('boss.ash-giant')
    expect(getEnemyPresentationAssetId('enemy.twilight-wolf', 1, 100)).toBe(
      'enemy.twilight-wolf',
    )
  })

  it('declares unique production-ready assets for both safe damage tiers', () => {
    const expected = [
      'boss.eclipse-knight.damaged',
      'boss.eclipse-knight.severe',
    ] as const
    const sources = new Set<string>()
    const hashes = new Set<string>()

    for (const assetId of expected) {
      const asset = manifestJson.assets.find((entry) => entry.id === assetId)
      expect(asset).toMatchObject({
        id: assetId,
        kind: 'boss',
        status: 'ready',
        format: 'webp',
        width: 768,
        height: 768,
        promptRecord: 'docs/assets/prompts/eclipse-knight-damage-states.md',
      })
      expect(asset?.bytes).toBeLessThanOrEqual(250 * 1024)
      expect(asset?.sha256).toMatch(/^[a-f0-9]{64}$/)
      sources.add(asset?.src ?? '')
      hashes.add(asset?.sha256 ?? '')
    }

    expect(sources.size).toBe(expected.length)
    expect(hashes.size).toBe(expected.length)
  })
})

describe('IRPG-415 companion portrait asset mapping', () => {
  it('maps the fixed companion to its production-ready generated portrait', () => {
    const asset = manifestJson.assets.find(
      (entry) => entry.id === COMPANION_DEFINITIONS.emberFox.assetId,
    )

    expect(asset).toMatchObject({
      id: 'companion.ember-fox.default',
      kind: 'companion',
      status: 'ready',
      format: 'webp',
      width: 768,
      height: 768,
      promptRecord: 'docs/assets/prompts/companion-ember-fox.md',
    })
    expect(asset?.bytes).toBeLessThanOrEqual(250 * 1024)
    expect(asset?.sha256).toMatch(/^[a-f0-9]{64}$/)
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

describe('IRPG-412 expedition event card asset mapping', () => {
  it('maps every fixed expedition event to unique production-ready card art', () => {
    const declaredById = new Map(manifestJson.assets.map((asset) => [asset.id, asset]))
    const expected = [
      ['불씨 성소', EXPEDITION_EVENT_DEFINITIONS['event.ember-shrine'].assetId],
      ['떠돌이 대장장이', EXPEDITION_EVENT_DEFINITIONS['event.wandering-smith'].assetId],
      ['잿빛 야영지', EXPEDITION_EVENT_DEFINITIONS['event.ash-camp'].assetId],
    ] as const
    const sources = new Set<string>()
    const hashes = new Set<string>()

    for (const [name, assetId] of expected) {
      const asset = declaredById.get(assetId)
      if (!asset) throw new Error(`Missing ${name} manifest asset: ${assetId}`)
      expect(asset).toMatchObject({
        kind: 'event',
        status: 'ready',
        format: 'webp',
        width: 512,
        height: 512,
        promptRecord: 'docs/assets/prompts/expedition-event-cards.md',
      })
      expect(asset.bytes).toBeLessThanOrEqual(160 * 1024)
      expect(asset.sha256).toMatch(/^[a-f0-9]{64}$/)
      sources.add(asset.src)
      hashes.add(asset.sha256 ?? '')
    }

    expect(sources.size).toBe(expected.length)
    expect(hashes.size).toBe(expected.length)
  })
})
