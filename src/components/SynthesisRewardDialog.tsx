import type { RefObject } from 'react'
import { createPortal } from 'react-dom'
import type { Chapter1RewardId } from '../game/types'
import { useModalFocus } from '../hooks/useModalFocus'
import { GameAsset } from './GameAsset'

interface SynthesisRewardDialogProps {
  rewardId: Chapter1RewardId
  rewardName: string
  fallbackFocusRef: RefObject<HTMLElement | null>
  onClose: () => void
}

export function SynthesisRewardDialog({
  rewardId,
  rewardName,
  fallbackFocusRef,
  onClose,
}: SynthesisRewardDialogProps) {
  const dialogRef = useModalFocus<HTMLElement>(onClose, true, fallbackFocusRef)

  return createPortal(
    <div className="modal-backdrop bond-reward-backdrop" role="presentation" data-modal-layer="true">
      <section
        ref={dialogRef}
        className="bond-reward-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bond-reward-dialog-title"
        aria-describedby="bond-reward-dialog-copy"
        data-testid="synthesis-reward-dialog"
        data-reward-id={rewardId}
        tabIndex={-1}
      >
        <GameAsset
          assetId="equipment.ember-blade"
          purpose="card"
          decorative
          fallbackLabel="무기"
          className="bond-reward-dialog__art"
          loading="eager"
        />
        <div className="bond-reward-dialog__body">
          <p className="eyebrow">CHAPTER I · BOND REWARD</p>
          <h2 id="bond-reward-dialog-title">합동 연성 보상</h2>
          <strong>{rewardName}</strong>
          <p id="bond-reward-dialog-copy">
            수집 원장에 한 번만 기록되는 잿불 무기 카드입니다. 같은 연성으로 다시 지급되지 않습니다.
          </p>
          <small>{rewardId}</small>
          <button type="button" onClick={onClose} data-initial-focus>
            보상 확인
          </button>
        </div>
      </section>
    </div>,
    document.body,
  )
}
