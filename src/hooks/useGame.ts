import { useCallback, useEffect, useRef, useState } from 'react'
import {
  advanceGame,
  acceptSeraContract as acceptSeraContractCommand,
  chooseExpeditionEvent as chooseExpeditionEventCommand,
  createInitialState,
  equipQuickConsumable as equipQuickConsumableCommand,
  healAtCamp as healAtCampCommand,
  mergeCombatEventBatches,
  performPrestige,
  purchaseCampMerchantOffer as purchaseCampMerchantOfferCommand,
  purchaseUpgrade,
  recruitCompanion as recruitCompanionCommand,
  selectCampCostume as selectCampCostumeCommand,
  selectStage,
  setAdultContentAccess as setAdultContentAccessCommand,
  setSeraBondConsent as setSeraBondConsentCommand,
  startCampCraft as startCampCraftCommand,
  switchGameMode,
  synthesizeJointBond as synthesizeJointBondCommand,
  increaseSeraTrust as increaseSeraTrustCommand,
  trainAtCamp as trainAtCampCommand,
  trainCompanion as trainCompanionCommand,
  upgradeCampStructure as upgradeCampStructureCommand,
  consumeCampConsumable as consumeCampConsumableCommand,
  useEquippedConsumable as consumeEquippedConsumableCommand,
  equipItem as equipItemCommand,
  unequipItem as unequipItemCommand,
  moveItem as moveItemCommand,
  settleLootAtCamp as settleLootAtCampCommand,
  equipSkillSlot as equipSkillSlotCommand,
  unequipSkillSlot as unequipSkillSlotCommand,
  upgradeSkill,
} from '../game/engine'
import {
  CAMP_RECIPE_DEFINITIONS,
  type CampMerchantOfferSlot,
} from '../game/camp'
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
  Chapter1CostumeId,
  Chapter1SynthesisId,
  CombatEventBatch,
  CombatEventCursor,
  CompanionId,
  CampStructureId,
  CampTrainingId,
  CampConsumableId,
  CampQuickConsumableId,
  CampRecipeId,
  CommandResult,
  EquipmentSlot,
  ExpeditionChoiceId,
  GameState,
  GameMode,
  SkillId,
  UpgradeId,
} from '../game/types'

const TICK_MS = 250
const AUTOSAVE_MS = 5_000
const LOCK_RETRY_MS = 1_000
const WRITER_LOCK_NAME = 'emberwatch.writer.v1'

const createEmptyCombatEventBatch = (): CombatEventBatch => ({
  nextCursor: '0',
  totalEvents: 0,
  events: [],
})

interface HeldWriterLock {
  owner: symbol
  release: () => void
}

export interface GameCommandFeedback {
  success: boolean
  message: string
  reason: 'committed' | 'rejected' | 'read-only' | 'save-failed'
}

type PersistResult =
  | { success: true }
  | { success: false; message: string }

export interface GameController {
  state: GameState
  offlineReport: AdvanceReport | null
  combatEventBatch: CombatEventBatch
  combatEventGeneration: number
  recoveredFromInvalidSave: boolean
  notice: string
  saveHealthy: boolean
  ready: boolean
  readOnly: boolean
  lockSupported: boolean
  changeMode: (mode: GameMode) => void
  upgradeCampStructure: (id: CampStructureId) => void
  trainAtCamp: (id: CampTrainingId) => void
  startCampCraft: (id: CampRecipeId) => void
  useCampConsumable: (id: CampConsumableId) => void
  healAtCamp: () => void
  equipQuickConsumable: (id: CampQuickConsumableId | null) => void
  useEquippedConsumable: () => void
  purchaseCampMerchantOffer: (slot: CampMerchantOfferSlot) => void
  acceptSeraContract: () => void
  increaseSeraTrust: () => void
  setAdultContentAccess: (confirmed: boolean) => GameCommandFeedback
  setSeraBondConsent: (consent: 'granted' | 'withdrawn') => GameCommandFeedback
  selectCampCostume: (id: Chapter1CostumeId) => GameCommandFeedback
  synthesizeJointBond: (id: Chapter1SynthesisId) => GameCommandFeedback
  buyUpgrade: (id: UpgradeId) => void
  buySkill: (id: SkillId) => void
  equipItem: (slot: EquipmentSlot, itemId: string) => void
  unequipItem: (slot: EquipmentSlot) => void
  moveItem: (
    source: 'heroInventory' | 'campStorage',
    target: 'heroInventory' | 'campStorage',
    itemId: string,
    amount?: number,
  ) => void
  settleLootAtCamp: () => void
  equipSkillSlot: (slotIndex: number, skillId: SkillId) => void
  unequipSkillSlot: (slotIndex: number) => void
  recruitCompanion: (id: CompanionId) => void
  trainCompanion: () => void
  chooseStage: (stage: number) => void
  chooseExpeditionEvent: (
    eventId: string,
    choiceId: ExpeditionChoiceId,
  ) => GameCommandFeedback
  prestige: () => void
  reset: () => void
  restoreSave: (preview: SaveImportPreview) => { success: boolean; message: string }
  dismissOfflineReport: () => void
}

function getLockManager(): LockManager | null {
  return typeof navigator.locks?.request === 'function' ? navigator.locks : null
}

function getCampTimerNotice(before: GameState, after: GameState): string | null {
  const messages: string[] = []
  if (before.camp.craftJob !== null && after.camp.craftJob === null) {
    messages.push(
      `${CAMP_RECIPE_DEFINITIONS[before.camp.craftJob.recipeId].name} 제작이 완료되었습니다.`,
    )
  }
  if (before.camp.merchant.cycle !== after.camp.merchant.cycle) {
    messages.push('떠돌이 상인의 제안이 갱신되었습니다.')
  }
  return messages.length === 0 ? null : messages.join(' ')
}

export function useGame(): GameController {
  const [lockManager] = useState<LockManager | null>(getLockManager)
  const [initialBootstrap] = useState<BootstrapResult>(() =>
    bootstrapGame(window.localStorage, Date.now(), 'reader'),
  )
  const [state, setState] = useState<GameState>(initialBootstrap.state)
  const [offlineReport, setOfflineReport] = useState<AdvanceReport | null>(null)
  const [combatEventBatch, setCombatEventBatch] = useState<CombatEventBatch>(
    createEmptyCombatEventBatch,
  )
  const [combatEventGeneration, setCombatEventGeneration] = useState(0)
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
  const tickBaselineRef = useRef(0)
  const combatEventCursorRef = useRef<CombatEventCursor>('0')
  const combatEventBatchRef = useRef<CombatEventBatch>(combatEventBatch)

  const commit = useCallback((next: GameState) => {
    stateRef.current = next
    setState(next)
  }, [])

  const commitReplacement = useCallback(
    (next: GameState, committedAt: number) => {
      tickBaselineRef.current = committedAt
      commit(next)
    },
    [commit],
  )

  const resetCombatEvents = useCallback(() => {
    const empty = createEmptyCombatEventBatch()
    combatEventCursorRef.current = empty.nextCursor
    combatEventBatchRef.current = empty
    setCombatEventBatch(empty)
    setCombatEventGeneration((current) => current + 1)
  }, [])

  const recordCombatEvents = useCallback((batch: CombatEventBatch) => {
    const merged = mergeCombatEventBatches(combatEventBatchRef.current, batch)
    combatEventCursorRef.current = batch.nextCursor
    combatEventBatchRef.current = merged
    setCombatEventBatch(merged)
  }, [])

  const applyBootstrap = useCallback(
    (bootstrap: BootstrapResult, role: 'writer' | 'reader') => {
      tickBaselineRef.current = Date.now()
      commit(bootstrap.state)
      resetCombatEvents()
      revisionRef.current = bootstrap.revision
      saveBlockedRef.current = bootstrap.saveBlocked
      setOfflineReport(role === 'writer' ? bootstrap.offlineReport : null)
      setRecoveredFromInvalidSave(bootstrap.recoveredFromInvalidSave)
      setSaveHealthy(bootstrap.saveHealthy)
      setReadOnly(role === 'reader')
      setReady(true)
      setNotice(
        role === 'writer'
          ? bootstrap.state.currentMode === 'CAMP'
            ? '캠프에서 휴식 중입니다. 재접속 오프라인 원정은 계속 정산됩니다.'
            : '자동 원정을 시작했습니다.'
          : '다른 탭이 진행을 저장 중입니다. 이 탭은 읽기 전용입니다.',
      )
    },
    [commit, resetCombatEvents],
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
    (next: GameState): PersistResult => {
      if (!writerRef.current || saveBlockedRef.current) {
        const message = '저장을 안전하게 확인할 수 없어 진행을 변경하지 않았습니다.'
        setSaveHealthy(false)
        setNotice(message)
        return { success: false, message }
      }
      const result = saveGameAtRevision(window.localStorage, next, revisionRef.current)
      if (result.status === 'saved') {
        revisionRef.current = result.revision
        setSaveHealthy(true)
        return { success: true }
      }
      const conflict = result.status === 'conflict'
      const message = conflict
        ? '더 새로운 저장을 반영하고 이 탭을 읽기 전용으로 전환했습니다.'
        : '저장을 안전하게 확인할 수 없어 이 탭을 읽기 전용으로 전환했습니다.'
      stopWriting(
        message,
        conflict,
      )
      return { success: false, message }
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
    (command: (current: GameState) => CommandResult): GameCommandFeedback => {
      if (!ready || readOnly || !writerRef.current) {
        const message = '읽기 전용 탭에서는 진행을 변경할 수 없습니다.'
        setNotice(message)
        return { success: false, message, reason: 'read-only' }
      }
      const now = Date.now()
      const current = stateRef.current
      const elapsedMs = tickBaselineRef.current === 0
        ? 0
        : Math.max(0, now - tickBaselineRef.current)
      const advanced = advanceGame(
        current,
        elapsedMs,
        combatEventCursorRef.current,
      )
      const timerNotice = getCampTimerNotice(current, advanced.state)
      const result = command(advanced.state)
      if (!result.success) {
        setNotice(result.message)
        return { success: false, message: result.message, reason: 'rejected' }
      }
      const next = { ...result.state, lastSavedAt: now }
      const persisted = persist(next)
      if (!persisted.success) {
        return {
          success: false,
          message: persisted.message,
          reason: 'save-failed',
        }
      }
      tickBaselineRef.current = now
      recordCombatEvents(advanced)
      commit(next)
      setNotice(timerNotice === null ? result.message : `${timerNotice} ${result.message}`)
      return { success: true, message: result.message, reason: 'committed' }
    },
    [commit, persist, readOnly, ready, recordCombatEvents],
  )

  useEffect(() => {
    if (!ready || readOnly || !writerRef.current) return
    tickBaselineRef.current = Date.now()

    const reconcile = (now: number) => {
      const current = stateRef.current
      const elapsedMs = Math.max(0, now - tickBaselineRef.current)
      tickBaselineRef.current = now
      const result = advanceGame(
        current,
        elapsedMs,
        combatEventCursorRef.current,
      )
      const timerNotice = getCampTimerNotice(current, result.state)
      recordCombatEvents(result)
      const next = { ...result.state, lastSavedAt: now }
      commit(next)
      if (timerNotice !== null) setNotice(timerNotice)
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
  }, [commit, persist, readOnly, ready, recordCombatEvents])

  const buyUpgrade = useCallback(
    (id: UpgradeId) => runCommand((current) => purchaseUpgrade(current, id)),
    [runCommand],
  )
  const upgradeCampStructure = useCallback(
    (id: CampStructureId) => runCommand((current) => upgradeCampStructureCommand(current, id)),
    [runCommand],
  )
  const trainAtCamp = useCallback(
    (id: CampTrainingId) => runCommand((current) => trainAtCampCommand(current, id)),
    [runCommand],
  )
  const startCampCraft = useCallback(
    (id: CampRecipeId) => runCommand((current) => startCampCraftCommand(current, id)),
    [runCommand],
  )
  const useCampConsumable = useCallback(
    (id: CampConsumableId) => runCommand((current) => consumeCampConsumableCommand(current, id)),
    [runCommand],
  )
  const healAtCamp = useCallback(
    () => runCommand((current) => healAtCampCommand(current)),
    [runCommand],
  )
  const equipQuickConsumable = useCallback(
    (id: CampQuickConsumableId | null) =>
      runCommand((current) => equipQuickConsumableCommand(current, id)),
    [runCommand],
  )
  const useEquippedConsumable = useCallback(
    () => runCommand((current) => consumeEquippedConsumableCommand(current)),
    [runCommand],
  )
  const purchaseCampMerchantOffer = useCallback(
    (slot: CampMerchantOfferSlot) =>
      runCommand((current) => purchaseCampMerchantOfferCommand(current, slot)),
    [runCommand],
  )
  const acceptSeraContract = useCallback(
    () => runCommand((current) => acceptSeraContractCommand(current)),
    [runCommand],
  )
  const increaseSeraTrust = useCallback(
    () => runCommand((current) => increaseSeraTrustCommand(current)),
    [runCommand],
  )
  const setAdultContentAccess = useCallback(
    (confirmed: boolean) =>
      runCommand((current) => setAdultContentAccessCommand(current, confirmed)),
    [runCommand],
  )
  const setSeraBondConsent = useCallback(
    (consent: 'granted' | 'withdrawn') =>
      runCommand((current) => setSeraBondConsentCommand(current, consent)),
    [runCommand],
  )
  const selectCampCostume = useCallback(
    (id: Chapter1CostumeId) =>
      runCommand((current) => selectCampCostumeCommand(current, id)),
    [runCommand],
  )
  const synthesizeJointBond = useCallback(
    (id: Chapter1SynthesisId) =>
      runCommand((current) => synthesizeJointBondCommand(current, id)),
    [runCommand],
  )
  const changeMode = useCallback(
    (mode: GameMode) => runCommand((current) => switchGameMode(current, mode)),
    [runCommand],
  )
  const buySkill = useCallback(
    (id: SkillId) => runCommand((current) => upgradeSkill(current, id)),
    [runCommand],
  )
  const equipItem = useCallback(
    (slot: EquipmentSlot, itemId: string) =>
      runCommand((current) => equipItemCommand(current, slot, itemId)),
    [runCommand],
  )
  const unequipItem = useCallback(
    (slot: EquipmentSlot) =>
      runCommand((current) => unequipItemCommand(current, slot)),
    [runCommand],
  )
  const moveItem = useCallback(
    (
      source: 'heroInventory' | 'campStorage',
      target: 'heroInventory' | 'campStorage',
      itemId: string,
      amount = 1,
    ) =>
      runCommand((current) =>
        moveItemCommand(current, source, target, itemId, amount),
      ),
    [runCommand],
  )
  const settleLootAtCamp = useCallback(
    () =>
      runCommand((current) => ({
        state: settleLootAtCampCommand(current),
        success: true,
        message: '임시 전리품 가방의 모든 전리품을 캠프 보관함으로 옮겼습니다.',
      })),
    [runCommand],
  )
  const equipSkillSlot = useCallback(
    (slotIndex: number, skillId: SkillId) =>
      runCommand((current) => equipSkillSlotCommand(current, slotIndex, skillId)),
    [runCommand],
  )
  const unequipSkillSlot = useCallback(
    (slotIndex: number) =>
      runCommand((current) => unequipSkillSlotCommand(current, slotIndex)),
    [runCommand],
  )
  const recruitCompanion = useCallback(
    (id: CompanionId) => runCommand((current) => recruitCompanionCommand(current, id)),
    [runCommand],
  )
  const trainCompanion = useCallback(
    () => runCommand((current) => trainCompanionCommand(current)),
    [runCommand],
  )
  const chooseStage = useCallback(
    (stage: number) => runCommand((current) => selectStage(current, stage)),
    [runCommand],
  )
  const chooseExpeditionEvent = useCallback(
    (eventId: string, choiceId: ExpeditionChoiceId) =>
      runCommand((current) => chooseExpeditionEventCommand(current, eventId, choiceId)),
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
    const committedAt = Date.now()
    const next = createInitialState(committedAt)
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
    commitReplacement(next, committedAt)
    resetCombatEvents()
    setOfflineReport(null)
    setRecoveredFromInvalidSave(false)
    setNotice('새 원정을 시작했습니다.')
    setSaveHealthy(true)
  }, [commitReplacement, readOnly, ready, resetCombatEvents, stopWriting])

  const restoreSave = useCallback(
    (preview: SaveImportPreview) => {
      if (!ready || readOnly || !writerRef.current) {
        const message = '읽기 전용 탭에서는 저장을 가져올 수 없습니다.'
        setNotice(message)
        return { success: false, message }
      }
      const expectedRevision = revisionRef.current
      const committedAt = Date.now()
      const imported = commitPortableSave(
        window.localStorage,
        preview,
        expectedRevision,
        committedAt,
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
      commitReplacement(imported.state, committedAt)
      resetCombatEvents()
      setOfflineReport(null)
      setRecoveredFromInvalidSave(false)
      setSaveHealthy(true)
      setNotice('백업 저장을 안전하게 가져왔습니다.')
      return { success: true, message: '백업 저장을 안전하게 가져왔습니다.' }
    },
    [commitReplacement, readOnly, ready, resetCombatEvents, stopWriting],
  )
  const dismissOfflineReport = useCallback(() => setOfflineReport(null), [])

  return {
    state,
    offlineReport,
    combatEventBatch,
    combatEventGeneration,
    recoveredFromInvalidSave,
    notice,
    saveHealthy,
    ready,
    readOnly,
    lockSupported: lockManager !== null,
    changeMode,
    upgradeCampStructure,
    trainAtCamp,
    startCampCraft,
    useCampConsumable,
    healAtCamp,
    equipQuickConsumable,
    useEquippedConsumable,
    purchaseCampMerchantOffer,
    acceptSeraContract,
    increaseSeraTrust,
    setAdultContentAccess,
    setSeraBondConsent,
    selectCampCostume,
    synthesizeJointBond,
    buyUpgrade,
    buySkill,
    equipItem,
    unequipItem,
    moveItem,
    settleLootAtCamp,
    equipSkillSlot,
    unequipSkillSlot,
    recruitCompanion,
    trainCompanion,
    chooseStage,
    chooseExpeditionEvent,
    prestige,
    reset,
    restoreSave,
    dismissOfflineReport,
  }
}
