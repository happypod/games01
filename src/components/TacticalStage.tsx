import { useLayoutEffect, useRef, useState } from 'react'
import {
  COMPANION_ATTACK_INTERVAL_MS,
  COMPANION_DEFINITIONS,
  getEnemyDefinition,
  getEnemyPresentationDamageState,
  getEnemyPresentationAssetId,
} from '../game/content'
import { getCompanionDamage, getHeroStats } from '../game/formulas'
import {
  getStageNodes,
  getStageRegionForStage,
} from '../game/stageMap'
import type {
  CombatEventBatch,
  ExpeditionChoiceId,
  GameState,
} from '../game/types'
import type { GameCommandFeedback } from '../hooks/useGame'
import { useTacticalStageEffects } from '../hooks/useTacticalStageEffects'
import {
  useTacticalMotionTriggers,
  type TacticalMotionClass,
} from '../hooks/useTacticalMotionTriggers'
import { ExpeditionEventPanel } from './ExpeditionEventPanel'
import { GameAsset } from './GameAsset'
import { StatBar } from './StatBar'
import {
  projectTacticalScenePresentation,
  TACTICAL_DAMAGE_POPUP_DURATION_MS,
} from './tacticalScenePresentation'
import { getEnemyDamageStateLabel } from './enemyDamagePresentation'

interface TacticalStageProps {
  state: GameState
  batch: CombatEventBatch
  streamGeneration: number
  notice: string
  onChooseStage: (stage: number) => void
  onChooseExpeditionEvent: (
    eventId: string,
    choiceId: ExpeditionChoiceId,
  ) => GameCommandFeedback
  disabled?: boolean
  disabledReason?: string
}

function getStageLabel(
  stage: number,
  currentStage: number,
  highestStage: number,
  isBoss: boolean,
) {
  const labels = [`스테이지 ${stage}`]
  if (isBoss) labels.push('보스')
  if (stage === currentStage) labels.push('현재 위치')
  else if (stage < highestStage) labels.push('완료')
  else if (stage === highestStage) labels.push('최전선')
  else labels.push(`잠김, 현재 최고 ${highestStage}`)
  return labels.join(', ')
}

function getOutcomeCopy(type: 'bossVictory' | 'defeat') {
  return type === 'bossVictory' ? '보스 승리' : '원정 패배'
}

export function TacticalStage({
  state,
  batch,
  streamGeneration,
  notice,
  onChooseStage,
  onChooseExpeditionEvent,
  disabled = false,
  disabledReason,
}: TacticalStageProps) {
  const hasPendingEvent = state.expeditionEvents.pending.length > 0
  const [openedEventOverlay, setOpenedEventOverlay] = useState<{
    eventIds: readonly string[]
  } | null>(null)
  const isEventOverlayVisible = openedEventOverlay !== null &&
    state.expeditionEvents.pending.some(
      ({ eventId }) => openedEventOverlay.eventIds.includes(eventId),
    )
  const pendingEventIdentity = state.expeditionEvents.pending
    .map(({ eventId }) => eventId)
    .join('\u001f')
  const effects = useTacticalStageEffects(
    batch,
    streamGeneration,
    !isEventOverlayVisible,
  )
  const presentation = effects.scene?.snapshot ?? null
  const presentedStage = presentation?.stage ?? state.battle.stage
  const enemy = getEnemyDefinition(presentedStage)
  const presentedEnemyHp = presentation?.enemyHp ?? state.battle.enemyHp
  const enemyAssetId = getEnemyPresentationAssetId(
    enemy.assetId,
    presentedEnemyHp,
    enemy.maxHp,
  )
  const enemyDamageState = getEnemyPresentationDamageState(
    enemy.assetId,
    presentedEnemyHp,
    enemy.maxHp,
  )
  const enemyDamageLabel = getEnemyDamageStateLabel(enemyDamageState)
  const hero = getHeroStats(state)
  const region = getStageRegionForStage(presentedStage)
  const liveRegion = getStageRegionForStage(state.battle.stage)
  const regionNodes = getStageNodes(
    liveRegion.id,
    state.battle.stage,
    state.battle.highestStage,
  )
  const currentOffset = regionNodes.findIndex(({ isCurrent }) => isCurrent)
  const blockStart = Math.floor(Math.max(0, currentOffset) / 10) * 10
  const timeline = regionNodes.slice(blockStart, blockStart + 10)
  const companionId = state.player.companion.id
  const companion = companionId === null ? null : COMPANION_DEFINITIONS[companionId]
  const companionDamage = getCompanionDamage(state)
  const skill = effects.scene?.events.find((event) => event.type === 'skill')
  const critical = effects.scene?.events.find((event) => event.type === 'critical')
  const assist = effects.scene?.events.find((event) => event.type === 'companionAssist')
  const kill = effects.scene?.events.find((event) => event.type === 'kill')
  const outcome = effects.scene?.priorityOutcome ?? null
  const scenePresentation = projectTacticalScenePresentation(
    effects.scene,
    state.player.skills.powerStrike,
  )
  const heroMotionClass: TacticalMotionClass | null = scenePresentation.hero.hit
    ? 'tactical-motion--hero-hit'
    : scenePresentation.hero.attacking
      ? 'tactical-motion--hero-attack'
      : null
  const enemyMotionClass: TacticalMotionClass | null = scenePresentation.enemy.defeated
    ? 'tactical-motion--enemy-defeated'
    : scenePresentation.enemy.hit
      ? 'tactical-motion--enemy-hit'
      : null
  const companionMotionClass: TacticalMotionClass | null =
    scenePresentation.companion.assisting
      ? 'tactical-motion--companion-assist'
      : null
  const stageHeadingRef = useRef<HTMLHeadingElement>(null)
  const eventToggleRef = useRef<HTMLButtonElement>(null)
  const eventOverlayRef = useRef<HTMLElement>(null)
  const previousEventOverlayVisibleRef = useRef(false)
  const heroAssetRef = useRef<HTMLDivElement>(null)
  const enemyAssetRef = useRef<HTMLDivElement>(null)
  const companionAssetRef = useRef<HTMLDivElement>(null)
  const previousPendingCountRef = useRef(state.expeditionEvents.pending.length)
  useTacticalMotionTriggers(
    effects.scene?.id ?? null,
    heroAssetRef,
    heroMotionClass,
    enemyAssetRef,
    enemyMotionClass,
    companionAssetRef,
    companionMotionClass,
  )
  useLayoutEffect(() => {
    const previousPendingCount = previousPendingCountRef.current
    previousPendingCountRef.current = state.expeditionEvents.pending.length
    if (
      previousPendingCount > 0 &&
      state.expeditionEvents.pending.length === 0 &&
      (document.activeElement === document.body || document.activeElement === null)
    ) {
      stageHeadingRef.current?.focus()
    }
  }, [state.expeditionEvents.pending.length])
  useLayoutEffect(() => {
    const wasEventOverlayVisible = previousEventOverlayVisibleRef.current
    previousEventOverlayVisibleRef.current = isEventOverlayVisible
    if (!isEventOverlayVisible) return
    if (eventOverlayRef.current?.contains(document.activeElement)) return
    if (
      wasEventOverlayVisible &&
      document.activeElement !== document.body &&
      document.activeElement !== null
    ) {
      return
    }
    const firstChoice = eventOverlayRef.current?.querySelector<HTMLButtonElement>(
      '.expedition-event-card__choices button:not(:disabled)',
    )
    const heading = eventOverlayRef.current?.querySelector<HTMLElement>(
      '#expedition-event-title',
    )
    const focusTarget = firstChoice ?? heading
    focusTarget?.focus()
  }, [isEventOverlayVisible, pendingEventIdentity])
  const cooldownPercent = companion === null
    ? 0
    : Math.min(
      100,
      Math.max(
        0,
        ((COMPANION_ATTACK_INTERVAL_MS - state.battle.companionCooldownMs) /
          COMPANION_ATTACK_INTERVAL_MS) * 100,
      ),
    )
  const chooseExpeditionEvent = (
    eventId: string,
    choiceId: ExpeditionChoiceId,
  ): GameCommandFeedback => {
    const result = onChooseExpeditionEvent(eventId, choiceId)
    if (result.success) {
      setOpenedEventOverlay((current) => {
        if (current === null) return null
        const eventIds = state.expeditionEvents.pending
          .map((pendingEvent) => pendingEvent.eventId)
          .filter((pendingEventId) => pendingEventId !== eventId)
        return eventIds.length === 0 ? null : { eventIds }
      })
    }
    return result
  }

  return (
    <section
      className={`tactical-canvas ${hasPendingEvent ? 'tactical-canvas--event' : ''} ${isEventOverlayVisible ? 'tactical-canvas--event-open' : ''}`}
      aria-labelledby="tactical-stage-title"
      data-testid="tactical-canvas"
      data-region-id={region.id}
      data-presented-stage={presentedStage}
      data-live-stage={state.battle.stage}
      data-scene-id={effects.scene?.id}
      data-enemy-asset-id={enemyAssetId}
      data-enemy-damage-state={enemyDamageState ?? undefined}
      data-event-overlay-state={isEventOverlayVisible ? 'open' : hasPendingEvent ? 'closed' : 'none'}
    >
      <GameAsset
        assetId={region.assetId}
        purpose="region"
        className="tactical-canvas__background"
        fallbackLabel={region.name}
        fit="cover"
        decorative
      />
      <div className="tactical-canvas__shade" aria-hidden="true" />

      <div
        className="tactical-canvas__base"
        inert={isEventOverlayVisible || undefined}
      >
        {scenePresentation.ultimateFlash && effects.scene && (
          <div
            key={`${effects.scene.id}:ultimate`}
            className="tactical-ultimate-flash"
            data-testid="tactical-ultimate-flash"
            aria-hidden="true"
          >
            <GameAsset
              assetId="skill.power-strike"
              purpose="card"
              className="tactical-ultimate-flash__art"
              fallbackLabel="화염 강타"
              fit="cover"
              decorative
            />
            <span>불씨 각성</span>
          </div>
        )}

        <header className="tactical-canvas__header">
          <div>
            <p className="eyebrow">{region.name} · {region.landmark}</p>
            <h2 id="tactical-stage-title" ref={stageHeadingRef} tabIndex={-1}>
              스테이지 {presentedStage}
              {enemy.isBoss && <span className="boss-tag">BOSS</span>}
            </h2>
            <p>{region.description}</p>
          </div>
          <span className="live-badge"><i aria-hidden="true" /> 자동 원정 중</span>
        </header>

        <div className="tactical-canvas__actors">
          <article className="tactical-actor tactical-actor--hero">
            <div className="tactical-actor__copy">
              <span>방랑 기사 · Lv. {state.player.level}</span>
              <h3>아렌</h3>
              <StatBar
                label="영웅 체력"
                value={presentation?.playerHp ?? state.player.currentHp}
                maximum={hero.maxHp}
                tone="health"
              />
              <small>공격력 {hero.attack.toLocaleString('ko-KR')} · 방어력 {hero.defense.toLocaleString('ko-KR')}</small>
            </div>
            <GameAsset
              assetId="hero.ashen-knight.default"
              purpose="character"
              className="tactical-actor__asset tactical-actor__asset--hero"
              fallbackLabel="아렌"
              fit="cover"
              loading="eager"
              decorative
              containerRef={heroAssetRef}
            />
          </article>

          {companion && (
            <article className="tactical-companion">
              <GameAsset
                assetId={companion.assetId}
                purpose="character"
                className="tactical-companion__asset"
                fallbackLabel="루미"
                fit="cover"
                decorative
                containerRef={companionAssetRef}
              />
              <div>
                <span>{companion.name} · Rank {state.player.companion.rank}</span>
                <strong>협공 {companionDamage.toLocaleString('ko-KR')}</strong>
                <div className="mini-track" aria-hidden="true">
                  <span style={{ width: `${cooldownPercent}%` }} />
                </div>
              </div>
            </article>
          )}

          <article className={`tactical-actor tactical-actor--enemy ${enemy.isBoss ? 'tactical-actor--boss' : ''}`}>
            <div className="tactical-actor__copy">
              <span>{enemy.isBoss ? '지역 수호자' : '야생의 위협'}</span>
              <h3>{enemy.name}</h3>
              {enemyDamageLabel && (
                <p
                  className="tactical-actor__damage-state"
                  data-damage-state={enemyDamageState ?? undefined}
                >
                  {enemyDamageLabel}
                </p>
              )}
              <StatBar
                label="적 체력"
                value={presentedEnemyHp}
                maximum={enemy.maxHp}
                tone="enemy"
              />
              <small>공격력 {enemy.attack.toLocaleString('ko-KR')}</small>
            </div>
            <GameAsset
              assetId={enemyAssetId}
              purpose="character"
              className="tactical-actor__asset tactical-actor__asset--enemy"
              fallbackLabel={enemy.name}
              fit="cover"
              loading="eager"
              decorative
              containerRef={enemyAssetRef}
            />
          </article>
        </div>

        {scenePresentation.damagePopups.length > 0 && effects.scene && (
          <div
            key={`${effects.scene.id}:damage`}
            className="tactical-damage-layer"
            data-testid="tactical-damage-layer"
            aria-hidden="true"
          >
            {scenePresentation.damagePopups.map((popup) => (
              <span
                key={popup.id}
                className={`tactical-damage-popup tactical-damage-popup--${popup.kind}`}
                data-popup-kind={popup.kind}
                data-popup-source={popup.source}
                style={{
                  animationDuration: `${TACTICAL_DAMAGE_POPUP_DURATION_MS}ms`,
                  animationDelay: `${popup.delayMs}ms`,
                }}
              >
                {popup.kind === 'critical' && <small>CRIT</small>}
                {popup.damage.toLocaleString('ko-KR')}
              </span>
            ))}
          </div>
        )}

        <div
          className={`tactical-cue ${effects.scene ? 'tactical-cue--active' : ''}`}
          aria-hidden="true"
        >
          {skill && (
            <GameAsset
              assetId="skill.power-strike"
              purpose="card"
              className="tactical-cue__skill-art"
              fallbackLabel="화염 강타"
              fit="cover"
              decorative
            />
          )}
          <div>
            {critical ? <strong>치명타!</strong> : skill ? <strong>화염 강타</strong> : assist ? <strong>루미 협공</strong> : null}
            {assist && <small>동료 협공</small>}
            {outcome
              ? <em>{getOutcomeCopy(outcome.type)}</em>
              : kill
                ? <em>적 처치</em>
                : null}
          </div>
        </div>

        <div className="tactical-canvas__status" role="status" aria-live="polite">
          {notice}
        </div>

        <nav className="tactical-timeline" aria-label={`${liveRegion.name} 현재 10단계`}>
          <div className="tactical-timeline__heading">
            <span>{liveRegion.name}</span>
            <small>{timeline[0]?.stage}–{timeline.at(-1)?.stage} · 최고 {state.battle.highestStage}</small>
          </div>
          <div className="tactical-timeline__nodes">
            {timeline.map((node) => {
              const locked = node.progress === 'locked'
              return (
                <button
                  key={node.stage}
                  type="button"
                  aria-label={getStageLabel(
                    node.stage,
                    state.battle.stage,
                    state.battle.highestStage,
                    node.isBoss,
                  )}
                  aria-current={node.isCurrent ? 'step' : undefined}
                  aria-disabled={disabled || locked || undefined}
                  data-stage-state={node.progress}
                  data-boss={node.isBoss ? 'true' : 'false'}
                  onClick={() => {
                    if (!disabled && !locked) onChooseStage(node.stage)
                  }}
                >
                  {node.stage}
                  {node.isBoss && <small>B</small>}
                </button>
              )
            })}
          </div>
        </nav>
      </div>

      {hasPendingEvent && (
        <>
          <button
            ref={eventToggleRef}
            type="button"
            className="tactical-event-toggle"
            aria-expanded={isEventOverlayVisible}
            aria-controls="tactical-event-overlay"
            onClick={() => {
              if (isEventOverlayVisible) {
                setOpenedEventOverlay(null)
                return
              }
              const eventIds = state.expeditionEvents.pending.map(
                ({ eventId }) => eventId,
              )
              if (eventIds.length > 0) {
                setOpenedEventOverlay({ eventIds })
              }
            }}
          >
            {isEventOverlayVisible
              ? '전투 화면 보기'
              : `원정 이벤트 ${state.expeditionEvents.pending.length}건 보기`}
          </button>
          <span
            className="sr-only"
            role="status"
            aria-live="polite"
            data-testid="tactical-event-count-status"
          >
            원정 이벤트 {state.expeditionEvents.pending.length}건 대기 중
          </span>
        </>
      )}

      {isEventOverlayVisible && (
        <aside
          ref={eventOverlayRef}
          id="tactical-event-overlay"
          className="tactical-event-overlay"
          aria-label="전장 위 원정 선택"
          onKeyDown={(event) => {
            if (event.key !== 'Escape') return
            event.preventDefault()
            setOpenedEventOverlay(null)
            eventToggleRef.current?.focus()
          }}
        >
          <ExpeditionEventPanel
            pending={state.expeditionEvents.pending}
            onChoose={chooseExpeditionEvent}
            disabled={disabled}
            {...(disabledReason ? { disabledReason } : {})}
          />
        </aside>
      )}

      {hasPendingEvent && !isEventOverlayVisible && (
        <span id="tactical-event-overlay" hidden />
      )}

      {effects.skippedSceneCount > 0 && (
        <span className="sr-only">
          빠른 전투 중 시각 연출 {effects.skippedSceneCount}개를 축약했습니다.
        </span>
      )}
    </section>
  )
}
