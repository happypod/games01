import { useState, type FormEvent } from 'react'
import { DEBUG_SPEEDS, type DebugSpeed } from '../game/debugSimulator'
import type { GameState } from '../game/types'

interface DebugPanelProps {
  state: GameState
  speed: DebugSpeed
  onSpeedChange: (speed: DebugSpeed) => void
  onSetStage: (stage: number) => void
  onSetResources: (gold: number, skillPoints: number, essence: number) => void
  onApplyOffline: (minutes: number) => void
  onReset: () => void
  onExit: () => void
}

interface PanelMessage {
  kind: 'status' | 'alert'
  text: string
}

const MAX_SAFE_VALUE = String(Number.MAX_SAFE_INTEGER)

function parseNumericInput(raw: string, label: string) {
  if (raw.trim() === '') throw new RangeError(`${label} 값을 입력해 주세요.`)
  return Number(raw)
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : '디버그 값을 적용하지 못했습니다.'
}

export function DebugPanel({
  state,
  speed,
  onSpeedChange,
  onSetStage,
  onSetResources,
  onApplyOffline,
  onReset,
  onExit,
}: DebugPanelProps) {
  const [stage, setStage] = useState(String(state.battle.stage))
  const [gold, setGold] = useState(String(state.player.gold))
  const [skillPoints, setSkillPoints] = useState(String(state.player.skillPoints))
  const [essence, setEssence] = useState(String(state.player.essence))
  const [offlineMinutes, setOfflineMinutes] = useState('0')
  const [message, setMessage] = useState<PanelMessage>({
    kind: 'status',
    text: '저장과 격리된 디버그 세션입니다.',
  })

  const attempt = (action: () => void, success: string) => {
    try {
      action()
      setMessage({ kind: 'status', text: success })
    } catch (error) {
      setMessage({ kind: 'alert', text: getErrorMessage(error) })
    }
  }

  const submitStage = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    attempt(
      () => onSetStage(parseNumericInput(stage, '스테이지')),
      `${stage} 스테이지 상태를 재현했습니다.`,
    )
  }

  const submitResources = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    attempt(
      () => onSetResources(
        parseNumericInput(gold, '골드'),
        parseNumericInput(skillPoints, '스킬 포인트'),
        parseNumericInput(essence, '불씨 정수'),
      ),
      '자원 fixture를 적용했습니다.',
    )
  }

  const submitOffline = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    attempt(
      () => onApplyOffline(parseNumericInput(offlineMinutes, '오프라인 시간')),
      `${offlineMinutes}분의 오프라인 진행을 적용했습니다.`,
    )
  }

  const resetSession = () => {
    if (!window.confirm('모든 디버그 변경을 버리고 저장된 기준 상태로 돌아갈까요?')) return
    onReset()
    setMessage({ kind: 'status', text: '저장된 기준 상태로 초기화했습니다.' })
  }

  const exitSession = () => {
    if (!window.confirm('디버그 변경을 버리고 정상 게임으로 돌아갈까요?')) return
    onExit()
  }

  return (
    <section className="debug-panel" aria-labelledby="debug-panel-title" data-testid="debug-panel">
      <div className="debug-panel__header">
        <div>
          <p className="eyebrow">IRPG-507 · MEMORY ONLY</p>
          <h2 id="debug-panel-title">개발자 패널</h2>
        </div>
        <div className="debug-panel__actions">
          <button type="button" onClick={resetSession}>세션 초기화</button>
          <button type="button" onClick={exitSession}>정상 게임으로 종료</button>
        </div>
      </div>

      <div className="debug-panel__summary" aria-label="현재 디버그 상태">
        <span>배속 <strong>{speed}x</strong></span>
        <span>스테이지 <strong>{state.battle.stage}</strong></span>
        <span>골드 <strong>{state.player.gold}</strong></span>
        <span>SP <strong>{state.player.skillPoints}</strong></span>
        <span>정수 <strong>{state.player.essence}</strong></span>
      </div>

      <div className="debug-panel__grid">
        <fieldset>
          <legend>실시간 배속</legend>
          <div className="debug-speed-options">
            {DEBUG_SPEEDS.map((value) => (
              <label key={value}>
                <input
                  type="radio"
                  name="debug-speed"
                  value={value}
                  checked={speed === value}
                  onChange={() => {
                    onSpeedChange(value)
                    setMessage({ kind: 'status', text: `${value}x 배속을 적용했습니다.` })
                  }}
                />
                {value}x
              </label>
            ))}
          </div>
        </fieldset>

        <form onSubmit={submitStage}>
          <label htmlFor="debug-stage">스테이지 (1–300)</label>
          <div className="debug-input-action">
            <input id="debug-stage" name="stage" type="text" inputMode="numeric" value={stage} onChange={(event) => setStage(event.target.value)} />
            <button type="submit">이동</button>
          </div>
        </form>

        <form className="debug-resource-form" onSubmit={submitResources}>
          <label htmlFor="debug-gold">골드</label>
          <input id="debug-gold" name="gold" type="text" inputMode="numeric" aria-describedby="debug-resource-limit" value={gold} onChange={(event) => setGold(event.target.value)} />
          <label htmlFor="debug-skill-points">스킬 포인트</label>
          <input id="debug-skill-points" name="skillPoints" type="text" inputMode="numeric" aria-describedby="debug-resource-limit" value={skillPoints} onChange={(event) => setSkillPoints(event.target.value)} />
          <label htmlFor="debug-essence">불씨 정수</label>
          <input id="debug-essence" name="essence" type="text" inputMode="numeric" aria-describedby="debug-resource-limit" value={essence} onChange={(event) => setEssence(event.target.value)} />
          <small id="debug-resource-limit">허용 범위 0–{MAX_SAFE_VALUE}</small>
          <button type="submit">자원 적용</button>
        </form>

        <form onSubmit={submitOffline}>
          <label htmlFor="debug-offline">오프라인 시간 (0–480분)</label>
          <div className="debug-input-action">
            <input id="debug-offline" name="offlineMinutes" type="text" inputMode="numeric" value={offlineMinutes} onChange={(event) => setOfflineMinutes(event.target.value)} />
            <button type="submit">진행 적용</button>
          </div>
        </form>
      </div>

      <p
        className={message.kind === 'alert' ? 'debug-panel__message debug-panel__message--error' : 'debug-panel__message'}
        role={message.kind}
        aria-live="polite"
      >
        {message.text}
      </p>
    </section>
  )
}
