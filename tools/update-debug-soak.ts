import { writeFile } from 'node:fs/promises'
import { MAX_OFFLINE_MS } from '../src/game/content'
import { runDebugSimulation } from '../src/game/debugSimulator'
import { createInitialState } from '../src/game/engine'

const SOAK_SEED = 0x1a2b3c4d
const SOAK_DURATION_MS = 24 * 60 * 60 * 1_000

const result = runDebugSimulation(createInitialState(0, SOAK_SEED), {
  speed: 100,
  durationMs: SOAK_DURATION_MS,
  snapshotIntervalMs: MAX_OFFLINE_MS,
})

const fixture = {
  contractVersion: 1,
  seed: SOAK_SEED,
  durationMs: SOAK_DURATION_MS,
  snapshotIntervalMs: MAX_OFFLINE_MS,
  snapshots: result.snapshots,
}

await writeFile(
  new URL('../src/game/fixtures/debug-soak-v1.json', import.meta.url),
  `${JSON.stringify(fixture, null, 2)}\n`,
  'utf8',
)
