import { StrictMode } from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CombatEvent, CombatEventBatch, CombatEventSnapshot } from '../game/types'
import { CombatLogPanel } from './CombatLogPanel'

const SNAPSHOT: CombatEventSnapshot = {
  stage: 1,
  highestStage: 1,
  playerHp: 100,
  enemyHp: 20,
  gold: 0,
  xp: 0,
}

function makeEvent(index: number, type: CombatEvent['type']): CombatEvent {
  const base = {
    id: `event-${index}-${type}`,
    roundSequence: String(index),
    rngState: index,
    stage: index,
    snapshot: { ...SNAPSHOT, stage: index },
  }
  if (type === 'skill') {
    return { ...base, type, ordinal: 10, skillId: 'powerStrike', damage: index }
  }
  if (type === 'critical') return { ...base, type, ordinal: 20, damage: index }
  if (type === 'companionAssist') {
    return { ...base, type, ordinal: 25, companionId: 'emberFox', damage: index }
  }
  if (type === 'kill') {
    return {
      ...base,
      type,
      ordinal: 30,
      defeatedStage: index,
      nextStage: index + 1,
      gold: index * 2,
      xp: index * 3,
    }
  }
  if (type === 'bossVictory') {
    return {
      ...base,
      type,
      ordinal: 30,
      defeatedStage: index,
      nextStage: index + 1,
      gold: index * 2,
      xp: index * 3,
      milestoneReward: null,
    }
  }
  return {
    ...base,
    type,
    ordinal: 30,
    damage: index,
    defeatedAtStage: index,
    returnStage: Math.max(1, index - 1),
    highestStage: index,
  }
}

function makeBatch(
  events: readonly CombatEvent[],
  totalEvents = events.length,
  nextCursor = String(events.length),
): CombatEventBatch {
  return { events, totalEvents, nextCursor }
}

describe('IRPG-411 combat log panel', () => {
  afterEach(() => vi.useRealTimers())

  it('starts collapsed and exposes a keyboard-operable disclosure with an explicit empty state', () => {
    render(<CombatLogPanel batch={makeBatch([])} />)

    const toggle = screen.getByRole('button', { name: '전투 로그 펼치기' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(toggle).toHaveAttribute('aria-controls', 'combat-log-content')
    expect(screen.getByText('최근 0건 · 이전 기록 없음')).toBeVisible()
    expect(screen.queryByText('아직 기록된 전투 이벤트가 없습니다.')).not.toBeVisible()

    fireEvent.keyDown(toggle, { key: 'Enter' })
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('아직 기록된 전투 이벤트가 없습니다.')).toBeVisible()
    expect(screen.getByRole('group', { name: '로그 필터' })).toBeVisible()
  })

  it('shows only the latest 20 in canonical order and filters after applying the bound', () => {
    const types: readonly CombatEvent['type'][] = [
      'skill',
      'critical',
      'companionAssist',
      'kill',
      'bossVictory',
      'defeat',
    ]
    const events = Array.from({ length: 25 }, (_, index) =>
      makeEvent(index + 1, types[index % types.length]!),
    )
    const unknown = {
      ...makeEvent(25, 'skill'),
      id: 'event-25-unknown',
      type: 'futureEvent',
    } as unknown as CombatEvent
    events[24] = unknown
    render(<CombatLogPanel batch={makeBatch(events, 25, '25')} />)

    fireEvent.click(screen.getByRole('button', { name: '전투 로그 펼치기' }))
    const list = screen.getByTestId('combat-log-list')
    expect(within(list).getAllByRole('listitem')).toHaveLength(20)
    expect(within(list).getAllByRole('listitem')[0]).toHaveTextContent('라운드 6')
    expect(within(list).getAllByRole('listitem')[19]).toHaveTextContent('라운드 25')
    expect(screen.getByText('최근 20건 · 이전 5건 요약')).toBeVisible()
    expect(screen.getByText('알 수 없는 전투 이벤트')).toBeVisible()

    fireEvent.click(screen.getByLabelText('모두'))
    expect(screen.getByText('선택한 필터에 해당하는 최근 이벤트가 없습니다.'))
      .toBeVisible()
    expect(screen.getByText('현재 필터에서 최근 기록 20건을 숨겼습니다.')).toBeVisible()

    fireEvent.click(screen.getByLabelText('승리'))
    const victories = within(screen.getByTestId('combat-log-list')).getAllByRole('listitem')
    expect(victories.length).toBeGreaterThan(0)
    expect(victories.every((entry) =>
      ['kill', 'bossVictory'].includes(entry.getAttribute('data-combat-event-type') ?? ''),
    )).toBe(true)
  })

  it('renders skill, critical, assist, victory, boss victory, and defeat snapshots as text', () => {
    const events = [
      makeEvent(1, 'skill'),
      makeEvent(2, 'critical'),
      makeEvent(3, 'companionAssist'),
      makeEvent(4, 'kill'),
      makeEvent(5, 'bossVictory'),
      makeEvent(6, 'defeat'),
    ]
    render(<CombatLogPanel batch={makeBatch(events)} />)
    fireEvent.click(screen.getByRole('button', { name: '전투 로그 펼치기' }))

    expect(screen.getByText(/화염 강타가 1 피해/)).toBeVisible()
    expect(screen.getByText(/치명타로 2 피해/)).toBeVisible()
    expect(screen.getByText(/불씨 여우 루미가 협공으로 3 피해/)).toBeVisible()
    expect(screen.getByText(/스테이지 4 승리 · 골드 8 · 경험치 12/)).toBeVisible()
    expect(screen.getByText(/보스 스테이지 5 승리 · 골드 10 · 경험치 15/)).toBeVisible()
    expect(screen.getByText(/스테이지 6 패배 · 스테이지 5로 복귀/)).toBeVisible()
  })

  it('announces only new IDs once per fixed five-second window and cancels on reset', () => {
    vi.useFakeTimers()
    const initial = makeBatch([makeEvent(1, 'skill')], 1, '1')
    const view = render(<CombatLogPanel batch={initial} />)
    const liveRegion = screen.getByTestId('combat-log-announcement')
    const toggle = screen.getByRole('button', { name: '전투 로그 펼치기' })
    toggle.focus()

    act(() => vi.advanceTimersByTime(5_000))
    expect(liveRegion).toBeEmptyDOMElement()

    view.rerender(
      <CombatLogPanel
        batch={makeBatch([makeEvent(1, 'skill'), makeEvent(2, 'critical')], 2, '2')}
      />,
    )
    act(() => vi.advanceTimersByTime(1_000))
    view.rerender(
      <CombatLogPanel
        batch={makeBatch([
          makeEvent(1, 'skill'),
          makeEvent(2, 'critical'),
          makeEvent(3, 'companionAssist'),
        ], 3, '3')}
      />,
    )
    expect(toggle).toHaveFocus()
    act(() => vi.advanceTimersByTime(3_999))
    expect(liveRegion).toBeEmptyDOMElement()
    act(() => vi.advanceTimersByTime(1))
    expect(liveRegion).toHaveTextContent(
      '새 전투 이벤트: 치명타 1회, 협공 1회. 마지막 라운드 3.',
    )

    view.rerender(
      <CombatLogPanel
        batch={makeBatch([
          makeEvent(1, 'skill'),
          makeEvent(2, 'critical'),
          makeEvent(3, 'companionAssist'),
          makeEvent(4, 'defeat'),
        ], 4, '4')}
      />,
    )
    act(() => vi.advanceTimersByTime(2_000))
    view.rerender(<CombatLogPanel batch={makeBatch([], 0, '0')} />)
    act(() => vi.advanceTimersByTime(5_000))
    expect(liveRegion).toBeEmptyDOMElement()
  })

  it('keeps one pending timer under StrictMode and clears it on unmount', () => {
    vi.useFakeTimers()
    const view = render(
      <StrictMode>
        <CombatLogPanel batch={makeBatch([])} />
      </StrictMode>,
    )
    view.rerender(
      <StrictMode>
        <CombatLogPanel batch={makeBatch([makeEvent(1, 'critical')], 1, '1')} />
      </StrictMode>,
    )
    expect(vi.getTimerCount()).toBe(1)

    view.rerender(
      <StrictMode>
        <CombatLogPanel batch={makeBatch([
          makeEvent(1, 'critical'),
          makeEvent(2, 'companionAssist'),
        ], 2, '2')} />
      </StrictMode>,
    )
    expect(vi.getTimerCount()).toBe(1)
    view.unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
