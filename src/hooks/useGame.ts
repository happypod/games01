import { useCallback, useEffect, useRef, useState } from 'react'
import {
  advanceGame,
  createInitialState,
  performPrestige,
  purchaseUpgrade,
  selectStage,
  upgradeSkill,
} from '../game/engine'
import {
  bootstrapGame,
  clearSave,
  saveGame,
  type BootstrapResult,
} from '../game/persistence'
import type {
  AdvanceReport,
  CommandResult,
  GameState,
  SkillId,
  UpgradeId,
} from '../game/types'

const TICK_MS = 250
const AUTOSAVE_MS = 5_000

export interface GameController {
  state: GameState
  offlineReport: AdvanceReport | null
  recoveredFromInvalidSave: boolean
  notice: string
  saveHealthy: boolean
  buyUpgrade: (id: UpgradeId) => void
  buySkill: (id: SkillId) => void
  chooseStage: (stage: number) => void
  prestige: () => void
  reset: () => void
  dismissOfflineReport: () => void
}

export function useGame(): GameController {
  const [bootstrap] = useState<BootstrapResult>(() => bootstrapGame(window.localStorage))
  const [state, setState] = useState<GameState>(bootstrap.state)
  const [offlineReport, setOfflineReport] = useState<AdvanceReport | null>(
    bootstrap.offlineReport,
  )
  const [notice, setNotice] = useState('자동 원정이 시작되었습니다.')
  const [saveHealthy, setSaveHealthy] = useState(bootstrap.saveHealthy)
  const stateRef = useRef(state)
  const saveBlockedRef = useRef(bootstrap.saveBlocked)

  const commit = useCallback((next: GameState) => {
    stateRef.current = next
    setState(next)
  }, [])

  const persist = useCallback((next: GameState) => {
    if (saveBlockedRef.current) {
      setSaveHealthy(false)
      return false
    }
    const healthy = saveGame(window.localStorage, next)
    setSaveHealthy(healthy)
    return healthy
  }, [])

  const runCommand = useCallback(
    (command: (current: GameState) => CommandResult) => {
      const result = command(stateRef.current)
      setNotice(result.message)
      if (!result.success) return
      const now = Date.now()
      const next = { ...result.state, lastSavedAt: now }
      commit(next)
      persist(next)
    },
    [commit, persist],
  )

  useEffect(() => {
    let lastTickAt = Date.now()

    const reconcile = (now: number) => {
      const elapsedMs = Math.max(0, now - lastTickAt)
      lastTickAt = now
      const result = advanceGame(stateRef.current, elapsedMs)
      const next = { ...result.state, lastSavedAt: now }
      commit(next)
      return next
    }

    const tickTimer = window.setInterval(() => reconcile(Date.now()), TICK_MS)
    const saveTimer = window.setInterval(() => {
      const now = Date.now()
      const next = reconcile(now)
      persist(next)
    }, AUTOSAVE_MS)

    const persistBeforeLeaving = () => {
      const next = reconcile(Date.now())
      persist(next)
    }
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') persistBeforeLeaving()
    }

    window.addEventListener('pagehide', persistBeforeLeaving)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      window.clearInterval(tickTimer)
      window.clearInterval(saveTimer)
      window.removeEventListener('pagehide', persistBeforeLeaving)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [commit, persist])

  const buyUpgrade = useCallback(
    (id: UpgradeId) => runCommand((current) => purchaseUpgrade(current, id)),
    [runCommand],
  )
  const buySkill = useCallback(
    (id: SkillId) => runCommand((current) => upgradeSkill(current, id)),
    [runCommand],
  )
  const chooseStage = useCallback(
    (stage: number) => runCommand((current) => selectStage(current, stage)),
    [runCommand],
  )
  const prestige = useCallback(
    () => runCommand((current) => performPrestige(current)),
    [runCommand],
  )
  const reset = useCallback(() => {
    const cleared = clearSave(window.localStorage)
    const next = createInitialState()
    commit(next)
    setOfflineReport(null)
    setNotice('새 원정을 시작했습니다.')
    if (cleared) saveBlockedRef.current = false
    const saved = saveBlockedRef.current ? false : saveGame(window.localStorage, next)
    setSaveHealthy(cleared && saved)
  }, [commit])

  return {
    state,
    offlineReport,
    recoveredFromInvalidSave: bootstrap.recoveredFromInvalidSave,
    notice,
    saveHealthy,
    buyUpgrade,
    buySkill,
    chooseStage,
    prestige,
    reset,
    dismissOfflineReport: () => setOfflineReport(null),
  }
}
