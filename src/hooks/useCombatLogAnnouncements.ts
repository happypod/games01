import { useEffect, useRef, useState } from 'react'
import type { CombatEvent, CombatEventBatch } from '../game/types'

const ANNOUNCEMENT_WINDOW_MS = 5_000

const ANNOUNCEMENT_LABELS: Readonly<Record<string, string>> = {
  skill: '스킬',
  critical: '치명타',
  companionAssist: '협공',
  kill: '승리',
  bossVictory: '보스 승리',
  defeat: '패배',
}

function compareCursor(left: string, right: string) {
  try {
    const leftValue = BigInt(left)
    const rightValue = BigInt(right)
    return leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0
  } catch {
    return left.localeCompare(right)
  }
}

function getRuntimeType(event: CombatEvent): string {
  const value = (event as { readonly type?: unknown }).type
  return typeof value === 'string' ? value : 'unknown'
}

function getRoundSequence(event: CombatEvent): string {
  const value = (event as { readonly roundSequence?: unknown }).roundSequence
  return typeof value === 'string' ? value : '알 수 없음'
}

export function useCombatLogAnnouncements(batch: CombatEventBatch): string {
  const [announcement, setAnnouncement] = useState('')
  const seenIdsRef = useRef<Set<string> | null>(null)
  const previousCursorRef = useRef(batch.nextCursor)
  const previousTotalRef = useRef(batch.totalEvents)
  const countsRef = useRef(new Map<string, number>())
  const latestRoundRef = useRef('')
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    const currentIds = new Set(batch.events.map(({ id }) => id))
    if (seenIdsRef.current === null) {
      seenIdsRef.current = currentIds
      previousCursorRef.current = batch.nextCursor
      previousTotalRef.current = batch.totalEvents
      return
    }

    const reset =
      batch.totalEvents < previousTotalRef.current ||
      compareCursor(batch.nextCursor, previousCursorRef.current) < 0
    if (reset) {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
      timerRef.current = null
      countsRef.current.clear()
      latestRoundRef.current = ''
      seenIdsRef.current = currentIds
      previousCursorRef.current = batch.nextCursor
      previousTotalRef.current = batch.totalEvents
      setAnnouncement('')
      return
    }

    const newEvents = batch.events.filter(({ id }) => !seenIdsRef.current?.has(id))
    seenIdsRef.current = currentIds
    previousCursorRef.current = batch.nextCursor
    previousTotalRef.current = batch.totalEvents
    if (newEvents.length === 0) return

    for (const event of newEvents) {
      const type = getRuntimeType(event)
      countsRef.current.set(type, (countsRef.current.get(type) ?? 0) + 1)
      latestRoundRef.current = getRoundSequence(event)
    }

    if (timerRef.current !== null) return
    timerRef.current = window.setTimeout(() => {
      const parts = [...countsRef.current.entries()].map(([type, count]) =>
        `${ANNOUNCEMENT_LABELS[type] ?? '기타 이벤트'} ${count}회`,
      )
      countsRef.current.clear()
      timerRef.current = null
      setAnnouncement(
        `새 전투 이벤트: ${parts.join(', ')}. 마지막 라운드 ${latestRoundRef.current}.`,
      )
    }, ANNOUNCEMENT_WINDOW_MS)
  }, [batch])

  useEffect(() => () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    timerRef.current = null
    countsRef.current.clear()
  }, [])

  return announcement
}
