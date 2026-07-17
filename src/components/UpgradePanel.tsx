import { UPGRADE_DEFINITIONS } from '../game/content'
import { formatNumber } from '../game/format'
import { getUpgradeCost } from '../game/formulas'
import { UPGRADE_IDS, type GameState, type UpgradeId } from '../game/types'

const UPGRADE_GLYPHS: Record<UpgradeId, string> = {
  weapon: '†',
  armor: '◇',
  charm: '✦',
}

interface UpgradePanelProps {
  state: GameState
  onBuy: (id: UpgradeId) => void
}

export function UpgradePanel({ state, onBuy }: UpgradePanelProps) {
  return (
    <section className="panel collection-panel" aria-labelledby="upgrade-title">
      <div className="panel__header panel__header--compact">
        <div>
          <p className="eyebrow">골드 성장</p>
          <h2 id="upgrade-title">성장 장비</h2>
        </div>
      </div>
      <div className="card-list">
        {UPGRADE_IDS.map((id) => {
          const definition = UPGRADE_DEFINITIONS[id]
          const level = state.player.upgrades[id]
          const cost = getUpgradeCost(id, level)
          const isMax = level >= definition.maxLevel
          const canAfford = state.player.gold >= cost
          return (
            <article className="upgrade-card" key={id}>
              <div className="item-glyph">{UPGRADE_GLYPHS[id]}</div>
              <div className="upgrade-card__copy">
                <div><strong>{definition.name}</strong><span>Lv.{level}</span></div>
                <p>{definition.description}</p>
              </div>
              <button
                type="button"
                onClick={() => onBuy(id)}
                disabled={isMax || !canAfford}
                aria-label={`${definition.name} 강화, 비용 ${formatNumber(cost)} 골드`}
              >
                {isMax ? 'MAX' : <><span>강화</span><small>{formatNumber(cost)} G</small></>}
              </button>
            </article>
          )
        })}
      </div>
    </section>
  )
}
