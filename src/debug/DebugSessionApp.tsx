import { useCallback, useEffect, useRef, useState } from 'react'
import { GameScreen } from '../components/GameScreen'
import {
  advanceGame,
  mergeCombatEventBatches,
  performPrestige,
  purchaseUpgrade,
  recruitCompanion,
  selectStage,
  trainCompanion,
  upgradeSkill,
} from '../game/engine'
import { bootstrapGame } from '../game/persistence'
import type {
  AdvanceReport,
  CombatEventBatch,
  CombatEventCursor,
  CommandResult,
  GameState,
} from '../game/types'
import type { GameController } from '../hooks/useGame'
import { DebugPanel } from './DebugPanel'
import {
  applyDebugOfflineMinutes,
  cloneDebugState,
  requireDebugSpeed,
  scaleDebugElapsedMs,
  setDebugResource,
  setDebugStage,
  type DebugSpeed,
} from './debugSession'

const DEBUG_TICK_MS = 250

const emptyCombatEvents = (): CombatEventBatch => ({
  nextCursor: '0',
  totalEvents: 0,
  events: [],
})

interface DebugSessionAppProps {
  onExit: () => void
}

export function DebugSessionApp({ onExit }: DebugSessionAppProps) {
  const [session] = useState(() => {
    const bootstrap = bootstrapGame(window.localStorage, Date.now(), 'reader')
    return {
      baseline: cloneDebugState(bootstrap.state),
      recoveredFromInvalidSave: bootstrap.recoveredFromInvalidSave,
    }
  })
  const [state, setState] = useState(() => cloneDebugState(session.baseline))
  const [speed, setSpeed] = useState<DebugSpeed>(1)
  const [notice, setNotice] = useState('저장된 reader snapshot으로 격리 세션을 시작했습니다.')
  const [offlineReport, setOfflineReport] = useState<AdvanceReport | null>(null)
  const [combatEventBatch, setCombatEventBatch] = useState<CombatEventBatch>(emptyCombatEvents)
  const [panelRevision, setPanelRevision] = useState(0)
  const stateRef = useRef(state)
  const eventCursorRef = useRef<CombatEventCursor>('0')
  const lastTickAtRef = useRef(0)

  const commit = useCallback((next: GameState) => {
    stateRef.current = next
    setState(next)
  }, [])

  const runCommand = useCallback((command: (input: GameState) => CommandResult) => {
    const result = command(stateRef.current)
    if (result.success) commit(result.state)
    setNotice(result.message)
  }, [commit])

  useEffect(() => {
    lastTickAtRef.current = Date.now()
    const timer = window.setInterval(() => {
      const now = Date.now()
      const realElapsedMs = Math.max(0, now - lastTickAtRef.current)
      lastTickAtRef.current = now
      const scaledElapsedMs = scaleDebugElapsedMs(speed, realElapsedMs)
      if (scaledElapsedMs === 0) return
      const advanced = advanceGame(
        stateRef.current,
        scaledElapsedMs,
        eventCursorRef.current,
      )
      eventCursorRef.current = advanced.nextCursor
      commit(advanced.state)
      setCombatEventBatch((current) => mergeCombatEventBatches(current, advanced))
    }, DEBUG_TICK_MS)

    return () => window.clearInterval(timer)
  }, [commit, speed])

  const reset = useCallback(() => {
    commit(cloneDebugState(session.baseline))
    eventCursorRef.current = '0'
    setCombatEventBatch(emptyCombatEvents())
    setOfflineReport(null)
    setSpeed(1)
    setPanelRevision((current) => current + 1)
    setNotice('저장된 reader snapshot으로 세션을 초기화했습니다.')
  }, [commit, session.baseline])

  const setStage = useCallback((stage: number) => {
    commit(setDebugStage(stateRef.current, stage))
    setNotice(`${stage} 스테이지 fixture를 적용했습니다.`)
  }, [commit])

  const setResources = useCallback((gold: number, skillPoints: number, essence: number) => {
    let next = setDebugResource(stateRef.current, 'gold', gold)
    next = setDebugResource(next, 'skillPoints', skillPoints)
    next = setDebugResource(next, 'essence', essence)
    commit(next)
    setNotice('자원 fixture를 적용했습니다.')
  }, [commit])

  const applyOffline = useCallback((minutes: number) => {
    const result = applyDebugOfflineMinutes(stateRef.current, minutes)
    commit(result.state)
    setOfflineReport(minutes === 0 ? null : result.report)
    setNotice(`${minutes}분의 오프라인 진행을 메모리에 적용했습니다.`)
  }, [commit])

  const changeSpeed = useCallback((value: DebugSpeed) => {
    const validated = requireDebugSpeed(value)
    setSpeed(validated)
    setNotice(`${validated}x 실시간 배속을 적용했습니다.`)
  }, [])

  const controller: GameController = {
    state,
    offlineReport,
    combatEventBatch,
    recoveredFromInvalidSave: session.recoveredFromInvalidSave,
    notice,
    saveHealthy: true,
    ready: true,
    readOnly: false,
    lockSupported: false,
    buyUpgrade: (id) => runCommand((current) => purchaseUpgrade(current, id)),
    buySkill: (id) => runCommand((current) => upgradeSkill(current, id)),
    recruitCompanion: (id) => runCommand((current) => recruitCompanion(current, id)),
    trainCompanion: () => runCommand(trainCompanion),
    chooseStage: (stage) => runCommand((current) => selectStage(current, stage)),
    prestige: () => runCommand(performPrestige),
    reset,
    restoreSave: () => ({
      success: false,
      message: '디버그 세션에서는 저장을 가져올 수 없습니다.',
    }),
    dismissOfflineReport: () => setOfflineReport(null),
  }

  return (
    <GameScreen
      game={controller}
      statusOverride={{
        text: '● DEBUG · 저장 격리',
        testId: 'debug-save-isolation-status',
      }}
      resetCopy={{
        label: '세션 초기화',
        confirmation: '디버그 변경을 버리고 저장된 기준 상태로 돌아갈까요?',
      }}
      informationBanner="이 화면의 진행은 메모리에만 존재하며 정상 A/B 저장에 기록되지 않습니다."
      showReadOnlyWarning={false}
      showSaveTransfer={false}
      footerSuffix=" · DEBUG"
      developerTools={(
        <DebugPanel
          key={panelRevision}
          state={state}
          speed={speed}
          onSpeedChange={changeSpeed}
          onSetStage={setStage}
          onSetResources={setResources}
          onApplyOffline={applyOffline}
          onReset={reset}
          onExit={onExit}
        />
      )}
    />
  )
}
