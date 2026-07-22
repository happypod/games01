import { useCallback, useLayoutEffect, useReducer } from 'react'
import {
  closePinnedCombatResult,
  consumeCombatResultBatch,
  createCombatResultConsumerState,
  pinCombatResult,
  type CombatResultConsumerState,
  type CombatResultCoordinate,
  type CombatResultSnapshot,
} from '../components/combatResultView'
import type { CombatEventBatch } from '../game/types'

interface CombatResultHookInput {
  readonly batch: CombatEventBatch
  readonly streamGeneration: number
}

type CombatResultAction =
  | {
      readonly type: 'consume'
      readonly batch: CombatEventBatch
      readonly streamGeneration: number
    }
  | { readonly type: 'open'; readonly resultId: string }
  | { readonly type: 'close' }

export interface CombatResultsController {
  readonly queue: readonly CombatResultSnapshot[]
  readonly overflowCount: number
  readonly announcement: string
  readonly pinnedResult: CombatResultSnapshot | null
  readonly lastConsumedCoordinate: CombatResultCoordinate | null
  readonly openResult: (resultId: string) => void
  readonly closeResult: () => void
}

function reducer(
  state: CombatResultConsumerState,
  action: CombatResultAction,
): CombatResultConsumerState {
  if (action.type === 'consume') {
    return consumeCombatResultBatch(state, action.batch, action.streamGeneration)
  }
  if (action.type === 'open') return pinCombatResult(state, action.resultId)
  return closePinnedCombatResult(state)
}

function initialize({ batch, streamGeneration }: CombatResultHookInput) {
  return createCombatResultConsumerState(batch, streamGeneration)
}

export function useCombatResults(
  batch: CombatEventBatch,
  streamGeneration: number,
): CombatResultsController {
  const [state, dispatch] = useReducer(
    reducer,
    { batch, streamGeneration },
    initialize,
  )

  useLayoutEffect(() => {
    dispatch({ type: 'consume', batch, streamGeneration })
  }, [batch, streamGeneration])

  const openResult = useCallback((resultId: string) => {
    dispatch({ type: 'open', resultId })
  }, [])
  const closeResult = useCallback(() => dispatch({ type: 'close' }), [])

  return {
    queue: state.queue,
    overflowCount: state.overflowCount,
    announcement: state.announcement,
    pinnedResult: state.pinnedResult,
    lastConsumedCoordinate: state.lastConsumedCoordinate,
    openResult,
    closeResult,
  }
}
