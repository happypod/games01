import { getEnemyDefinition } from '../game/content'
import { getHeroStats } from '../game/formulas'
import type { GameState } from '../game/types'
import { StatBar } from './StatBar'

interface BattleArenaProps {
  state: GameState
  onChooseStage: (stage: number) => void
  disabled?: boolean
}

export function BattleArena({ state, onChooseStage, disabled = false }: BattleArenaProps) {
  const enemy = getEnemyDefinition(state.battle.stage)
  const hero = getHeroStats(state)
  const cooldownReady = state.battle.powerStrikeCooldownMs === 0
  const cooldownProgress = cooldownReady
    ? 5_000
    : Math.max(0, 5_000 - state.battle.powerStrikeCooldownMs)

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
        <span className="live-badge"><i /> 자동 원정 중</span>
      </div>

      <div className={`enemy-portrait ${enemy.isBoss ? 'enemy-portrait--boss' : ''}`}>
        <div className="enemy-portrait__aura" />
        <div className="enemy-portrait__core">
          <span>{enemy.isBoss ? '♛' : '◆'}</span>
        </div>
      </div>

      <div className="enemy-name">
        <span>{enemy.isBoss ? '지역 수호자' : '야생의 위협'}</span>
        <strong>{enemy.name}</strong>
      </div>

      <StatBar label="적 체력" value={state.battle.enemyHp} maximum={enemy.maxHp} tone="enemy" />

      <div className="battle__meta">
        <span>적 공격력 <strong>{enemy.attack.toLocaleString('ko-KR')}</strong></span>
        <span>내 공격력 <strong>{hero.attack.toLocaleString('ko-KR')}</strong></span>
      </div>

      <div className="skill-cycle">
        <div className="skill-cycle__icon">火</div>
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
