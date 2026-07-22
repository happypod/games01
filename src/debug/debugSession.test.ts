// @vitest-environment node

import { describe, expect, it } from 'vitest'
import { MAX_OFFLINE_MS, MAX_STAGE, getEnemyDefinition } from '../game/content'
import { createInitialState } from '../game/engine'
import { MAX_EXPEDITION_MILESTONE_MASK } from '../game/expedition'
import { isGameState } from '../game/persistence'
import type { GameState } from '../game/types'
import {
  DEBUG_SPEEDS,
  MAX_DEBUG_OFFLINE_MINUTES,
  applyDebugOfflineMinutes,
  cloneDebugState,
  isDebugSpeed,
  requireDebugSpeed,
  scaleDebugElapsedMs,
  setDebugResource,
  setDebugStage,
  type DebugResourceId,
} from './debugSession'

function expectDeepClone(input: GameState, clone: GameState) {
  expect(clone).toEqual(input)
  expect(clone).not.toBe(input)
  expect(clone.expeditionEvents).not.toBe(input.expeditionEvents)
  expect(clone.expeditionEvents.pending).not.toBe(input.expeditionEvents.pending)
  expect(clone.rng).not.toBe(input.rng)
  expect(clone.player).not.toBe(input.player)
  expect(clone.player.upgrades).not.toBe(input.player.upgrades)
  expect(clone.player.skills).not.toBe(input.player.skills)
  expect(clone.player.companion).not.toBe(input.player.companion)
  expect(clone.battle).not.toBe(input.battle)
  expect(clone.stats).not.toBe(input.stats)
}

describe('IRPG-507 debug session adapter', () => {
  it('deep clones every mutable GameState branch', () => {
    const input = createInitialState(1_000, 0x1234_5678)
    const clone = cloneDebugState(input)

    expectDeepClone(input, clone)
    clone.rng.draws = 9
    clone.player.upgrades.weapon = 4
    clone.player.skills.powerStrike = 2
    clone.player.companion.rank = 1
    clone.battle.kills = 3
    clone.stats.enemiesDefeated = 3
    clone.camp.materials.ashShard = 9

    expect(input).toEqual(createInitialState(1_000, 0x1234_5678))
  })

  it('accepts only the three supported speed values', () => {
    expect(DEBUG_SPEEDS).toEqual([1, 10, 100])
    for (const speed of DEBUG_SPEEDS) {
      expect(isDebugSpeed(speed)).toBe(true)
      expect(requireDebugSpeed(speed)).toBe(speed)
    }

    for (const invalid of [0, 2, 99, 101, -1, 1.5, Number.NaN, Infinity, '10', null]) {
      expect(isDebugSpeed(invalid)).toBe(false)
      expect(() => requireDebugSpeed(invalid)).toThrow(RangeError)
    }
  })

  it('scales real elapsed time at 1x, 10x, and 100x and caps one tick at eight hours', () => {
    expect(scaleDebugElapsedMs(1, 250)).toBe(250)
    expect(scaleDebugElapsedMs(10, 250)).toBe(2_500)
    expect(scaleDebugElapsedMs(100, 250)).toBe(25_000)
    expect(scaleDebugElapsedMs(100, Number.MAX_SAFE_INTEGER)).toBe(MAX_OFFLINE_MS)
    expect(scaleDebugElapsedMs(100, Number.MAX_SAFE_INTEGER, 12 * 60 * 60 * 1_000))
      .toBe(12 * 60 * 60 * 1_000)

    for (const invalid of [-1, 0.5, Number.NaN, Infinity, '250']) {
      expect(() => scaleDebugElapsedMs(10, invalid)).toThrow(RangeError)
    }
    expect(() => scaleDebugElapsedMs(2, 250)).toThrow(RangeError)
  })

  it('sets an exact stage through the engine while only expanding highestStage', () => {
    const input = createInitialState(0, 1)
    const inputCopy = structuredClone(input)
    const lastStage = setDebugStage(input, MAX_STAGE)

    expect(input).toEqual(inputCopy)
    expect(lastStage.battle.stage).toBe(MAX_STAGE)
    expect(lastStage.battle.highestStage).toBe(MAX_STAGE)
    expect(lastStage.battle.enemyHp).toBe(getEnemyDefinition(MAX_STAGE).maxHp)
    expect(lastStage.expeditionEvents.milestoneMask).toBe(
      MAX_EXPEDITION_MILESTONE_MASK,
    )
    expect(isGameState(lastStage)).toBe(true)

    const returned = setDebugStage(lastStage, 1)
    expect(returned.battle.stage).toBe(1)
    expect(returned.battle.highestStage).toBe(MAX_STAGE)
    expect(returned.battle.enemyHp).toBe(getEnemyDefinition(1).maxHp)
    expect(isGameState(returned)).toBe(true)
    expect(lastStage.battle.stage).toBe(MAX_STAGE)
  })

  it('rejects malformed and out-of-range stages without mutation', () => {
    const input = createInitialState(0, 1)
    const inputCopy = structuredClone(input)

    for (const invalid of [0, MAX_STAGE + 1, -1, 1.5, Number.NaN, Infinity, Number.MAX_SAFE_INTEGER]) {
      expect(() => setDebugStage(input, invalid)).toThrow(RangeError)
      expect(input).toEqual(inputCopy)
    }
  })

  it('sets each resource to the inclusive safe-integer boundaries', () => {
    const input = createInitialState(0, 1)
    const inputCopy = structuredClone(input)
    const gold = setDebugResource(input, 'gold', Number.MAX_SAFE_INTEGER)
    const skillPoints = setDebugResource(input, 'skillPoints', Number.MAX_SAFE_INTEGER)
    const essence = setDebugResource(input, 'essence', 0)

    expect(input).toEqual(inputCopy)
    expect(gold.player.gold).toBe(Number.MAX_SAFE_INTEGER)
    expect(skillPoints.player.skillPoints).toBe(Number.MAX_SAFE_INTEGER)
    expect(essence.player.essence).toBe(0)
    expect(gold.player.skillPoints).toBe(input.player.skillPoints)
    expect(skillPoints.player.gold).toBe(input.player.gold)
  })

  it('rejects malformed resources and values without mutation', () => {
    const input = createInitialState(0, 1)
    const inputCopy = structuredClone(input)
    const invalidValues = [-1, 0.5, Number.NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]

    for (const resource of ['gold', 'skillPoints', 'essence'] as const) {
      for (const invalid of invalidValues) {
        expect(() => setDebugResource(input, resource, invalid)).toThrow(RangeError)
        expect(input).toEqual(inputCopy)
      }
    }
    expect(() => setDebugResource(input, 'xp' as DebugResourceId, 1)).toThrow(RangeError)
    expect(input).toEqual(inputCopy)
  })

  it('applies the state-derived tent cap through the offline engine even from camp mode', () => {
    const input = createInitialState(0, 0x1234_5678)
    const inputCopy = structuredClone(input)
    const zero = applyDebugOfflineMinutes(input, 0)
    const maximum = applyDebugOfflineMinutes(input, 480)

    expect(input).toEqual(inputCopy)
    expect(zero.elapsedMs).toBe(0)
    expectDeepClone(input, zero.state)
    expect(maximum.elapsedMs).toBe(8 * 60 * 60 * 1_000)
    expect(maximum.state.rng.draws).toBe(input.rng.draws + 28_800)
    expect(maximum.state).not.toBe(input)

    const expandedCamp = createInitialState(0, 0x1234_5678)
    expandedCamp.currentMode = 'CAMP'
    expandedCamp.camp.structures.tent = 5
    const expanded = applyDebugOfflineMinutes(expandedCamp, MAX_DEBUG_OFFLINE_MINUTES)
    expect(expanded.elapsedMs).toBe(12 * 60 * 60 * 1_000)
    expect(expanded.state.currentMode).toBe('CAMP')
    expect(expanded.state.rng.draws).toBe(expandedCamp.rng.draws + 43_200)
  })

  it('rejects malformed offline minutes without mutation', () => {
    const input = createInitialState(0, 1)
    const inputCopy = structuredClone(input)

    for (const invalid of [
      -1,
      0.5,
      481,
      MAX_DEBUG_OFFLINE_MINUTES + 1,
      Number.NaN,
      Infinity,
      Number.MAX_SAFE_INTEGER,
    ]) {
      expect(() => applyDebugOfflineMinutes(input, invalid)).toThrow(RangeError)
      expect(input).toEqual(inputCopy)
    }
  })
})
