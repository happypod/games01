import { describe, expect, it } from 'vitest'
import {
  advanceGame,
  advanceOfflineGame,
  createInitialState,
  performPrestige,
  switchGameMode,
} from './engine'

describe('IRPG-418 camp activity mode', () => {
  it('switches only the persisted activity mode and rejects duplicate commands', () => {
    const initial = createInitialState(10, 0x4180_0001)
    const snapshot = structuredClone(initial)

    const entered = switchGameMode(initial, 'CAMP')

    expect(entered.success).toBe(true)
    expect(entered.state).toEqual({ ...snapshot, currentMode: 'CAMP' })
    expect(initial).toEqual(snapshot)
    expect(switchGameMode(entered.state, 'CAMP')).toEqual({
      state: entered.state,
      success: false,
      message: '이미 캠프에서 쉬고 있습니다.',
    })
  })

  it('pauses foreground combat without consuming a round, RNG, reward, or cursor', () => {
    const battle = createInitialState(0, 0x4180_0002)
    const camp = switchGameMode(battle, 'CAMP').state
    const snapshot = structuredClone(camp)

    const result = advanceGame(camp, 60_000, '42')

    expect(result.state).toEqual({
      ...snapshot,
      camp: {
        ...snapshot.camp,
        merchant: {
          ...snapshot.camp.merchant,
          refreshRemainingMs: snapshot.camp.merchant.refreshRemainingMs - 60_000,
        },
      },
    })
    expect(result.report).toMatchObject({ elapsedMs: 60_000, rounds: 0, kills: 0 })
    expect(result).toMatchObject({ nextCursor: '42', totalEvents: 0, events: [] })
    expect(result.state.rng).toEqual(snapshot.rng)
  })

  it('reconciles offline camp time through the normal battle engine and restores camp mode', () => {
    const initial = createInitialState(0, 0x4180_0003)
    const camp = switchGameMode(initial, 'CAMP').state
    const expected = advanceGame(initial, 60_000)
    const offline = advanceOfflineGame(camp, 60_000)

    expect(offline.report).toEqual(expected.report)
    expect(offline.state).toEqual({ ...expected.state, currentMode: 'CAMP' })
    expect(offline.nextCursor).toBe(expected.nextCursor)
    expect(camp.battle).toEqual(initial.battle)
    expect(camp.rng).toEqual(initial.rng)
  })

  it('preserves the camp foundation through prestige while returning to battle mode', () => {
    const initial = createInitialState(100, 0x4180_0004)
    initial.currentMode = 'CAMP'
    initial.battle.highestStage = 30
    initial.camp.structures.tent = 3
    initial.camp.training.attack = 4
    initial.camp.materials.ashShard = 7

    const result = performPrestige(initial)

    expect(result.success).toBe(true)
    expect(result.state.currentMode).toBe('BATTLE')
    expect(result.state.camp).toEqual(initial.camp)
    expect(result.state.camp).not.toBe(initial.camp)
  })
})
