import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createInitialState } from '../game/engine'
import { createPortableSave } from '../game/saveTransfer'
import { SaveTransferPanel } from './SaveTransferPanel'

function stateWithGold(gold: number) {
  const state = createInitialState(1_000)
  state.player.gold = gold
  return state
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((complete) => {
    resolve = complete
  })
  return { promise, resolve }
}

describe('SaveTransferPanel', () => {
  it('keeps the newest file selection when an older read completes later', async () => {
    const olderRead = deferred<string>()
    const newerRead = deferred<string>()
    const older = new File(['old'], 'older.json', { type: 'application/json' })
    const newer = new File(['new'], 'newer.json', { type: 'application/json' })
    Object.defineProperty(older, 'text', { value: () => olderRead.promise })
    Object.defineProperty(newer, 'text', { value: () => newerRead.promise })

    render(
      <SaveTransferPanel
        state={createInitialState(0)}
        onRestore={() => ({ success: true, message: 'ok' })}
      />,
    )
    const input = screen.getByLabelText('저장 파일 선택')
    fireEvent.change(input, { target: { files: [older] } })
    fireEvent.change(input, { target: { files: [newer] } })

    await act(async () => newerRead.resolve(createPortableSave(stateWithGold(222), 2_000)!))
    const dialog = await screen.findByRole('dialog', { name: '이 진행으로 복원할까요?' })
    expect(within(dialog).getByText('222')).toBeInTheDocument()

    await act(async () => olderRead.resolve(createPortableSave(stateWithGold(111), 2_000)!))
    expect(within(dialog).getByText('222')).toBeInTheDocument()
    expect(within(dialog).queryByText('111')).not.toBeInTheDocument()
  })

  it('announces file read failures without opening a preview', async () => {
    const broken = new File(['broken'], 'broken.json', { type: 'application/json' })
    Object.defineProperty(broken, 'text', {
      value: vi.fn().mockRejectedValue(new Error('simulated read failure')),
    })
    render(
      <SaveTransferPanel
        state={createInitialState(0)}
        onRestore={() => ({ success: true, message: 'ok' })}
      />,
    )

    fireEvent.change(screen.getByLabelText('저장 파일 선택'), {
      target: { files: [broken] },
    })

    expect(await screen.findByText('저장 파일을 읽지 못했습니다.')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
