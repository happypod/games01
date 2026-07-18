import type { RefObject } from 'react'
import { useModalFocus } from '../hooks/useModalFocus'
import type { CombatResultSnapshot } from './combatResultView'
import { GameAsset } from './GameAsset'

interface CombatResultDialogProps {
  result: CombatResultSnapshot
  fallbackFocusRef: RefObject<HTMLElement | null>
  onClose: () => void
}

function formatResultNumber(value: number) {
  return Math.floor(value).toLocaleString('ko-KR')
}

function getProgressCopy(result: Extract<CombatResultSnapshot, { type: 'bossVictory' }>) {
  return result.nextStage > result.defeatedStage
    ? `다음 스테이지 ${formatResultNumber(result.nextStage)}`
    : `최종 스테이지 ${formatResultNumber(result.nextStage)} 유지`
}

export function CombatResultDialog({
  result,
  fallbackFocusRef,
  onClose,
}: CombatResultDialogProps) {
  const dialogRef = useModalFocus<HTMLElement>(onClose, true, fallbackFocusRef)
  const victory = result.type === 'bossVictory'
  const title = victory
    ? `스테이지 ${formatResultNumber(result.defeatedStage)} 보스 승리`
    : `스테이지 ${formatResultNumber(result.defeatedAtStage)} 패배`

  return (
    <div className="modal-backdrop combat-result-backdrop" role="presentation">
      <section
        ref={dialogRef}
        className={`combat-result-dialog combat-result-dialog--${victory ? 'victory' : 'defeat'}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="combat-result-dialog-title"
        aria-describedby="combat-result-dialog-lead"
        data-testid="combat-result-dialog"
        data-result-type={result.type}
        tabIndex={-1}
      >
        <GameAsset
          assetId={victory ? 'result.boss-victory' : 'result.defeat'}
          purpose="result"
          decorative
          fallbackLabel={victory ? '승' : '패'}
          className="combat-result-dialog__art"
          loading="eager"
        />

        <div className="combat-result-dialog__body">
          <p className="eyebrow">{victory ? 'BOSS CONQUERED' : 'EXPEDITION RETREAT'}</p>
          <h2 id="combat-result-dialog-title">{title}</h2>
          <p id="combat-result-dialog-lead" className="combat-result-dialog__lead">
            {victory
              ? '엔진에서 확정된 전투 보상과 진행 결과입니다.'
              : '최고 기록은 유지되며 아래 스테이지에서 원정을 계속합니다.'}
          </p>

          {victory ? (
            <>
              <dl className="combat-result-dialog__facts">
                <div>
                  <dt>기본 골드 정산값</dt>
                  <dd>+{formatResultNumber(result.gold)}</dd>
                </div>
                <div>
                  <dt>기본 경험치 정산값</dt>
                  <dd>+{formatResultNumber(result.xp)} XP</dd>
                </div>
                <div>
                  <dt>원정 진행</dt>
                  <dd>{getProgressCopy(result)}</dd>
                </div>
                <div>
                  <dt>정산 뒤 보유 골드</dt>
                  <dd>{formatResultNumber(result.balanceGold)}</dd>
                </div>
              </dl>

              <div className="combat-result-dialog__milestone">
                <h3>최초 승리 보상</h3>
                {result.milestoneReward === null ? (
                  <p>추가 최초 승리 보상 없음 · 정산 완료</p>
                ) : (
                  <>
                    <p>
                      실제 지급 <strong>+{formatResultNumber(result.milestoneReward.appliedGold)} 골드</strong>
                    </p>
                    {result.milestoneReward.appliedGold !== result.milestoneReward.configuredGold && (
                      <p className="combat-result-dialog__cap-note">
                        설정 {formatResultNumber(result.milestoneReward.configuredGold)} 골드 중 보유 상한까지 적용
                      </p>
                    )}
                    <small>
                      {result.milestoneReward.tableId} · 스테이지 {formatResultNumber(result.milestoneReward.milestoneStage)}
                    </small>
                  </>
                )}
              </div>
            </>
          ) : (
            <dl className="combat-result-dialog__facts">
              <div>
                <dt>패배 스테이지</dt>
                <dd>{formatResultNumber(result.defeatedAtStage)}</dd>
              </div>
              <div>
                <dt>복귀 스테이지</dt>
                <dd>{formatResultNumber(result.returnStage)}</dd>
              </div>
              <div>
                <dt>유지된 최고 기록</dt>
                <dd>{formatResultNumber(result.highestStage)}</dd>
              </div>
              <div>
                <dt>마지막 피해</dt>
                <dd>{formatResultNumber(result.damage)}</dd>
              </div>
            </dl>
          )}

          <button type="button" onClick={onClose} data-initial-focus>
            결과 닫기
          </button>
        </div>
      </section>
    </div>
  )
}
