import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const isCanonicalRunner =
  process.platform === 'linux' && process.env.GITHUB_ACTIONS === 'true'
const forceLocalComparison = process.env.IRPG_FORCE_VISUAL_COMPARE === '1'

if (!isCanonicalRunner && !forceLocalComparison) {
  console.log(
    '[IRPG-506] Canonical screenshot comparison runs on Ubuntu GitHub Actions; local comparison skipped.',
  )
  process.exit(0)
}

const playwrightCli = fileURLToPath(
  new URL('../node_modules/@playwright/test/cli.js', import.meta.url),
)
const result = spawnSync(
  process.execPath,
  [
    playwrightCli,
    'test',
    '--config',
    'playwright.visual.config.ts',
    ...process.argv.slice(2),
  ],
  { stdio: 'inherit' },
)

process.exit(result.status ?? 1)
