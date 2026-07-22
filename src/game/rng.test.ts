import { describe, expect, it } from 'vitest'
import { FALLBACK_RNG_SEED, createRngState, nextRandom, normalizeRngSeed, seedFromText } from './rng'

describe('saved xorshift32 RNG', () => {
  it('matches the xorshift32-v1 reference vector', () => {
    let rng = createRngState(1)
    const values: number[] = []

    for (let index = 0; index < 5; index += 1) {
      const draw = nextRandom(rng)
      values.push(draw.uint32)
      rng = draw.rng
    }

    expect(values).toEqual([270369, 67634689, 2647435461, 307599695, 2398689233])
    expect(rng.draws).toBe(5)
    expect(rng.seed).toBe(1)
  })

  it('normalizes zero and hashes text deterministically without a zero state', () => {
    expect(normalizeRngSeed(0)).toBe(FALLBACK_RNG_SEED)
    expect(seedFromText('legacy-state')).toBe(seedFromText('legacy-state'))
    expect(seedFromText('legacy-state')).not.toBe(0)
    expect(seedFromText('legacy-state')).not.toBe(seedFromText('other-state'))
  })
})
