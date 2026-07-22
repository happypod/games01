import { describe, expect, it } from 'vitest'
import { SKILL_DEFINITIONS, UPGRADE_DEFINITIONS } from './content'
import { createInitialState } from './engine'
import {
  getSkillEffectComparison,
  getUpgradeEffectComparison,
} from './formulas'

describe('IRPG-409 progression effect selectors', () => {
  it('derives equipment current and next effects without mutating state', () => {
    const state = createInitialState(0, 0x409)
    const snapshot = structuredClone(state)

    expect(getUpgradeEffectComparison(state, 'weapon')).toEqual({
      isMax: false,
      metrics: [{ key: 'attack', current: 10, next: 15 }],
    })
    expect(getUpgradeEffectComparison(state, 'armor')).toEqual({
      isMax: false,
      metrics: [
        { key: 'maxHp', current: 100, next: 130 },
        { key: 'defense', current: 0, next: 2 },
      ],
    })
    expect(getUpgradeEffectComparison(state, 'charm')).toEqual({
      isMax: false,
      metrics: [{ key: 'goldBonusPercent', current: 0, next: 10 }],
    })
    expect(state).toEqual(snapshot)
  })

  it('treats rank-zero power strike as inactive and omits every MAX next value', () => {
    const base = createInitialState(0, 0x409)
    const rankZero = {
      ...base,
      player: {
        ...base.player,
        skills: { ...base.player.skills, powerStrike: 0 },
      },
    }
    expect(getSkillEffectComparison(rankZero, 'powerStrike')).toEqual({
      isMax: false,
      metrics: [{ key: 'powerStrikeMultiplier', current: null, next: 2.5 }],
    })
    expect(getSkillEffectComparison(rankZero, 'fortune')).toEqual({
      isMax: false,
      metrics: [{ key: 'goldBonusPercent', current: 0, next: 12 }],
    })

    const maximum = {
      ...base,
      player: {
        ...base.player,
        upgrades: {
          ...base.player.upgrades,
          weapon: UPGRADE_DEFINITIONS.weapon.maxLevel,
        },
        skills: {
          ...base.player.skills,
          powerStrike: SKILL_DEFINITIONS.powerStrike.maxRank,
        },
      },
    }
    expect(getUpgradeEffectComparison(maximum, 'weapon')).toMatchObject({
      isMax: true,
      metrics: [{ next: null }],
    })
    expect(getSkillEffectComparison(maximum, 'powerStrike')).toMatchObject({
      isMax: true,
      metrics: [{ next: null }],
    })
  })
})
