import { SKILL_DEFINITIONS } from '../game/content'
import { getSkillPointCost, isSkillUnlocked } from '../game/formulas'
import { SKILL_IDS, type GameState, type SkillId } from '../game/types'

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
          const isMax = rank >= definition.maxRank
          return (
            <article className={`upgrade-card ${unlocked ? '' : 'upgrade-card--locked'}`} key={id}>
              <div className="item-glyph item-glyph--skill">{SKILL_GLYPHS[id]}</div>
              <div className="upgrade-card__copy">
                <div><strong>{definition.name}</strong><span>Rank {rank}</span></div>
                <p>{unlocked ? definition.description : `영웅 레벨 ${definition.unlockLevel}에 해금`}</p>
              </div>
              <button
                type="button"
                onClick={() => onBuy(id)}
                disabled={disabled || !unlocked || isMax || state.player.skillPoints < cost}
                aria-label={`${definition.name} 랭크 상승, 비용 ${cost} 스킬 포인트`}
              >
                {isMax ? 'MAX' : <><span>각인</span><small>{cost} SP</small></>}
              </button>
            </article>
          )
        })}
      </div>
    </section>
  )
}
