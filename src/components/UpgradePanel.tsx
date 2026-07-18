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
  disabled?: boolean
}

export function UpgradePanel({ state, onBuy, disabled = false }: UpgradePanelProps) {
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
          const descriptionId = `upgrade-${id}-description`
          const statusId = `upgrade-${id}-status`
          return (
            <article className="upgrade-card" key={id}>
              <div className="item-glyph" aria-hidden="true">{UPGRADE_GLYPHS[id]}</div>
              <div className="upgrade-card__copy">
                <div><strong>{definition.name}</strong><span>Lv.{level}</span></div>
                <p id={descriptionId}>{definition.description}</p>
                <span className="sr-only" id={statusId}>
                  {isMax
                    ? '최대 강화입니다.'
                    : disabled
                      ? '읽기 전용이거나 저장 소유권을 확인 중이라 강화할 수 없습니다.'
                      : canAfford
                      ? '강화할 수 있습니다.'
                      : `골드가 ${formatNumber(cost - state.player.gold)} 부족합니다.`}
                </span>
              </div>
              <button
                type="button"
                onClick={() => onBuy(id)}
                disabled={disabled || isMax || !canAfford}
                aria-label={`${definition.name} 강화, 비용 ${formatNumber(cost)} 골드`}
                aria-describedby={`${descriptionId} ${statusId}`}
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
