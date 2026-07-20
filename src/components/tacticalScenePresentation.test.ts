import { describe, expect, it } from 'vitest'
import { advanceGame, createInitialState } from '../game/engine'
import type { CombatEvent, CombatEventSnapshot } from '../game/types'
import {
  TACTICAL_STAGE_SCENE_MS,
  type TacticalStageScene,
} from '../hooks/useTacticalStageEffects'
import {
  projectTacticalScenePresentation,
  TACTICAL_DAMAGE_POPUP_DELAYS_MS,
  TACTICAL_DAMAGE_POPUP_DURATION_MS,
  TACTICAL_DAMAGE_POPUP_EXIT_MARGIN_MS,
} from './tacticalScenePresentation'

const SNAPSHOT: CombatEventSnapshot = {
  stage: 1,
  highestStage: 1,
  playerHp: 100,
  enemyHp: 50,
  gold: 0,
  xp: 0,
}

function event(type: CombatEvent['type'], stage = 1, damage = 10): CombatEvent {
  const base = {
    id: `7:${type}`,
    roundSequence: '7',
    rngState: 123,
    stage,
    snapshot: { ...SNAPSHOT, stage },
  }
  if (type === 'skill') {
    return { ...base, type, ordinal: 10, skillId: 'powerStrike', damage }
  }
  if (type === 'critical') {
    return { ...base, type, ordinal: 20, damage }
  }
  if (type === 'companionAssist') {
    return { ...base, type, ordinal: 25, companionId: 'emberFox', damage }
  }
  if (type === 'kill') {
    return {
      ...base,
      type,
      ordinal: 30,
      defeatedStage: stage,
      nextStage: stage + 1,
      gold: 5,
      xp: 3,
    }
  }
  if (type === 'bossVictory') {
    return {
      ...base,
      type,
      ordinal: 30,
      defeatedStage: stage,
      nextStage: stage + 1,
      gold: 50,
      xp: 30,
      milestoneReward: null,
    }
  }
  return {
    ...base,
    type,
    ordinal: 30,
    damage,
    defeatedAtStage: stage,
    returnStage: Math.max(1, stage - 1),
    highestStage: stage,
  }
}

function scene(events: readonly CombatEvent[], id = '4:7'): TacticalStageScene {
  return {
    id,
    roundSequence: '7',
    events,
    snapshot: events.at(-1)?.snapshot ?? SNAPSHOT,
    priorityOutcome:
      events.find(
        (candidate) =>
          candidate.type === 'bossVictory' || candidate.type === 'defeat',
      ) as TacticalStageScene['priorityOutcome'] ?? null,
  }
}

describe('IRPG-416 tactical scene presentation', () => {
  it('returns one stable idle projection when there is no active scene', () => {
    const first = projectTacticalScenePresentation(null, 10)
    const second = projectTacticalScenePresentation(null, 0)

    expect(first).toBe(second)
    expect(first).toEqual({
      hero: { attacking: false, hit: false, victorious: false },
      enemy: { hit: false, defeated: false },
      companion: { assisting: false },
      damagePopups: [],
      ultimateFlash: false,
    })
    expect(Object.isFrozen(first)).toBe(true)
    expect(Object.isFrozen(first.damagePopups)).toBe(true)
  })

  it('deduplicates skill and critical damage, then keeps companion damage separate', () => {
    const activeScene = scene([
      event('skill', 10, 111),
      event('critical', 10, 111),
      event('companionAssist', 10, 33),
      event('bossVictory', 10),
    ])

    const projection = projectTacticalScenePresentation(activeScene, 1)

    expect(projection.hero).toEqual({ attacking: true, hit: false, victorious: true })
    expect(projection.enemy).toEqual({ hit: true, defeated: true })
    expect(projection.companion).toEqual({ assisting: true })
    expect(projection.damagePopups).toEqual([
      {
        id: '4:7:primary',
        source: 'hero',
        target: 'enemy',
        kind: 'critical',
        damage: 111,
        delayMs: TACTICAL_DAMAGE_POPUP_DELAYS_MS.primary,
      },
      {
        id: '4:7:companion',
        source: 'companion',
        target: 'enemy',
        kind: 'companionAssist',
        damage: 33,
        delayMs: TACTICAL_DAMAGE_POPUP_DELAYS_MS.companion,
      },
    ])
    expect(projection.damagePopups).toHaveLength(2)
    expect(projection.ultimateFlash).toBe(true)
    expect(Object.isFrozen(projection)).toBe(true)
    expect(Object.isFrozen(projection.hero)).toBe(true)
    expect(Object.isFrozen(projection.damagePopups[0])).toBe(true)

    expect(projectTacticalScenePresentation(activeScene, 1).damagePopups)
      .toEqual(projection.damagePopups)
  })

  it('finishes every popup before the 900ms scene boundary', () => {
    expect(TACTICAL_DAMAGE_POPUP_DURATION_MS).toBe(600)
    expect(TACTICAL_DAMAGE_POPUP_EXIT_MARGIN_MS).toBe(120)
    expect(
      TACTICAL_DAMAGE_POPUP_DURATION_MS +
      Math.max(...Object.values(TACTICAL_DAMAGE_POPUP_DELAYS_MS)),
    ).toBeLessThanOrEqual(TACTICAL_STAGE_SCENE_MS - 100)
  })

  it('does not apply a defeated target\'s cues to the next enemy in real engine batches', () => {
    const regularState = createInitialState(0, 1)
    regularState.battle.enemyHp = 1
    const regularResult = advanceGame(regularState, 1_000, '0')

    const bossState = createInitialState(0, 0x1234_5678)
    bossState.battle.stage = 10
    bossState.battle.highestStage = 10
    bossState.battle.enemyHp = 1
    const bossResult = advanceGame(bossState, 1_000, '0')

    for (const [kind, result] of [
      ['kill', regularResult],
      ['bossVictory', bossResult],
    ] as const) {
      expect(result.events.some((candidate) => candidate.type === kind)).toBe(true)
      expect(result.events.at(-1)?.snapshot.stage).not.toBe(result.events[0]?.stage)

      const projection = projectTacticalScenePresentation(
        scene(result.events, `engine:${kind}`),
        result.state.player.skills.powerStrike,
      )

      expect(projection.hero.attacking).toBe(true)
      expect(projection.enemy).toEqual({ hit: false, defeated: false })
      expect(projection.damagePopups).toEqual([])
      if (kind === 'bossVictory') {
        expect(projection.hero.victorious).toBe(true)
        expect(projection.ultimateFlash).toBe(true)
      }
    }
  })

  it('keeps actor-side attack and assist motion when an outcome snapshot shows the next enemy', () => {
    const nextEnemySnapshot = { ...SNAPSHOT, stage: 11 }
    const activeScene = scene([
      event('skill', 10, 111),
      event('companionAssist', 10, 33),
      { ...event('bossVictory', 10), snapshot: nextEnemySnapshot },
    ])

    const projection = projectTacticalScenePresentation(activeScene, 1)

    expect(projection.hero).toEqual({ attacking: true, hit: false, victorious: true })
    expect(projection.companion.assisting).toBe(true)
    expect(projection.enemy).toEqual({ hit: false, defeated: false })
    expect(projection.damagePopups).toEqual([])
    expect(projection.ultimateFlash).toBe(true)
  })

  it('uses rank five as the non-boss ultimate threshold and the event stage for bosses', () => {
    const regularSkill = scene([event('skill', 9, 42)])
    expect(projectTacticalScenePresentation(regularSkill, 4).ultimateFlash).toBe(false)
    expect(projectTacticalScenePresentation(regularSkill, 5).ultimateFlash).toBe(true)

    const bossSkillAfterStageAdvance = scene([{
      ...event('skill', 10, 84),
      snapshot: { ...SNAPSHOT, stage: 11 },
    }])
    expect(projectTacticalScenePresentation(bossSkillAfterStageAdvance, 0).ultimateFlash)
      .toBe(true)
  })

  it('projects outcome motion without inventing floating damage', () => {
    const kill = projectTacticalScenePresentation(scene([event('kill', 3)]), 10)
    expect(kill.hero.attacking).toBe(false)
    expect(kill.enemy).toEqual({ hit: false, defeated: true })
    expect(kill.damagePopups).toEqual([])

    const victory = projectTacticalScenePresentation(
      scene([event('bossVictory', 10)]),
      10,
    )
    expect(victory.hero.victorious).toBe(true)
    expect(victory.enemy.defeated).toBe(true)
    expect(victory.damagePopups).toEqual([])
    expect(victory.ultimateFlash).toBe(false)

    const defeat = projectTacticalScenePresentation(scene([event('defeat', 6, 99)]), 10)
    expect(defeat.hero.hit).toBe(true)
    expect(defeat.enemy.defeated).toBe(false)
    expect(defeat.damagePopups).toEqual([])
  })
})
