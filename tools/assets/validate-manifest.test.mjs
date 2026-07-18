import assert from 'node:assert/strict'
import { appendFile, cp, mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { ERROR_CODES, REQUIRED_ASSET_IDS, validateManifest } from './validate-manifest.mjs'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const SOURCE_GAME_DIR = path.join(REPO_ROOT, 'src/assets/game')
const SOURCE_PROMPTS_DIR = path.join(REPO_ROOT, 'docs/assets/prompts')

function findEntry(manifest, id = 'hero.ashen-knight.default') {
  const entry = manifest.assets.find((candidate) => candidate.id === id)
  assert.ok(entry, `fixture entry ${id} must exist`)
  return entry
}

function hasError(result, code, id) {
  return result.errors.some((error) => error.code === code && (id === undefined || error.id === id))
}

async function runFixture(mutate) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'irpg-406-assets-'))
  try {
    const gameDir = path.join(root, 'src/assets/game')
    const promptsDir = path.join(root, 'docs/assets/prompts')
    await mkdir(path.dirname(gameDir), { recursive: true })
    await mkdir(path.dirname(promptsDir), { recursive: true })
    await Promise.all([
      cp(SOURCE_GAME_DIR, gameDir, { recursive: true }),
      cp(SOURCE_PROMPTS_DIR, promptsDir, { recursive: true }),
    ])

    const manifestPath = path.join(gameDir, 'manifest.json')
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
    await mutate({ root, gameDir, manifest, manifestPath })
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
    return await validateManifest({ repoRoot: root, manifestPath })
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

test('checked-in manifest contains the exact inventory and validates', async () => {
  const result = await validateManifest({ repoRoot: REPO_ROOT })
  assert.equal(REQUIRED_ASSET_IDS.length, 27)
  assert.deepEqual(result.errors, [])
  assert.equal(result.valid, true)
})

test('isolated mutation fixture starts from a fully valid manifest', async () => {
  const result = await runFixture(async () => {})
  assert.deepEqual(result.errors, [])
  assert.equal(result.valid, true)
})

test('reports a stable duplicate ID code', async () => {
  const result = await runFixture(async ({ manifest }) => {
    manifest.assets.push({ ...manifest.assets[0] })
  })
  assert.equal(hasError(result, ERROR_CODES.DUPLICATE_ID, 'hero.ashen-knight.default'), true)
})

test('reports missing and unexpected inventory IDs independently', async () => {
  const missing = await runFixture(async ({ manifest }) => {
    manifest.assets = manifest.assets.filter((entry) => entry.id !== 'event.ash-camp')
  })
  assert.equal(hasError(missing, ERROR_CODES.MISSING_ID, 'event.ash-camp'), true)

  const unexpected = await runFixture(async ({ manifest }) => {
    manifest.assets.push({ ...manifest.assets[0], id: 'hero.unapproved.default' })
  })
  assert.equal(hasError(unexpected, ERROR_CODES.UNEXPECTED_ID, 'hero.unapproved.default'), true)
})

test('rejects remote runtime sources', async () => {
  const result = await runFixture(async ({ manifest }) => {
    findEntry(manifest).src = 'https://cdn.example/hero.webp'
  })
  assert.equal(hasError(result, ERROR_CODES.REMOTE_SRC, 'hero.ashen-knight.default'), true)
})

test('rejects lexical path traversal', async () => {
  const result = await runFixture(async ({ manifest }) => {
    findEntry(manifest).src = './files/../../../../outside.webp'
  })
  assert.equal(hasError(result, ERROR_CODES.PATH_ESCAPE, 'hero.ashen-knight.default'), true)
})

test('rejects realpath traversal through a directory link', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'irpg-406-realpath-'))
  try {
    const gameDir = path.join(root, 'src/assets/game')
    const promptsDir = path.join(root, 'docs/assets/prompts')
    await mkdir(path.dirname(gameDir), { recursive: true })
    await mkdir(path.dirname(promptsDir), { recursive: true })
    await Promise.all([
      cp(SOURCE_GAME_DIR, gameDir, { recursive: true }),
      cp(SOURCE_PROMPTS_DIR, promptsDir, { recursive: true }),
    ])

    const outsideDir = path.join(root, 'outside')
    await mkdir(outsideDir)
    await cp(
      path.join(gameDir, 'files/hero/ashen-knight-default.webp'),
      path.join(outsideDir, 'escape.webp'),
    )
    try {
      await symlink(outsideDir, path.join(gameDir, 'files/link'), process.platform === 'win32' ? 'junction' : 'dir')
    } catch (error) {
      if (error?.code === 'EPERM' || error?.code === 'EACCES') {
        t.skip('directory links are unavailable in this environment')
        return
      }
      throw error
    }

    const manifestPath = path.join(gameDir, 'manifest.json')
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
    findEntry(manifest).src = './files/link/escape.webp'
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
    const result = await validateManifest({ repoRoot: root, manifestPath })
    assert.equal(hasError(result, ERROR_CODES.PATH_ESCAPE, 'hero.ashen-knight.default'), true)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('reports a missing deployed file', async () => {
  const result = await runFixture(async ({ manifest }) => {
    findEntry(manifest).src = './files/hero/missing.webp'
  })
  assert.equal(hasError(result, ERROR_CODES.MISSING_FILE, 'hero.ashen-knight.default'), true)
})

test('compares declared bytes to the real file', async () => {
  const result = await runFixture(async ({ manifest }) => {
    findEntry(manifest).bytes += 1
  })
  assert.equal(hasError(result, ERROR_CODES.BYTES_MISMATCH, 'hero.ashen-knight.default'), true)
})

test('requires final content art to be ready with a content hash', async () => {
  const result = await runFixture(async ({ manifest }) => {
    const entry = findEntry(manifest, 'region.ashen-border')
    entry.status = 'placeholder'
    delete entry.sha256
  })
  assert.equal(hasError(result, ERROR_CODES.INVALID_STATUS, 'region.ashen-border'), true)
  assert.equal(hasError(result, ERROR_CODES.HASH_REQUIRED, 'region.ashen-border'), true)
})

test('requires final progression cards to be ready with a content hash', async () => {
  const result = await runFixture(async ({ manifest }) => {
    const entry = findEntry(manifest, 'equipment.ember-blade')
    entry.status = 'placeholder'
    delete entry.sha256
  })
  assert.equal(hasError(result, ERROR_CODES.INVALID_STATUS, 'equipment.ember-blade'), true)
  assert.equal(hasError(result, ERROR_CODES.HASH_REQUIRED, 'equipment.ember-blade'), true)
})

test('requires final battle result art to be ready, hashed, and tied to its approved prompt record', async () => {
  const result = await runFixture(async ({ manifest }) => {
    const entry = findEntry(manifest, 'result.boss-victory')
    entry.status = 'placeholder'
    entry.promptRecord = 'docs/assets/prompts/placeholder-assets.md'
    delete entry.sha256
  })
  assert.equal(hasError(result, ERROR_CODES.INVALID_STATUS, 'result.boss-victory'), true)
  assert.equal(hasError(result, ERROR_CODES.HASH_REQUIRED, 'result.boss-victory'), true)
  assert.equal(hasError(result, ERROR_CODES.RIGHTS_METADATA, 'result.boss-victory'), true)
})

test('compares declared region hashes to the real files', async () => {
  const result = await runFixture(async ({ manifest }) => {
    findEntry(manifest, 'region.moonfall-pass').sha256 = '0'.repeat(64)
  })
  assert.equal(hasError(result, ERROR_CODES.HASH_MISMATCH, 'region.moonfall-pass'), true)
})

test('rejects shared source paths and hashes across final content art', async () => {
  const sharedSource = await runFixture(async ({ manifest }) => {
    findEntry(manifest, 'region.moonfall-pass').src = findEntry(
      manifest,
      'region.ashen-border',
    ).src
  })
  assert.equal(hasError(sharedSource, ERROR_CODES.DUPLICATE_SRC, 'region.moonfall-pass'), true)

  const sharedHash = await runFixture(async ({ manifest }) => {
    findEntry(manifest, 'region.moonfall-pass').sha256 = findEntry(
      manifest,
      'region.ashen-border',
    ).sha256
  })
  assert.equal(
    hasError(sharedHash, ERROR_CODES.DUPLICATE_SHA256, 'region.moonfall-pass'),
    true,
  )
})

test('rejects shared source paths and hashes across final progression cards', async () => {
  const sharedSource = await runFixture(async ({ manifest }) => {
    findEntry(manifest, 'skill.iron-will').src = findEntry(
      manifest,
      'equipment.guard-armor',
    ).src
  })
  assert.equal(hasError(sharedSource, ERROR_CODES.DUPLICATE_SRC, 'skill.iron-will'), true)

  const sharedHash = await runFixture(async ({ manifest }) => {
    findEntry(manifest, 'skill.loot-sense').sha256 = findEntry(
      manifest,
      'equipment.fortune-charm',
    ).sha256
  })
  assert.equal(
    hasError(sharedHash, ERROR_CODES.DUPLICATE_SHA256, 'skill.loot-sense'),
    true,
  )
})

test('rejects shared source paths and hashes across final battle result art', async () => {
  const sharedSource = await runFixture(async ({ manifest }) => {
    findEntry(manifest, 'result.defeat').src = findEntry(
      manifest,
      'result.boss-victory',
    ).src
  })
  assert.equal(hasError(sharedSource, ERROR_CODES.DUPLICATE_SRC, 'result.defeat'), true)

  const sharedHash = await runFixture(async ({ manifest }) => {
    const duplicateHash = '0'.repeat(64)
    findEntry(manifest, 'result.boss-victory').sha256 = duplicateHash
    findEntry(manifest, 'result.defeat').sha256 = duplicateHash
  })
  assert.equal(
    hasError(sharedHash, ERROR_CODES.DUPLICATE_SHA256, 'result.defeat'),
    true,
  )
})

test('enforces battle result dimensions and the 300 KiB byte budget', async () => {
  const dimensions = await runFixture(async ({ manifest }) => {
    findEntry(manifest, 'result.boss-victory').width = 1279
  })
  assert.equal(
    hasError(dimensions, ERROR_CODES.DIMENSION_MISMATCH, 'result.boss-victory'),
    true,
  )

  const budget = await runFixture(async ({ gameDir, manifest }) => {
    const entry = findEntry(manifest, 'result.boss-victory')
    const target = path.resolve(gameDir, entry.src)
    await appendFile(target, Buffer.alloc(300 * 1024))
    entry.bytes = (await stat(target)).size
  })
  assert.equal(
    hasError(budget, ERROR_CODES.BUDGET_EXCEEDED, 'result.boss-victory'),
    true,
  )
})

test('reads dimensions from the actual WebP header', async () => {
  const result = await runFixture(async ({ manifest }) => {
    findEntry(manifest).width = 767
  })
  assert.equal(hasError(result, ERROR_CODES.DIMENSION_MISMATCH, 'hero.ashen-knight.default'), true)
})

test('rejects an extension whose file header has another format', async () => {
  const result = await runFixture(async ({ gameDir, manifest }) => {
    const target = path.join(gameDir, 'files/hero/not-webp.webp')
    await cp(path.join(gameDir, 'files/fallback/character.svg'), target)
    const entry = findEntry(manifest)
    entry.src = './files/hero/not-webp.webp'
    entry.bytes = (await stat(target)).size
  })
  assert.equal(hasError(result, ERROR_CODES.HEADER_FORMAT_MISMATCH, 'hero.ashen-knight.default'), true)
})

test('enforces the per-use byte budget from the actual file', async () => {
  const result = await runFixture(async ({ gameDir, manifest }) => {
    const target = path.join(gameDir, 'files/hero/ashen-knight-default.webp')
    await appendFile(target, Buffer.alloc(250 * 1024))
    findEntry(manifest).bytes = (await stat(target)).size
  })
  assert.equal(hasError(result, ERROR_CODES.BUDGET_EXCEEDED, 'hero.ashen-knight.default'), true)
})

test('requires generated asset production metadata', async () => {
  const result = await runFixture(async ({ manifest }) => {
    delete findEntry(manifest).generator
  })
  assert.equal(hasError(result, ERROR_CODES.RIGHTS_METADATA, 'hero.ashen-knight.default'), true)
})

test('requires CC-BY attribution', async () => {
  const result = await runFixture(async ({ manifest }) => {
    const entry = findEntry(manifest)
    entry.sourceType = 'licensed'
    entry.license = 'CC-BY-4.0'
    entry.sourceUrl = 'https://example.test/source'
    delete entry.generator
    delete entry.promptRecord
  })
  assert.equal(hasError(result, ERROR_CODES.RIGHTS_METADATA, 'hero.ashen-knight.default'), true)
})

test('requires repository-local commercial redistribution proof', async () => {
  const result = await runFixture(async ({ manifest }) => {
    const entry = findEntry(manifest)
    entry.sourceType = 'original'
    entry.license = 'commercial-redistribution'
    entry.proofPath = 'docs/licenses/missing.txt'
    delete entry.generator
    delete entry.promptRecord
  })
  assert.equal(hasError(result, ERROR_CODES.METADATA_FILE_MISSING, 'hero.ashen-knight.default'), true)
})

test('rejects executable SVG fallback content', async () => {
  const result = await runFixture(async ({ gameDir, manifest }) => {
    const entry = findEntry(manifest, 'fallback.character')
    const target = path.join(gameDir, 'files/fallback/character.svg')
    const unsafe = '<svg xmlns="http://www.w3.org/2000/svg" width="768" height="768"><script>alert(1)</script></svg>'
    await writeFile(target, unsafe, 'utf8')
    entry.bytes = Buffer.byteLength(unsafe)
  })
  assert.equal(hasError(result, ERROR_CODES.UNSAFE_SVG, 'fallback.character'), true)
})

test('does not treat data-width and data-height as SVG dimensions', async () => {
  const result = await runFixture(async ({ gameDir, manifest }) => {
    const entry = findEntry(manifest, 'fallback.character')
    const target = path.join(gameDir, 'files/fallback/character.svg')
    const invalid = '<svg xmlns="http://www.w3.org/2000/svg" data-width="768" data-height="768"></svg>'
    await writeFile(target, invalid, 'utf8')
    entry.bytes = Buffer.byteLength(invalid)
  })
  assert.equal(hasError(result, ERROR_CODES.INVALID_IMAGE, 'fallback.character'), true)
})

test('does not accept a commented fake SVG root', async () => {
  const result = await runFixture(async ({ gameDir, manifest }) => {
    const entry = findEntry(manifest, 'fallback.character')
    const target = path.join(gameDir, 'files/fallback/character.svg')
    const invalid = '<?xml version="1.0"?><!-- <svg width="768" height="768"> --><html></html>'
    await writeFile(target, invalid, 'utf8')
    entry.bytes = Buffer.byteLength(invalid)
  })
  assert.equal(
    hasError(result, ERROR_CODES.HEADER_FORMAT_MISMATCH, 'fallback.character'),
    true,
  )
})

test('rejects foreignObject and embedded active HTML in SVG fallbacks', async () => {
  const result = await runFixture(async ({ gameDir, manifest }) => {
    const entry = findEntry(manifest, 'fallback.character')
    const target = path.join(gameDir, 'files/fallback/character.svg')
    const unsafe = '<svg xmlns="http://www.w3.org/2000/svg" width="768" height="768"><foreignObject><iframe src="https://example.test"></iframe></foreignObject></svg>'
    await writeFile(target, unsafe, 'utf8')
    entry.bytes = Buffer.byteLength(unsafe)
  })
  assert.equal(hasError(result, ERROR_CODES.UNSAFE_SVG, 'fallback.character'), true)
})

test('rejects malformed SVG with mismatched element nesting', async () => {
  const result = await runFixture(async ({ gameDir, manifest }) => {
    const entry = findEntry(manifest, 'fallback.character')
    const target = path.join(gameDir, 'files/fallback/character.svg')
    const invalid = '<svg xmlns="http://www.w3.org/2000/svg" width="768" height="768"><g></svg>'
    await writeFile(target, invalid, 'utf8')
    entry.bytes = Buffer.byteLength(invalid)
  })
  assert.equal(hasError(result, ERROR_CODES.INVALID_IMAGE, 'fallback.character'), true)
})

test('rejects xml:base and other unapproved SVG attributes', async () => {
  const result = await runFixture(async ({ gameDir, manifest }) => {
    const entry = findEntry(manifest, 'fallback.character')
    const target = path.join(gameDir, 'files/fallback/character.svg')
    const unsafe = '<svg xmlns="http://www.w3.org/2000/svg" xml:base="https://evil.test/a.svg" width="768" height="768"><defs><linearGradient id="g"/></defs><rect width="768" height="768" fill="url(#g)"/></svg>'
    await writeFile(target, unsafe, 'utf8')
    entry.bytes = Buffer.byteLength(unsafe)
  })
  assert.equal(hasError(result, ERROR_CODES.UNSAFE_SVG, 'fallback.character'), true)
})

test('rejects namespace and kind disagreement', async () => {
  const result = await runFixture(async ({ manifest }) => {
    findEntry(manifest).kind = 'enemy'
  })
  assert.equal(hasError(result, ERROR_CODES.NAMESPACE_KIND_MISMATCH, 'hero.ashen-knight.default'), true)
})
