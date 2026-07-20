import {
  COMPANION_ATTACK_INTERVAL_MS,
  COMPANION_DEFINITIONS,
  getEnemyDefinition,
  getEnemyPresentationAssetId,
} from '../game/content'
import { getCompanionDamage, getHeroStats, isCompanionUnlocked } from '../game/formulas'
import type { GameState } from '../game/types'
import { GameAsset } from './GameAsset'
import { StatBar } from './StatBar'

interface BattleArenaProps {
  state: GameState
  onChooseStage: (stage: number) => void
  disabled?: boolean
}

export function BattleArena({ state, onChooseStage, disabled = false }: BattleArenaProps) {
  const enemy = getEnemyDefinition(state.battle.stage)
  const enemyAssetId = getEnemyPresentationAssetId(
    enemy.assetId,
    state.battle.enemyHp,
    enemy.maxHp,
  )
  const hero = getHeroStats(state)
  const cooldownReady = state.battle.powerStrikeCooldownMs === 0
  const cooldownProgress = cooldownReady
    ? 5_000
    : Math.max(0, 5_000 - state.battle.powerStrikeCooldownMs)
  const companionId = state.player.companion.id
  const companion = companionId === null ? null : COMPANION_DEFINITIONS[companionId]
  const companionUnlocked = isCompanionUnlocked(state, 'emberFox')
  const companionDamage = getCompanionDamage(state)
  const companionCooldownReady = companion !== null && state.battle.companionCooldownMs === 0
  const companionCooldownProgress = companion === null
    ? 0
    : companionCooldownReady
      ? COMPANION_ATTACK_INTERVAL_MS
      : Math.max(0, COMPANION_ATTACK_INTERVAL_MS - state.battle.companionCooldownMs)

  return (
    <section className="panel battle" aria-labelledby="battle-title">
      <div className="panel__header">
        <div>
          <p className="eyebrow">현재 원정</p>
          <h2 id="battle-title">
            스테이지 {state.battle.stage}
            {enemy.isBoss && <span className="boss-tag">BOSS</span>}
          </h2>
        </div>
        <span className="live-badge"><i aria-hidden="true" /> 자동 원정 중</span>
      </div>

      <div
        className={`enemy-portrait ${enemy.isBoss ? 'enemy-portrait--boss' : ''}`}
        aria-hidden="true"
      >
        <div className="enemy-portrait__aura" />
        <GameAsset
          assetId={enemyAssetId}
          purpose="character"
          className="enemy-portrait__asset"
          fallbackLabel={enemy.isBoss ? '♛' : '◆'}
          fit="contain"
          loading="eager"
          decorative
        />
      </div>

      <div className="enemy-name">
        <span>{enemy.isBoss ? '지역 수호자' : '야생의 위협'}</span>
        <strong>{enemy.name}</strong>
      </div>

      <StatBar label="적 체력" value={state.battle.enemyHp} maximum={enemy.maxHp} tone="enemy" />

      <div className="battle__meta">
        <span>적 공격력 <strong>{enemy.attack.toLocaleString('ko-KR')}</strong></span>
        <span>내 공격력 <strong>{hero.attack.toLocaleString('ko-KR')}</strong></span>
        <span>동료 협공 <strong>{companionDamage.toLocaleString('ko-KR')}</strong></span>
      </div>

      <div className="skill-cycle">
        <div className="skill-cycle__icon" aria-hidden="true">火</div>
        <div className="skill-cycle__body">
          <div className="skill-cycle__title">
            <span>화염 강타</span>
            <strong>{cooldownReady ? '준비됨' : `${Math.ceil(state.battle.powerStrikeCooldownMs / 1_000)}초`}</strong>
          </div>
          <div className="mini-track">
            <span style={{ width: `${(cooldownProgress / 5_000) * 100}%` }} />
          </div>
        </div>
      </div>

      <div className={`skill-cycle companion-cycle ${companion === null ? 'companion-cycle--empty' : ''}`}>
        <div className="skill-cycle__icon companion-cycle__icon" aria-hidden="true">狐</div>
        <div className="skill-cycle__body">
          <div className="skill-cycle__title">
            <span>{companion?.name ?? '동료 미영입'}</span>
            <strong>
              {companion === null
                ? companionUnlocked
                  ? '무료 영입 가능'
                  : '첫 보스 뒤 해금'
                : companionCooldownReady
                  ? '협공 준비'
                  : `${Math.ceil(state.battle.companionCooldownMs / 1_000)}초`}
            </strong>
          </div>
          <p className="companion-cycle__detail">
            {companion === null
              ? companionUnlocked
                ? '동료 원정대에서 불씨 여우 루미를 영입하세요.'
                : '스테이지 11에서 원정 동료를 무료로 영입할 수 있습니다.'
              : `Rank ${state.player.companion.rank} · 협공 피해 ${companionDamage.toLocaleString('ko-KR')}`}
          </p>
          <div className="mini-track" aria-hidden="true">
            <span style={{ width: `${(companionCooldownProgress / COMPANION_ATTACK_INTERVAL_MS) * 100}%` }} />
          </div>
        </div>
      </div>

      <nav className="stage-nav" aria-label="스테이지 이동">
        <button
          type="button"
          onClick={() => onChooseStage(state.battle.stage - 1)}
          disabled={disabled || state.battle.stage <= 1}
        >
          ← 이전
        </button>
        <span>최고 {state.battle.highestStage}</span>
        <button
          type="button"
          onClick={() => onChooseStage(state.battle.stage + 1)}
          disabled={disabled || state.battle.stage >= state.battle.highestStage}
        >
          다음 →
        </button>
      </nav>
    </section>
  )
}
