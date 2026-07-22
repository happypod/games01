import { Buffer } from 'node:buffer'
import { createReadStream, existsSync, realpathSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path'
import { URL, fileURLToPath } from 'node:url'

const HOST = '127.0.0.1'
const PORT = Number.parseInt(globalThis.process.env.PORT ?? '4174', 10)
const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const DIST_ROOT = resolve(REPOSITORY_ROOT, 'dist')
const INDEX_PATH = resolve(DIST_ROOT, 'index.html')

const MIME_TYPES = new Map([
  ['.avif', 'image/avif'],
  ['.css', 'text/css; charset=utf-8'],
  ['.gif', 'image/gif'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.otf', 'font/otf'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml; charset=utf-8'],
  ['.ttf', 'font/ttf'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.wasm', 'application/wasm'],
  ['.webp', 'image/webp'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
])

if (!Number.isSafeInteger(PORT) || PORT < 1 || PORT > 65_535) {
  throw new Error(`Invalid PORT: ${globalThis.process.env.PORT ?? '4174'}`)
}

if (!existsSync(INDEX_PATH)) {
  throw new Error(`Production build not found at ${INDEX_PATH}. Run npm run build first.`)
}

const REAL_DIST_ROOT = realpathSync(DIST_ROOT)

function setNoStoreHeaders(response) {
  response.setHeader('Cache-Control', 'no-store, max-age=0')
  response.setHeader('Pragma', 'no-cache')
  response.setHeader('Expires', '0')
  response.setHeader('X-Content-Type-Options', 'nosniff')
}

function endText(response, statusCode, text) {
  const body = Buffer.from(text, 'utf8')
  response.statusCode = statusCode
  response.setHeader('Content-Type', 'text/plain; charset=utf-8')
  response.setHeader('Content-Length', body.byteLength)
  response.end(body)
}

function isWithinDist(candidate) {
  const pathFromRoot = relative(REAL_DIST_ROOT, candidate)
  return pathFromRoot === '' || (!pathFromRoot.startsWith(`..${sep}`) && pathFromRoot !== '..' && !isAbsolute(pathFromRoot))
}

function decodeSafePathname(rawUrl) {
  let pathname
  try {
    pathname = decodeURIComponent(new URL(rawUrl, `http://${HOST}:${PORT}`).pathname)
  } catch {
    return null
  }

  if (pathname.includes('\0') || pathname.includes('\\')) return null
  const segments = pathname.split('/')
  if (segments.some((segment) => segment === '..' || segment === '.')) return null
  return pathname
}

function resolveRequestedFile(pathname) {
  const relativePath = pathname.replace(/^\/+/, '')
  const candidate = resolve(DIST_ROOT, relativePath || 'index.html')
  const candidateFromRoot = relative(DIST_ROOT, candidate)
  if (
    candidateFromRoot === '..' ||
    candidateFromRoot.startsWith(`..${sep}`) ||
    isAbsolute(candidateFromRoot)
  ) {
    return { status: 'forbidden' }
  }

  if (existsSync(candidate) && statSync(candidate).isFile()) {
    const realCandidate = realpathSync(candidate)
    return isWithinDist(realCandidate)
      ? { status: 'file', path: realCandidate }
      : { status: 'forbidden' }
  }

  // Extension-bearing URLs are static resource requests and must not receive
  // the SPA document, which would hide missing build assets behind HTTP 200.
  if (extname(relativePath) !== '') return { status: 'missing' }
  return { status: 'file', path: INDEX_PATH }
}

const server = createServer((request, response) => {
  setNoStoreHeaders(response)

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.setHeader('Allow', 'GET, HEAD')
    endText(response, 405, 'Method Not Allowed')
    return
  }

  const pathname = decodeSafePathname(request.url ?? '/')
  if (pathname === null) {
    endText(response, 400, 'Bad Request')
    return
  }

  const resolvedFile = resolveRequestedFile(pathname)
  if (resolvedFile.status === 'forbidden') {
    endText(response, 403, 'Forbidden')
    return
  }
  if (resolvedFile.status === 'missing') {
    endText(response, 404, 'Not Found')
    return
  }

  let fileStats
  try {
    fileStats = statSync(resolvedFile.path)
  } catch {
    endText(response, 404, 'Not Found')
    return
  }

  response.statusCode = 200
  response.setHeader(
    'Content-Type',
    MIME_TYPES.get(extname(resolvedFile.path).toLowerCase()) ?? 'application/octet-stream',
  )
  response.setHeader('Content-Length', fileStats.size)

  if (request.method === 'HEAD') {
    response.end()
    return
  }

  const stream = createReadStream(resolvedFile.path)
  stream.on('error', () => {
    if (!response.headersSent) endText(response, 500, 'Internal Server Error')
    else response.destroy()
  })
  stream.pipe(response)
})

server.listen(PORT, HOST, () => {
  globalThis.process.stdout.write(`IRPG-406 dist server listening at http://${HOST}:${PORT}\n`)
})

let shuttingDown = false

function shutdown() {
  if (shuttingDown) return
  shuttingDown = true
  server.close(() => globalThis.process.exit(0))
  server.closeIdleConnections()
  server.closeAllConnections()
}

globalThis.process.once('SIGINT', shutdown)
globalThis.process.once('SIGTERM', shutdown)
