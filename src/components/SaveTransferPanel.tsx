import { useCallback, useRef, useState, type ChangeEvent } from 'react'
import { createPortal } from 'react-dom'
import { formatNumber } from '../game/format'
import {
  MAX_PORTABLE_SAVE_BYTES,
  createPortableSave,
  parsePortableSave,
  type SaveImportPreview,
} from '../game/saveTransfer'
import type { GameState } from '../game/types'
import { useModalFocus } from '../hooks/useModalFocus'

interface SaveTransferPanelProps {
  state: GameState
  exportDisabled?: boolean
  importDisabled?: boolean
  onRestore: (preview: SaveImportPreview) => { success: boolean; message: string }
}

export function SaveTransferPanel({
  state,
  exportDisabled = false,
  importDisabled = false,
  onRestore,
}: SaveTransferPanelProps) {
  const [preview, setPreview] = useState<SaveImportPreview | null>(null)
  const [message, setMessage] = useState('')
  const selectionRef = useRef(0)
  const cancelImport = useCallback(() => {
    setPreview(null)
    setMessage('백업 복원을 취소했습니다.')
  }, [])
  const dialogRef = useModalFocus<HTMLElement>(cancelImport, preview !== null)

  const exportSave = () => {
    const raw = createPortableSave(state)
    if (raw === null) {
      setMessage('현재 진행을 내보낼 수 없습니다.')
      return
    }
    const blob = new Blob([raw], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `emberwatch-save-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
    document.body.append(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    setMessage('저장 백업 파일을 만들었습니다.')
  }

  const selectImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (file === undefined) return
    const selection = selectionRef.current + 1
    selectionRef.current = selection
    setPreview(null)
    if (file.size > MAX_PORTABLE_SAVE_BYTES) {
      setMessage('저장 파일이 1 MiB 제한을 초과합니다.')
      return
    }
    setMessage('저장 파일을 검증하고 있습니다.')
    let raw: string
    try {
      raw = await file.text()
    } catch {
      if (selection !== selectionRef.current) return
      setMessage('저장 파일을 읽지 못했습니다.')
      return
    }
    if (selection !== selectionRef.current) return
    const parsed = parsePortableSave(raw)
    if (!parsed.success) {
      setPreview(null)
      setMessage(parsed.message)
      return
    }
    setMessage('파일 검증이 끝났습니다. 복원할 진행을 확인해 주세요.')
    setPreview(parsed.preview)
  }

  const confirmImport = () => {
    if (preview === null) return
    const restored = onRestore(preview)
    if (restored.success) {
      setPreview(null)
      setMessage(restored.message)
    } else {
      setPreview(null)
      setMessage(restored.message)
    }
  }

  return (
    <section className="panel save-transfer" aria-labelledby="save-transfer-title">
      <div>
        <p className="eyebrow">SAVE BACKUP</p>
        <h2 id="save-transfer-title">저장 백업</h2>
        <p>진행을 JSON 파일로 보관하거나 검증된 백업에서 복원합니다.</p>
      </div>
      <div className="save-transfer__actions">
        <button type="button" onClick={exportSave} disabled={exportDisabled}>
          저장 내보내기
        </button>
        <label className={importDisabled ? 'file-button file-button--disabled' : 'file-button'}>
          저장 가져오기
          <input
            type="file"
            accept="application/json,.json"
            aria-label="저장 파일 선택"
            disabled={importDisabled}
            onChange={selectImport}
          />
        </label>
      </div>
      <p className="save-transfer__status" role="status" aria-live="polite">
        {message}
      </p>

      {preview && createPortal(
        <div
          className="modal-backdrop"
          role="presentation"
          data-modal-layer="true"
        >
          <section
            ref={dialogRef}
            className="offline-modal import-preview"
            role="dialog"
            aria-modal="true"
            aria-labelledby="import-preview-title"
            tabIndex={-1}
          >
            <p className="eyebrow">검증 완료</p>
            <h2 id="import-preview-title">이 진행으로 복원할까요?</h2>
            <p className="offline-modal__lead">
              {new Date(preview.exportedAt).toLocaleString('ko-KR')}에 내보낸 백업입니다.
            </p>
            <dl>
              <div><dt>레벨</dt><dd>{formatNumber(preview.state.player.level)}</dd></div>
              <div><dt>최고 스테이지</dt><dd>{formatNumber(preview.state.battle.highestStage)}</dd></div>
              <div><dt>골드</dt><dd>{formatNumber(preview.state.player.gold)}</dd></div>
              <div><dt>불씨 정수</dt><dd>{formatNumber(preview.state.player.essence)}</dd></div>
            </dl>
            <div className="import-preview__actions">
              <button
                type="button"
                onClick={cancelImport}
                data-initial-focus
              >
                취소
              </button>
              <button type="button" onClick={confirmImport}>검증된 저장 복원</button>
            </div>
          </section>
        </div>,
        document.body,
      )}
    </section>
  )
}
