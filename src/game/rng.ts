import { RNG_ALGORITHM, type RngState } from './types'

export const MAX_UINT32 = 0xffff_ffff
export const FALLBACK_RNG_SEED = 0x6d2b79f5

export interface RandomDraw {
  rng: RngState
  value: number
  uint32: number
}

export function normalizeRngSeed(rawSeed: number): number {
  if (!Number.isFinite(rawSeed)) return FALLBACK_RNG_SEED
  const seed = Math.floor(rawSeed) >>> 0
  return seed === 0 ? FALLBACK_RNG_SEED : seed
}

export function seedFromText(text: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return normalizeRngSeed(hash >>> 0)
}

export function createRngState(seed: number): RngState {
  const normalizedSeed = normalizeRngSeed(seed)
  return {
    algorithm: RNG_ALGORITHM,
    seed: normalizedSeed,
    state: normalizedSeed,
    draws: 0,
  }
}

export function nextRandom(input: RngState): RandomDraw {
  let nextState = input.state >>> 0
  nextState ^= nextState << 13
  nextState ^= nextState >>> 17
  nextState ^= nextState << 5
  nextState >>>= 0

  return {
    rng: {
      algorithm: RNG_ALGORITHM,
      seed: input.seed,
      state: nextState,
      draws: Math.min(Number.MAX_SAFE_INTEGER, input.draws + 1),
    },
    value: nextState / 0x1_0000_0000,
    uint32: nextState,
  }
}
