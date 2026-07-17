import { PRESTIGE_STAGE } from '../game/content'
import { formatNumber } from '../game/format'
import { getPrestigeReward } from '../game/formulas'
import type { GameState } from '../game/types'

interface PrestigePanelProps {
  state: GameState
  onPrestige: () => void
}

export function PrestigePanel({ state, onPrestige }: PrestigePanelProps) {
  const unlocked = state.battle.highestStage >= PRESTIGE_STAGE
  const reward = getPrestigeReward(state.battle.highestStage)
  return (
    <section className="panel prestige-panel" aria-labelledby="prestige-title">
      <div>
        <p className="eyebrow">영구 성장</p>
        <h2 id="prestige-title">불씨의 계승</h2>
        <p>
          진행을 처음부터 다시 시작하고 불씨 정수를 얻습니다. 정수 1개마다 공격력과 체력이 3% 증가합니다.
        </p>
      </div>
      <div className="prestige-panel__action">
        <span>예상 보상 <strong>{formatNumber(reward)} 정수</strong></span>
        <button type="button" disabled={!unlocked} onClick={onPrestige}>
          {unlocked ? '환생하기' : `${PRESTIGE_STAGE} 스테이지 필요`}
        </button>
      </div>
    </section>
  )
}
