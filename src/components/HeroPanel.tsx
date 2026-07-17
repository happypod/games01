import { getHeroStats, getXpToNextLevel } from '../game/formulas'
import { formatNumber } from '../game/format'
import type { GameState } from '../game/types'
import { StatBar } from './StatBar'

interface HeroPanelProps {
  state: GameState
}

export function HeroPanel({ state }: HeroPanelProps) {
  const hero = getHeroStats(state)
  return (
    <section className="panel hero-panel" aria-labelledby="hero-title">
      <div className="panel__header panel__header--compact">
        <div>
          <p className="eyebrow">잿불의 계승자</p>
          <h2 id="hero-title">방랑 기사 아렌</h2>
        </div>
        <div className="level-seal">Lv.{state.player.level}</div>
      </div>
      <StatBar label="생명력" value={state.player.currentHp} maximum={hero.maxHp} />
      <StatBar label="경험치" value={state.player.xp} maximum={getXpToNextLevel(state.player.level)} tone="xp" />
      <dl className="stat-grid">
        <div><dt>공격력</dt><dd>{formatNumber(hero.attack)}</dd></div>
        <div><dt>방어력</dt><dd>{formatNumber(hero.defense)}</dd></div>
        <div><dt>골드 보너스</dt><dd>+{Math.round((hero.goldMultiplier - 1) * 100)}%</dd></div>
        <div><dt>누적 처치</dt><dd>{formatNumber(state.stats.enemiesDefeated)}</dd></div>
      </dl>
    </section>
  )
}
