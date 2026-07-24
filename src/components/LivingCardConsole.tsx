import { useState } from 'react'
import type { CombatEventBatch, ExpeditionChoiceId, GameState } from '../game/types'
import { getEnemyDefinition } from '../game/content'
import { COMBAT_LOG_FILTER_IDS, createCombatLogView, getEventCopy } from './combatLogView'
import { GameAsset } from './GameAsset'

interface LivingCardConsoleProps {
  state: GameState
  batch: CombatEventBatch
  onChooseExpeditionEvent?: ((eventId: string, choiceId: ExpeditionChoiceId) => void) | undefined
}

const ALL_LOG_FILTERS = new Set(COMBAT_LOG_FILTER_IDS)

const H_STAGE_LABELS = [
  'H-Stage 0: Normal (완전 무결)',
  'H-Stage 1: Damaged (의상 1차 파손)',
  'H-Stage 2: Severe (파손 및 무력화)',
] as const
const H_STAGE_COLORS = ['#10B981', '#F59E0B', '#EF4444'] as const

export function LivingCardConsole({ state, batch, onChooseExpeditionEvent }: LivingCardConsoleProps) {
  const enemy = getEnemyDefinition(state.battle.stage)
  const livingCard = state.livingCards[enemy.assetId] ?? null

  const [isFlipped, setIsFlipped] = useState(false)
  const pendingEvent = state.expeditionEvents.pending[0]
  const recentLogItems = createCombatLogView(batch, ALL_LOG_FILTERS).items.slice(-5)

  return (
    <div
      data-living-console="true"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        height: '100%',
        background: 'rgba(20, 16, 14, 0.92)',
        borderRadius: '16px',
        padding: '16px',
        border: '1px solid rgba(255, 239, 214, 0.12)',
        backdropFilter: 'blur(16px)',
      }}
    >
      {/* 상단: 생체카드 - IRPG-801이 채운 실제 state.livingCards만 표시, 클라이언트에서 값을 지어내지 않음 */}
      <section
        style={{
          background: 'linear-gradient(145deg, #1c1714, #120e0c)',
          borderRadius: '12px',
          padding: '14px',
          border: '1px solid rgba(255, 180, 110, 0.15)',
        }}
      >
        <header style={{ marginBottom: '8px' }}>
          <p style={{ margin: 0, fontSize: '10px', color: '#ffb46e', letterSpacing: '0.15em', fontWeight: 'bold' }}>
            LIVING CARD & H-COSTUME STAGE
          </p>
          <h3 style={{ margin: '4px 0 0', fontSize: '18px', color: '#f6efe4', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{enemy.name}</span>
            {livingCard && (
              <span style={{ fontSize: '12px', color: H_STAGE_COLORS[livingCard.hStage], background: 'rgba(0,0,0,0.4)', padding: '2px 8px', borderRadius: '4px' }}>
                Stage {livingCard.hStage}
              </span>
            )}
          </h3>
        </header>

        {livingCard === null ? (
          <p
            data-testid="living-card-empty-state"
            style={{ margin: 0, fontSize: '12px', color: '#a89f94' }}
          >
            포획 진행 중인 대상이 없습니다.
          </p>
        ) : (
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div
              style={{
                width: '84px',
                height: '104px',
                borderRadius: '8px',
                background: '#0a0807',
                border: `1px solid ${H_STAGE_COLORS[livingCard.hStage]}`,
                overflow: 'hidden',
                display: 'grid',
                placeItems: 'center',
                position: 'relative',
              }}
            >
              <GameAsset
                assetId={enemy.assetId}
                purpose="card"
                fallbackLabel="C"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
              {livingCard.isCaptured && (
                <span style={{ position: 'absolute', bottom: '4px', right: '4px', fontSize: '10px', background: '#EF4444', color: '#fff', padding: '1px 4px', borderRadius: '3px', fontWeight: 'bold' }}>
                  포획됨
                </span>
              )}
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '12px', fontWeight: 'bold', color: H_STAGE_COLORS[livingCard.hStage], marginBottom: '6px' }}>
                {H_STAGE_LABELS[livingCard.hStage]}
              </div>

              <div style={{ marginBottom: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#a89f94', marginBottom: '2px' }}>
                  <span>충성도</span>
                  <strong style={{ color: '#ffb46e' }}>{livingCard.captureLoyalty}%</strong>
                </div>
                <div style={{ height: '6px', width: '100%', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${livingCard.captureLoyalty}%`, background: 'linear-gradient(90deg, #ee7d3d, #ffb46e)' }} />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#a89f94', marginBottom: '2px' }}>
                  <span>타락 농도</span>
                  <strong style={{ color: '#d95d54' }}>{livingCard.corruptionLevel}%</strong>
                </div>
                <div style={{ height: '6px', width: '100%', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${livingCard.corruptionLevel}%`, background: 'linear-gradient(90deg, #b8f0e0, #d95d54)' }} />
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 중앙: 원정 카드 덱 - 이미 실제 state.expeditionEvents 기반, 변경 없음 */}
      <section
        style={{
          background: 'linear-gradient(145deg, #1c1714, #120e0c)',
          borderRadius: '12px',
          padding: '14px',
          border: '1px solid rgba(104, 201, 180, 0.15)',
        }}
      >
        <header style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ margin: 0, fontSize: '10px', color: '#68c9b4', letterSpacing: '0.15em', fontWeight: 'bold' }}>
              EXPEDITION DECK FLIP
            </p>
            <h4 style={{ margin: '2px 0 0', fontSize: '14px', color: '#f6efe4' }}>원정 인카운터 덱</h4>
          </div>
          <button
            type="button"
            onClick={() => setIsFlipped(!isFlipped)}
            style={{
              padding: '4px 10px',
              fontSize: '11px',
              borderRadius: '6px',
              background: '#2b231e',
              border: '1px solid #68c9b4',
              color: '#68c9b4',
              cursor: 'pointer',
            }}
          >
            {isFlipped ? '덱 덮기' : '카드 뒤집기'}
          </button>
        </header>

        {isFlipped || pendingEvent ? (
          <div style={{ background: 'rgba(0,0,0,0.4)', borderRadius: '8px', padding: '10px', marginTop: '6px' }}>
            <p style={{ margin: '0 0 6px', fontSize: '12px', color: '#ffb46e', fontWeight: 'bold' }}>
              ✦ {pendingEvent ? `대기 이벤트: ${pendingEvent.eventId}` : '신비한 불씨 제단 인카운터'}
            </p>
            <p style={{ margin: 0, fontSize: '11px', color: '#a89f94' }}>
              원정 중 조우한 신비한 덱 카드 선택지를 통해 골드 또는 체력 회복 보상을 획득할 수 있습니다.
            </p>
            {pendingEvent && onChooseExpeditionEvent && (
              <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => onChooseExpeditionEvent(pendingEvent.eventId, 'gold')}
                  style={{ flex: 1, padding: '6px', fontSize: '11px', background: '#ee7d3d', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                  골드 탐색
                </button>
                <button
                  type="button"
                  onClick={() => onChooseExpeditionEvent(pendingEvent.eventId, 'recovery')}
                  style={{ flex: 1, padding: '6px', fontSize: '11px', background: '#68c9b4', color: '#100d0c', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  휴식 및 회복
                </button>
              </div>
            )}
          </div>
        ) : (
          <p style={{ margin: 0, fontSize: '12px', color: '#a89f94' }}>
            카드를 클릭하거나 뒤집어 대기 중인 원정 인카운터 이벤트를 확인하세요.
          </p>
        )}
      </section>

      {/* 하단: 실시간 전투 이벤트 로그 - CombatLogPanel과 동일한 실제 이벤트 포맷터 재사용 */}
      <section
        style={{
          flex: 1,
          background: 'linear-gradient(145deg, #1c1714, #120e0c)',
          borderRadius: '12px',
          padding: '14px',
          border: '1px solid rgba(255, 239, 214, 0.08)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <header style={{ marginBottom: '8px' }}>
          <p style={{ margin: 0, fontSize: '10px', color: '#a89f94', letterSpacing: '0.15em', fontWeight: 'bold' }}>
            LIVE COMBAT LOGS
          </p>
          <h4 style={{ margin: '2px 0 0', fontSize: '14px', color: '#f6efe4' }}>전술 전투 기록</h4>
        </header>

        {recentLogItems.length === 0 ? (
          <p
            data-testid="living-console-log-empty-state"
            style={{ margin: 0, fontSize: '12px', color: '#a89f94' }}
          >
            아직 기록된 전투 이벤트가 없습니다.
          </p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {recentLogItems.map((item) => (
              <li
                key={item.event.id}
                style={{
                  fontSize: '11px',
                  color: '#d4ceb8',
                  background: 'rgba(255,255,255,0.025)',
                  padding: '6px 8px',
                  borderRadius: '4px',
                  borderLeft: '3px solid #ee7d3d',
                }}
              >
                {getEventCopy(item).text}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
