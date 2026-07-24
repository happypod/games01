import { useState } from 'react'
import type { ExpeditionChoiceId, GameState } from '../game/types'
import { getEnemyDefinition } from '../game/content'
import { GameAsset } from './GameAsset'

interface LivingCardConsoleProps {
  state: GameState
  onChooseExpeditionEvent?: ((eventId: string, choiceId: ExpeditionChoiceId) => void) | undefined
}

export function LivingCardConsole({ state, onChooseExpeditionEvent }: LivingCardConsoleProps) {
  const enemy = getEnemyDefinition(state.battle.stage)
  const enemyMaxHp = enemy ? enemy.maxHp : 100
  const enemyCurrentHp = state.battle.enemyHp
  const enemyHpRatio = Math.max(0, Math.min(1, enemyCurrentHp / enemyMaxHp))

  // HP 연동 H-Stage 계산 (0: HP >= 70%, 1: 30% <= HP < 70%, 2: HP < 30%)
  const damageStage: 0 | 1 | 2 =
    enemyHpRatio >= 0.7 ? 0 : enemyHpRatio >= 0.3 ? 1 : 2

  const stageLabels = [
    'H-Stage 0: Normal (완전 무결)',
    'H-Stage 1: Damaged (의상 1차 파손)',
    'H-Stage 2: Severe (파손 및 무력화)',
  ]
  const stageColors = ['#10B981', '#F59E0B', '#EF4444']

  const enemyAssetId = enemy
    ? damageStage === 1
      ? `${enemy.assetId}.damaged`
      : damageStage === 2
        ? `${enemy.assetId}.severe`
        : enemy.assetId
    : 'enemy.ash-slime'

  // 충성도 및 타락 게이지 계산
  const currentCardState = state.livingCards[enemy?.assetId ?? ''] ?? {
    cardId: enemy?.assetId ?? 'default',
    hStage: damageStage,
    captureLoyalty: Math.min(100, Math.round((1 - enemyHpRatio) * 100)),
    corruptionLevel: Math.min(100, state.battle.stage * 3),
    isCaptured: damageStage === 2,
  }

  // 덱 플립 카드 선택 상태
  const [isFlipped, setIsFlipped] = useState(false)
  const pendingEvent = state.expeditionEvents.pending[0]

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
        pointerEvents: 'none',
      }}
    >
      {/* 상단: 19금 H-Stage 카드 비주얼 및 포획/충성도 바 */}
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
            <span>{enemy?.name ?? '타겟 정보'}</span>
            <span style={{ fontSize: '12px', color: stageColors[damageStage], background: 'rgba(0,0,0,0.4)', padding: '2px 8px', borderRadius: '4px' }}>
              Stage {damageStage}
            </span>
          </h3>
        </header>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div
            style={{
              width: '84px',
              height: '104px',
              borderRadius: '8px',
              background: '#0a0807',
              border: `1px solid ${stageColors[damageStage]}`,
              overflow: 'hidden',
              display: 'grid',
              placeItems: 'center',
              position: 'relative',
            }}
          >
            <GameAsset
              assetId={enemyAssetId}
              purpose="card"
              fallbackLabel="C"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
            {currentCardState.isCaptured && (
              <span style={{ position: 'absolute', bottom: '4px', right: '4px', fontSize: '10px', background: '#EF4444', color: '#fff', padding: '1px 4px', borderRadius: '3px', fontWeight: 'bold' }}>
                포획됨
              </span>
            )}
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '12px', fontWeight: 'bold', color: stageColors[damageStage], marginBottom: '6px' }}>
              {stageLabels[damageStage]}
            </div>

            {/* 타락 포획 & 충성도 게이지 바 */}
            <div style={{ marginBottom: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#a89f94', marginBottom: '2px' }}>
                <span>포획 복종도</span>
                <strong style={{ color: '#ffb46e' }}>{currentCardState.captureLoyalty}%</strong>
              </div>
              <div style={{ height: '6px', width: '100%', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${currentCardState.captureLoyalty}%`, background: 'linear-gradient(90deg, #ee7d3d, #ffb46e)' }} />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#a89f94', marginBottom: '2px' }}>
                <span>타락 농도 (Corruption)</span>
                <strong style={{ color: '#d95d54' }}>{currentCardState.corruptionLevel}%</strong>
              </div>
              <div style={{ height: '6px', width: '100%', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${currentCardState.corruptionLevel}%`, background: 'linear-gradient(90deg, #b8f0e0, #d95d54)' }} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 중앙: 원정 카드 덱 Flip & 선택지 모달 호출 컨트롤 */}
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
              pointerEvents: 'auto',
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
                  style={{ flex: 1, padding: '6px', fontSize: '11px', background: '#ee7d3d', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', pointerEvents: 'auto' }}
                >
                  골드 탐색
                </button>
                <button
                  type="button"
                  onClick={() => onChooseExpeditionEvent(pendingEvent.eventId, 'recovery')}
                  style={{ flex: 1, padding: '6px', fontSize: '11px', background: '#68c9b4', color: '#100d0c', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', pointerEvents: 'auto' }}
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

      {/* 하단: 실시간 전투 이벤트 로그 콘솔 (최근 5줄 고정) */}
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

        <ul style={{ listStyle: 'none', padding: 0, margin: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {[
            { id: '1', text: `영웅 아렌이 ${enemy?.name ?? '적'}에게 ${state.player.level * 15} 피해를 입혔습니다.` },
            { id: '2', text: `적 ${enemy?.name ?? '적'}이 아렌에게 ${enemy?.attack ?? 5} 피해를 입혔습니다.` },
            { id: '3', text: `동료 루미가 협공 사격을 지원했습니다.` },
            { id: '4', text: `H-Stage ${damageStage} 단계 연출이 전환되었습니다.` },
            { id: '5', text: `Schema 5 전투 세션 진행 중...` },
          ].map((log) => (
            <li
              key={log.id}
              style={{
                fontSize: '11px',
                color: '#d4ceb8',
                background: 'rgba(255,255,255,0.025)',
                padding: '6px 8px',
                borderRadius: '4px',
                borderLeft: '3px solid #ee7d3d',
              }}
            >
              {log.text}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
