import { useRef } from 'react'
import type { CombatEventBatch } from '../game/types'
import { useCombatResults } from '../hooks/useCombatResults'
import { CombatResultDialog } from './CombatResultDialog'
import { CombatResultTrigger } from './CombatResultTrigger'
import type { CombatResultSnapshot } from './combatResultView'

interface CombatResultRegionProps {
  batch: CombatEventBatch
  streamGeneration: number
}

function getResultLabel(result: CombatResultSnapshot) {
  return result.type === 'bossVictory'
    ? `스테이지 ${result.defeatedStage} 보스 승리`
    : `스테이지 ${result.defeatedAtStage} 패배 · 스테이지 ${result.returnStage} 복귀`
}

export function CombatResultRegion({
  batch,
  streamGeneration,
}: CombatResultRegionProps) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const results = useCombatResults(batch, streamGeneration)
  const newestFirst = [...results.queue].reverse()
  const latest = newestFirst[0]

  return (
    <>
      <section className="panel combat-result-region" aria-labelledby="combat-result-heading">
        <div className="combat-result-region__header">
          <div>
            <p className="eyebrow">BATTLE OUTCOMES</p>
            <h2 id="combat-result-heading" ref={headingRef} tabIndex={-1}>승패 결과</h2>
            <p className="combat-result-region__summary">
              최근 결과 {results.queue.length}건
              {results.overflowCount > 0
                ? ` · 이전 결과 ${results.overflowCount}건 요약`
                : ' · 이전 결과 없음'}
            </p>
          </div>
          {latest && (
            <span className={`combat-result-region__latest combat-result-region__latest--${latest.type}`}>
              {latest.type === 'bossVictory' ? '최근 승리' : '최근 패배'}
            </span>
          )}
        </div>

        <p
          className="sr-only"
          role="status"
          aria-live="polite"
          aria-atomic="true"
          data-testid="combat-result-announcement"
        >
          {results.announcement}
        </p>

        {newestFirst.length === 0 ? (
          <p className="combat-result-region__empty">
            아직 보스 승리 또는 패배 결과가 없습니다. 자동 전투는 계속 진행됩니다.
          </p>
        ) : (
          <ol className="combat-result-list" data-testid="combat-result-list">
            {newestFirst.map((result) => (
              <li key={result.id} className={`combat-result-card combat-result-card--${result.type}`}>
                <div>
                  <span>{result.type === 'bossVictory' ? '보스 승리' : '패배'}</span>
                  <strong>{getResultLabel(result)}</strong>
                  <small>라운드 {result.roundSequence} · 정산 완료</small>
                </div>
                <CombatResultTrigger
                  resultId={result.id}
                  label={`${getResultLabel(result)} 상세 보기`}
                  fallbackFocusRef={headingRef}
                  onOpen={results.openResult}
                />
              </li>
            ))}
          </ol>
        )}
      </section>

      {results.pinnedResult && (
        <CombatResultDialog
          result={results.pinnedResult}
          fallbackFocusRef={headingRef}
          onClose={results.closeResult}
        />
      )}
    </>
  )
}
