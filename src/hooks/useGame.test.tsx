import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { advanceGame, createInitialState } from '../game/engine'
import {
  SAVE_SLOT_KEYS,
  bootstrapGame,
  parseSaveEnvelope,
  saveGameAtRevision,
} from '../game/persistence'
import { createPortableSave, parsePortableSave } from '../game/saveTransfer'
import { useGame, type GameCommandFeedback } from './useGame'

describe('useGame persistence safety', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.useFakeTimers({ now: new Date('2026-01-01T00:00:00Z') })
  })

  afterEach(() => {
    Reflect.deleteProperty(navigator, 'locks')
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('keeps combat events in memory and resets them on import and new game', async () => {
    const request = vi.fn(
      async (
        _name: string,
        _options: LockOptions,
        callback: (lock: Lock | null) => Promise<void> | void,
      ) => callback({ name: 'emberwatch.writer.v1', mode: 'exclusive' } as Lock),
    )
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: { request } as unknown as LockManager,
    })

    const { result, rerender, unmount } = renderHook(() => useGame())
    await act(async () => vi.advanceTimersByTimeAsync(0))

    expect(result.current.readOnly).toBe(false)
    const bootstrapGeneration = result.current.combatEventGeneration
    await act(async () => vi.advanceTimersByTimeAsync(1_000))

    expect(result.current.combatEventBatch.nextCursor).toBe('1')
    expect(result.current.combatEventBatch.totalEvents).toBeGreaterThan(0)
    expect(result.current.combatEventGeneration).toBe(bootstrapGeneration)
    const firstBatch = result.current.combatEventBatch
    rerender()
    expect(result.current.combatEventBatch).toEqual(firstBatch)

    const importedState = createInitialState(Date.now(), 0x1234_5678)
    importedState.player.gold = 777
    const parsed = parsePortableSave(createPortableSave(importedState, Date.now()) ?? '')
    if (!parsed.success) throw new Error(parsed.message)
    act(() => {
      expect(result.current.restoreSave(parsed.preview).success).toBe(true)
    })
    expect(result.current.state.player.gold).toBe(777)
    expect(result.current.combatEventBatch).toEqual({
      nextCursor: '0',
      totalEvents: 0,
      events: [],
    })
    expect(result.current.combatEventGeneration).toBe(bootstrapGeneration + 1)

    await act(async () => vi.advanceTimersByTimeAsync(1_000))
    expect(result.current.combatEventBatch.nextCursor).toBe('1')
    act(() => result.current.reset())
    expect(result.current.combatEventBatch).toEqual({
      nextCursor: '0',
      totalEvents: 0,
      events: [],
    })
    expect(result.current.combatEventGeneration).toBe(bootstrapGeneration + 2)
    unmount()
  })

  it('starts a new tick baseline when resetting after a suspended timer gap', async () => {
    const request = vi.fn(
      async (
        _name: string,
        _options: LockOptions,
        callback: (lock: Lock | null) => Promise<void> | void,
      ) => callback({ name: 'emberwatch.writer.v1', mode: 'exclusive' } as Lock),
    )
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: { request } as unknown as LockManager,
    })

    const { result, unmount } = renderHook(() => useGame())
    await act(async () => vi.advanceTimersByTimeAsync(0))
    expect(result.current.readOnly).toBe(false)

    const resetAt = Date.now() + 60_000
    vi.setSystemTime(resetAt)
    act(() => result.current.reset())
    const resetState = structuredClone(result.current.state)
    expect(resetState.lastSavedAt).toBe(resetAt)

    await act(async () => vi.advanceTimersByTimeAsync(250))
    const expected = advanceGame(resetState, 250).state
    expect(result.current.state.battle).toEqual(expected.battle)
    expect(result.current.state.rng).toEqual(expected.rng)
    unmount()
  })

  it('starts a new tick baseline when restoring after a suspended timer gap', async () => {
    const request = vi.fn(
      async (
        _name: string,
        _options: LockOptions,
        callback: (lock: Lock | null) => Promise<void> | void,
      ) => callback({ name: 'emberwatch.writer.v1', mode: 'exclusive' } as Lock),
    )
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: { request } as unknown as LockManager,
    })

    const { result, unmount } = renderHook(() => useGame())
    await act(async () => vi.advanceTimersByTimeAsync(0))
    expect(result.current.readOnly).toBe(false)

    const importedState = createInitialState(Date.now(), 0x1234_5678)
    importedState.player.gold = 777
    const parsed = parsePortableSave(createPortableSave(importedState, Date.now()) ?? '')
    if (!parsed.success) throw new Error(parsed.message)

    const restoredAt = Date.now() + 60_000
    vi.setSystemTime(restoredAt)
    act(() => {
      expect(result.current.restoreSave(parsed.preview).success).toBe(true)
    })
    const restoredState = structuredClone(result.current.state)
    expect(restoredState.lastSavedAt).toBe(restoredAt)
    expect(restoredState.player.gold).toBe(777)

    await act(async () => vi.advanceTimersByTimeAsync(250))
    const expected = advanceGame(restoredState, 250).state
    expect(result.current.state.battle).toEqual(expected.battle)
    expect(result.current.state.rng).toEqual(expected.rng)
    unmount()
  })

  it('persists camp mode and pauses foreground rounds while autosave checkpoints time', async () => {
    const request = vi.fn(
      async (
        _name: string,
        _options: LockOptions,
        callback: (lock: Lock | null) => Promise<void> | void,
      ) => callback({ name: 'emberwatch.writer.v1', mode: 'exclusive' } as Lock),
    )
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: { request } as unknown as LockManager,
    })

    const { result, unmount } = renderHook(() => useGame())
    await act(async () => vi.advanceTimersByTimeAsync(0))
    const rngBefore = structuredClone(result.current.state.rng)
    const battleBefore = structuredClone(result.current.state.battle)

    act(() => result.current.changeMode('CAMP'))
    expect(result.current.state.currentMode).toBe('CAMP')
    await act(async () => vi.advanceTimersByTimeAsync(6_000))

    expect(result.current.state.currentMode).toBe('CAMP')
    expect(result.current.state.rng).toEqual(rngBefore)
    expect(result.current.state.battle).toEqual(battleBefore)
    expect(result.current.state.lastSavedAt).toBe(Date.now())
    expect(result.current.combatEventBatch).toMatchObject({
      nextCursor: '0',
      totalEvents: 0,
    })
    const saved = SAVE_SLOT_KEYS
      .map((key) => window.localStorage.getItem(key))
      .filter((raw): raw is string => raw !== null)
      .map((raw) => parseSaveEnvelope(raw))
      .filter((envelope) => envelope !== null)
      .sort((left, right) => right.revision - left.revision)[0]
    expect(saved?.state.currentMode).toBe('CAMP')
    expect(saved?.state.rng).toEqual(rngBefore)
    unmount()
  })

  it('does not carry suspended camp time across the battle resume boundary', async () => {
    const request = vi.fn(
      async (
        _name: string,
        _options: LockOptions,
        callback: (lock: Lock | null) => Promise<void> | void,
      ) => callback({ name: 'emberwatch.writer.v1', mode: 'exclusive' } as Lock),
    )
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: { request } as unknown as LockManager,
    })

    const { result, unmount } = renderHook(() => useGame())
    await act(async () => vi.advanceTimersByTimeAsync(0))
    act(() => result.current.changeMode('CAMP'))
    const campSnapshot = structuredClone(result.current.state)

    vi.setSystemTime(Date.now() + 60_000)
    act(() => result.current.changeMode('BATTLE'))
    const expected = advanceGame({ ...campSnapshot, currentMode: 'BATTLE' }, 1_000).state
    await act(async () => vi.advanceTimersByTimeAsync(1_000))

    expect(result.current.state.battle).toEqual(expected.battle)
    expect(result.current.state.rng).toEqual(expected.rng)
    unmount()
  })

  it('reconciles camp timers before commands and announces a craft completion once', async () => {
    const request = vi.fn(
      async (
        _name: string,
        _options: LockOptions,
        callback: (lock: Lock | null) => Promise<void> | void,
      ) => callback({ name: 'emberwatch.writer.v1', mode: 'exclusive' } as Lock),
    )
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: { request } as unknown as LockManager,
    })

    const startedAt = Date.now()
    const initial = createInitialState(startedAt, 0x4214_2042)
    initial.currentMode = 'CAMP'
    initial.player.gold = 1_000
    initial.camp.craftJob = { recipeId: 'goldStew', remainingMs: 1_000 }
    initial.camp.merchant.refreshRemainingMs = 500
    expect(saveGameAtRevision(window.localStorage, initial, null)).toMatchObject({
      status: 'saved',
      revision: 1,
    })

    const { result, unmount } = renderHook(() => useGame())
    await act(async () => vi.advanceTimersByTimeAsync(0))
    expect(result.current.readOnly).toBe(false)

    vi.setSystemTime(startedAt + 600)
    act(() => result.current.purchaseCampMerchantOffer(0))
    expect(result.current.state.camp.craftJob).toEqual({
      recipeId: 'goldStew',
      remainingMs: 400,
    })
    expect(result.current.state.camp.merchant).toEqual({
      cycle: 1,
      refreshRemainingMs: 1_799_900,
      purchasedOfferMask: 1,
    })
    expect(result.current.state.camp.materials).toMatchObject({
      ashShard: 0,
      beastHide: 6,
    })
    expect(result.current.state.player.gold).toBe(780)

    vi.setSystemTime(startedAt + 1_000)
    act(() => result.current.changeMode('BATTLE'))
    expect(result.current.state.camp.craftJob).toBeNull()
    expect(result.current.state.camp.consumables.goldStew).toBe(1)
    expect(result.current.notice).toContain('황금 스튜 제작이 완료되었습니다.')
    const completionNotice = result.current.notice

    await act(async () => vi.advanceTimersByTimeAsync(250))
    expect(result.current.notice).toBe(completionNotice)
    unmount()
  })

  it('persists camp healing, quick equipment, and battle potion use through runCommand', async () => {
    const request = vi.fn(
      async (
        _name: string,
        _options: LockOptions,
        callback: (lock: Lock | null) => Promise<void> | void,
      ) => callback({ name: 'emberwatch.writer.v1', mode: 'exclusive' } as Lock),
    )
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: { request } as unknown as LockManager,
    })

    const initial = createInitialState(Date.now(), 0x4230_0001)
    initial.currentMode = 'CAMP'
    initial.player.currentHp = 50
    initial.camp.materials.ashShard = 5
    initial.camp.consumables.healingPotion = 1
    expect(saveGameAtRevision(window.localStorage, initial, null)).toMatchObject({
      status: 'saved',
      revision: 1,
    })

    const { result, unmount } = renderHook(() => useGame())
    await act(async () => vi.advanceTimersByTimeAsync(0))
    expect(result.current.readOnly).toBe(false)

    act(() => result.current.equipQuickConsumable('healingPotion'))
    expect(result.current.state.camp.quickConsumable).toBe('healingPotion')

    act(() => result.current.changeMode('BATTLE'))
    const countBeforeUse = result.current.state.camp.consumables.healingPotion

    act(() => result.current.useEquippedConsumable())
    expect(result.current.state.player.currentHp).toBe(85)
    expect(result.current.state.camp.consumables.healingPotion).toBe(countBeforeUse - 1)
    expect(result.current.state.camp.quickConsumable).toBe('healingPotion')

    act(() => result.current.changeMode('CAMP'))
    act(() => result.current.healAtCamp())
    expect(result.current.state.player.currentHp).toBe(100)
    expect(result.current.state.camp.materials.ashShard).toBe(4)

    const reloaded = bootstrapGame(window.localStorage, Date.now(), 'reader')
    expect(reloaded.state.player.currentHp).toBe(100)
    expect(reloaded.state.camp.consumables.healingPotion).toBe(countBeforeUse - 1)
    expect(reloaded.state.camp.quickConsumable).toBe('healingPotion')
    unmount()
  })

  it('does not expose a recovery state mutation when its save commit fails', async () => {
    const request = vi.fn(
      async (
        _name: string,
        _options: LockOptions,
        callback: (lock: Lock | null) => Promise<void> | void,
      ) => callback({ name: 'emberwatch.writer.v1', mode: 'exclusive' } as Lock),
    )
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: { request } as unknown as LockManager,
    })

    const initial = createInitialState(Date.now(), 0x4230_0002)
    initial.currentMode = 'CAMP'
    initial.player.currentHp = 50
    initial.camp.materials.ashShard = 3
    expect(saveGameAtRevision(window.localStorage, initial, null)).toMatchObject({
      status: 'saved',
      revision: 1,
    })

    const { result, unmount } = renderHook(() => useGame())
    await act(async () => vi.advanceTimersByTimeAsync(0))
    const before = structuredClone(result.current.state)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('simulated recovery write failure')
    })

    act(() => result.current.healAtCamp())

    expect(result.current.state).toEqual(before)
    expect(result.current.readOnly).toBe(true)
    expect(result.current.saveHealthy).toBe(false)
    unmount()
  })

  it('commits the Chapter I bond flow and turns access off with consent withdrawn atomically', async () => {
    const request = vi.fn(
      async (
        _name: string,
        _options: LockOptions,
        callback: (lock: Lock | null) => Promise<void> | void,
      ) => callback({ name: 'emberwatch.writer.v1', mode: 'exclusive' } as Lock),
    )
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: { request } as unknown as LockManager,
    })

    const initial = createInitialState(Date.now(), 0x4250_0428)
    initial.currentMode = 'CAMP'
    initial.player.gold = 2_000
    initial.camp.materials = { ashShard: 20, beastHide: 10, emberCore: 2 }
    initial.camp.residents.sera = { status: 'contracted', trust: 1 }
    expect(saveGameAtRevision(window.localStorage, initial, null)).toMatchObject({
      status: 'saved',
      revision: 1,
    })

    const { result, unmount } = renderHook(() => useGame())
    await act(async () => vi.advanceTimersByTimeAsync(0))

    let feedback: GameCommandFeedback | undefined
    act(() => {
      feedback = result.current.setAdultContentAccess(true)
    })
    expect(feedback).toMatchObject({ success: true, reason: 'committed' })
    act(() => {
      feedback = result.current.setSeraBondConsent('granted')
    })
    expect(feedback).toMatchObject({ success: true, reason: 'committed' })
    act(() => {
      feedback = result.current.synthesizeJointBond('chapter1.sera.ember-vow')
    })
    expect(feedback).toMatchObject({ success: true, reason: 'committed' })
    expect(result.current.state.camp.bond.claimedSynthesisRewardMask).toBe(1)

    act(() => {
      feedback = result.current.setAdultContentAccess(false)
    })
    expect(feedback).toMatchObject({ success: true, reason: 'committed' })
    expect(result.current.state.camp.bond).toMatchObject({
      adultAccessConfirmed: false,
      seraConsent: 'withdrawn',
      claimedSynthesisRewardMask: 1,
    })
    const reloaded = bootstrapGame(window.localStorage, Date.now(), 'reader')
    expect(reloaded.state.camp.bond).toMatchObject({
      adultAccessConfirmed: false,
      seraConsent: 'withdrawn',
      claimedSynthesisRewardMask: 1,
    })
    unmount()
  })

  it('latches writes off after a bootstrap read error', async () => {
    const originalGetItem = Storage.prototype.getItem
    vi.spyOn(Storage.prototype, 'getItem')
      .mockImplementationOnce(() => {
        throw new Error('simulated transient read failure')
      })
      .mockImplementation(function (this: Storage, key: string) {
        return originalGetItem.call(this, key)
      })
    const setItem = vi.spyOn(Storage.prototype, 'setItem')

    const { result, unmount } = renderHook(() => useGame())
    expect(result.current.saveHealthy).toBe(false)

    await act(async () => vi.advanceTimersByTimeAsync(6_000))

    expect(setItem).not.toHaveBeenCalled()
    expect(result.current.saveHealthy).toBe(false)
    unmount()
  })

  it('uses a no-write reader mode when Web Locks is unavailable', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem')

    const { result, unmount } = renderHook(() => useGame())

    expect(result.current.lockSupported).toBe(false)
    expect(result.current.ready).toBe(true)
    expect(result.current.readOnly).toBe(true)
    expect(result.current.notice).toContain('읽기 전용')

    let feedback: GameCommandFeedback | undefined
    act(() => {
      feedback = result.current.chooseExpeditionEvent('missing-event', 'gold')
    })
    expect(feedback).toEqual({
      success: false,
      message: '읽기 전용 탭에서는 진행을 변경할 수 없습니다.',
      reason: 'read-only',
    })

    const stateBeforeRecoveryCommands = structuredClone(result.current.state)
    act(() => {
      result.current.healAtCamp()
      result.current.equipQuickConsumable('healingPotion')
      result.current.useEquippedConsumable()
    })
    expect(result.current.state).toEqual(stateBeforeRecoveryCommands)

    await act(async () => vi.advanceTimersByTimeAsync(10_000))
    expect(setItem).not.toHaveBeenCalled()
    unmount()
  })

  it('does not advance save revision when progression commands are rejected', async () => {
    const request = vi.fn(
      async (
        _name: string,
        _options: LockOptions,
        callback: (lock: Lock | null) => Promise<void> | void,
      ) => callback({ name: 'emberwatch.writer.v1', mode: 'exclusive' } as Lock),
    )
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: { request } as unknown as LockManager,
    })

    const { result, unmount } = renderHook(() => useGame())
    await act(async () => vi.advanceTimersByTimeAsync(0))
    expect(result.current.readOnly).toBe(false)

    const stateBefore = structuredClone(result.current.state)
    const slotsBefore = SAVE_SLOT_KEYS.map((key) => window.localStorage.getItem(key))
    const revisionsBefore = slotsBefore.map((raw) =>
      raw === null ? null : parseSaveEnvelope(raw)?.revision ?? null,
    )

    act(() => {
      result.current.buyUpgrade('weapon')
      result.current.buySkill('fortune')
    })

    expect(result.current.state).toEqual(stateBefore)
    expect(result.current.state.rng).toEqual(stateBefore.rng)
    const slotsAfter = SAVE_SLOT_KEYS.map((key) => window.localStorage.getItem(key))
    expect(slotsAfter).toEqual(slotsBefore)
    expect(slotsAfter.map((raw) =>
      raw === null ? null : parseSaveEnvelope(raw)?.revision ?? null,
    )).toEqual(revisionsBefore)
    unmount()
  })

  it('persists one expedition choice and rejects a repeated command without another write', async () => {
    const request = vi.fn(
      async (
        _name: string,
        _options: LockOptions,
        callback: (lock: Lock | null) => Promise<void> | void,
      ) => callback({ name: 'emberwatch.writer.v1', mode: 'exclusive' } as Lock),
    )
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: { request } as unknown as LockManager,
    })

    const initial = createInitialState(Date.now(), 0x1234_5678)
    initial.player.upgrades.weapon = 100
    initial.battle.stage = 9
    initial.battle.highestStage = 9
    initial.battle.enemyHp = 1
    const offered = advanceGame(initial, 1_000).state
    const pending = offered.expeditionEvents.pending[0]
    if (pending === undefined) throw new Error('stage 10 expedition event was not offered')
    const goldChoice = pending.resolvedChoices.find(({ choiceId }) => choiceId === 'gold')
    if (goldChoice?.effect.type !== 'grantGold') throw new Error('missing resolved gold choice')
    const goldBeforeChoice = offered.player.gold
    expect(saveGameAtRevision(window.localStorage, offered, null)).toMatchObject({
      status: 'saved',
      revision: 1,
    })

    const { result, unmount } = renderHook(() => useGame())
    await act(async () => vi.advanceTimersByTimeAsync(0))
    expect(result.current.readOnly).toBe(false)
    const revisionBeforeChoice = Math.max(...SAVE_SLOT_KEYS.map((key) => {
      const raw = window.localStorage.getItem(key)
      return raw === null ? 0 : parseSaveEnvelope(raw)?.revision ?? 0
    }))

    let committed: GameCommandFeedback | undefined
    act(() => {
      committed = result.current.chooseExpeditionEvent(pending.eventId, 'gold')
    })
    expect(committed).toEqual({
      success: true,
      message: '원정 이벤트 선택을 적용했습니다.',
      reason: 'committed',
    })
    expect(result.current.state.player.gold).toBe(
      goldBeforeChoice + goldChoice.effect.amount,
    )
    expect(result.current.state.expeditionEvents.pending).toEqual([])
    const slotsAfterChoice = SAVE_SLOT_KEYS.map((key) => window.localStorage.getItem(key))
    expect(Math.max(...slotsAfterChoice.map((raw) =>
      raw === null ? 0 : parseSaveEnvelope(raw)?.revision ?? 0,
    ))).toBe(revisionBeforeChoice + 1)
    const stateAfterChoice = structuredClone(result.current.state)

    let rejected: GameCommandFeedback | undefined
    act(() => {
      rejected = result.current.chooseExpeditionEvent(pending.eventId, 'gold')
    })
    expect(rejected).toEqual({
      success: false,
      message: '선택할 수 없는 원정 이벤트입니다.',
      reason: 'rejected',
    })
    expect(result.current.state).toEqual(stateAfterChoice)
    expect(SAVE_SLOT_KEYS.map((key) => window.localStorage.getItem(key))).toEqual(
      slotsAfterChoice,
    )

    const reloaded = bootstrapGame(window.localStorage, Date.now(), 'reader')
    expect(reloaded.state.player.gold).toBe(goldBeforeChoice + goldChoice.effect.amount)
    expect(reloaded.state.expeditionEvents.pending).toEqual([])
    unmount()
  })

  it('returns save-failed and never commits an expedition choice before read-back', async () => {
    const request = vi.fn(
      async (
        _name: string,
        _options: LockOptions,
        callback: (lock: Lock | null) => Promise<void> | void,
      ) => callback({ name: 'emberwatch.writer.v1', mode: 'exclusive' } as Lock),
    )
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: { request } as unknown as LockManager,
    })

    const initial = createInitialState(Date.now(), 0x8765_4321)
    initial.player.upgrades.weapon = 100
    initial.battle.stage = 9
    initial.battle.highestStage = 9
    initial.battle.enemyHp = 1
    const offered = advanceGame(initial, 1_000).state
    const pending = offered.expeditionEvents.pending[0]
    if (pending === undefined) throw new Error('stage 10 expedition event was not offered')
    expect(saveGameAtRevision(window.localStorage, offered, null)).toMatchObject({
      status: 'saved',
      revision: 1,
    })

    const { result, unmount } = renderHook(() => useGame())
    await act(async () => vi.advanceTimersByTimeAsync(0))
    expect(result.current.readOnly).toBe(false)

    const stateBefore = structuredClone(result.current.state)
    const slotsBefore = SAVE_SLOT_KEYS.map((key) => window.localStorage.getItem(key))
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('simulated expedition write failure')
    })

    let feedback: GameCommandFeedback | undefined
    act(() => {
      feedback = result.current.chooseExpeditionEvent(pending.eventId, 'gold')
    })

    expect(feedback).toEqual({
      success: false,
      message: '저장을 안전하게 확인할 수 없어 이 탭을 읽기 전용으로 전환했습니다.',
      reason: 'save-failed',
    })
    expect(setItem).toHaveBeenCalled()
    expect(result.current.state).toEqual(stateBefore)
    expect(result.current.state.expeditionEvents.pending).toHaveLength(1)
    expect(result.current.readOnly).toBe(true)
    expect(result.current.saveHealthy).toBe(false)
    expect(SAVE_SLOT_KEYS.map((key) => window.localStorage.getItem(key))).toEqual(
      slotsBefore,
    )
    unmount()
  })
})
