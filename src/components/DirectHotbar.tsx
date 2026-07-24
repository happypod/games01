import React, { useState, useRef } from 'react'
import type { GameState } from '../game/types'
import { SKILL_DEFINITIONS } from '../game/content'

interface DirectHotbarProps {
  state: GameState
  onUseSkill?: (skillId: keyof typeof SKILL_DEFINITIONS) => void
  onUseConsumable?: () => void
}

export function DirectHotbar({ state, onUseSkill, onUseConsumable }: DirectHotbarProps) {
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null)
  const longPressTimerRef = useRef<number | null>(null)

  const handlePointerDown = (id: string) => {
    longPressTimerRef.current = window.setTimeout(() => {
      setActiveTooltip(id)
    }, 500)
  }

  const handlePointerUp = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }

  const skills = [
    { id: 'powerStrike', name: '강격', cd: 0, maxCd: 5, icon: '⚔️' },
    { id: 'ironWill', name: '강철 의지', cd: 0, maxCd: 12, icon: '🛡️' },
    { id: 'fortune', name: '행운의 불꽃', cd: 0, maxCd: 20, icon: '🔥' },
  ] as const

  return (
    <div className="direct-hotbar" data-testid="direct-hotbar">
      {skills.map((skill) => {
        const level = state.player.skills[skill.id as keyof typeof SKILL_DEFINITIONS] || 0
        const isCooldown = skill.cd > 0
        const cooldownPct = (skill.cd / skill.maxCd) * 100

        return (
          <div
            key={skill.id}
            className={`direct-hotbar__slot ${isCooldown ? 'direct-hotbar__slot--disabled' : ''}`}
            onPointerDown={() => handlePointerDown(skill.id)}
            onPointerUp={handlePointerUp}
            onPointerLeave={() => {
              handlePointerUp()
              setActiveTooltip(null)
            }}
            onClick={() => {
              if (!isCooldown && onUseSkill) {
                onUseSkill(skill.id as keyof typeof SKILL_DEFINITIONS)
              }
            }}
            title={`${skill.name} (Lv.${level})`}
          >
            <span style={{ fontSize: '24px' }}>{skill.icon}</span>

            {/* 반시계방향 쿨타임 셰이더 Overlay */}
            {isCooldown && (
              <div className="cooldown-shader">
                <div
                  className="cooldown-shader__overlay"
                  style={{ '--cooldown-pct': `${cooldownPct}%` } as React.CSSProperties}
                />
              </div>
            )}

            {/* Long-Press 툴팁 */}
            {activeTooltip === skill.id && (
              <div className="long-press-tooltip">
                <strong>{skill.name}</strong> (Lv.{level})
                <br />
                1-Tap 클릭 즉시 발동
              </div>
            )}
          </div>
        )
      })}

      {/* 소모품 즉시 포션 핫바 */}
      <div
        className="direct-hotbar__slot"
        onClick={() => onUseConsumable && onUseConsumable()}
        title="체력 포션 (1-Tap)"
      >
        <span style={{ fontSize: '24px' }}>🧪</span>
      </div>
    </div>
  )
}
