import type { ReactNode } from 'react'
import { BattleArena } from './BattleArena'
import { CampDashboard } from './CampDashboard'
import { CombatLogPanel } from './CombatLogPanel'
import { CombatResultSurface } from './CombatResultRegion'
import { ExpeditionEventPanel } from './ExpeditionEventPanel'
import { GrowthTabs } from './GrowthTabs'
import { HeroPanel } from './HeroPanel'
import { LayoutModeSelector } from './LayoutModeSelector'
import { OfflineReport } from './OfflineReport'
import { PrestigePanel } from './PrestigePanel'
import { SaveTransferPanel } from './SaveTransferPanel'
import { StageMapPanel } from './StageMapPanel'
import { TacticalStage } from './TacticalStage'
import { formatNumber } from '../game/format'
import type { GameController } from '../hooks/useGame'
import { useCombatResults } from '../hooks/useCombatResults'
import { useLayoutPreference } from '../hooks/useLayoutPreference'

interface GameScreenProps {
  game: GameController
  developerTools?: ReactNode
  statusOverride?: {
    text: string
    testId?: string
  }
  resetCopy?: {
    label: string
    confirmation: string
  }
  informationBanner?: string
  showReadOnlyWarning?: boolean
  showSaveTransfer?: boolean
  footerSuffix?: string
}

export function GameScreen({
  game,
  developerTools,
  statusOverride,
  resetCopy,
  informationBanner,
  showReadOnlyWarning = true,
  showSaveTransfer = true,
  footerSuffix = '',
}: GameScreenProps) {
  const controlsDisabled = !game.ready || game.readOnly
  const [layoutMode, setLayoutMode] = useLayoutPreference()
  const combatResults = useCombatResults(
    game.combatEventBatch,
    game.combatEventGeneration,
  )
  const disabledReason = !game.ready
    ? '게임 상태를 준비하는 중이라 명령을 실행할 수 없습니다.'
    : game.readOnly
      ? '다른 탭이 진행을 저장 중인 읽기 전용 모드에서는 명령을 실행할 수 없습니다.'
      : undefined

  const requestReset = () => {
    const message = resetCopy?.confirmation ?? '모든 진행을 지우고 새 원정을 시작할까요?'
    if (window.confirm(message)) game.reset()
  }
  const requestPrestige = () => {
    const pendingCount = game.state.expeditionEvents.pending.length
    const pendingWarning = pendingCount > 0
      ? `\n환생하면 대기 중인 원정 이벤트 ${pendingCount}개가 보상 없이 사라집니다.`
      : ''
    if (window.confirm(`골드, 레벨, 장비, 스테이지를 초기화하고 환생할까요?${pendingWarning}`)) {
      game.prestige()
    }
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">본문 바로가기</a>
      <div className="ambient ambient--one" aria-hidden="true" />
      <div className="ambient ambient--two" aria-hidden="true" />
      <header className="topbar" id="top">
        <a className="brand" href="#top" aria-label="Emberwatch 홈">
          <span className="brand__mark" aria-hidden="true">E</span>
          <span><strong>EMBERWATCH</strong><small>IDLE CHRONICLE</small></span>
        </a>
        <div className="topbar__campaign">
          <p>CHAPTER I · 재의 변경</p>
          <div>
            <h1>꺼지지 않는 원정</h1>
            <span className="topbar__stage">
              STAGE {game.state.battle.stage}
              <small>최고 {game.state.battle.highestStage}</small>
            </span>
          </div>
        </div>
        <div className="topbar__right">
          <div className="topbar__layout">
            <LayoutModeSelector
              value={layoutMode}
              onChange={setLayoutMode}
              gameMode={game.state.currentMode}
              onGameModeChange={game.changeMode}
              gameModeDisabled={controlsDisabled}
            />
          </div>
          <div className="resource-rack" role="group" aria-label="보유 자원">
            <div><span className="resource-icon resource-icon--gold" aria-hidden="true">●</span><span>골드<strong>{formatNumber(game.state.player.gold)}</strong></span></div>
            <div><span className="resource-icon resource-icon--essence" aria-hidden="true">✦</span><span>불씨 정수<strong>{formatNumber(game.state.player.essence)}</strong></span></div>
          </div>
          <div className="status-cluster">
            <span
              className={statusOverride || (game.saveHealthy && !game.readOnly) ? 'save-ok' : 'save-error'}
              data-testid={statusOverride?.testId}
            >
              {statusOverride?.text ?? (
                !game.ready
                  ? '● 저장 소유권 확인 중'
                  : game.readOnly
                    ? '● 읽기 전용'
                    : game.saveHealthy
                      ? '● 자동 저장 정상'
                      : '● 저장 실패'
              )}
            </span>
            <button
              type="button"
              className="text-button"
              onClick={requestReset}
              disabled={controlsDisabled}
            >
              {resetCopy?.label ?? '진행 초기화'}
            </button>
          </div>
        </div>
      </header>

      <main className="game-main" id="main-content" tabIndex={-1}>
        <div className="dashboard-alerts">
          {informationBanner && (
            <div className="warning-banner" role="status">
              {informationBanner}
            </div>
          )}

          {showReadOnlyWarning && game.ready && game.readOnly && (
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
        </div>

        {developerTools}

        {game.state.currentMode === 'CAMP' ? (
          <CampDashboard
            state={game.state}
            notice={game.notice}
            disabled={controlsDisabled}
            onUpgradeStructure={game.upgradeCampStructure}
            onTrain={game.trainAtCamp}
            onStartCraft={game.startCampCraft}
            onUseConsumable={game.useCampConsumable}
            onPurchaseMerchantOffer={game.purchaseCampMerchantOffer}
            onAcceptSeraContract={game.acceptSeraContract}
            onIncreaseSeraTrust={game.increaseSeraTrust}
          />
        ) : layoutMode === 'dashboard' ? (
          <div className="game-dashboard" data-testid="game-dashboard">
            <section className="dashboard dashboard-column dashboard-column--battle" aria-label="전투와 영웅">
              <BattleArena
                state={game.state}
                onChooseStage={game.chooseStage}
                disabled={controlsDisabled}
              />
              <div className="side-stack">
                <HeroPanel state={game.state} />
                <div className="notice-strip" role="status" aria-live="polite">{game.notice}</div>
              </div>
            </section>

            <section className="dashboard-column dashboard-column--journey" aria-label="원정 상황과 전투 기록">
              <div className="dashboard-pane dashboard-pane--campaign">
                <StageMapPanel
                  currentStage={game.state.battle.stage}
                  highestStage={game.state.battle.highestStage}
                  onChooseStage={game.chooseStage}
                  disabled={controlsDisabled}
                  {...(!game.ready
                    ? { disabledReason: '게임 상태를 준비하는 중이라 스테이지를 이동할 수 없습니다.' }
                    : game.readOnly
                      ? { disabledReason: '다른 탭이 진행을 저장 중인 읽기 전용 모드에서는 스테이지를 이동할 수 없습니다.' }
                      : {})}
                />

                <ExpeditionEventPanel
                  pending={game.state.expeditionEvents.pending}
                  onChoose={game.chooseExpeditionEvent}
                  disabled={controlsDisabled}
                  {...(!game.ready
                    ? { disabledReason: '게임 상태를 준비하는 중이라 원정 이벤트를 선택할 수 없습니다.' }
                    : game.readOnly
                      ? { disabledReason: '다른 탭이 진행을 저장 중인 읽기 전용 모드에서는 원정 이벤트를 선택할 수 없습니다.' }
                      : {})}
                />

                <CombatResultSurface results={combatResults} announce />
              </div>

              <CombatLogPanel batch={game.combatEventBatch} />
            </section>

            <aside className="dashboard-column dashboard-column--growth" aria-label="성장과 관리">
              <GrowthTabs
                state={game.state}
                onBuyUpgrade={game.buyUpgrade}
                onBuySkill={game.buySkill}
                onRecruitCompanion={game.recruitCompanion}
                onTrainCompanion={game.trainCompanion}
                disabled={controlsDisabled}
              />

              <div className="dashboard-pane dashboard-pane--management">
                <PrestigePanel
                  state={game.state}
                  onPrestige={requestPrestige}
                  disabled={controlsDisabled}
                />

                {showSaveTransfer && (
                  <SaveTransferPanel
                    state={game.state}
                    exportDisabled={!game.ready}
                    importDisabled={controlsDisabled}
                    onRestore={game.restoreSave}
                  />
                )}
              </div>
            </aside>
          </div>
        ) : (
          <div className="tactical-layout" data-testid="tactical-layout">
            <TacticalStage
              state={game.state}
              batch={game.combatEventBatch}
              streamGeneration={game.combatEventGeneration}
              notice={game.notice}
              onChooseStage={game.chooseStage}
              onChooseExpeditionEvent={game.chooseExpeditionEvent}
              disabled={controlsDisabled}
              {...(disabledReason ? { disabledReason } : {})}
            />

            <aside className="tactical-command-dock" aria-label="성장과 원정 관리">
              <GrowthTabs
                state={game.state}
                onBuyUpgrade={game.buyUpgrade}
                onBuySkill={game.buySkill}
                onRecruitCompanion={game.recruitCompanion}
                onTrainCompanion={game.trainCompanion}
                disabled={controlsDisabled}
              />

              <div className="tactical-command-dock__lower">
                <CombatLogPanel batch={game.combatEventBatch} />
                <CombatResultSurface results={combatResults} announce />
                <PrestigePanel
                  state={game.state}
                  onPrestige={requestPrestige}
                  disabled={controlsDisabled}
                />
                {showSaveTransfer && (
                  <SaveTransferPanel
                    state={game.state}
                    exportDisabled={!game.ready}
                    importDisabled={controlsDisabled}
                    onRestore={game.restoreSave}
                  />
                )}
              </div>
            </aside>
          </div>
        )}

        <footer className="dashboard-footer">
          <span>로컬 프로토타입 v0.1{footerSuffix}</span>
          <span>처치 {formatNumber(game.state.battle.kills)} · 패배 {formatNumber(game.state.battle.defeats)} · 환생 {game.state.stats.prestiges}</span>
        </footer>
      </main>

      {game.offlineReport && (
        <OfflineReport report={game.offlineReport} onClose={game.dismissOfflineReport} />
      )}
    </div>
  )
}
