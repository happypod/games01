import { useLayoutEffect, type RefObject } from 'react'

export type TacticalMotionClass =
  | 'tactical-motion--hero-attack'
  | 'tactical-motion--hero-hit'
  | 'tactical-motion--enemy-hit'
  | 'tactical-motion--enemy-defeated'
  | 'tactical-motion--companion-assist'

const MOTION_CLASSES: readonly TacticalMotionClass[] = [
  'tactical-motion--hero-attack',
  'tactical-motion--hero-hit',
  'tactical-motion--enemy-hit',
  'tactical-motion--enemy-defeated',
  'tactical-motion--companion-assist',
]

function resetMotionClass(element: HTMLElement | null) {
  if (element === null) return
  element.classList.remove(...MOTION_CLASSES)
}

function triggerMotionClass(
  element: HTMLElement | null,
  className: TacticalMotionClass | null,
) {
  if (element === null || className === null) return
  // Consecutive scenes may request the same keyframes. A layout read between
  // removal and re-addition makes that one-shot animation restart reliably.
  void element.offsetWidth
  element.classList.add(className)
}

export function useTacticalMotionTriggers(
  sceneId: string | null,
  heroRef: RefObject<HTMLElement | null>,
  heroClass: TacticalMotionClass | null,
  enemyRef: RefObject<HTMLElement | null>,
  enemyClass: TacticalMotionClass | null,
  companionRef: RefObject<HTMLElement | null>,
  companionClass: TacticalMotionClass | null,
) {
  useLayoutEffect(() => {
    const hero = heroRef.current
    const enemy = enemyRef.current
    const companion = companionRef.current
    resetMotionClass(hero)
    resetMotionClass(enemy)
    resetMotionClass(companion)

    if (sceneId === null) return
    triggerMotionClass(hero, heroClass)
    triggerMotionClass(enemy, enemyClass)
    triggerMotionClass(companion, companionClass)

    return () => {
      resetMotionClass(hero)
      resetMotionClass(enemy)
      resetMotionClass(companion)
    }
  }, [
    companionClass,
    companionRef,
    enemyClass,
    enemyRef,
    heroClass,
    heroRef,
    sceneId,
  ])
}
