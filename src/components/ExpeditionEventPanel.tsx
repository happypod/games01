import { useLayoutEffect, useRef, useState } from 'react'
import {
  EXPEDITION_DEFINITION_VERSION_V1,
  EXPEDITION_EVENT_DEFINITIONS_V1,
  type ExpeditionEventDefinition,
} from '../game/content'
import type {
  ExpeditionChoiceId,
  ExpeditionPendingEvent,
  ExpeditionResolvedChoice,
} from '../game/types'
import type { GameCommandFeedback } from '../hooks/useGame'
import { useViewportActivation } from '../hooks/useViewportActivation'
import { GameAsset } from './GameAsset'

interface ExpeditionEventPanelProps {
  pending: readonly ExpeditionPendingEvent[]
  onChoose: (
    eventId: string,
    choiceId: ExpeditionChoiceId,
  ) => GameCommandFeedback
  disabled?: boolean
  disabledReason?: string
}

interface EventArtProps {
  readonly assetId: string
  readonly definitionId: string
}

const PANEL_TITLE_ID = 'expedition-event-title'
const DISABLED_REASON_ID = 'expedition-event-disabled-reason'
const LIMIT_NOTE_ID = 'expedition-event-limit-note'
const EXPEDITION_AMOUNT_FORMATTER = new Intl.NumberFormat('ko-KR', {
  maximumFractionDigits: 0,
  useGrouping: true,
})

function getDefinition(
  event: ExpeditionPendingEvent,
): ExpeditionEventDefinition | null {
  if (event.definitionVersion !== EXPEDITION_DEFINITION_VERSION_V1) return null
  return Object.values(EXPEDITION_EVENT_DEFINITIONS_V1).find(
    ({ id }) => id === event.definitionId,
  ) ?? null
}

function getChoiceLabel(
  definition: ExpeditionEventDefinition | null,
  choiceId: ExpeditionChoiceId,
): string {
  return definition?.choices.find(({ id }) => id === choiceId)?.label ??
    (choiceId === 'gold' ? '골드를 선택한다' : '회복을 선택한다')
}

function getEffectPreview(choice: ExpeditionResolvedChoice): string {
  return choice.effect.type === 'grantGold'
    ? `골드 최대 +${EXPEDITION_AMOUNT_FORMATTER.format(choice.effect.amount)}`
    : `체력 최대 +${EXPEDITION_AMOUNT_FORMATTER.format(choice.effect.amount)}`
}

function getFallbackGlyph(definitionId: string): string {
  if (definitionId === 'event.ember-shrine') return '✦'
  if (definitionId === 'event.wandering-smith') return '⚒'
  if (definitionId === 'event.ash-camp') return '♨'
  return '◆'
}

function getChoiceRefKey(eventId: string, choiceId: ExpeditionChoiceId): string {
  return `${eventId}\u0000${choiceId}`
}

function EventArt({ assetId, definitionId }: EventArtProps) {
  const { targetRef, isActive } = useViewportActivation<HTMLDivElement>()
  return (
    <div
      ref={targetRef}
      className="expedition-event-card__art"
      data-event-asset-id={assetId}
      data-art-active={isActive ? 'true' : 'false'}
      aria-hidden="true"
    >
      {isActive ? (
        <GameAsset
          assetId={assetId}
          purpose="card"
          decorative
          fallbackLabel={getFallbackGlyph(definitionId)}
          className="expedition-event-card__asset"
          fit="cover"
        />
      ) : (
        <span className="expedition-event-card__art-placeholder" aria-hidden="true">
          {getFallbackGlyph(definitionId)}
        </span>
      )}
    </div>
  )
}

export function ExpeditionEventPanel({
  pending,
  onChoose,
  disabled = false,
  disabledReason = '읽기 전용이거나 저장 소유권을 확인 중이라 원정 이벤트를 선택할 수 없습니다.',
}: ExpeditionEventPanelProps) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const choiceRefs = useRef(new Map<string, HTMLButtonElement>())
  const submittingEventIds = useRef(new Set<string>())
  const pendingFocus = useRef<{ eventId: string; removedIndex: number } | null>(null)
  const focusedChoice = useRef<{ eventId: string; removedIndex: number } | null>(null)
  const [feedback, setFeedback] = useState<GameCommandFeedback | null>(null)

  useLayoutEffect(() => {
    const completed = pendingFocus.current
    const externallyRemoved = focusedChoice.current
    const removal = completed ?? (
      externallyRemoved !== null &&
      !pending.some(({ eventId }) => eventId === externallyRemoved.eventId)
        ? externallyRemoved
        : null
    )
    if (removal === null) return
    if (pending.some(({ eventId }) => eventId === removal.eventId)) return
    if (
      completed === null &&
      document.activeElement !== null &&
      document.activeElement !== document.body
    ) {
      focusedChoice.current = null
      return
    }

    pendingFocus.current = null
    focusedChoice.current = null
    submittingEventIds.current.delete(removal.eventId)
    if (pending.length === 0) {
      headingRef.current?.focus()
      return
    }

    const nextEvent = pending[removal.removedIndex % pending.length]
    const firstChoice = nextEvent?.resolvedChoices[0]
    if (nextEvent === undefined || firstChoice === undefined) {
      headingRef.current?.focus()
      return
    }
    choiceRefs.current
      .get(getChoiceRefKey(nextEvent.eventId, firstChoice.choiceId))
      ?.focus()
  }, [pending])

  const choose = (
    event: ExpeditionPendingEvent,
    removedIndex: number,
    choiceId: ExpeditionChoiceId,
  ) => {
    if (disabled || submittingEventIds.current.has(event.eventId)) return
    submittingEventIds.current.add(event.eventId)

    let result: GameCommandFeedback
    try {
      result = onChoose(event.eventId, choiceId)
    } catch (error) {
      submittingEventIds.current.delete(event.eventId)
      throw error
    }

    setFeedback(result)
    if (result.success) {
      pendingFocus.current = { eventId: event.eventId, removedIndex }
    } else {
      submittingEventIds.current.delete(event.eventId)
    }
  }

  return (
    <section
      className="panel expedition-event-panel"
      aria-labelledby={PANEL_TITLE_ID}
      data-testid="expedition-event-panel"
    >
      <div className="expedition-event-panel__header">
        <div>
          <p className="eyebrow">EXPEDITION ENCOUNTERS · IRPG-412</p>
          <h2
            id={PANEL_TITLE_ID}
            ref={headingRef}
            tabIndex={-1}
            onFocus={() => {
              focusedChoice.current = null
            }}
          >
            원정 선택 이벤트
          </h2>
          <p>저장된 선택지만 표시하며 자동 전투는 계속 진행됩니다.</p>
        </div>
        <span className="expedition-event-panel__count">대기 중 {pending.length}/3</span>
      </div>

      {disabled && (
        <p className="expedition-event-panel__disabled" id={DISABLED_REASON_ID}>
          {disabledReason}
        </p>
      )}

      {feedback && (
        <p
          className={`expedition-event-panel__feedback expedition-event-panel__feedback--${feedback.success ? 'success' : 'failure'}`}
        >
          {feedback.message}
        </p>
      )}

      <p className="expedition-event-panel__limit-note" id={LIMIT_NOTE_ID}>
        보유 한도와 현재 체력에 따라 실제 증가량은 줄어들 수 있습니다.
      </p>

      {pending.length === 0 ? (
        <p className="expedition-event-panel__empty">
          대기 중인 원정 이벤트가 없습니다. 다음 10단계 이정표에서 새로운 선택을 만납니다.
        </p>
      ) : (
        <div className="expedition-event-grid">
          {pending.map((event, eventIndex) => {
            const definition = getDefinition(event)
            const cardId = `expedition-event-${event.milestoneIndex}`
            const titleId = `${cardId}-title`
            const descriptionId = `${cardId}-description`
            const assetId = definition?.assetId ?? event.definitionId
            const name = definition?.name ?? '미확인 원정 이벤트'
            const description = definition?.description ??
              '이 이벤트의 표시 정보를 찾지 못했습니다. 저장된 선택 효과만 확인할 수 있습니다.'

            return (
              <article
                className="expedition-event-card"
                key={event.eventId}
                aria-labelledby={titleId}
                aria-describedby={descriptionId}
                data-expedition-event-id={event.eventId}
                data-event-definition-id={event.definitionId}
              >
                <EventArt assetId={assetId} definitionId={event.definitionId} />

                <div className="expedition-event-card__body">
                  <div className="expedition-event-card__heading">
                    <h3 id={titleId}>{name}</h3>
                    <span>스테이지 {event.milestoneStage}에서 발견</span>
                  </div>
                  <p id={descriptionId}>{description}</p>
                </div>

                <div className="expedition-event-card__choices" role="group" aria-label={`${name} 선택지`}>
                  {event.resolvedChoices.map((choice) => {
                    const label = getChoiceLabel(definition, choice.choiceId)
                    const preview = getEffectPreview(choice)
                    const previewId = `${cardId}-${choice.choiceId}-preview`
                    return (
                      <button
                        key={choice.choiceId}
                        ref={(node) => {
                          const key = getChoiceRefKey(event.eventId, choice.choiceId)
                          if (node === null) choiceRefs.current.delete(key)
                          else choiceRefs.current.set(key, node)
                        }}
                        type="button"
                        disabled={disabled}
                        aria-label={`${name}, ${label}, ${preview}`}
                        aria-describedby={`${previewId} ${LIMIT_NOTE_ID}${disabled ? ` ${DISABLED_REASON_ID}` : ''}`}
                        onFocus={() => {
                          focusedChoice.current = {
                            eventId: event.eventId,
                            removedIndex: eventIndex,
                          }
                        }}
                        onBlur={(focusEvent) => {
                          const next = focusEvent.relatedTarget
                          const card = focusEvent.currentTarget.closest('.expedition-event-card')
                          if (next instanceof Node && card?.contains(next)) return
                          if (next !== null) focusedChoice.current = null
                        }}
                        onClick={() => choose(event, eventIndex, choice.choiceId)}
                      >
                        <span>{label}</span>
                        <small id={previewId}>{preview}</small>
                      </button>
                    )
                  })}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
