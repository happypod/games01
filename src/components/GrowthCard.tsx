import type { GrowthEffectComparison, GrowthEffectMetricKey } from '../game/formulas'
import { formatNumber } from '../game/format'
import { useViewportActivation } from '../hooks/useViewportActivation'
import { GameAsset } from './GameAsset'

export type GrowthCardStatus =
  | 'available'
  | 'insufficient'
  | 'locked'
  | 'max'
  | 'globally-disabled'

const EFFECT_LABELS: Record<GrowthEffectMetricKey, string> = {
  attack: '공격력',
  maxHp: '최대 체력',
  defense: '방어력',
  goldBonusPercent: '골드 보너스',
  powerStrikeMultiplier: '피해 배율',
}

function formatEffectValue(key: GrowthEffectMetricKey, value: number | null): string {
  if (value === null) return '비활성'
  if (key === 'goldBonusPercent') return `+${formatNumber(value)}%`
  if (key === 'powerStrikeMultiplier') return `×${Number(value.toFixed(2))}`
  return formatNumber(value)
}

interface GrowthCardProps {
  id: string
  assetId: string
  fallbackGlyph: string
  name: string
  rankLabel: string
  description: string
  comparison: GrowthEffectComparison
  status: GrowthCardStatus
  statusText: string
  buttonLabel: string
  buttonAriaLabel: string
  costLabel?: string
  onAction: () => void
}

export function GrowthCard({
  id,
  assetId,
  fallbackGlyph,
  name,
  rankLabel,
  description,
  comparison,
  status,
  statusText,
  buttonLabel,
  buttonAriaLabel,
  costLabel,
  onAction,
}: GrowthCardProps) {
  const { targetRef, isActive } = useViewportActivation<HTMLDivElement>()
  const titleId = `${id}-title`
  const descriptionId = `${id}-description`
  const effectsId = `${id}-effects`
  const statusId = `${id}-status`
  const isDisabled = status !== 'available'

  return (
    <article
      className={`growth-card growth-card--${status}`}
      aria-labelledby={titleId}
      aria-describedby={`${descriptionId} ${effectsId} ${statusId}`}
      data-growth-card={id}
      data-growth-status={status}
    >
      <div
        ref={targetRef}
        className="growth-card__art"
        data-card-asset-id={assetId}
        data-art-active={isActive ? 'true' : 'false'}
        aria-hidden="true"
      >
        {isActive ? (
          <GameAsset
            assetId={assetId}
            purpose="card"
            decorative
            fallbackLabel={fallbackGlyph}
            className="growth-card__asset"
            fit="cover"
          />
        ) : (
          <span className="growth-card__art-placeholder" aria-hidden="true">
            {fallbackGlyph}
          </span>
        )}
      </div>

      <div className="growth-card__body">
        <div className="growth-card__heading">
          <h3 id={titleId}>{name}</h3>
          <span>{rankLabel}</span>
        </div>
        <p className="growth-card__description" id={descriptionId}>{description}</p>
        <dl className="growth-card__effects" id={effectsId}>
          {comparison.metrics.map((metric) => (
            <div key={metric.key}>
              <dt>{EFFECT_LABELS[metric.key]}</dt>
              <dd>
                <span><small>현재</small>{formatEffectValue(metric.key, metric.current)}</span>
                {metric.next !== null && (
                  <>
                    <i aria-hidden="true">→</i>
                    <span><small>다음</small>{formatEffectValue(metric.key, metric.next)}</span>
                  </>
                )}
              </dd>
            </div>
          ))}
        </dl>
        <p className="growth-card__status" id={statusId}>{statusText}</p>
      </div>

      <button
        type="button"
        onClick={onAction}
        disabled={isDisabled}
        aria-label={buttonAriaLabel}
        aria-describedby={`${descriptionId} ${effectsId} ${statusId}`}
      >
        <span>{buttonLabel}</span>
        {costLabel && <small>{costLabel}</small>}
      </button>
    </article>
  )
}
