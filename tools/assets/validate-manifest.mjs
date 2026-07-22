import { createHash } from 'node:crypto'
import { readFile, readdir, realpath, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const REQUIRED_ASSET_IDS = Object.freeze([
  'hero.ashen-knight.default',
  'companion.ember-fox.default',
  'costume.chapter1.sera.ember-bond',
  'enemy.ash-slime',
  'enemy.twilight-wolf',
  'enemy.abandoned-armor',
  'enemy.charred-shaman',
  'enemy.abyss-sentinel',
  'boss.ash-giant',
  'boss.eclipse-knight',
  'boss.eclipse-knight.damaged',
  'boss.eclipse-knight.severe',
  'boss.forgotten-dragon',
  'region.ashen-border',
  'region.moonfall-pass',
  'region.forgotten-caldera',
  'equipment.ember-blade',
  'equipment.guard-armor',
  'equipment.fortune-charm',
  'skill.power-strike',
  'skill.iron-will',
  'skill.loot-sense',
  'result.boss-victory',
  'result.defeat',
  'event.ember-shrine',
  'event.wandering-smith',
  'event.ash-camp',
  'fallback.character',
  'fallback.region',
  'fallback.card',
  'fallback.result',
])

export const ERROR_CODES = Object.freeze({
  MANIFEST_PARSE: 'MANIFEST_PARSE',
  MANIFEST_SHAPE: 'MANIFEST_SHAPE',
  MISSING_ID: 'MISSING_ID',
  UNEXPECTED_ID: 'UNEXPECTED_ID',
  DUPLICATE_ID: 'DUPLICATE_ID',
  INVALID_ENTRY: 'INVALID_ENTRY',
  INVALID_KIND: 'INVALID_KIND',
  INVALID_STATUS: 'INVALID_STATUS',
  NAMESPACE_KIND_MISMATCH: 'NAMESPACE_KIND_MISMATCH',
  INVALID_SRC: 'INVALID_SRC',
  REMOTE_SRC: 'REMOTE_SRC',
  PATH_ESCAPE: 'PATH_ESCAPE',
  MISSING_FILE: 'MISSING_FILE',
  NOT_FILE: 'NOT_FILE',
  FORMAT_MISMATCH: 'FORMAT_MISMATCH',
  HEADER_FORMAT_MISMATCH: 'HEADER_FORMAT_MISMATCH',
  INVALID_IMAGE: 'INVALID_IMAGE',
  UNSAFE_SVG: 'UNSAFE_SVG',
  DIMENSION_MISMATCH: 'DIMENSION_MISMATCH',
  BYTES_MISMATCH: 'BYTES_MISMATCH',
  HASH_REQUIRED: 'HASH_REQUIRED',
  HASH_MISMATCH: 'HASH_MISMATCH',
  DUPLICATE_SRC: 'DUPLICATE_SRC',
  DUPLICATE_SHA256: 'DUPLICATE_SHA256',
  BUDGET_EXCEEDED: 'BUDGET_EXCEEDED',
  RIGHTS_METADATA: 'RIGHTS_METADATA',
  METADATA_PATH_ESCAPE: 'METADATA_PATH_ESCAPE',
  METADATA_FILE_MISSING: 'METADATA_FILE_MISSING',
  CHAPTER_SCOPE_VIOLATION: 'CHAPTER_SCOPE_VIOLATION',
})

const KINDS = new Set([
  'hero',
  'companion',
  'costume',
  'enemy',
  'boss',
  'region',
  'equipment',
  'skill',
  'result',
  'event',
  'fallback',
])
const STATUSES = new Set(['ready', 'placeholder'])
const FORMATS = new Set(['webp', 'svg'])
const SOURCE_TYPES = new Set(['original', 'generated', 'licensed'])
const LICENSES = new Set([
  'project-owned',
  'CC0-1.0',
  'CC-BY-4.0',
  'commercial-redistribution',
])
const REQUIRED_FIELDS = [
  'id',
  'kind',
  'status',
  'src',
  'format',
  'width',
  'height',
  'bytes',
  'sourceType',
  'author',
  'license',
]
const OPTIONAL_FIELDS = [
  'attribution',
  'proofPath',
  'sourceUrl',
  'generator',
  'promptRecord',
  'sha256',
]
const ALLOWED_FIELDS = new Set([...REQUIRED_FIELDS, ...OPTIONAL_FIELDS])

const FINAL_CONTENT_ASSET_IDS = new Set([
  'companion.ember-fox.default',
  'costume.chapter1.sera.ember-bond',
  'boss.eclipse-knight.damaged',
  'boss.eclipse-knight.severe',
  'region.ashen-border',
  'region.moonfall-pass',
  'region.forgotten-caldera',
  'equipment.ember-blade',
  'equipment.guard-armor',
  'equipment.fortune-charm',
  'skill.power-strike',
  'skill.iron-will',
  'skill.loot-sense',
  'result.boss-victory',
  'result.defeat',
  'event.ember-shrine',
  'event.wandering-smith',
  'event.ash-camp',
])

const REQUIRED_PROMPT_RECORD_BY_ASSET_ID = new Map([
  ['companion.ember-fox.default', 'docs/assets/prompts/companion-ember-fox.md'],
  ['costume.chapter1.sera.ember-bond', 'docs/assets/prompts/chapter1-sera-ember-bond.md'],
  ['boss.eclipse-knight.damaged', 'docs/assets/prompts/eclipse-knight-damage-states.md'],
  ['boss.eclipse-knight.severe', 'docs/assets/prompts/eclipse-knight-damage-states.md'],
  ['result.boss-victory', 'docs/assets/prompts/battle-results.md'],
  ['result.defeat', 'docs/assets/prompts/battle-results.md'],
  ['event.ember-shrine', 'docs/assets/prompts/expedition-event-cards.md'],
  ['event.wandering-smith', 'docs/assets/prompts/expedition-event-cards.md'],
  ['event.ash-camp', 'docs/assets/prompts/expedition-event-cards.md'],
])

const SPEC_BY_KIND = Object.freeze({
  hero: { format: 'webp', width: 768, height: 768, maxBytes: 250 * 1024 },
  companion: { format: 'webp', width: 768, height: 768, maxBytes: 250 * 1024 },
  costume: { format: 'webp', width: 768, height: 768, maxBytes: 250 * 1024 },
  enemy: { format: 'webp', width: 768, height: 768, maxBytes: 250 * 1024 },
  boss: { format: 'webp', width: 768, height: 768, maxBytes: 250 * 1024 },
  region: { format: 'webp', width: 1600, height: 900, maxBytes: 350 * 1024 },
  equipment: { format: 'webp', width: 512, height: 512, maxBytes: 160 * 1024 },
  skill: { format: 'webp', width: 512, height: 512, maxBytes: 160 * 1024 },
  event: { format: 'webp', width: 512, height: 512, maxBytes: 160 * 1024 },
  result: { format: 'webp', width: 1280, height: 720, maxBytes: 300 * 1024 },
})

const FALLBACK_SPECS = Object.freeze({
  'fallback.character': { format: 'svg', width: 768, height: 768, maxBytes: 20 * 1024 },
  'fallback.region': { format: 'svg', width: 1600, height: 900, maxBytes: 20 * 1024 },
  'fallback.card': { format: 'svg', width: 512, height: 512, maxBytes: 20 * 1024 },
  'fallback.result': { format: 'svg', width: 1280, height: 720, maxBytes: 20 * 1024 },
})

const CHAPTER_ONE_COSTUME_ID_PATTERN =
  /^costume\.chapter1\.[a-z0-9]+(?:-[a-z0-9]+)*\.[a-z0-9]+(?:-[a-z0-9]+)*$/
const CHAPTER_ONE_COSTUME_SOURCE_PREFIX = './files/costume/chapter1/'
const FORBIDDEN_CHAPTER_REFERENCE =
  /(?:^|[._/\\ -])chapter(?:[._/\\ -]?)(?:iii|ii|[23])(?=$|[._/\\ -])/i

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function isPositiveInteger(value) {
  return Number.isSafeInteger(value) && value > 0
}

function isChapterOneCostumeAssetId(value) {
  return typeof value === 'string' && CHAPTER_ONE_COSTUME_ID_PATTERN.test(value)
}

function isFinalContentAssetId(value) {
  return FINAL_CONTENT_ASSET_IDS.has(value) || isChapterOneCostumeAssetId(value)
}

function hasForbiddenChapterReference(value) {
  return typeof value === 'string' && FORBIDDEN_CHAPTER_REFERENCE.test(value)
}

function isInside(parent, child) {
  const relative = path.relative(parent, child)
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))
}

function addError(errors, code, message, id, field) {
  const error = { code, message }
  if (id !== undefined) error.id = id
  if (field !== undefined) error.field = field
  errors.push(error)
}

async function validateDeployedChapterScope(filesRoot, errors) {
  const directories = [filesRoot]
  const deployedFiles = []

  while (directories.length > 0) {
    const directory = directories.pop()
    const entries = await readdir(directory, { withFileTypes: true })
    for (const entry of entries) {
      const target = path.join(directory, entry.name)
      if (entry.isDirectory()) directories.push(target)
      else if (entry.isFile()) deployedFiles.push(target)
    }
  }

  deployedFiles.sort((left, right) => left.localeCompare(right, 'en'))
  for (const file of deployedFiles) {
    const relative = path.relative(filesRoot, file).split(path.sep).join('/')
    if (hasForbiddenChapterReference(relative)) {
      addError(
        errors,
        ERROR_CODES.CHAPTER_SCOPE_VIOLATION,
        'deployed asset files are limited to CHAPTER I; CHAPTER II and III are forbidden',
        relative,
        'src',
      )
    }
  }
}

function getSpec(entry) {
  if (entry.kind === 'fallback') return FALLBACK_SPECS[entry.id]
  return SPEC_BY_KIND[entry.kind]
}

function inspectWebP(buffer) {
  if (
    buffer.length < 20 ||
    buffer.toString('ascii', 0, 4) !== 'RIFF' ||
    buffer.toString('ascii', 8, 12) !== 'WEBP'
  ) {
    return null
  }

  const declaredFileSize = buffer.readUInt32LE(4) + 8
  let offset = 12
  let dimensions = null

  while (offset + 8 <= buffer.length) {
    const chunkType = buffer.toString('ascii', offset, offset + 4)
    const chunkSize = buffer.readUInt32LE(offset + 4)
    const dataOffset = offset + 8
    if (dataOffset + chunkSize > buffer.length) return { invalid: true }

    if (chunkType === 'VP8X' && chunkSize >= 10) {
      dimensions = {
        width: 1 + buffer.readUIntLE(dataOffset + 4, 3),
        height: 1 + buffer.readUIntLE(dataOffset + 7, 3),
      }
      break
    }

    if (
      chunkType === 'VP8 ' &&
      chunkSize >= 10 &&
      buffer[dataOffset + 3] === 0x9d &&
      buffer[dataOffset + 4] === 0x01 &&
      buffer[dataOffset + 5] === 0x2a
    ) {
      dimensions = {
        width: buffer.readUInt16LE(dataOffset + 6) & 0x3fff,
        height: buffer.readUInt16LE(dataOffset + 8) & 0x3fff,
      }
      break
    }

    if (chunkType === 'VP8L' && chunkSize >= 5 && buffer[dataOffset] === 0x2f) {
      const b1 = buffer[dataOffset + 1]
      const b2 = buffer[dataOffset + 2]
      const b3 = buffer[dataOffset + 3]
      const b4 = buffer[dataOffset + 4]
      dimensions = {
        width: 1 + b1 + ((b2 & 0x3f) << 8),
        height: 1 + ((b2 & 0xc0) >> 6) + (b3 << 2) + ((b4 & 0x0f) << 10),
      }
      break
    }

    offset = dataOffset + chunkSize + (chunkSize % 2)
  }

  if (dimensions === null || dimensions.width <= 0 || dimensions.height <= 0) {
    return { invalid: true }
  }
  return { ...dimensions, invalid: declaredFileSize !== buffer.length }
}

const SAFE_SVG_TAGS = new Set([
  'svg',
  'title',
  'desc',
  'defs',
  'g',
  'linearGradient',
  'radialGradient',
  'stop',
  'clipPath',
  'mask',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'path',
])

const SAFE_SVG_ATTRIBUTES = new Set([
  'xmlns',
  'id',
  'width',
  'height',
  'viewBox',
  'preserveAspectRatio',
  'x',
  'y',
  'x1',
  'y1',
  'x2',
  'y2',
  'cx',
  'cy',
  'r',
  'rx',
  'ry',
  'd',
  'points',
  'offset',
  'fill',
  'fill-rule',
  'fill-opacity',
  'stroke',
  'stroke-width',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-miterlimit',
  'stroke-opacity',
  'opacity',
  'transform',
  'vector-effect',
  'stop-color',
  'stop-opacity',
  'gradientUnits',
  'gradientTransform',
  'spreadMethod',
  'clipPathUnits',
  'maskUnits',
  'maskContentUnits',
])

function hasInvalidXmlEntity(value) {
  return value.replace(/&(?:amp|lt|gt|quot|apos);/g, '').includes('&')
}

function parseSvgAttributes(rawAttributes) {
  const attributes = new Map()
  let remaining = rawAttributes
  while (remaining.length > 0) {
    if (/^\s*$/.test(remaining)) break
    const match = remaining.match(
      /^\s+([A-Za-z_][A-Za-z0-9_.:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/,
    )
    if (match === null) return { attributes, invalid: true, unsafe: false }

    const name = match[1]
    const value = match[2] ?? match[3] ?? ''
    if (attributes.has(name) || value.includes('<') || hasInvalidXmlEntity(value)) {
      return { attributes, invalid: true, unsafe: false }
    }
    attributes.set(name, value)
    remaining = remaining.slice(match[0].length)
  }

  let unsafe = false
  for (const [name, value] of attributes) {
    if (!SAFE_SVG_ATTRIBUTES.has(name)) unsafe = true
    if (name === 'xmlns') {
      if (value !== 'http://www.w3.org/2000/svg') unsafe = true
      continue
    }
    if (/(?:https?:|\/\/|data:|javascript:|@import)/i.test(value)) unsafe = true
    const withoutSafeFragments = value.replace(
      /url\(\s*["']?#[A-Za-z_][\w:.-]*["']?\s*\)/gi,
      '',
    )
    if (/url\s*\(/i.test(withoutSafeFragments)) unsafe = true
  }
  return { attributes, invalid: false, unsafe }
}

function parseSvgLength(value) {
  if (value === undefined || !/^[0-9]+(?:\.[0-9]+)?(?:px)?$/.test(value)) return null
  const parsed = Number(value.replace(/px$/, ''))
  return Number.isFinite(parsed) ? parsed : null
}

function inspectSvg(buffer) {
  const source = buffer.toString('utf8').replace(/^\uFEFF/, '')
  const withoutComments = source.replace(/<!--[\s\S]*?-->/g, '')
  if (/<!--|-->/.test(withoutComments)) return { invalid: true, unsafe: true }

  const document = withoutComments
    .replace(/^\s*<\?xml\s+version\s*=\s*["']1\.[01]["'](?:\s+encoding\s*=\s*["'][A-Za-z0-9._-]+["'])?\s*\?>/i, '')
    .trim()
  if (!document.startsWith('<svg')) return null
  if (/<!|<\?/.test(document)) return { invalid: true, unsafe: true }

  const stack = []
  let rootAttributes = null
  let sawRoot = false
  let rootClosed = false
  let invalid = false
  let unsafe = false
  let cursor = 0

  for (const match of document.matchAll(/<[^>]*>/g)) {
    const token = match[0]
    const tokenIndex = match.index ?? 0
    const textBefore = document.slice(cursor, tokenIndex)
    if (textBefore.includes('<') || hasInvalidXmlEntity(textBefore)) invalid = true
    if ((stack.length === 0 || rootClosed) && textBefore.trim() !== '') invalid = true
    cursor = tokenIndex + token.length

    if (token.startsWith('</')) {
      const closing = token.match(/^<\/([A-Za-z][A-Za-z0-9.-]*)\s*>$/)
      if (closing === null || stack.pop() !== closing[1]) invalid = true
      if (stack.length === 0) rootClosed = true
      continue
    }

    const selfClosing = /\/\s*>$/.test(token)
    const body = token.slice(1, selfClosing ? token.lastIndexOf('/') : -1).trimEnd()
    const opening = body.match(/^([A-Za-z][A-Za-z0-9.-]*)([\s\S]*)$/)
    if (opening === null) {
      invalid = true
      continue
    }

    const name = opening[1]
    const parsedAttributes = parseSvgAttributes(opening[2])
    invalid ||= parsedAttributes.invalid
    unsafe ||= parsedAttributes.unsafe || !SAFE_SVG_TAGS.has(name)

    if (stack.length === 0) {
      if (sawRoot || name !== 'svg') invalid = true
      sawRoot = true
      rootAttributes = parsedAttributes.attributes
      if (rootAttributes.get('xmlns') !== 'http://www.w3.org/2000/svg') unsafe = true
    }
    if (!selfClosing) stack.push(name)
    else if (stack.length === 0) rootClosed = true
  }

  const trailingText = document.slice(cursor)
  if (trailingText.includes('<') || hasInvalidXmlEntity(trailingText) || trailingText.trim() !== '') {
    invalid = true
  }
  if (!sawRoot || !rootClosed || stack.length !== 0 || rootAttributes === null) invalid = true

  let width = parseSvgLength(rootAttributes?.get('width'))
  let height = parseSvgLength(rootAttributes?.get('height'))
  if (width === null || height === null) {
    const viewBox = rootAttributes?.get('viewBox')?.match(
      /^\s*[-+0-9.]+[ ,]+[-+0-9.]+[ ,]+([0-9]+(?:\.[0-9]+)?)[ ,]+([0-9]+(?:\.[0-9]+)?)\s*$/,
    )
    if (viewBox !== undefined && viewBox !== null) {
      width ??= Number(viewBox[1])
      height ??= Number(viewBox[2])
    }
  }

  if (
    width === null ||
    height === null ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    invalid = true
  }
  return { width: width ?? undefined, height: height ?? undefined, invalid, unsafe }
}

async function validateMetadataPath({ value, field, entryId, repoRoot, realRepoRoot, errors }) {
  if (!isNonEmptyString(value) || path.isAbsolute(value) || value.includes('\\') || /^[a-z][a-z\d+.-]*:/i.test(value)) {
    addError(errors, ERROR_CODES.RIGHTS_METADATA, `${field} must be a repository-relative path`, entryId, field)
    return
  }

  const target = path.resolve(repoRoot, value)
  if (!isInside(repoRoot, target)) {
    addError(errors, ERROR_CODES.METADATA_PATH_ESCAPE, `${field} escapes the repository`, entryId, field)
    return
  }

  try {
    const [targetStat, realTarget] = await Promise.all([stat(target), realpath(target)])
    if (!targetStat.isFile()) {
      addError(errors, ERROR_CODES.METADATA_FILE_MISSING, `${field} is not a file`, entryId, field)
    } else if (!isInside(realRepoRoot, realTarget)) {
      addError(errors, ERROR_CODES.METADATA_PATH_ESCAPE, `${field} resolves outside the repository`, entryId, field)
    }
  } catch {
    addError(errors, ERROR_CODES.METADATA_FILE_MISSING, `${field} does not exist`, entryId, field)
  }
}

async function validateRights(entry, context) {
  const { errors, repoRoot, realRepoRoot } = context
  const id = entry.id

  if (!SOURCE_TYPES.has(entry.sourceType)) {
    addError(errors, ERROR_CODES.RIGHTS_METADATA, 'sourceType is not allowed', id, 'sourceType')
  }
  if (!isNonEmptyString(entry.author)) {
    addError(errors, ERROR_CODES.RIGHTS_METADATA, 'author is required', id, 'author')
  }
  if (!LICENSES.has(entry.license)) {
    addError(errors, ERROR_CODES.RIGHTS_METADATA, 'license is not allowed', id, 'license')
  }

  if (entry.license === 'CC-BY-4.0' && !isNonEmptyString(entry.attribution)) {
    addError(errors, ERROR_CODES.RIGHTS_METADATA, 'CC-BY-4.0 requires attribution', id, 'attribution')
  }

  if (entry.license === 'commercial-redistribution') {
    if (!isNonEmptyString(entry.proofPath)) {
      addError(errors, ERROR_CODES.RIGHTS_METADATA, 'commercial redistribution requires proofPath', id, 'proofPath')
    } else {
      await validateMetadataPath({
        value: entry.proofPath,
        field: 'proofPath',
        entryId: id,
        repoRoot,
        realRepoRoot,
        errors,
      })
    }
  }

  if (entry.sourceType === 'generated') {
    if (!isNonEmptyString(entry.generator)) {
      addError(errors, ERROR_CODES.RIGHTS_METADATA, 'generated assets require generator', id, 'generator')
    }
    if (!isNonEmptyString(entry.promptRecord)) {
      addError(errors, ERROR_CODES.RIGHTS_METADATA, 'generated assets require promptRecord', id, 'promptRecord')
    } else {
      await validateMetadataPath({
        value: entry.promptRecord,
        field: 'promptRecord',
        entryId: id,
        repoRoot,
        realRepoRoot,
        errors,
      })
    }
  }

  if (entry.sourceType === 'licensed' && !isNonEmptyString(entry.sourceUrl)) {
    addError(errors, ERROR_CODES.RIGHTS_METADATA, 'licensed assets require sourceUrl', id, 'sourceUrl')
  }
  if (entry.sourceUrl !== undefined) {
    try {
      const sourceUrl = new URL(entry.sourceUrl)
      if (sourceUrl.protocol !== 'https:' || sourceUrl.username !== '' || sourceUrl.password !== '') throw new Error()
    } catch {
      addError(errors, ERROR_CODES.RIGHTS_METADATA, 'sourceUrl must be an HTTPS evidence URL', id, 'sourceUrl')
    }
  }
}

async function validateAssetFile(entry, context) {
  const { manifestDir, filesRoot, realFilesRoot, errors } = context
  const id = entry.id
  const src = entry.src

  if (!isNonEmptyString(src)) {
    addError(errors, ERROR_CODES.INVALID_SRC, 'src is required', id, 'src')
    return
  }
  if (/^[a-z][a-z\d+.-]*:/i.test(src) || src.startsWith('//')) {
    addError(errors, ERROR_CODES.REMOTE_SRC, 'runtime src must be local', id, 'src')
    return
  }
  if (path.isAbsolute(src) || src.includes('\\') || src.includes('?') || src.includes('#') || src.includes('\0')) {
    addError(errors, ERROR_CODES.INVALID_SRC, 'src must be a plain POSIX relative path', id, 'src')
    return
  }

  const target = path.resolve(manifestDir, src)
  if (!isInside(filesRoot, target)) {
    addError(errors, ERROR_CODES.PATH_ESCAPE, 'src escapes the deployed asset directory', id, 'src')
    return
  }
  if (!src.startsWith('./files/')) {
    addError(errors, ERROR_CODES.INVALID_SRC, 'src must start with ./files/', id, 'src')
    return
  }

  let targetStat
  let realTarget
  let buffer
  try {
    ;[targetStat, realTarget, buffer] = await Promise.all([stat(target), realpath(target), readFile(target)])
  } catch {
    addError(errors, ERROR_CODES.MISSING_FILE, 'asset file does not exist', id, 'src')
    return
  }
  if (!isInside(realFilesRoot, realTarget)) {
    addError(errors, ERROR_CODES.PATH_ESCAPE, 'src resolves outside the deployed asset directory', id, 'src')
    return
  }
  if (!targetStat.isFile()) {
    addError(errors, ERROR_CODES.NOT_FILE, 'src is not a regular file', id, 'src')
    return
  }

  const spec = getSpec(entry)
  const extension = path.extname(target).slice(1).toLowerCase()
  if (!FORMATS.has(entry.format) || extension !== entry.format || (spec !== undefined && entry.format !== spec.format)) {
    addError(errors, ERROR_CODES.FORMAT_MISMATCH, 'declared format, extension, and use contract must agree', id, 'format')
  }

  if (!isPositiveInteger(entry.bytes) || entry.bytes !== targetStat.size) {
    addError(errors, ERROR_CODES.BYTES_MISMATCH, 'declared bytes do not match the file', id, 'bytes')
  }
  if (entry.sha256 !== undefined) {
    if (typeof entry.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(entry.sha256)) {
      addError(errors, ERROR_CODES.HASH_MISMATCH, 'sha256 must be 64 lowercase hexadecimal characters', id, 'sha256')
    } else if (createHash('sha256').update(buffer).digest('hex') !== entry.sha256) {
      addError(errors, ERROR_CODES.HASH_MISMATCH, 'declared sha256 does not match the file', id, 'sha256')
    }
  }
  if (spec !== undefined && targetStat.size > spec.maxBytes) {
    addError(errors, ERROR_CODES.BUDGET_EXCEEDED, `asset exceeds ${spec.maxBytes} bytes`, id, 'bytes')
  }

  let inspected
  if (entry.format === 'webp') {
    inspected = inspectWebP(buffer)
    if (inspected === null) {
      addError(errors, ERROR_CODES.HEADER_FORMAT_MISMATCH, 'file header is not WebP', id, 'format')
      return
    }
  } else if (entry.format === 'svg') {
    inspected = inspectSvg(buffer)
    if (inspected === null) {
      addError(errors, ERROR_CODES.HEADER_FORMAT_MISMATCH, 'file header is not SVG', id, 'format')
      return
    }
    if (inspected.unsafe) {
      addError(errors, ERROR_CODES.UNSAFE_SVG, 'SVG contains executable or remote content', id, 'src')
    }
  } else {
    return
  }

  if (inspected.invalid) {
    addError(errors, ERROR_CODES.INVALID_IMAGE, 'image container or dimensions are invalid', id, 'src')
  }
  if (
    !isPositiveInteger(entry.width) ||
    !isPositiveInteger(entry.height) ||
    inspected.width !== entry.width ||
    inspected.height !== entry.height ||
    (spec !== undefined && (entry.width !== spec.width || entry.height !== spec.height))
  ) {
    addError(errors, ERROR_CODES.DIMENSION_MISMATCH, 'declared, actual, and use dimensions must agree', id, 'width')
  }
}

export async function validateManifest(options = {}) {
  const defaultRepoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
  const repoRoot = path.resolve(options.repoRoot ?? defaultRepoRoot)
  const manifestPath = path.resolve(options.manifestPath ?? path.join(repoRoot, 'src/assets/game/manifest.json'))
  const manifestDir = path.dirname(manifestPath)
  const filesRoot = path.join(manifestDir, 'files')
  const errors = []

  let manifest
  try {
    manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  } catch (error) {
    addError(errors, ERROR_CODES.MANIFEST_PARSE, `cannot parse manifest: ${error.message}`)
    return { valid: false, errors }
  }

  if (!isObject(manifest) || manifest.version !== 1 || !Array.isArray(manifest.assets)) {
    addError(errors, ERROR_CODES.MANIFEST_SHAPE, 'manifest must be { version: 1, assets: [] }')
    return { valid: false, errors }
  }

  let realRepoRoot
  let realFilesRoot
  try {
    ;[realRepoRoot, realFilesRoot] = await Promise.all([realpath(repoRoot), realpath(filesRoot)])
  } catch {
    addError(errors, ERROR_CODES.MANIFEST_SHAPE, 'repository or deployed asset directory is missing')
    return { valid: false, errors }
  }

  await validateDeployedChapterScope(filesRoot, errors)

  const seen = new Set()
  const ids = new Set()
  const context = { repoRoot, realRepoRoot, manifestDir, filesRoot, realFilesRoot, errors }

  for (let index = 0; index < manifest.assets.length; index += 1) {
    const entry = manifest.assets[index]
    if (!isObject(entry)) {
      addError(errors, ERROR_CODES.INVALID_ENTRY, `asset at index ${index} must be an object`)
      continue
    }

    const id = isNonEmptyString(entry.id) ? entry.id : `#${index}`
    for (const field of REQUIRED_FIELDS) {
      if (!(field in entry)) addError(errors, ERROR_CODES.INVALID_ENTRY, `${field} is required`, id, field)
    }
    for (const field of Object.keys(entry)) {
      if (!ALLOWED_FIELDS.has(field)) addError(errors, ERROR_CODES.INVALID_ENTRY, `${field} is not allowed`, id, field)
    }
    if (!isNonEmptyString(entry.id)) {
      addError(errors, ERROR_CODES.INVALID_ENTRY, 'id must be a non-empty string', id, 'id')
      continue
    }

    ids.add(entry.id)
    if (seen.has(entry.id)) addError(errors, ERROR_CODES.DUPLICATE_ID, 'asset ID is duplicated', entry.id, 'id')
    seen.add(entry.id)

    for (const field of ['id', 'src', 'promptRecord']) {
      if (hasForbiddenChapterReference(entry[field])) {
        addError(
          errors,
          ERROR_CODES.CHAPTER_SCOPE_VIOLATION,
          `${field} references forbidden CHAPTER II or III content`,
          entry.id,
          field,
        )
      }
    }
    if (
      isChapterOneCostumeAssetId(entry.id) &&
      (!isNonEmptyString(entry.src) || !entry.src.startsWith(CHAPTER_ONE_COSTUME_SOURCE_PREFIX))
    ) {
      addError(
        errors,
        ERROR_CODES.CHAPTER_SCOPE_VIOLATION,
        `CHAPTER I costume src must start with ${CHAPTER_ONE_COSTUME_SOURCE_PREFIX}`,
        entry.id,
        'src',
      )
    }

    if (!KINDS.has(entry.kind)) {
      addError(errors, ERROR_CODES.INVALID_KIND, 'kind is not allowed', entry.id, 'kind')
    } else if (entry.id.split('.')[0] !== entry.kind) {
      addError(errors, ERROR_CODES.NAMESPACE_KIND_MISMATCH, 'ID namespace must match kind', entry.id, 'kind')
    }
    if (!STATUSES.has(entry.status)) {
      addError(errors, ERROR_CODES.INVALID_STATUS, 'status is not ready or placeholder', entry.id, 'status')
    }
    if (isFinalContentAssetId(entry.id)) {
      if (entry.status !== 'ready') {
        addError(errors, ERROR_CODES.INVALID_STATUS, 'final content asset must be ready', entry.id, 'status')
      }
      if (!isNonEmptyString(entry.sha256)) {
        addError(errors, ERROR_CODES.HASH_REQUIRED, 'final content asset requires sha256', entry.id, 'sha256')
      }
    }
    const requiredPromptRecord = REQUIRED_PROMPT_RECORD_BY_ASSET_ID.get(entry.id)
    if (requiredPromptRecord !== undefined && entry.promptRecord !== requiredPromptRecord) {
      addError(
        errors,
        ERROR_CODES.RIGHTS_METADATA,
        `final content asset must use ${requiredPromptRecord}`,
        entry.id,
        'promptRecord',
      )
    }

    const spec = getSpec(entry)
    if (spec === undefined) {
      addError(errors, ERROR_CODES.INVALID_KIND, 'asset has no use specification', entry.id, 'kind')
    } else if (
      entry.format !== spec.format ||
      entry.width !== spec.width ||
      entry.height !== spec.height
    ) {
      addError(errors, ERROR_CODES.DIMENSION_MISMATCH, 'entry does not match its use specification', entry.id, 'width')
    }

    await validateRights(entry, context)
    await validateAssetFile(entry, context)
  }

  const contentSources = new Map()
  const contentHashes = new Map()
  for (const entry of manifest.assets) {
    if (!isObject(entry) || !isFinalContentAssetId(entry.id)) continue
    if (isNonEmptyString(entry.src)) {
      const owner = contentSources.get(entry.src)
      if (owner !== undefined) {
        addError(errors, ERROR_CODES.DUPLICATE_SRC, `final content asset shares src with ${owner}`, entry.id, 'src')
      } else {
        contentSources.set(entry.src, entry.id)
      }
    }
    if (typeof entry.sha256 === 'string' && /^[a-f0-9]{64}$/.test(entry.sha256)) {
      const owner = contentHashes.get(entry.sha256)
      if (owner !== undefined) {
        addError(errors, ERROR_CODES.DUPLICATE_SHA256, `final content asset shares sha256 with ${owner}`, entry.id, 'sha256')
      } else {
        contentHashes.set(entry.sha256, entry.id)
      }
    }
  }

  const required = new Set(REQUIRED_ASSET_IDS)
  for (const id of REQUIRED_ASSET_IDS) {
    if (!ids.has(id)) addError(errors, ERROR_CODES.MISSING_ID, 'required asset ID is missing', id, 'id')
  }
  for (const id of ids) {
    if (!required.has(id) && !isChapterOneCostumeAssetId(id)) {
      addError(errors, ERROR_CODES.UNEXPECTED_ID, 'asset ID is outside the fixed inventory and CHAPTER I costume namespace', id, 'id')
    }
  }

  errors.sort((left, right) =>
    [left.code, left.id ?? '', left.field ?? '', left.message].join('\0').localeCompare(
      [right.code, right.id ?? '', right.field ?? '', right.message].join('\0'),
      'en',
    ),
  )
  return { valid: errors.length === 0, errors }
}

const isMain = process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const result = await validateManifest()
  if (result.valid) {
    console.log(`IRPG-406 asset manifest valid (${REQUIRED_ASSET_IDS.length} IDs)`)
  } else {
    for (const error of result.errors) {
      console.error(`[${error.code}]${error.id ? ` ${error.id}` : ''}${error.field ? `.${error.field}` : ''}: ${error.message}`)
    }
    process.exitCode = 1
  }
}
