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
  LEGACY_SAVE_KEY,
  SAVE_SLOT_KEYS,
  bootstrapGame,
  saveGameAtRevision,
  type BootstrapResult,
} from '../game/persistence'
import { commitPortableSave, type SaveImportPreview } from '../game/saveTransfer'
import type {
  AdvanceReport,
  CommandResult,
  GameState,
  SkillId,
  UpgradeId,
} from '../game/types'

const TICK_MS = 250
const AUTOSAVE_MS = 5_000
const LOCK_RETRY_MS = 1_000
const WRITER_LOCK_NAME = 'emberwatch.writer.v1'

interface HeldWriterLock {
  owner: symbol
  release: () => void
}

export interface GameController {
  state: GameState
  offlineReport: AdvanceReport | null
  recoveredFromInvalidSave: boolean
  notice: string
  saveHealthy: boolean
  ready: boolean
  readOnly: boolean
  lockSupported: boolean
  buyUpgrade: (id: UpgradeId) => void
  buySkill: (id: SkillId) => void
  chooseStage: (stage: number) => void
  prestige: () => void
  reset: () => void
  restoreSave: (preview: SaveImportPreview) => { success: boolean; message: string }
  dismissOfflineReport: () => void
}

function getLockManager(): LockManager | null {
  return typeof navigator.locks?.request === 'function' ? navigator.locks : null
}

export function useGame(): GameController {
  const [lockManager] = useState<LockManager | null>(getLockManager)
  const [initialBootstrap] = useState<BootstrapResult>(() =>
    bootstrapGame(window.localStorage, Date.now(), 'reader'),
  )
  const [state, setState] = useState<GameState>(initialBootstrap.state)
  const [offlineReport, setOfflineReport] = useState<AdvanceReport | null>(null)
  const [recoveredFromInvalidSave, setRecoveredFromInvalidSave] = useState(
    initialBootstrap.recoveredFromInvalidSave,
  )
  const [notice, setNotice] = useState(
    lockManager === null
      ? '이 브라우저는 안전한 다중 탭 잠금을 지원하지 않아 읽기 전용입니다.'
      : '저장 소유권을 확인하고 있습니다.',
  )
  const [saveHealthy, setSaveHealthy] = useState(initialBootstrap.saveHealthy)
  const [ready, setReady] = useState(lockManager === null)
  const [readOnly, setReadOnly] = useState(true)
  const stateRef = useRef(state)
  const revisionRef = useRef<number | null>(initialBootstrap.revision)
  const saveBlockedRef = useRef(initialBootstrap.saveBlocked)
  const writerRef = useRef(false)
  const writerOwnerRef = useRef<symbol | null>(null)
  const conflictBlockedRef = useRef(false)
  const heldLockRef = useRef<HeldWriterLock | null>(null)

  const commit = useCallback((next: GameState) => {
    stateRef.current = next
    setState(next)
  }, [])

  const applyBootstrap = useCallback(
    (bootstrap: BootstrapResult, role: 'writer' | 'reader') => {
      commit(bootstrap.state)
      revisionRef.current = bootstrap.revision
      saveBlockedRef.current = bootstrap.saveBlocked
      setOfflineReport(role === 'writer' ? bootstrap.offlineReport : null)
      setRecoveredFromInvalidSave(bootstrap.recoveredFromInvalidSave)
      setSaveHealthy(bootstrap.saveHealthy)
      setReadOnly(role === 'reader')
      setReady(true)
      setNotice(
        role === 'writer'
          ? '자동 원정을 시작했습니다.'
          : '다른 탭이 진행을 저장 중입니다. 이 탭은 읽기 전용입니다.',
      )
    },
    [commit],
  )

  const stopWriting = useCallback(
    (message: string, retry: boolean, snapshot?: BootstrapResult) => {
      const latest = snapshot ?? bootstrapGame(window.localStorage, Date.now(), 'reader')
      writerRef.current = false
      writerOwnerRef.current = null
      conflictBlockedRef.current = !retry
      applyBootstrap(latest, 'reader')
      if (!retry) {
        saveBlockedRef.current = true
        setSaveHealthy(false)
      }
      setNotice(message)
      heldLockRef.current?.release()
      heldLockRef.current = null
    },
    [applyBootstrap],
  )

  const persist = useCallback(
    (next: GameState) => {
      if (!writerRef.current || saveBlockedRef.current) {
        setSaveHealthy(false)
        return false
      }
      const result = saveGameAtRevision(window.localStorage, next, revisionRef.current)
      if (result.status === 'saved') {
        revisionRef.current = result.revision
        setSaveHealthy(true)
        return true
      }
      const conflict = result.status === 'conflict'
      stopWriting(
        conflict
          ? '더 새로운 저장을 반영하고 이 탭을 읽기 전용으로 전환했습니다.'
          : '저장을 안전하게 확인할 수 없어 이 탭을 읽기 전용으로 전환했습니다.',
        conflict,
      )
      return false
    },
    [stopWriting],
  )

  useEffect(() => {
    if (lockManager === null) return

    let active = true
    let requestPending = false
    const owner = Symbol(WRITER_LOCK_NAME)

    const attemptWriterLock = () => {
      if (
        !active ||
        requestPending ||
        (writerRef.current && writerOwnerRef.current === owner) ||
        conflictBlockedRef.current
      ) {
        return
      }
      requestPending = true
      void lockManager
        .request(WRITER_LOCK_NAME, { ifAvailable: true }, async (lock) => {
          if (!active) return
          if (lock === null) {
            const reader = bootstrapGame(window.localStorage, Date.now(), 'reader')
            applyBootstrap(reader, 'reader')
            return
          }

          writerRef.current = true
          writerOwnerRef.current = owner
          const writer = bootstrapGame(window.localStorage, Date.now(), 'writer')
          if (writer.saveBlocked) {
            stopWriting('저장 충돌로 writer 시작을 중단했습니다.', false)
            return
          }
          applyBootstrap(writer, 'writer')

          await new Promise<void>((resolve) => {
            if (!active || writerOwnerRef.current !== owner) {
              resolve()
              return
            }
            heldLockRef.current = { owner, release: resolve }
          })
          if (heldLockRef.current?.owner === owner) heldLockRef.current = null
          if (writerOwnerRef.current === owner) {
            writerOwnerRef.current = null
            writerRef.current = false
            if (active) {
              applyBootstrap(
                bootstrapGame(window.localStorage, Date.now(), 'reader'),
                'reader',
              )
            }
          }
        })
        .catch(() => {
          if (!active) return
          setReady(true)
          setReadOnly(true)
          setSaveHealthy(false)
          setNotice('탭 저장 잠금을 확인하지 못해 읽기 전용으로 전환했습니다.')
        })
        .finally(() => {
          requestPending = false
        })
    }

    queueMicrotask(attemptWriterLock)
    const retryTimer = window.setInterval(attemptWriterLock, LOCK_RETRY_MS)
    return () => {
      active = false
      window.clearInterval(retryTimer)
      if (heldLockRef.current?.owner === owner) {
        heldLockRef.current.release()
        heldLockRef.current = null
      }
    }
  }, [applyBootstrap, lockManager, stopWriting])

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (
        event.storageArea !== window.localStorage ||
        (event.key !== null &&
          event.key !== LEGACY_SAVE_KEY &&
          !SAVE_SLOT_KEYS.some((key) => key === event.key))
      ) {
        return
      }
      const latest = bootstrapGame(window.localStorage, Date.now(), 'reader')
      if (writerRef.current && latest.revision !== revisionRef.current) {
        stopWriting(
          '다른 탭의 새 저장을 반영하고 이 탭을 읽기 전용으로 전환했습니다.',
          true,
          latest,
        )
        return
      }
      if (!writerRef.current) applyBootstrap(latest, 'reader')
    }

    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [applyBootstrap, stopWriting])

  const runCommand = useCallback(
    (command: (current: GameState) => CommandResult) => {
      if (!ready || readOnly || !writerRef.current) {
        setNotice('읽기 전용 탭에서는 진행을 변경할 수 없습니다.')
        return
      }
      const result = command(stateRef.current)
      setNotice(result.message)
      if (!result.success) return
      const now = Date.now()
      const next = { ...result.state, lastSavedAt: now }
      if (persist(next)) commit(next)
    },
    [commit, persist, readOnly, ready],
  )

  useEffect(() => {
    if (!ready || readOnly || !writerRef.current) return
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
      const next = reconcile(Date.now())
      persist(next)
    }, AUTOSAVE_MS)

    const persistBeforeLeaving = () => persist(reconcile(Date.now()))
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
  }, [commit, persist, readOnly, ready])

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
    if (!ready || readOnly || !writerRef.current) {
      setNotice('읽기 전용 탭에서는 진행을 초기화할 수 없습니다.')
      return
    }
    const next = createInitialState()
    const first = saveGameAtRevision(window.localStorage, next, revisionRef.current)
    if (first.status !== 'saved') {
      stopWriting(
        '초기화 중 저장 충돌을 감지해 읽기 전용으로 전환했습니다.',
        first.status === 'conflict',
      )
      return
    }
    const second = saveGameAtRevision(window.localStorage, next, first.revision)
    if (second.status !== 'saved') {
      revisionRef.current = first.revision
      stopWriting(
        '초기화는 기록됐지만 이중 슬롯 검증에 실패해 읽기 전용으로 전환했습니다.',
        second.status === 'conflict',
      )
      return
    }
    revisionRef.current = second.revision
    saveBlockedRef.current = false
    commit(next)
    setOfflineReport(null)
    setRecoveredFromInvalidSave(false)
    setNotice('새 원정을 시작했습니다.')
    setSaveHealthy(true)
  }, [commit, readOnly, ready, stopWriting])

  const restoreSave = useCallback(
    (preview: SaveImportPreview) => {
      if (!ready || readOnly || !writerRef.current) {
        const message = '읽기 전용 탭에서는 저장을 가져올 수 없습니다.'
        setNotice(message)
        return { success: false, message }
      }
      const expectedRevision = revisionRef.current
      const imported = commitPortableSave(
        window.localStorage,
        preview,
        expectedRevision,
        Date.now(),
      )
      if (imported.status !== 'saved') {
        const message =
          imported.status === 'conflict'
            ? `미리보기 중 저장 revision이 ${expectedRevision ?? 0}에서 ${imported.currentRevision ?? 0}(으)로 변경되었습니다.`
            : '가져온 저장을 안전하게 기록하지 못했습니다.'
        stopWriting(
          message,
          imported.status === 'conflict',
        )
        return { success: false, message }
      }
      revisionRef.current = imported.revision
      saveBlockedRef.current = false
      commit(imported.state)
      setOfflineReport(null)
      setRecoveredFromInvalidSave(false)
      setSaveHealthy(true)
      setNotice('백업 저장을 안전하게 가져왔습니다.')
      return { success: true, message: '백업 저장을 안전하게 가져왔습니다.' }
    },
    [commit, readOnly, ready, stopWriting],
  )

  return {
    state,
    offlineReport,
    recoveredFromInvalidSave,
    notice,
    saveHealthy,
    ready,
    readOnly,
    lockSupported: lockManager !== null,
    buyUpgrade,
    buySkill,
    chooseStage,
    prestige,
    reset,
    restoreSave,
    dismissOfflineReport: () => setOfflineReport(null),
  }
}
