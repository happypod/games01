import { expect, test, type Response } from '@playwright/test'
import { readFileSync, readdirSync, realpathSync, statSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import {
  basename,
  dirname,
  extname,
  isAbsolute,
  relative,
  resolve,
  sep,
} from 'node:path'
import { fileURLToPath } from 'node:url'

const ORIGIN = 'http://127.0.0.1:4174'
const BUDGET_BYTES = 600 * 1_024
const COUNTED_RESOURCE_TYPES = new Set(['document', 'script', 'stylesheet', 'font', 'image'])
const IMAGE_EXTENSIONS = new Set(['.avif', '.gif', '.jpeg', '.jpg', '.png', '.svg', '.webp'])
const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DIST_ROOT = resolve(REPOSITORY_ROOT, 'dist')
const REAL_DIST_ROOT = realpathSync(DIST_ROOT)
const ASSET_MANIFEST_PATH = resolve(REPOSITORY_ROOT, 'src/assets/game/manifest.json')
const VITE_MANIFEST_PATH = resolve(DIST_ROOT, '.vite/manifest.json')
const DEBUG_BUNDLE_MARKERS = [
  'src/debug/',
  'IRPG507_DEBUG_PANEL',
  'DEBUG · 저장 격리',
] as const
const DEBUG_DOM_SELECTORS = [
  '[data-irpg507-debug]',
  '[data-testid="irpg-507-debug-trigger"]',
  '[data-testid="irpg-507-debug-panel"]',
  '#irpg-507-debug-panel',
].join(', ')

interface AssetManifestEntry {
  id: string
  src: string
}

interface AssetManifest {
  version: number
  assets: AssetManifestEntry[]
}

interface ViteManifestEntry {
  file: string
  src?: string
  assets?: string[]
  css?: string[]
}

type ViteManifest = Record<string, ViteManifestEntry>

interface CapturedResponse {
  url: string
  resourceType: string
  status: number
  cacheControl: string
  contentType: string
}

interface BudgetResource extends CapturedResponse {
  distFile: string
  sourceBytes: number
  gzipBytes: number
}

interface DebugMarkerOccurrence {
  file: string
  marker: (typeof DEBUG_BUNDLE_MARKERS)[number]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function loadAssetManifest(): AssetManifest {
  const parsed = JSON.parse(readFileSync(ASSET_MANIFEST_PATH, 'utf8')) as unknown
  if (!isRecord(parsed) || parsed.version !== 1 || !Array.isArray(parsed.assets)) {
    throw new Error('src/assets/game/manifest.json must contain version 1 and an assets array')
  }

  const assets = parsed.assets.map((asset, index) => {
    if (!isRecord(asset) || typeof asset.id !== 'string' || typeof asset.src !== 'string') {
      throw new Error(`Invalid asset manifest entry at index ${index}`)
    }
    return { id: asset.id, src: asset.src }
  })
  return { version: 1, assets }
}

function loadViteManifest(): ViteManifest {
  const parsed = JSON.parse(readFileSync(VITE_MANIFEST_PATH, 'utf8')) as unknown
  if (!isRecord(parsed)) throw new Error('dist/.vite/manifest.json is not an object')

  const manifest: ViteManifest = {}
  for (const [key, rawEntry] of Object.entries(parsed)) {
    if (!isRecord(rawEntry) || typeof rawEntry.file !== 'string') continue
    manifest[key] = {
      file: rawEntry.file,
      ...(typeof rawEntry.src === 'string' ? { src: rawEntry.src } : {}),
      ...(Array.isArray(rawEntry.assets) && rawEntry.assets.every((value) => typeof value === 'string')
        ? { assets: rawEntry.assets }
        : {}),
      ...(Array.isArray(rawEntry.css) && rawEntry.css.every((value) => typeof value === 'string')
        ? { css: rawEntry.css }
        : {}),
    }
  }
  return manifest
}

function toPosixPath(filePath: string): string {
  return filePath.split(sep).join('/')
}

function pathIsInside(root: string, candidate: string): boolean {
  const pathFromRoot = relative(root, candidate)
  return (
    pathFromRoot === '' ||
    (pathFromRoot !== '..' && !pathFromRoot.startsWith(`..${sep}`) && !isAbsolute(pathFromRoot))
  )
}

function resolveManifestSource(source: string): string {
  if (/^(?:[a-z]+:)?\/\//i.test(source) || source.includes('\\')) {
    throw new Error(`Asset source is not a local POSIX path: ${source}`)
  }
  const absoluteSource = resolve(dirname(ASSET_MANIFEST_PATH), source)
  const assetRoot = resolve(REPOSITORY_ROOT, 'src/assets/game')
  if (!pathIsInside(assetRoot, absoluteSource)) {
    throw new Error(`Asset source escapes src/assets/game: ${source}`)
  }
  return toPosixPath(relative(REPOSITORY_ROOT, absoluteSource))
}

function normalizeViteReference(reference: string): string {
  const withoutQuery = reference.split('?', 1)[0] ?? reference
  return withoutQuery.replace(/^\/+/, '').replaceAll('\\', '/')
}

function referenceMatchesSource(reference: string, source: string): boolean {
  const normalized = normalizeViteReference(reference)
  return normalized === source || normalized.endsWith(`/${source}`)
}

function walkFiles(root: string, current = root): string[] {
  const output: string[] = []
  for (const entry of readdirSync(current, { withFileTypes: true })) {
    const absoluteEntry = resolve(current, entry.name)
    if (entry.isDirectory()) output.push(...walkFiles(root, absoluteEntry))
    else if (entry.isFile()) output.push(toPosixPath(relative(root, absoluteEntry)))
  }
  return output
}

function outputFilesForSource(
  source: string,
  viteManifest: ViteManifest,
  distFiles: string[],
): Set<string> {
  const output = new Set<string>()
  for (const [key, entry] of Object.entries(viteManifest)) {
    if (
      !referenceMatchesSource(key, source) &&
      !(entry.src !== undefined && referenceMatchesSource(entry.src, source))
    ) {
      continue
    }
    output.add(normalizeViteReference(entry.file))
    for (const asset of entry.assets ?? []) output.add(normalizeViteReference(asset))
    for (const css of entry.css ?? []) output.add(normalizeViteReference(css))
  }

  // Vite keeps the source basename when emitting ordinary assets. This closes
  // the gap for assets listed on a parent chunk rather than as their own entry.
  const sourceExtension = extname(source).toLowerCase()
  const sourceStem = basename(source, sourceExtension)
  for (const distFile of distFiles) {
    if (extname(distFile).toLowerCase() !== sourceExtension) continue
    const outputStem = basename(distFile, sourceExtension)
    if (outputStem === sourceStem || outputStem.startsWith(`${sourceStem}-`)) {
      output.add(distFile)
    }
  }
  return output
}

function resolveRequestedDistFile(rawUrl: string): { absolute: string; relative: string } {
  const url = new URL(rawUrl)
  let pathname
  try {
    pathname = decodeURIComponent(url.pathname)
  } catch {
    throw new Error(`Request URL has invalid escaping: ${rawUrl}`)
  }
  if (pathname.includes('\0') || pathname.includes('\\')) {
    throw new Error(`Request URL contains an unsafe path: ${rawUrl}`)
  }
  if (pathname.split('/').some((segment) => segment === '..' || segment === '.')) {
    throw new Error(`Request URL traverses outside dist: ${rawUrl}`)
  }

  const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '')
  const candidate = resolve(DIST_ROOT, relativePath)
  if (!pathIsInside(DIST_ROOT, candidate) || !statSync(candidate).isFile()) {
    throw new Error(`Successful local response does not map to a dist file: ${rawUrl}`)
  }
  const realCandidate = realpathSync(candidate)
  if (!pathIsInside(REAL_DIST_ROOT, realCandidate)) {
    throw new Error(`Successful local response resolves outside dist: ${rawUrl}`)
  }
  return { absolute: realCandidate, relative: toPosixPath(relative(DIST_ROOT, candidate)) }
}

function expectedContentType(file: string): string | null {
  switch (extname(file).toLowerCase()) {
    case '.avif': return 'image/avif'
    case '.css': return 'text/css'
    case '.gif': return 'image/gif'
    case '.html': return 'text/html'
    case '.ico': return 'image/x-icon'
    case '.jpeg':
    case '.jpg': return 'image/jpeg'
    case '.js':
    case '.mjs': return 'text/javascript'
    case '.json': return 'application/json'
    case '.otf': return 'font/otf'
    case '.png': return 'image/png'
    case '.svg': return 'image/svg+xml'
    case '.ttf': return 'font/ttf'
    case '.wasm': return 'application/wasm'
    case '.webp': return 'image/webp'
    case '.woff': return 'font/woff'
    case '.woff2': return 'font/woff2'
    default: return null
  }
}

function addOutputFiles(target: Set<string>, files: Iterable<string>) {
  for (const file of files) target.add(file)
}

function intersection(left: Set<string>, right: Set<string>): string[] {
  return [...left].filter((value) => right.has(value)).sort()
}

function findAsset(entries: AssetManifestEntry[], id: string): AssetManifestEntry {
  const entry = entries.find((asset) => asset.id === id)
  if (entry === undefined) throw new Error(`Required asset ID is missing: ${id}`)
  return entry
}

async function captureResponse(response: Response): Promise<CapturedResponse | null> {
  const url = new URL(response.url())
  if (url.origin !== ORIGIN) return null
  const headers = await response.allHeaders()
  return {
    url: url.href,
    resourceType: response.request().resourceType(),
    status: response.status(),
    cacheControl: headers['cache-control'] ?? '',
    contentType: headers['content-type'] ?? '',
  }
}

function findDebugMarkerOccurrences(files: string[]): DebugMarkerOccurrence[] {
  const occurrences: DebugMarkerOccurrence[] = []
  for (const file of files) {
    const contents = readFileSync(resolve(DIST_ROOT, file), 'utf8').replaceAll('\\', '/')
    for (const marker of DEBUG_BUNDLE_MARKERS) {
      if (contents.includes(marker)) occurrences.push({ file, marker })
    }
  }
  return occurrences
}

test('dist server keeps SPA fallback inside dist and disables caching on errors', async ({
  request,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'chromium-cold-load',
    'This production-only assertion runs through playwright.assets.config.ts.',
  )

  const spaFallback = await request.get(`${ORIGIN}/expedition/visual-check`)
  expect(spaFallback.status()).toBe(200)
  expect(spaFallback.headers()['content-type']).toContain('text/html')
  expect(spaFallback.headers()['cache-control']).toContain('no-store')
  expect(await spaFallback.text()).toContain('<div id="root">')

  const missingStaticAsset = await request.get(`${ORIGIN}/assets/not-in-dist.js`)
  expect(missingStaticAsset.status()).toBe(404)
  expect(missingStaticAsset.headers()['content-type']).toContain('text/plain')
  expect(missingStaticAsset.headers()['cache-control']).toContain('no-store')

  const traversal = await request.get(`${ORIGIN}/%2e%2e%2fpackage.json`)
  expect(traversal.status()).toBe(400)
  expect(traversal.headers()['cache-control']).toContain('no-store')
})

test('production bundle and DOM exclude the IRPG-507 debug panel', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'chromium-cold-load',
    'This production-only assertion runs through playwright.assets.config.ts.',
  )

  const distTextFiles = walkFiles(DIST_ROOT).filter((file) => {
    const extension = extname(file).toLowerCase()
    return extension === '.js' || extension === '.css'
  })
  const scannedFiles = [toPosixPath(relative(DIST_ROOT, VITE_MANIFEST_PATH)), ...distTextFiles]
  const markerOccurrences = findDebugMarkerOccurrences(scannedFiles)

  await page.addInitScript(() => {
    const debugOverrides = {
      IRPG507_DEBUG_PANEL: '1',
      debug: 'true',
      'irpg.debug': 'true',
      'irpg507.debug': 'true',
      'irpg-507-debug-panel': 'true',
    }
    for (const [key, value] of Object.entries(debugOverrides)) {
      localStorage.setItem(key, value)
    }
  })

  await page.goto('/?debug=1&dev=1&IRPG507_DEBUG_PANEL=1#IRPG507_DEBUG_PANEL', {
    waitUntil: 'networkidle',
  })
  await expect(page.locator('#root')).not.toBeEmpty()

  const domEvidence = await page.locator('body').evaluate((body) => ({
    text: body.textContent ?? '',
    html: body.innerHTML,
  }))
  const debugTextMarkers = DEBUG_BUNDLE_MARKERS.slice(1).filter((marker) =>
    domEvidence.text.includes(marker),
  )

  await testInfo.attach('irpg-507-production-debug-absence.json', {
    body: Buffer.from(JSON.stringify({
      scannedFiles,
      markerOccurrences,
      attemptedUrl: page.url(),
      attemptedLocalStorageKeys: [
        'IRPG507_DEBUG_PANEL',
        'debug',
        'irpg.debug',
        'irpg507.debug',
        'irpg-507-debug-panel',
      ],
      debugTextMarkers,
      debugSelectorMatches: await page.locator(DEBUG_DOM_SELECTORS).count(),
    }, null, 2)),
    contentType: 'application/json',
  })

  expect(distTextFiles.length, 'Production build emitted no JavaScript or CSS files').toBeGreaterThan(0)
  expect(markerOccurrences, 'Production manifest or JS/CSS contains IRPG-507 debug code').toEqual([])
  expect(debugTextMarkers, 'Production DOM exposes an IRPG-507 debug marker').toEqual([])
  await expect(
    page.locator(DEBUG_DOM_SELECTORS),
    'Production DOM exposes an IRPG-507 debug trigger or panel',
  ).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: /(?:개발자|디버그).*(?:패널|도구)/ }),
    'Production DOM exposes a debug-panel activation button',
  ).toHaveCount(0)
})

test('production cold load stays within the asset budget and preserves lazy namespaces', async ({
  browser,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'chromium-cold-load',
    'This production-only assertion runs through playwright.assets.config.ts.',
  )

  const context = await browser.newContext({
    baseURL: ORIGIN,
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    serviceWorkers: 'block',
    viewport: { width: 1_440, height: 900 },
  })
  const page = await context.newPage()
  const cdp = await context.newCDPSession(page)
  await cdp.send('Network.enable')
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true })

  const captured: CapturedResponse[] = []
  const pendingResponses = new Set<Promise<void>>()
  page.on('response', (response) => {
    const pending = captureResponse(response).then((result) => {
      if (result !== null) captured.push(result)
    })
    pendingResponses.add(pending)
    void pending.then(
      () => pendingResponses.delete(pending),
      () => pendingResponses.delete(pending),
    )
  })

  try {
    await page.goto('/', { waitUntil: 'networkidle' })
    while (pendingResponses.size > 0) await Promise.all([...pendingResponses])
    await expect(page.getByRole('heading', { name: '꺼지지 않는 원정' })).toBeVisible()

    const failedLocalResponses = captured.filter(
      (response) => response.status < 200 || response.status >= 300,
    )
    const noStoreViolations = captured.filter(
      (response) => !response.cacheControl.includes('no-store'),
    )
    const successfulResponses = new Map<string, CapturedResponse>()
    for (const response of captured) {
      if (response.status >= 200 && response.status < 300) {
        successfulResponses.set(response.url, response)
      }
    }

    const budgetResources: BudgetResource[] = []
    const mimeViolations: Array<{ url: string; expected: string; actual: string }> = []
    for (const response of successfulResponses.values()) {
      if (!COUNTED_RESOURCE_TYPES.has(response.resourceType)) continue
      if (new URL(response.url).pathname.endsWith('.map')) continue

      const distFile = resolveRequestedDistFile(response.url)
      const expectedMime = expectedContentType(distFile.relative)
      if (expectedMime !== null && !response.contentType.includes(expectedMime)) {
        mimeViolations.push({
          url: response.url,
          expected: expectedMime,
          actual: response.contentType,
        })
      }
      const source = readFileSync(distFile.absolute)
      budgetResources.push({
        ...response,
        distFile: distFile.relative,
        sourceBytes: source.byteLength,
        gzipBytes: gzipSync(source, { level: 9 }).byteLength,
      })
    }

    const totalGzipBytes = budgetResources.reduce((total, resource) => total + resource.gzipBytes, 0)
    const requestedDistFiles = new Set(budgetResources.map((resource) => resource.distFile))
    const assetManifest = loadAssetManifest()
    const viteManifest = loadViteManifest()
    const distFiles = walkFiles(DIST_ROOT)
    const outputsByAssetId = new Map<string, Set<string>>()
    for (const entry of assetManifest.assets) {
      const source = resolveManifestSource(entry.src)
      outputsByAssetId.set(entry.id, outputFilesForSource(source, viteManifest, distFiles))
    }

    const hero = findAsset(assetManifest.assets, 'hero.ashen-knight.default')
    const currentEnemy = findAsset(assetManifest.assets, 'enemy.ash-slime')
    const heroOutputs = outputsByAssetId.get(hero.id) ?? new Set<string>()
    const currentEnemyOutputs = outputsByAssetId.get(currentEnemy.id) ?? new Set<string>()
    const heroImageOutputs = new Set([...heroOutputs].filter((file) => IMAGE_EXTENSIONS.has(extname(file).toLowerCase())))
    const currentEnemyImageOutputs = new Set(
      [...currentEnemyOutputs].filter((file) => IMAGE_EXTENSIONS.has(extname(file).toLowerCase())),
    )
    const regionImageOutputsById = new Map<string, Set<string>>()
    const allRegionImageOutputs = new Set<string>()
    for (const entry of assetManifest.assets.filter(({ id }) => id.startsWith('region.'))) {
      const imageOutputs = new Set(
        [...(outputsByAssetId.get(entry.id) ?? [])].filter((file) =>
          IMAGE_EXTENSIONS.has(extname(file).toLowerCase()),
        ),
      )
      regionImageOutputsById.set(entry.id, imageOutputs)
      addOutputFiles(allRegionImageOutputs, imageOutputs)
    }
    const cardImageOutputsById = new Map<string, Set<string>>()
    const allCardImageOutputs = new Set<string>()
    for (const entry of assetManifest.assets.filter(({ id }) =>
      /^(?:equipment|skill)\./.test(id),
    )) {
      const imageOutputs = new Set(
        [...(outputsByAssetId.get(entry.id) ?? [])].filter((file) =>
          IMAGE_EXTENSIONS.has(extname(file).toLowerCase()),
        ),
      )
      cardImageOutputsById.set(entry.id, imageOutputs)
      addOutputFiles(allCardImageOutputs, imageOutputs)
    }

    const lazyOutputs = new Set<string>()
    const nonCurrentCombatOutputs = new Set<string>()
    for (const entry of assetManifest.assets) {
      const outputs = outputsByAssetId.get(entry.id) ?? []
      if (/^(?:region|equipment|skill|result|event)\./.test(entry.id)) {
        addOutputFiles(lazyOutputs, outputs)
      }
      if ((entry.id.startsWith('enemy.') && entry.id !== currentEnemy.id) || entry.id.startsWith('boss.')) {
        addOutputFiles(nonCurrentCombatOutputs, outputs)
      }
    }

    const evidence = {
      budgetBytes: BUDGET_BYTES,
      totalGzipBytes,
      remainingBytes: BUDGET_BYTES - totalGzipBytes,
      localResponseCount: captured.length,
      requestedUrlCount: successfulResponses.size,
      failedLocalResponses,
      noStoreViolations,
      mimeViolations,
      countedResourceCount: budgetResources.length,
      heroOutputs: [...heroImageOutputs].sort(),
      currentEnemyOutputs: [...currentEnemyImageOutputs].sort(),
      initialRegionImageRequests: intersection(allRegionImageOutputs, requestedDistFiles),
      initialCardImageRequests: intersection(allCardImageOutputs, requestedDistFiles),
      lazyOutputRequests: intersection(lazyOutputs, requestedDistFiles),
      nonCurrentCombatRequests: intersection(nonCurrentCombatOutputs, requestedDistFiles),
      resources: budgetResources.sort((left, right) => left.url.localeCompare(right.url)),
    }
    await testInfo.attach('irpg-406-cold-load-budget.json', {
      body: Buffer.from(JSON.stringify(evidence, null, 2)),
      contentType: 'application/json',
    })

    expect(failedLocalResponses, 'A same-origin production request failed').toEqual([])
    expect(noStoreViolations, 'A same-origin response allowed HTTP caching').toEqual([])
    expect(mimeViolations, 'A production response used the wrong MIME type').toEqual([])
    expect(budgetResources.length, 'No production resources were counted').toBeGreaterThan(0)
    expect(totalGzipBytes).toBeLessThanOrEqual(BUDGET_BYTES)
    expect(heroImageOutputs.size, 'Vite manifest has no emitted hero image').toBeGreaterThan(0)
    expect(currentEnemyImageOutputs.size, 'Vite manifest has no emitted stage-1 enemy image').toBeGreaterThan(0)
    expect(intersection(heroImageOutputs, requestedDistFiles), 'Hero image was not requested').not.toEqual([])
    expect(
      intersection(currentEnemyImageOutputs, requestedDistFiles),
      'Stage-1 ash slime image was not requested',
    ).not.toEqual([])
    expect(evidence.lazyOutputRequests, 'A lazy region/card/result/event asset was requested').toEqual([])
    expect(
      evidence.nonCurrentCombatRequests,
      'A non-current enemy or boss asset was requested',
    ).toEqual([])

    const activeRegionId = 'region.ashen-border'
    const activeRegionImageOutputs = regionImageOutputsById.get(activeRegionId) ?? new Set<string>()
    expect(evidence.initialRegionImageRequests, 'A region image loaded before map disclosure').toEqual([])
    expect(evidence.initialCardImageRequests, 'A progression card loaded before entering the panel').toEqual([])
    expect(activeRegionImageOutputs.size, 'Vite manifest has no unique active-region image').toBe(1)

    await page.getByRole('button', { name: '원정 지도 열기' }).click()
    const activeRegionArt = page.locator('.stage-map-scene__art')
    await expect(activeRegionArt).toHaveAttribute('data-asset-id', activeRegionId)
    await expect(activeRegionArt).toHaveAttribute('data-state', 'loaded')
    while (pendingResponses.size > 0) await Promise.all([...pendingResponses])

    const imageRequestsAfterDisclosure = new Set(
      captured
        .filter(({ resourceType, status }) =>
          resourceType === 'image' && status >= 200 && status < 300,
        )
        .map(({ url }) => resolveRequestedDistFile(url).relative),
    )
    const regionImageRequestsAfterDisclosure = intersection(
      allRegionImageOutputs,
      imageRequestsAfterDisclosure,
    )
    const expectedActiveRegionRequests = intersection(
      activeRegionImageOutputs,
      imageRequestsAfterDisclosure,
    )
    const regionLazyLoadEvidence = {
      activeRegionId,
      activeRegionImageOutputs: [...activeRegionImageOutputs].sort(),
      regionImageRequestsAfterDisclosure,
      expectedActiveRegionRequests,
    }
    await testInfo.attach('irpg-408-region-lazy-load.json', {
      body: Buffer.from(JSON.stringify(regionLazyLoadEvidence, null, 2)),
      contentType: 'application/json',
    })

    expect(expectedActiveRegionRequests, 'Opening the map did not request its active region').toHaveLength(1)
    expect(
      regionImageRequestsAfterDisclosure,
      'Opening the map requested an inactive region image',
    ).toEqual(expectedActiveRegionRequests)

    const cardSlots = page.locator('[data-card-asset-id]')
    await expect(cardSlots).toHaveCount(6)
    for (let index = 0; index < 6; index += 1) {
      const slot = cardSlots.nth(index)
      const assetId = await slot.getAttribute('data-card-asset-id')
      expect(assetId).not.toBeNull()
      expect(cardImageOutputsById.get(assetId ?? '')?.size).toBe(1)
      await slot.scrollIntoViewIfNeeded()
      await expect(slot).toHaveAttribute('data-art-active', 'true')
      await expect(slot.locator('.growth-card__asset')).toHaveAttribute('data-state', 'loaded')
    }
    while (pendingResponses.size > 0) await Promise.all([...pendingResponses])

    const imageRequestsAfterCards = new Set(
      captured
        .filter(({ resourceType, status }) =>
          resourceType === 'image' && status >= 200 && status < 300,
        )
        .map(({ url }) => resolveRequestedDistFile(url).relative),
    )
    const cardImageRequestsAfterActivation = intersection(
      allCardImageOutputs,
      imageRequestsAfterCards,
    )
    const cardImageResponseFiles = captured
      .filter(({ resourceType, status }) =>
        resourceType === 'image' && status >= 200 && status < 300,
      )
      .map(({ url }) => resolveRequestedDistFile(url).relative)
      .filter((file) => allCardImageOutputs.has(file))
      .sort()
    const expectedCardRequests = [...cardImageOutputsById.values()]
      .flatMap((files) => [...files])
      .sort()
    const cardLazyLoadEvidence = {
      cardIds: [...cardImageOutputsById.keys()],
      initialCardImageRequests: evidence.initialCardImageRequests,
      cardImageRequestsAfterActivation,
      cardImageResponseFiles,
      expectedCardRequests,
    }
    await testInfo.attach('irpg-409-card-lazy-load.json', {
      body: Buffer.from(JSON.stringify(cardLazyLoadEvidence, null, 2)),
      contentType: 'application/json',
    })

    expect(cardImageRequestsAfterActivation).toEqual(expectedCardRequests)
    expect(cardImageResponseFiles).toEqual(expectedCardRequests)
  } finally {
    await context.close()
  }
})
