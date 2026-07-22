import { getEnemyDefinition } from '../game/content'
import type {
  CompanionAssistCombatEvent,
  CriticalCombatEvent,
  SkillCombatEvent,
} from '../game/types'
import type { TacticalStageScene } from '../hooks/useTacticalStageEffects'
import { TACTICAL_STAGE_SCENE_MS } from '../hooks/useTacticalStageEffects'

export type TacticalDamagePopupKind = 'skill' | 'critical' | 'companionAssist'

export const TACTICAL_DAMAGE_POPUP_DURATION_MS = 600
export const TACTICAL_DAMAGE_POPUP_DELAYS_MS = Object.freeze({
  primary: 60,
  companion: 180,
})
export const TACTICAL_DAMAGE_POPUP_EXIT_MARGIN_MS =
  TACTICAL_STAGE_SCENE_MS -
  TACTICAL_DAMAGE_POPUP_DURATION_MS -
  TACTICAL_DAMAGE_POPUP_DELAYS_MS.companion

export interface TacticalDamagePopup {
  readonly id: string
  readonly source: 'hero' | 'companion'
  readonly target: 'enemy'
  readonly kind: TacticalDamagePopupKind
  readonly damage: number
  readonly delayMs: number
}

export interface TacticalScenePresentation {
  readonly hero: {
    readonly attacking: boolean
    readonly hit: boolean
    readonly victorious: boolean
  }
  readonly enemy: {
    readonly hit: boolean
    readonly defeated: boolean
  }
  readonly companion: {
    readonly assisting: boolean
  }
  readonly damagePopups: readonly TacticalDamagePopup[]
  readonly ultimateFlash: boolean
}

const EMPTY_HERO_STATE = Object.freeze({
  attacking: false,
  hit: false,
  victorious: false,
})

const EMPTY_ENEMY_STATE = Object.freeze({
  hit: false,
  defeated: false,
})

const EMPTY_COMPANION_STATE = Object.freeze({ assisting: false })
const EMPTY_DAMAGE_POPUPS: readonly TacticalDamagePopup[] = Object.freeze([])

const EMPTY_PRESENTATION: TacticalScenePresentation = Object.freeze({
  hero: EMPTY_HERO_STATE,
  enemy: EMPTY_ENEMY_STATE,
  companion: EMPTY_COMPANION_STATE,
  damagePopups: EMPTY_DAMAGE_POPUPS,
  ultimateFlash: false,
})

function createPrimaryPopup(
  sceneId: string,
  event: CriticalCombatEvent | SkillCombatEvent,
): TacticalDamagePopup {
  return Object.freeze({
    id: `${sceneId}:primary`,
    source: 'hero',
    target: 'enemy',
    kind: event.type,
    damage: event.damage,
    delayMs: TACTICAL_DAMAGE_POPUP_DELAYS_MS.primary,
  })
}

function createCompanionPopup(
  sceneId: string,
  event: CompanionAssistCombatEvent,
): TacticalDamagePopup {
  return Object.freeze({
    id: `${sceneId}:companion`,
    source: 'companion',
    target: 'enemy',
    kind: event.type,
    damage: event.damage,
    delayMs: TACTICAL_DAMAGE_POPUP_DELAYS_MS.companion,
  })
}

/**
 * Projects one event-stream scene into short-lived, display-only tactical cues.
 * Skill and critical events describe the same applied hero hit, so critical wins
 * the primary popup slot instead of rendering the damage twice.
 */
export function projectTacticalScenePresentation(
  scene: TacticalStageScene | null,
  powerStrikeRank: number,
): TacticalScenePresentation {
  if (scene === null) return EMPTY_PRESENTATION

  const skill = scene.events.find(
    (event): event is SkillCombatEvent => event.type === 'skill',
  )
  const critical = scene.events.find(
    (event): event is CriticalCombatEvent => event.type === 'critical',
  )
  const assist = scene.events.find(
    (event): event is CompanionAssistCombatEvent => event.type === 'companionAssist',
  )
  const kill = scene.events.find((event) => event.type === 'kill')
  const bossVictory = scene.events.find((event) => event.type === 'bossVictory')
  const defeat = scene.events.some((event) => event.type === 'defeat')
  const primary = critical ?? skill
  const presentedEnemyStage = scene.snapshot.stage
  const primaryTargetsPresentedEnemy = primary?.stage === presentedEnemyStage
  const assistTargetsPresentedEnemy = assist?.stage === presentedEnemyStage
  const defeatedTarget = kill ?? bossVictory
  const defeatedTargetIsPresented = defeatedTarget?.stage === presentedEnemyStage
  const damagePopups: TacticalDamagePopup[] = []

  if (primary !== undefined && primaryTargetsPresentedEnemy) {
    damagePopups.push(createPrimaryPopup(scene.id, primary))
  }
  if (assist !== undefined && assistTargetsPresentedEnemy) {
    damagePopups.push(createCompanionPopup(scene.id, assist))
  }

  return Object.freeze({
    hero: Object.freeze({
      attacking: primary !== undefined,
      hit: defeat,
      victorious: bossVictory !== undefined,
    }),
    enemy: Object.freeze({
      hit: primaryTargetsPresentedEnemy || assistTargetsPresentedEnemy,
      defeated: defeatedTargetIsPresented,
    }),
    companion: Object.freeze({ assisting: assist !== undefined }),
    damagePopups: Object.freeze(damagePopups),
    ultimateFlash:
      skill !== undefined &&
      (getEnemyDefinition(skill.stage).isBoss || powerStrikeRank >= 5),
  })
}
