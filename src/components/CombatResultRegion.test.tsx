import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type {
  BossVictoryCombatEvent,
  CombatEvent,
  CombatEventBatch,
  CombatEventSnapshot,
  DefeatCombatEvent,
} from '../game/types'
import { CombatResultRegion } from './CombatResultRegion'

const EMPTY_BATCH: CombatEventBatch = { nextCursor: '0', totalEvents: 0, events: [] }

function snapshot(stage: number, gold = 1_255): CombatEventSnapshot {
  return {
    stage,
    highestStage: 11,
    playerHp: 100,
    enemyHp: 0,
    gold,
    xp: 50,
  }
}

function victory(
  round: string,
  options: {
    stage?: number
    nextStage?: number
    appliedGold?: number | null
    configuredGold?: number
  } = {},
): BossVictoryCombatEvent {
  const stage = options.stage ?? 10
  return {
    id: `victory-${round}`,
    type: 'bossVictory',
    roundSequence: round,
    ordinal: 30,
    rngState: 0x4100_0000,
    stage,
    defeatedStage: stage,
    nextStage: options.nextStage ?? stage + 1,
    gold: 240,
    xp: 120,
    milestoneReward: options.appliedGold === null
      ? null
      : {
          tableId: 'boss-milestone-v1',
          kind: 'gold',
          milestoneStage: stage,
          configuredGold: options.configuredGold ?? 15,
          appliedGold: options.appliedGold ?? 15,
        },
    snapshot: snapshot(options.nextStage ?? stage + 1),
  }
}

function defeat(round: string, stage = 10): DefeatCombatEvent {
  return {
    id: `defeat-${round}`,
    type: 'defeat',
    roundSequence: round,
    ordinal: 30,
    rngState: 0x4100_0001,
    stage,
    damage: 96,
    defeatedAtStage: stage,
    returnStage: 9,
    highestStage: 11,
    snapshot: snapshot(9),
  }
}

function batch(events: readonly CombatEvent[]): CombatEventBatch {
  return {
    nextCursor: events.at(-1)?.roundSequence ?? '0',
    totalEvents: events.length,
    events,
  }
}

describe('IRPG-410 combat result region', () => {
  it('keeps the empty status nonmodal and loads result art only after an explicit detail action', () => {
    const view = render(
      <>
        <button type="button">전투 제어</button>
        <CombatResultRegion batch={EMPTY_BATCH} streamGeneration={1} />
      </>,
    )
    const control = screen.getByRole('button', { name: '전투 제어' })
    control.focus()
    expect(screen.getByText(/아직 보스 승리 또는 패배 결과가 없습니다/)).toBeVisible()
    expect(document.querySelector('[data-asset-id^="result."]')).toBeNull()

    view.rerender(
      <>
        <button type="button">전투 제어</button>
        <CombatResultRegion batch={batch([victory('1')])} streamGeneration={1} />
      </>,
    )

    expect(control).toHaveFocus()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(document.querySelector('[data-asset-id^="result."]')).toBeNull()
    expect(screen.getByTestId('combat-result-announcement')).toHaveTextContent(
      '새 전투 결과: 스테이지 10 보스 승리',
    )

    const opener = screen.getByRole('button', { name: '스테이지 10 보스 승리 상세 보기' })
    opener.focus()
    fireEvent.click(opener)
    const dialog = screen.getByRole('dialog', { name: '스테이지 10 보스 승리' })
    expect(dialog.closest('[data-modal-layer="true"]')?.parentElement).toBe(document.body)
    expect(dialog).toHaveAttribute('data-result-type', 'bossVictory')
    expect(within(dialog).getByText('기본 골드 정산값').nextElementSibling)
      .toHaveTextContent('+240')
    expect(within(dialog).getByText('기본 경험치 정산값').nextElementSibling)
      .toHaveTextContent('+120 XP')
    expect(within(dialog).getByText('원정 진행').nextElementSibling)
      .toHaveTextContent('다음 스테이지 11')
    expect(within(dialog).getByText('정산 뒤 보유 골드').nextElementSibling)
      .toHaveTextContent('1,255')
    expect(within(dialog).getByText(/실제 지급/)).toHaveTextContent('+15 골드')
    expect(dialog.querySelector('[data-asset-id="result.boss-victory"]')).not.toBeNull()
    expect(screen.getByRole('button', { name: '결과 닫기' })).toHaveFocus()

    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(opener).toHaveFocus()
  })

  it('pins an evicted result and restores focus to the region heading when its opener disappears', () => {
    const firstBatch = batch([victory('1'), defeat('2'), victory('3')])
    const view = render(<CombatResultRegion batch={firstBatch} streamGeneration={1} />)
    const victoryOpeners = screen.getAllByRole('button', {
      name: '스테이지 10 보스 승리 상세 보기',
    })
    const oldestOpener = victoryOpeners.at(-1)
    if (oldestOpener === undefined) throw new Error('oldest result opener missing')
    oldestOpener.focus()
    fireEvent.click(oldestOpener)
    expect(screen.getByRole('dialog', { name: '스테이지 10 보스 승리' })).toBeVisible()

    view.rerender(
      <CombatResultRegion
        batch={batch([victory('1'), defeat('2'), victory('3'), defeat('4')])}
        streamGeneration={1}
      />,
    )

    expect(oldestOpener).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: '스테이지 10 보스 승리' })).toBeVisible()
    expect(screen.getByText('최근 결과 3건 · 이전 결과 1건 요약')).toBeVisible()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(screen.getByRole('heading', { name: '승패 결과' })).toHaveFocus()
  })

  it('moves focus to the region heading when a focused queue trigger is evicted', () => {
    const firstBatch = batch([victory('1'), defeat('2'), victory('3')])
    const view = render(<CombatResultRegion batch={firstBatch} streamGeneration={1} />)
    const victoryOpeners = screen.getAllByRole('button', {
      name: '스테이지 10 보스 승리 상세 보기',
    })
    const oldestOpener = victoryOpeners.at(-1)
    if (oldestOpener === undefined) throw new Error('oldest result opener missing')
    oldestOpener.focus()

    view.rerender(
      <CombatResultRegion
        batch={batch([victory('1'), defeat('2'), victory('3'), defeat('4')])}
        streamGeneration={1}
      />,
    )

    expect(oldestOpener).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '승패 결과' })).toHaveFocus()
  })

  it('renders defeat snapshots and keeps all values independent from later state', () => {
    const loss = defeat('1')
    const original = JSON.stringify(loss)
    render(<CombatResultRegion batch={batch([loss])} streamGeneration={4} />)
    fireEvent.click(screen.getByRole('button', {
      name: '스테이지 10 패배 · 스테이지 9 복귀 상세 보기',
    }))

    const dialog = screen.getByRole('dialog', { name: '스테이지 10 패배' })
    expect(within(dialog).getByText('패배 스테이지').nextElementSibling).toHaveTextContent('10')
    expect(within(dialog).getByText('복귀 스테이지').nextElementSibling).toHaveTextContent('9')
    expect(within(dialog).getByText('유지된 최고 기록').nextElementSibling).toHaveTextContent('11')
    expect(within(dialog).getByText('마지막 피해').nextElementSibling).toHaveTextContent('96')
    expect(dialog.querySelector('[data-asset-id="result.defeat"]')).not.toBeNull()
    expect(JSON.stringify(loss)).toBe(original)
  })

  it('distinguishes capped milestone settlement, no bonus, and the final stage', () => {
    const capped = victory('1', {
      stage: 300,
      nextStage: 300,
      configuredGold: 450,
      appliedGold: 0,
    })
    const view = render(<CombatResultRegion batch={batch([capped])} streamGeneration={1} />)
    fireEvent.click(screen.getByRole('button', {
      name: '스테이지 300 보스 승리 상세 보기',
    }))
    expect(screen.getByText('최종 스테이지 300 유지')).toBeVisible()
    expect(screen.getByText(/실제 지급/)).toHaveTextContent('+0 골드')
    expect(screen.getByText(/설정 450 골드 중 보유 상한까지 적용/)).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: '결과 닫기' }))

    view.rerender(
      <CombatResultRegion
        batch={batch([capped, victory('2', { appliedGold: null })])}
        streamGeneration={1}
      />,
    )
    fireEvent.click(screen.getByRole('button', {
      name: '스테이지 10 보스 승리 상세 보기',
    }))
    expect(screen.getByText('추가 최초 승리 보상 없음 · 정산 완료')).toBeVisible()
  })
})
