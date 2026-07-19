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
