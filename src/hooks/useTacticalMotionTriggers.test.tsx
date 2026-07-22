import { renderHook } from '@testing-library/react'
import { createRef } from 'react'
import { describe, expect, it } from 'vitest'
import {
  useTacticalMotionTriggers,
  type TacticalMotionClass,
} from './useTacticalMotionTriggers'

describe('IRPG-416 useTacticalMotionTriggers', () => {
  it('applies one-shot classes for a scene and removes them when it clears', () => {
    const hero = document.createElement('div')
    const enemy = document.createElement('div')
    const companion = document.createElement('div')
    const heroRef = createRef<HTMLDivElement>()
    const enemyRef = createRef<HTMLDivElement>()
    const companionRef = createRef<HTMLDivElement>()
    heroRef.current = hero
    enemyRef.current = enemy
    companionRef.current = companion

    const { rerender } = renderHook(
      ({ sceneId }) => useTacticalMotionTriggers(
        sceneId,
        heroRef,
        'tactical-motion--hero-attack',
        enemyRef,
        'tactical-motion--enemy-hit',
        companionRef,
        'tactical-motion--companion-assist',
      ),
      { initialProps: { sceneId: 'scene-1' as string | null } },
    )

    expect(hero).toHaveClass('tactical-motion--hero-attack')
    expect(enemy).toHaveClass('tactical-motion--enemy-hit')
    expect(companion).toHaveClass('tactical-motion--companion-assist')

    rerender({ sceneId: null })
    expect(hero.className).toBe('')
    expect(enemy.className).toBe('')
    expect(companion.className).toBe('')
  })

  it('replaces the prior scene class without retaining stale motion', () => {
    const hero = document.createElement('div')
    const heroRef = createRef<HTMLDivElement>()
    const emptyRef = createRef<HTMLDivElement>()
    heroRef.current = hero

    const { rerender } = renderHook(
      ({ sceneId, heroClass }: {
        sceneId: string
        heroClass: TacticalMotionClass
      }) => useTacticalMotionTriggers(
        sceneId,
        heroRef,
        heroClass,
        emptyRef,
        null,
        emptyRef,
        null,
      ),
      {
        initialProps: {
          sceneId: 'scene-1',
          heroClass: 'tactical-motion--hero-attack' as TacticalMotionClass,
        },
      },
    )

    expect(hero).toHaveClass('tactical-motion--hero-attack')
    rerender({
      sceneId: 'scene-2',
      heroClass: 'tactical-motion--hero-hit',
    })
    expect(hero).not.toHaveClass('tactical-motion--hero-attack')
    expect(hero).toHaveClass('tactical-motion--hero-hit')
  })
})
