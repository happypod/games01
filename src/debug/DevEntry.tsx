import { useEffect, useState } from 'react'
import { App } from '../App'
import { DebugSessionApp } from './DebugSessionApp'
import './debug.css'

export const IRPG507_DEBUG_SENTINEL = 'IRPG507_DEBUG_PANEL'
const DEBUG_SESSION_KEY = 'emberwatch.irpg507.debug-session'
type DevelopmentPhase = 'normal' | 'releasing-writer' | 'debug'

function hasDebugSessionMarker() {
  try {
    return window.sessionStorage.getItem(DEBUG_SESSION_KEY) === 'active'
  } catch {
    return false
  }
}

function setDebugSessionMarker(active: boolean) {
  try {
    if (active) window.sessionStorage.setItem(DEBUG_SESSION_KEY, 'active')
    else window.sessionStorage.removeItem(DEBUG_SESSION_KEY)
    return hasDebugSessionMarker() === active
  } catch {
    return false
  }
}

export function DevEntry() {
  const [phase, setPhase] = useState<DevelopmentPhase>(() =>
    hasDebugSessionMarker() ? 'debug' : 'normal',
  )
  const [markerError, setMarkerError] = useState('')

  useEffect(() => {
    if (phase !== 'releasing-writer') return
    const transitionTimer = window.setTimeout(() => setPhase('debug'), 0)
    return () => window.clearTimeout(transitionTimer)
  }, [phase])

  const startDebugSession = () => {
    const confirmed = window.confirm(
      '개발자 패널을 시작하면 아직 자동 저장되지 않은 최근 진행은 기준 상태에 포함되지 않을 수 있습니다. 정상 저장과 분리된 세션을 시작할까요?',
    )
    if (!confirmed) return
    if (!setDebugSessionMarker(true)) {
      setMarkerError('브라우저가 세션 저장소를 차단해 안전한 디버그 세션을 시작할 수 없습니다.')
      return
    }
    setMarkerError('')
    setPhase('releasing-writer')
  }

  const exitDebugSession = () => {
    if (!setDebugSessionMarker(false)) {
      window.alert('세션 표시를 지우지 못했습니다. 페이지를 닫기 전 브라우저 저장소 권한을 확인해 주세요.')
      return
    }
    setPhase('normal')
  }

  if (phase === 'debug') return <DebugSessionApp onExit={exitDebugSession} />
  if (phase === 'releasing-writer') {
    return <p className="debug-transition" role="status">저장 writer를 해제하고 격리 세션을 준비하고 있습니다.</p>
  }

  return (
    <>
      <App />
      <aside
        className="debug-launcher"
        aria-label="개발 도구"
        data-debug-sentinel={IRPG507_DEBUG_SENTINEL}
      >
        <button type="button" onClick={startDebugSession}>개발자 패널</button>
        {markerError && <p role="alert">{markerError}</p>}
      </aside>
    </>
  )
}
