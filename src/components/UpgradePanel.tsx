import { UPGRADE_DEFINITIONS } from '../game/content'
import { formatNumber } from '../game/format'
import { getUpgradeCost, getUpgradeEffectComparison } from '../game/formulas'
import { UPGRADE_IDS, type GameState, type UpgradeId } from '../game/types'
import { GrowthCard, type GrowthCardStatus } from './GrowthCard'

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
          const comparison = getUpgradeEffectComparison(state, id)
          const shortage = Math.max(0, cost - state.player.gold)
          const status: GrowthCardStatus = comparison.isMax
            ? 'max'
            : disabled
              ? 'globally-disabled'
              : shortage > 0
                ? 'insufficient'
                : 'available'
          const statusText = status === 'max'
            ? '최대 강화에 도달했습니다.'
            : status === 'globally-disabled'
              ? '읽기 전용이거나 저장 소유권을 확인 중입니다.'
              : status === 'insufficient'
                ? `골드가 ${formatNumber(shortage)} 부족합니다.`
                : '지금 강화할 수 있습니다.'
          const buttonAriaLabel = status === 'max'
            ? `${definition.name} 최대 강화`
            : status === 'globally-disabled'
              ? `${definition.name} 강화 불가, 비용 ${formatNumber(cost)} 골드, 읽기 전용 또는 저장 확인 중`
              : status === 'insufficient'
                ? `${definition.name} 강화 불가, 비용 ${formatNumber(cost)} 골드, 골드 ${formatNumber(shortage)} 부족`
                : `${definition.name} 강화, 비용 ${formatNumber(cost)} 골드`

          return (
            <GrowthCard
              key={id}
              id={`upgrade-${id}`}
              assetId={definition.assetId}
              fallbackGlyph={UPGRADE_GLYPHS[id]}
              name={definition.name}
              rankLabel={`Lv.${level}`}
              description={definition.description}
              comparison={comparison}
              status={status}
              statusText={statusText}
              buttonLabel={status === 'max' ? 'MAX' : '강화'}
              {...(status === 'max' ? {} : { costLabel: `${formatNumber(cost)} G` })}
              buttonAriaLabel={buttonAriaLabel}
              onAction={() => onBuy(id)}
            />
          )
        })}
      </div>
    </section>
  )
}
