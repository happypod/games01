import { BattleArena } from './components/BattleArena'
import { HeroPanel } from './components/HeroPanel'
import { OfflineReport } from './components/OfflineReport'
import { PrestigePanel } from './components/PrestigePanel'
import { SkillPanel } from './components/SkillPanel'
import { UpgradePanel } from './components/UpgradePanel'
import { formatNumber } from './game/format'
import { useGame } from './hooks/useGame'

export function App() {
  const game = useGame()
  const controlsDisabled = !game.ready || game.readOnly

  const requestReset = () => {
    if (window.confirm('모든 진행을 지우고 새 원정을 시작할까요?')) game.reset()
  }
  const requestPrestige = () => {
    if (window.confirm('골드, 레벨, 장비, 스테이지를 초기화하고 환생할까요?')) game.prestige()
  }

  return (
    <div className="app-shell">
      <div className="ambient ambient--one" />
      <div className="ambient ambient--two" />
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Emberwatch 홈">
          <span className="brand__mark">E</span>
          <span><strong>EMBERWATCH</strong><small>IDLE CHRONICLE</small></span>
        </a>
        <div className="resource-rack" aria-label="보유 자원">
          <div><span className="resource-icon resource-icon--gold">●</span><span>골드<strong>{formatNumber(game.state.player.gold)}</strong></span></div>
          <div><span className="resource-icon resource-icon--essence">✦</span><span>불씨 정수<strong>{formatNumber(game.state.player.essence)}</strong></span></div>
        </div>
      </header>

      <main id="top">
        <section className="intro">
          <div>
            <p className="eyebrow">CHAPTER I · 재의 변경</p>
            <h1>꺼지지 않는 원정</h1>
          </div>
          <div className="status-cluster">
            <span className={game.saveHealthy && !game.readOnly ? 'save-ok' : 'save-error'}>
              {!game.ready
                ? '● 저장 소유권 확인 중'
                : game.readOnly
                  ? '● 읽기 전용'
                  : game.saveHealthy
                    ? '● 자동 저장 정상'
                    : '● 저장 실패'}
            </span>
            <button
              type="button"
              className="text-button"
              onClick={requestReset}
              disabled={controlsDisabled}
            >
              진행 초기화
            </button>
          </div>
        </section>

        {game.ready && game.readOnly && (
          <div className="warning-banner" role="status">
            {game.lockSupported
              ? '다른 탭이 진행을 저장하고 있습니다. 이 탭은 최신 저장을 표시하는 읽기 전용 모드이며, 다른 탭을 닫으면 자동으로 이어받습니다.'
              : '이 브라우저는 안전한 다중 탭 잠금을 지원하지 않아 저장을 보호하기 위해 읽기 전용으로 열었습니다.'}
          </div>
        )}

        {(game.recoveredFromInvalidSave || !game.saveHealthy) && (
          <div className="warning-banner" role="status">
            {game.recoveredFromInvalidSave
              ? '저장 데이터 문제를 감지해 보호 모드로 열었습니다. 저장 상태를 확인해 주세요.'
              : '브라우저 저장소에 기록하지 못했습니다. 이 탭을 닫기 전에 저장소 권한을 확인해 주세요.'}
          </div>
        )}

        <div className="dashboard">
          <BattleArena
            state={game.state}
            onChooseStage={game.chooseStage}
            disabled={controlsDisabled}
          />
          <div className="side-stack">
            <HeroPanel state={game.state} />
            <div className="notice-strip" role="status" aria-live="polite">{game.notice}</div>
          </div>
        </div>

        <div className="growth-grid">
          <UpgradePanel state={game.state} onBuy={game.buyUpgrade} disabled={controlsDisabled} />
          <SkillPanel state={game.state} onBuy={game.buySkill} disabled={controlsDisabled} />
        </div>

        <PrestigePanel
          state={game.state}
          onPrestige={requestPrestige}
          disabled={controlsDisabled}
        />

        <footer>
          <span>로컬 프로토타입 v0.1</span>
          <span>처치 {formatNumber(game.state.battle.kills)} · 패배 {formatNumber(game.state.battle.defeats)} · 환생 {game.state.stats.prestiges}</span>
        </footer>
      </main>

      {game.offlineReport && (
        <OfflineReport report={game.offlineReport} onClose={game.dismissOfflineReport} />
      )}
    </div>
  )
}
