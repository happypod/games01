import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createInitialState } from '../game/engine'
import { createPortableSave } from '../game/saveTransfer'
import type { CombatEventBatch, CriticalCombatEvent } from '../game/types'
import type { CombatResultsController } from '../hooks/useCombatResults'
import type { BossVictoryResultSnapshot } from './combatResultView'
import { TacticalUtilityDock, type TacticalUtilityDockProps } from './TacticalUtilityDock'

const EMPTY_BATCH: CombatEventBatch = { nextCursor: '0', totalEvents: 0, events: [] }

function criticalEvent(roundSequence: string): CriticalCombatEvent {
  return {
    id: `critical-${roundSequence}`,
    type: 'critical',
    roundSequence,
    ordinal: 20,
    rngState: 0x4220_0001,
    stage: 10,
    damage: 42,
    snapshot: {
      stage: 10,
      highestStage: 10,
      playerHp: 100,
      enemyHp: 10,
      gold: 300,
      xp: 50,
    },
  }
}

function createResults(overrides: Partial<CombatResultsController> = {}): CombatResultsController {
  return {
    queue: [],
    overflowCount: 0,
    announcement: '',
    pinnedResult: null,
    lastConsumedCoordinate: null,
    openResult: vi.fn(),
    closeResult: vi.fn(),
    ...overrides,
  }
}

function victoryResult(): BossVictoryResultSnapshot {
  return {
    id: 'victory-10',
    type: 'bossVictory',
    roundSequence: '10',
    ordinal: 30,
    stage: 10,
    defeatedStage: 10,
    nextStage: 11,
    gold: 240,
    xp: 120,
    balanceGold: 1_495,
    milestoneReward: null,
  }
}

function createProps(overrides: Partial<TacticalUtilityDockProps> = {}): TacticalUtilityDockProps {
  const state = createInitialState(1_000)
  state.battle.highestStage = 30
  return {
    batch: EMPTY_BATCH,
    results: createResults(),
    state,
    onPrestige: vi.fn(),
    onRestore: vi.fn(() => ({ success: true, message: '복원 완료' })),
    ...overrides,
  }
}

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('IRPG-422 TacticalUtilityDock', () => {
  it('renders four Font Awesome icon triggers and exposes labels as focus and hover tooltips', () => {
    render(<TacticalUtilityDock {...createProps()} />)

    const labels = ['전투 로그', '승패 결과', '불씨의 계승', '저장 백업']
    for (const label of labels) {
      const trigger = screen.getByRole('button', { name: label })
      expect(trigger).toHaveAttribute('aria-haspopup', 'dialog')
      expect(trigger).toHaveAttribute('aria-expanded', 'false')
      expect(trigger.querySelector('svg')).not.toBeNull()
    }

    const log = screen.getByRole('button', { name: '전투 로그' })
    fireEvent.mouseEnter(log)
    expect(screen.getByRole('tooltip')).toHaveTextContent('전투 로그')
    expect(log).toHaveAttribute('aria-describedby', 'tactical-utility-tooltip-log')
    fireEvent.mouseLeave(log)
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()

    fireEvent.focus(log)
    expect(screen.getByRole('tooltip')).toHaveTextContent('전투 로그')
    fireEvent.blur(log)
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('keeps exactly one interactive panel open and focuses each selected panel heading', () => {
    render(<TacticalUtilityDock {...createProps()} />)

    const log = screen.getByRole('button', { name: '전투 로그' })
    const results = screen.getByRole('button', { name: '승패 결과' })
    fireEvent.click(log)

    let panel = screen.getByTestId('tactical-utility-panel')
    expect(panel).toHaveAttribute('data-utility-panel', 'log')
    expect(log).toHaveAttribute('aria-expanded', 'true')
    expect(panel.querySelector('#tactical-utility-panel-title-log')).toHaveFocus()

    fireEvent.click(results)
    panel = screen.getByTestId('tactical-utility-panel')
    expect(panel).toHaveAttribute('data-utility-panel', 'results')
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    expect(log).toHaveAttribute('aria-expanded', 'false')
    expect(results).toHaveAttribute('aria-expanded', 'true')
    expect(panel.querySelector('#tactical-utility-panel-title-results')).toHaveFocus()
  })

  it('restores trigger focus for explicit closes without stealing focus on an outside click', () => {
    render(
      <>
        <TacticalUtilityDock {...createProps()} />
        <button type="button">도크 밖</button>
      </>,
    )
    const log = screen.getByRole('button', { name: '전투 로그' })

    fireEvent.click(log)
    const close = screen.getByRole('button', { name: '전투 로그 닫기' })
    expect(close.querySelector('svg[data-icon="xmark"]')).not.toBeNull()
    fireEvent.click(close)
    expect(screen.queryByTestId('tactical-utility-panel')).not.toBeInTheDocument()
    expect(log).toHaveFocus()

    fireEvent.click(log)
    fireEvent.keyDown(screen.getByTestId('tactical-utility-panel'), { key: 'Escape' })
    expect(screen.queryByTestId('tactical-utility-panel')).not.toBeInTheDocument()
    expect(log).toHaveFocus()

    fireEvent.click(log)
    fireEvent.click(log)
    expect(screen.queryByTestId('tactical-utility-panel')).not.toBeInTheDocument()
    expect(log).toHaveFocus()

    fireEvent.click(log)
    const outside = screen.getByRole('button', { name: '도크 밖' })
    outside.focus()
    fireEvent.click(outside)
    expect(screen.queryByTestId('tactical-utility-panel')).not.toBeInTheDocument()
    expect(outside).toHaveFocus()
  })

  it('routes prestige once and preserves disabled command behavior', () => {
    const enabledProps = createProps()
    const view = render(<TacticalUtilityDock {...enabledProps} />)
    fireEvent.click(screen.getByRole('button', { name: '불씨의 계승' }))
    fireEvent.click(screen.getByRole('button', { name: '환생하기' }))
    expect(enabledProps.onPrestige).toHaveBeenCalledTimes(1)

    view.unmount()
    const disabledProps = createProps({ disabled: true })
    render(<TacticalUtilityDock {...disabledProps} />)
    fireEvent.click(screen.getByRole('button', { name: '불씨의 계승' }))
    expect(screen.getByRole('button', { name: '환생하기' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: '환생하기' }))
    expect(disabledProps.onPrestige).not.toHaveBeenCalled()
  })

  it('routes a result detail action exactly once without adding a reward command', () => {
    const openResult = vi.fn()
    render(
      <TacticalUtilityDock
        {...createProps({
          results: createResults({ queue: [victoryResult()], openResult }),
        })}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '승패 결과' }))
    fireEvent.click(screen.getByRole('button', {
      name: '스테이지 10 보스 승리 상세 보기',
    }))

    expect(openResult).toHaveBeenCalledTimes(1)
    expect(openResult).toHaveBeenCalledWith('victory-10')
  })

  it('keeps log and result announcements mounted while panels are closed without duplicate live output', () => {
    vi.useFakeTimers()
    const resultAnnouncement = '새 전투 결과. 보스 승리 1건.'
    const props = createProps({ results: createResults({ announcement: resultAnnouncement }) })
    const view = render(<TacticalUtilityDock {...props} />)

    expect(screen.queryByTestId('tactical-utility-panel')).not.toBeInTheDocument()
    expect(screen.getByTestId('tactical-utility-result-announcement')).toHaveTextContent(resultAnnouncement)

    const event = criticalEvent('1')
    view.rerender(
      <TacticalUtilityDock
        {...props}
        batch={{ nextCursor: '1', totalEvents: 1, events: [event] }}
      />,
    )
    act(() => vi.advanceTimersByTime(5_000))
    expect(screen.getByTestId('tactical-utility-log-announcement')).toHaveTextContent('치명타 1회')

    fireEvent.click(screen.getByRole('button', { name: '전투 로그' }))
    const nestedLogAnnouncement = screen.getByTestId('combat-log-announcement')
    expect(nestedLogAnnouncement).toHaveAttribute('aria-live', 'off')
    expect(nestedLogAnnouncement).toHaveAttribute('aria-hidden', 'true')

    fireEvent.click(screen.getByRole('button', { name: '승패 결과' }))
    expect(screen.queryByTestId('combat-result-announcement')).not.toBeInTheDocument()
    expect(screen.getByTestId('tactical-utility-result-announcement')).toHaveTextContent(resultAnnouncement)
  })

  it('keeps the backup panel mounted while its nested modal closes and commits restore once', async () => {
    const onRestore = vi.fn((): ReturnType<TacticalUtilityDockProps['onRestore']> => ({
      success: true,
      message: '복원 완료',
    }))
    const props = createProps({ onRestore })
    render(<TacticalUtilityDock {...props} />)

    fireEvent.click(screen.getByRole('button', { name: '저장 백업' }))
    const input = screen.getByLabelText('저장 파일 선택')
    const raw = createPortableSave(createInitialState(1_000), 2_000)
    expect(raw).not.toBeNull()
    const file = new File([raw!], 'backup.json', { type: 'application/json' })
    fireEvent.change(input, { target: { files: [file] } })

    const preview = await screen.findByRole('dialog', { name: '이 진행으로 복원할까요?' })
    const cancel = within(preview).getByRole('button', { name: '취소' })
    await waitFor(() => expect(cancel).toHaveFocus())
    const modalLayer = preview.closest('[data-modal-layer="true"]')
    expect(modalLayer?.parentElement).toBe(document.body)
    if (modalLayer === null) throw new Error('modal layer missing')
    fireEvent.click(modalLayer)
    expect(preview).toBeVisible()
    expect(screen.getByTestId('tactical-utility-panel')).toHaveAttribute('data-utility-panel', 'backup')
    fireEvent.keyDown(cancel, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '이 진행으로 복원할까요?' })).not.toBeInTheDocument())
    expect(screen.getByTestId('tactical-utility-panel')).toHaveAttribute('data-utility-panel', 'backup')

    fireEvent.change(screen.getByLabelText('저장 파일 선택'), { target: { files: [file] } })
    const secondPreview = await screen.findByRole('dialog', { name: '이 진행으로 복원할까요?' })
    fireEvent.click(within(secondPreview).getByRole('button', { name: '검증된 저장 복원' }))
    expect(onRestore).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('tactical-utility-panel')).toHaveAttribute('data-utility-panel', 'backup')
  })

  it('supports optional backup and forwards independent export and import disabled flags', () => {
    const view = render(
      <TacticalUtilityDock
        {...createProps({ saveExportDisabled: true, saveImportDisabled: true })}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: '저장 백업' }))
    expect(screen.getByRole('button', { name: '저장 내보내기' })).toBeDisabled()
    expect(screen.getByLabelText('저장 파일 선택')).toBeDisabled()

    view.rerender(<TacticalUtilityDock {...createProps({ showSaveTransfer: false })} />)
    expect(screen.queryByRole('button', { name: '저장 백업' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('button')).toHaveLength(3)

    view.rerender(<TacticalUtilityDock {...createProps({ showSaveTransfer: true })} />)
    expect(screen.queryByTestId('tactical-utility-panel')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '저장 백업' })).toHaveAttribute('aria-expanded', 'false')
  })
})
