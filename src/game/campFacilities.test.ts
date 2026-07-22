import { describe, expect, it } from 'vitest'
import {
  CAMP_OFFLINE_CAP_HOURS,
  CAMP_TRAINING_EFFECTS,
  CAMP_WORKBENCH_DURATION_PERCENT,
  getCampOfflineCapMs,
  getCampStructureUpgradeCost,
  getCampTrainingCost,
  getCampTrainingRankCap,
  getCampWorkbenchDurationMultiplier,
} from './camp'
import {
  advanceOfflineGame,
  createInitialState,
  performPrestige,
  trainAtCamp,
  upgradeCampStructure,
} from './engine'
import { getHeroStats } from './formulas'
import {
  bootstrapGame,
  saveGameAtRevision,
} from './persistence'
import { createPortableSave, parsePortableSave } from './saveTransfer'
import type { AdvanceReport, StorageLike } from './types'

class MemoryStorage implements StorageLike {
  readonly values = new Map<string, string>()
  getItem(key: string) { return this.values.get(key) ?? null }
  setItem(key: string, value: string) { this.values.set(key, value) }
  removeItem(key: string) { this.values.delete(key) }
}

function addReports(left: AdvanceReport, right: AdvanceReport): AdvanceReport {
  return Object.fromEntries(
    Object.keys(left).map((key) => [key, left[key as keyof AdvanceReport] + right[key as keyof AdvanceReport]]),
  ) as unknown as AdvanceReport
}

describe('IRPG-419 camp facilities and permanent training', () => {
  it('maps tent, workbench, and training-ground levels to fixed effects', () => {
    const state = createInitialState(0, 0x4190_0001)

    for (let level = 1; level <= 5; level += 1) {
      state.camp.structures.tent = level
      state.camp.structures.workbench = level
      state.camp.structures.trainingGround = level
      expect(getCampOfflineCapMs(state.camp)).toBe(CAMP_OFFLINE_CAP_HOURS[level - 1]! * 3_600_000)
      expect(getCampWorkbenchDurationMultiplier(state.camp))
        .toBe(CAMP_WORKBENCH_DURATION_PERCENT[level - 1]! / 100)
      expect(getCampTrainingRankCap(state.camp)).toBe(level * 5)
    }
  })

  it('applies facility upgrades as atomic camp-only gold transactions', () => {
    const battle = createInitialState(0, 0x4190_0002)
    const cost = getCampStructureUpgradeCost('tent', 1)
    if (cost === null) throw new Error('missing tent upgrade cost')
    battle.player.gold = cost
    expect(upgradeCampStructure(battle, 'tent')).toMatchObject({ success: false })

    const camp = { ...battle, currentMode: 'CAMP' as const }
    camp.player = { ...battle.player, gold: cost - 1 }
    const short = upgradeCampStructure(camp, 'tent')
    expect(short.success).toBe(false)
    expect(short.state).toBe(camp)

    camp.player.gold = cost
    const exact = upgradeCampStructure(camp, 'tent')
    expect(exact.success).toBe(true)
    expect(exact.state.player.gold).toBe(0)
    expect(exact.state.camp.structures.tent).toBe(2)
    expect(camp.camp.structures.tent).toBe(1)

    const maxed = structuredClone(camp)
    maxed.camp.structures.tent = 5
    expect(upgradeCampStructure(maxed, 'tent')).toMatchObject({ success: false, state: maxed })
  })

  it('uses the tent level as the deterministic elapsed-time clamp', () => {
    for (let level = 1; level <= 5; level += 1) {
      const state = createInitialState(0, 0x4190_0003 + level)
      state.camp.structures.tent = level
      const capMs = CAMP_OFFLINE_CAP_HOURS[level - 1]! * 3_600_000
      const exact = advanceOfflineGame(state, capMs)
      const over = advanceOfflineGame(state, capMs + 3_600_000)
      expect(over).toEqual(exact)
    }

    const splitInput = createInitialState(0, 0x4190_0009)
    splitInput.camp.structures.tent = 5
    const single = advanceOfflineGame(splitInput, 12 * 3_600_000)
    const first = advanceOfflineGame(splitInput, 6 * 3_600_000)
    const second = advanceOfflineGame(first.state, 6 * 3_600_000)
    expect(second.state).toEqual(single.state)
    expect(addReports(first.report, second.report)).toEqual(single.report)
  })

  it('adds only the configured permanent flat stat and safely restores vitality', () => {
    const state = createInitialState(0, 0x4190_0004)
    state.currentMode = 'CAMP'
    state.player.currentHp = 40
    state.player.gold = 10_000
    const before = getHeroStats(state)

    const attack = trainAtCamp(state, 'attack')
    expect(attack.success).toBe(true)
    expect(getHeroStats(attack.state).attack - before.attack).toBe(CAMP_TRAINING_EFFECTS.attack)
    expect(getHeroStats(attack.state).maxHp).toBe(before.maxHp)

    const beforeVitality = getHeroStats(attack.state)
    const hpBefore = attack.state.player.currentHp
    const vitality = trainAtCamp(attack.state, 'vitality')
    expect(vitality.success).toBe(true)
    expect(getHeroStats(vitality.state).maxHp - beforeVitality.maxHp)
      .toBe(CAMP_TRAINING_EFFECTS.vitality)
    expect(vitality.state.player.currentHp - hpBefore).toBe(CAMP_TRAINING_EFFECTS.vitality)
  })

  it('blocks one-short and rank-cap training without mutating state', () => {
    const state = createInitialState(0, 0x4190_0005)
    state.currentMode = 'CAMP'
    const cost = getCampTrainingCost('attack', 0)
    state.player.gold = cost - 1
    expect(trainAtCamp(state, 'attack')).toMatchObject({ success: false, state })

    state.camp.training.attack = 5
    state.player.gold = Number.MAX_SAFE_INTEGER
    expect(trainAtCamp(state, 'attack')).toMatchObject({ success: false, state })
  })

  it('preserves facilities and training through prestige while returning to battle', () => {
    const state = createInitialState(0, 0x4190_0006)
    state.currentMode = 'CAMP'
    state.battle.highestStage = 30
    state.camp.structures = { tent: 3, workbench: 2, trainingGround: 2 }
    state.camp.training = { attack: 4, vitality: 3 }

    const result = performPrestige(state)

    expect(result.success).toBe(true)
    expect(result.state.currentMode).toBe('BATTLE')
    expect(result.state.camp.structures).toEqual(state.camp.structures)
    expect(result.state.camp.training).toEqual(state.camp.training)
  })

  it('round-trips non-default facilities and training through A/B and portable saves', () => {
    const state = createInitialState(100, 0x4190_0011)
    state.camp.structures = { tent: 5, workbench: 4, trainingGround: 3 }
    state.camp.training = { attack: 7, vitality: 6 }
    state.player.currentHp = getHeroStats(state).maxHp
    const expectedStats = getHeroStats(state)

    const storage = new MemoryStorage()
    expect(saveGameAtRevision(storage, state, null)).toEqual({ status: 'saved', revision: 1 })
    const reloaded = bootstrapGame(storage, 100, 'reader').state
    expect(reloaded.camp.structures).toEqual(state.camp.structures)
    expect(reloaded.camp.training).toEqual(state.camp.training)
    expect(getHeroStats(reloaded)).toEqual(expectedStats)

    const portable = createPortableSave(state, 100)
    if (portable === null) throw new Error('portable save was not created')
    const parsed = parsePortableSave(portable)
    if (!parsed.success) throw new Error(parsed.message)
    expect(parsed.preview.state.camp.structures).toEqual(state.camp.structures)
    expect(parsed.preview.state.camp.training).toEqual(state.camp.training)
    expect(getHeroStats(parsed.preview.state)).toEqual(expectedStats)
  })
})
