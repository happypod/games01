import { useMemo, type RefObject } from 'react'
import type { GameState } from '../game/types'
import { COMPANION_DEFINITIONS, getEnemyDefinition, getEnemyPresentationAssetId } from '../game/content'
import { getCompanionDamage, getHeroStats } from '../game/formulas'
import { GameAsset } from './GameAsset'
import { StatBar } from './StatBar'

interface TacticalCardStageProps {
  state: GameState
  presentation?: { playerHp: number; enemyHp: number } | null
  latestDamage?: { amount: number; isCritical: boolean; timestamp: number } | null
  heroAssetRef?: RefObject<HTMLDivElement | null>
  enemyAssetRef?: RefObject<HTMLDivElement | null>
  companionAssetRef?: RefObject<HTMLDivElement | null>
  heroMotionClass?: string | null
  enemyMotionClass?: string | null
  companionMotionClass?: string | null
  enemyDamageLabel?: string | null
}

export function TacticalCardStage({
  state,
  presentation,
  latestDamage,
  heroAssetRef,
  enemyAssetRef,
  companionAssetRef,
  heroMotionClass,
  enemyMotionClass,
  companionMotionClass,
  enemyDamageLabel,
}: TacticalCardStageProps) {
  const enemyDef = useMemo(() => getEnemyDefinition(state.battle.stage), [state.battle.stage])
  const heroStats = useMemo(() => getHeroStats(state), [state])

  const currentPlayerHp = presentation?.playerHp ?? state.player.currentHp
  const currentEnemyHp = presentation?.enemyHp ?? state.battle.enemyHp

  // HP 비율 기반 3단계 H-Costume 파손 로직
  const heroHpPct = Math.max(0, Math.min(100, (currentPlayerHp / heroStats.maxHp) * 100))
  const enemyHpPct = Math.max(0, Math.min(100, (currentEnemyHp / enemyDef.maxHp) * 100))

  const heroHStage = heroHpPct >= 70 ? 0 : heroHpPct >= 30 ? 1 : 2
  const enemyHStage = enemyHpPct >= 70 ? 0 : enemyHpPct >= 30 ? 1 : 2

  const companionId = state.player.companion.id
  const companion = companionId === null ? null : COMPANION_DEFINITIONS[companionId]
  const companionDamage = getCompanionDamage(state)

  return (
    <div className="tactical-card-stage" data-testid="tactical-card-stage" style={{ position: 'relative', width: '100%', marginTop: '52px', boxSizing: 'border-box', overflow: 'hidden' }}>
      <div className="tactical-card-stage__bg" />

      {/* 데미지 플로팅 팝업 Juice */}
      {latestDamage && (
        <div
          key={latestDamage.timestamp}
          className={`animate-float-damage text-damage-popup ${
            latestDamage.isCritical ? 'text-damage-critical' : ''
          }`}
          style={{ position: 'absolute', top: '35%', left: '65%', zIndex: 30 }}
        >
          {latestDamage.isCritical ? 'CRITICAL! ' : ''}-{latestDamage.amount}
        </div>
      )}

      <div className="tactical-card-stage__grid" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', boxSizing: 'border-box', padding: '0 8px' }}>
        {/* 영웅 측 (왼쪽) */}
        <div className="tactical-card-stage__hero-side tactical-actor tactical-actor--hero" style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: '1', maxWidth: '45%', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
            {/* 동료 난입 연출 */}
            {companion && (
              <div className="animate-slide-in-left tactical-companion" style={{ opacity: 0.9 }}>
                <GameAsset
                  assetId={companion.assetId}
                  fallbackLabel={companion.name}
                  className={`h-costume--stage-0 tactical-companion__asset ${companionMotionClass ?? ''}`}
                  containerRef={companionAssetRef as React.Ref<HTMLDivElement>}
                  style={{ width: '50px', height: '65px', borderRadius: '6px' }}
                />
                <div style={{ fontSize: '9px', color: '#a89f94', marginTop: '2px' }}>
                  <span>{companion.name} · Rank {state.player.companion.rank}</span>
                  <br />
                  <strong>협공 {companionDamage.toLocaleString('ko-KR')}</strong>
                </div>
              </div>
            )}

            <div className={`h-costume--stage-${heroHStage}`} style={{ position: 'relative' }}>
              <GameAsset
                assetId="hero.ashen-knight.default"
                fallbackLabel="아렌"
                className={`tactical-actor__asset tactical-actor__asset--hero ${heroMotionClass ?? ''}`}
                containerRef={heroAssetRef as React.Ref<HTMLDivElement>}
                style={{ width: '85px', height: '110px', borderRadius: '8px' }}
              />
              <div style={{ marginTop: '2px', textAlign: 'center' }}>
                <span className={`h-stage-badge h-stage-badge--stage-${heroHStage}`}>
                  H-Stage {heroHStage}
                </span>
              </div>
            </div>
          </div>

          <div className="tactical-actor__copy" style={{ background: 'rgba(0,0,0,0.5)', padding: '6px 8px', borderRadius: '6px', border: '1px solid rgba(255,239,214,0.1)', width: '100%', boxSizing: 'border-box' }}>
            <span>방랑 기사 · Lv. {state.player.level}</span>
            <h3 style={{ margin: '2px 0 4px', fontSize: '13px', fontWeight: 'bold', color: '#f6efe4' }}>아렌</h3>
            <StatBar
              label="영웅 체력"
              value={currentPlayerHp}
              maximum={heroStats.maxHp}
              tone="health"
            />
          </div>
        </div>

        {/* 대치 VS 라벨 */}
        <div style={{ alignSelf: 'center', opacity: 0.4, padding: '0 4px' }} className="text-status-val">
          VS
        </div>

        {/* 적 측 (오른쪽 - Flex 배치) */}
        <div className={`tactical-card-stage__enemy-side tactical-actor tactical-actor--enemy ${enemyDef.isBoss ? 'tactical-actor--boss' : ''}`} style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: '1', maxWidth: '45%', alignItems: 'flex-end', boxSizing: 'border-box' }}>
          <div className={`h-costume--stage-${enemyHStage} ${latestDamage ? 'animate-hit-flash' : ''}`}>
            <GameAsset
              assetId={getEnemyPresentationAssetId(enemyDef.assetId, currentEnemyHp, enemyDef.maxHp)}
              fallbackLabel={enemyDef.name}
              className={`tactical-actor__asset tactical-actor__asset--enemy ${enemyMotionClass ?? ''}`}
              containerRef={enemyAssetRef as React.Ref<HTMLDivElement>}
              style={{ width: enemyDef.isBoss ? '100px' : '75px', height: enemyDef.isBoss ? '120px' : '95px', borderRadius: '8px' }}
            />
            {enemyDamageLabel && (
              <p
                className="tactical-actor__damage-state"
                style={{ fontSize: '10px', color: '#ef4444', textAlign: 'center', margin: '2px 0 0' }}
              >
                {enemyDamageLabel}
              </p>
            )}
            <div style={{ marginTop: '2px', textAlign: 'center' }}>
              <span className={`h-stage-badge h-stage-badge--stage-${enemyHStage}`}>
                {enemyDef.isBoss ? 'BOSS ' : ''}H-Stage {enemyHStage}
              </span>
            </div>
          </div>

          <div className="tactical-actor__copy" style={{ background: 'rgba(0,0,0,0.5)', padding: '6px 8px', borderRadius: '6px', border: '1px solid rgba(255,239,214,0.1)', width: '100%', boxSizing: 'border-box' }}>
            <span>{enemyDef.isBoss ? '지역 수호자' : '야생의 위협'}</span>
            <h3 style={{ margin: '2px 0 4px', fontSize: '13px', fontWeight: 'bold', color: '#f6efe4' }}>{enemyDef.name}</h3>
            <StatBar
              label="적 체력"
              value={currentEnemyHp}
              maximum={enemyDef.maxHp}
              tone="enemy"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
