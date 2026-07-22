import { SKILL_DEFINITIONS } from '../game/content'
import { getSkillEffectComparison, getSkillPointCost, isSkillUnlocked } from '../game/formulas'
import { SKILL_IDS, type GameState, type SkillId } from '../game/types'
import { GrowthCard, type GrowthCardStatus } from './GrowthCard'

const SKILL_GLYPHS: Record<SkillId, string> = {
  powerStrike: '火',
  ironWill: '盾',
  fortune: '星',
}

interface SkillPanelProps {
  state: GameState
  onBuy: (id: SkillId) => void
  disabled?: boolean
}

export function SkillPanel({ state, onBuy, disabled = false }: SkillPanelProps) {
  return (
    <section className="panel collection-panel" aria-labelledby="skill-title">
      <div className="panel__header panel__header--compact">
        <div>
          <p className="eyebrow">레벨 성장</p>
          <h2 id="skill-title">스킬 각인</h2>
        </div>
        <div className="point-pill">SP {state.player.skillPoints}</div>
      </div>
      <div className="card-list">
        {SKILL_IDS.map((id) => {
          const definition = SKILL_DEFINITIONS[id]
          const rank = state.player.skills[id]
          const unlocked = isSkillUnlocked(state, id)
          const cost = getSkillPointCost(id, rank)
          const comparison = getSkillEffectComparison(state, id)
          const shortage = Math.max(0, cost - state.player.skillPoints)
          const status: GrowthCardStatus = !unlocked
            ? 'locked'
            : comparison.isMax
              ? 'max'
              : disabled
                ? 'globally-disabled'
                : shortage > 0
                  ? 'insufficient'
                  : 'available'
          const statusText = status === 'locked'
            ? `영웅 레벨 ${definition.unlockLevel}에 해금됩니다.`
            : status === 'max'
              ? '최대 랭크에 도달했습니다.'
              : status === 'globally-disabled'
                ? '읽기 전용이거나 저장 소유권을 확인 중입니다.'
                : status === 'insufficient'
                  ? `스킬 포인트가 ${shortage} 부족합니다.`
                  : '지금 각인할 수 있습니다.'
          const buttonAriaLabel = status === 'locked'
            ? `${definition.name} 잠김, 영웅 레벨 ${definition.unlockLevel} 필요, 비용 ${cost} 스킬 포인트`
            : status === 'max'
              ? `${definition.name} 최대 랭크`
              : status === 'globally-disabled'
                ? `${definition.name} 각인 불가, 비용 ${cost} 스킬 포인트, 읽기 전용 또는 저장 확인 중`
                : status === 'insufficient'
                  ? `${definition.name} 각인 불가, 비용 ${cost} 스킬 포인트, 스킬 포인트 ${shortage} 부족`
                  : `${definition.name} 각인, 비용 ${cost} 스킬 포인트`

          return (
            <GrowthCard
              key={id}
              id={`skill-${id}`}
              assetId={definition.assetId}
              fallbackGlyph={SKILL_GLYPHS[id]}
              name={definition.name}
              rankLabel={`Rank ${rank}`}
              description={definition.description}
              comparison={comparison}
              status={status}
              statusText={statusText}
              buttonLabel={status === 'max' ? 'MAX' : status === 'locked' ? '잠김' : '각인'}
              {...(status === 'max' ? {} : { costLabel: `${cost} SP` })}
              buttonAriaLabel={buttonAriaLabel}
              onAction={() => onBuy(id)}
            />
          )
        })}
      </div>
    </section>
  )
}
