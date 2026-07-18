import { formatDuration, formatNumber } from '../game/format'
import type { AdvanceReport } from '../game/types'
import { useModalFocus } from '../hooks/useModalFocus'

interface OfflineReportProps {
  report: AdvanceReport
  onClose: () => void
}

export function OfflineReport({ report, onClose }: OfflineReportProps) {
  const dialogRef = useModalFocus<HTMLElement>(onClose)
  return (
    <div className="modal-backdrop" role="presentation">
      <section
        ref={dialogRef}
        className="offline-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="offline-title"
        tabIndex={-1}
      >
        <div className="offline-modal__sigil" aria-hidden="true">✦</div>
        <p className="eyebrow">원정 복귀 보고</p>
        <h2 id="offline-title">쉬는 동안에도 검은 멈추지 않았습니다</h2>
        <p className="offline-modal__lead">{formatDuration(report.elapsedMs)} 동안의 자동 전투 결과입니다.</p>
        <dl>
          <div><dt>처치한 적</dt><dd>{formatNumber(report.kills)}</dd></div>
          <div><dt>획득 골드</dt><dd>{formatNumber(report.goldEarned)}</dd></div>
          <div><dt>획득 경험치</dt><dd>{formatNumber(report.xpEarned)}</dd></div>
          <div><dt>도달 스테이지</dt><dd>+{formatNumber(report.stagesGained)}</dd></div>
        </dl>
        <button type="button" onClick={onClose} data-initial-focus>보상 확인</button>
      </section>
    </div>
  )
}
