import type { EnemyPresentationDamageState } from '../game/content'

const ENEMY_DAMAGE_STATE_LABELS = {
  normal: '갑옷 온전',
  damaged: '갑옷 균열',
  severe: '갑옷 붕괴 직전',
} as const satisfies Record<EnemyPresentationDamageState, string>

export function getEnemyDamageStateLabel(
  state: EnemyPresentationDamageState | null,
): string | null {
  return state === null ? null : ENEMY_DAMAGE_STATE_LABELS[state]
}
