import { describe, expect, it } from 'vitest'
import { createInitialState } from '../../game/engine'
import { createPortableSave } from '../../game/saveTransfer'

const FORBIDDEN_VISUAL_STATE_MARKERS = [
  'assetId',
  'assetPath',
  '.webp',
  '.svg',
  'src/assets',
  '/assets/',
] as const

describe('visual asset save boundary', () => {
  it('keeps asset identifiers and paths out of GameState and portable backups', () => {
    const state = createInitialState(1_700_000_000_000, 0x406)
    const serializedState = JSON.stringify(state)
    const portable = createPortableSave(state, 1_700_000_001_000)

    expect(portable).not.toBeNull()
    for (const marker of FORBIDDEN_VISUAL_STATE_MARKERS) {
      expect(serializedState).not.toContain(marker)
      expect(portable).not.toContain(marker)
    }
  })
})
