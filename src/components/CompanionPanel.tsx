import { COMPANION_DEFINITIONS } from '../game/content'
import {
  getCompanionDamage,
  getCompanionTrainingCost,
  isCompanionUnlocked,
} from '../game/formulas'
import { COMPANION_IDS, type CompanionId, type GameState } from '../game/types'
import { formatNumber } from '../game/format'

interface CompanionPanelProps {
  state: GameState
  onRecruit: (id: CompanionId) => void
  onTrain: () => void
  disabled?: boolean
}

export function CompanionPanel({
  state,
  onRecruit,
  onTrain,
  disabled = false,
}: CompanionPanelProps) {
  return (
    <section
      className="panel collection-panel companion-panel"
      aria-labelledby="companion-title"
    >
      <div className="panel__header panel__header--compact">
        <div>
          <p className="eyebrow">원정 협공</p>
          <h2 id="companion-title">동료 원정대</h2>
        </div>
        <div className="companion-pill">
          {state.player.companion.id === null
            ? '미영입'
            : `Rank ${state.player.companion.rank}`}
        </div>
      </div>

      <div className="card-list">
        {COMPANION_IDS.map((id) => {
          const definition = COMPANION_DEFINITIONS[id]
          const recruited = state.player.companion.id === id
          const rank = recruited ? state.player.companion.rank : 0
          const unlocked = isCompanionUnlocked(state, id)
          const isMax = recruited && rank >= definition.maxRank
          const cost = recruited ? getCompanionTrainingCost(id, rank) : 0
          const canAfford = recruited && state.player.gold >= cost
          const damage = recruited ? getCompanionDamage(state) : 0
          const descriptionId = `companion-${id}-description`
          const detailId = `companion-${id}-detail`
          const statusId = `companion-${id}-status`
          const cooldownReady = recruited && state.battle.companionCooldownMs === 0
          const cooldownSeconds = Math.ceil(state.battle.companionCooldownMs / 1_000)

          const status = disabled
            ? '읽기 전용이거나 저장 소유권을 확인 중이라 동료를 변경할 수 없습니다.'
            : !recruited && !unlocked
              ? `첫 보스를 격파하고 스테이지 ${definition.unlockStage}을 열면 영입할 수 있습니다.`
              : !recruited
                ? '무료로 영입할 수 있습니다.'
                : isMax
                  ? '최대 랭크입니다.'
                  : !canAfford
                    ? `골드가 ${formatNumber(cost - state.player.gold)} 부족합니다.`
                    : '훈련할 수 있습니다.'

          return (
            <article
              className={`upgrade-card companion-card ${recruited ? 'companion-card--active' : ''}`}
              key={id}
            >
              <div className="item-glyph item-glyph--companion" aria-hidden="true">狐</div>
              <div className="upgrade-card__copy companion-card__copy">
                <div>
                  <h3>{definition.name}</h3>
                  <span>{recruited ? `Rank ${rank}` : '미영입'}</span>
                  {recruited && <span className="companion-active">협공 중</span>}
                </div>
                <p id={descriptionId}>{definition.description}</p>
                <p className="companion-card__detail" id={detailId}>
                  {recruited
                    ? `협공 피해 ${formatNumber(damage)} · ${cooldownReady ? '준비됨' : `${cooldownSeconds}초 후 공격`}`
                    : unlocked
                      ? '첫 보스 승리 보상 · 무료 영입 가능'
                      : `최고 스테이지 ${definition.unlockStage}에서 무료 영입`}
                </p>
                <span className="sr-only" id={statusId}>{status}</span>
              </div>
              <button
                type="button"
                onClick={() => recruited ? onTrain() : onRecruit(id)}
                disabled={disabled || (!recruited && !unlocked) || isMax || (recruited && !canAfford)}
                aria-label={recruited
                  ? isMax
                    ? `${definition.name} 최대 랭크`
                    : `${definition.name} 훈련, 비용 ${formatNumber(cost)} 골드`
                  : `${definition.name} 영입, 무료`}
                aria-describedby={`${descriptionId} ${detailId} ${statusId}`}
              >
                {recruited
                  ? isMax
                    ? 'MAX'
                    : <><span>훈련</span><small>{formatNumber(cost)} G</small></>
                  : <><span>영입</span><small>무료</small></>}
              </button>
            </article>
          )
        })}
      </div>
    </section>
  )
}
