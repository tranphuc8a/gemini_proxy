/**
 * Extended JSON on the browser side.
 *
 * Two directions, and they are not symmetric:
 *
 * - `parseRelaxed` reads what a person types. Nobody wants to write
 *   `{"_id": {"$oid": "..."}}` by hand, so mongosh syntax is accepted —
 *   unquoted keys, single quotes, trailing commas, `ObjectId(...)`,
 *   `ISODate(...)`, `/regex/i` — and normalised into strict Extended JSON,
 *   which is what the bridge expects.
 * - `toShell` writes what a person reads: the same shell spellings, so the
 *   document shown in the editor can be typed straight back in.
 *
 * The parser is a small scanner rather than a set of regular expressions,
 * because a regex cannot tell `ObjectId(` inside a string from one outside it.
 */

export class EjsonParseError extends Error {
  readonly position: number

  constructor(message: string, position: number) {
    super(message)
    this.name = 'EjsonParseError'
    this.position = position
  }
}

const IDENTIFIER_START = /[A-Za-z_$]/
const IDENTIFIER_PART = /[A-Za-z0-9_$.]/
const WHITESPACE = /\s/

/** `new` is noise: `new Date(...)` and `Date(...)` mean the same thing here. */
const CONSTRUCTORS = new Set([
  'ObjectId',
  'ObjectID',
  'UUID',
  'ISODate',
  'Date',
  'NumberLong',
  'NumberInt',
  'NumberDecimal',
  'Timestamp',
  'BinData',
  'MinKey',
  'MaxKey',
])

const LITERALS = new Set(['true', 'false', 'null'])

/**
 * Rewrite relaxed/shell JSON as strict JSON text.
 *
 * Exported for its own tests; `parseRelaxed` is what callers normally want.
 */
export function normaliseRelaxed(input: string): string {
  const out: string[] = []
  let i = 0

  const error = (message: string): never => {
    throw new EjsonParseError(message, i)
  }

  const skipWhitespace = (from: number): number => {
    let at = from
    while (at < input.length && WHITESPACE.test(input[at])) at += 1
    return at
  }

  /** Read a quoted string and re-emit it with double quotes. */
  const readString = (): string => {
    const quote = input[i]
    i += 1
    const chars: string[] = []
    while (i < input.length && input[i] !== quote) {
      if (input[i] === '\\') {
        const next = input[i + 1]
        // A single-quoted string may escape ' — in JSON that escape is invalid.
        if (next === "'") chars.push("'")
        else chars.push(input[i], next ?? '')
        i += 2
        continue
      }
      if (input[i] === '"') chars.push('\\"')
      else chars.push(input[i])
      i += 1
    }
    if (i >= input.length) error('unterminated string')
    i += 1
    return `"${chars.join('')}"`
  }

  /** Read the text between the parentheses of a constructor call. */
  const readArguments = (): string[] => {
    i = skipWhitespace(i)
    if (input[i] !== '(') error('expected ( after a constructor')
    i += 1
    const args: string[] = []
    let current: string[] = []
    let depth = 0
    while (i < input.length) {
      const char = input[i]
      if (char === '"' || char === "'") {
        const quote = char
        current.push(char)
        i += 1
        while (i < input.length && input[i] !== quote) {
          if (input[i] === '\\') {
            current.push(input[i], input[i + 1] ?? '')
            i += 2
            continue
          }
          current.push(input[i])
          i += 1
        }
        current.push(quote)
        i += 1
        continue
      }
      if (char === '(' || char === '[' || char === '{') depth += 1
      if (char === ')' && depth === 0) {
        i += 1
        const tail = current.join('').trim()
        if (tail || args.length) args.push(tail)
        return args
      }
      if (char === ')' || char === ']' || char === '}') depth -= 1
      if (char === ',' && depth === 0) {
        args.push(current.join('').trim())
        current = []
        i += 1
        continue
      }
      current.push(char)
      i += 1
    }
    return error('unterminated constructor call')
  }

  const unquote = (raw: string): string => {
    const trimmed = raw.trim()
    if (trimmed.length >= 2 && (trimmed[0] === '"' || trimmed[0] === "'") && trimmed.at(-1) === trimmed[0]) {
      return trimmed.slice(1, -1)
    }
    return trimmed
  }

  const expand = (name: string, args: string[]): string => {
    const first = args[0] === undefined ? '' : unquote(args[0])
    switch (name) {
      case 'ObjectId':
      case 'ObjectID':
        return JSON.stringify({ $oid: first })
      case 'UUID':
        return JSON.stringify({ $uuid: first })
      case 'ISODate':
      case 'Date':
        return JSON.stringify({ $date: first || new Date().toISOString() })
      case 'NumberLong':
        return JSON.stringify({ $numberLong: first })
      case 'NumberInt':
        return JSON.stringify({ $numberInt: first })
      case 'NumberDecimal':
        return JSON.stringify({ $numberDecimal: first })
      case 'Timestamp':
        return JSON.stringify({ $timestamp: { t: Number(first) || 0, i: Number(unquote(args[1] ?? '0')) || 0 } })
      case 'BinData':
        return JSON.stringify({
          $binary: { base64: unquote(args[1] ?? ''), subType: Number(first || 0).toString(16).padStart(2, '0') },
        })
      case 'MinKey':
        return JSON.stringify({ $minKey: 1 })
      case 'MaxKey':
        return JSON.stringify({ $maxKey: 1 })
      default:
        return error(`unsupported constructor ${name}()`)
    }
  }

  /** `/pattern/flags` — only valid where a value is expected. */
  const readRegex = (): string => {
    i += 1
    const pattern: string[] = []
    let inClass = false
    while (i < input.length) {
      const char = input[i]
      if (char === '\\') {
        pattern.push(char, input[i + 1] ?? '')
        i += 2
        continue
      }
      if (char === '[') inClass = true
      else if (char === ']') inClass = false
      else if (char === '/' && !inClass) break
      if (char === '\n') error('unterminated regular expression')
      pattern.push(char)
      i += 1
    }
    if (input[i] !== '/') error('unterminated regular expression')
    i += 1
    const flags: string[] = []
    while (i < input.length && /[a-z]/.test(input[i])) {
      flags.push(input[i])
      i += 1
    }
    return JSON.stringify({
      $regularExpression: { pattern: pattern.join(''), options: flags.join('') },
    })
  }

  /** Was the last thing emitted a place where a value (not a key) goes? */
  const lastMeaningful = (): string => {
    for (let at = out.length - 1; at >= 0; at -= 1) {
      const chunk = out[at].trim()
      if (chunk) return chunk.at(-1) as string
    }
    return ''
  }

  while (i < input.length) {
    const char = input[i]

    if (WHITESPACE.test(char)) {
      out.push(char)
      i += 1
      continue
    }

    if (char === '"' || char === "'") {
      out.push(readString())
      continue
    }

    // Drop a trailing comma before a closing brace or bracket.
    if (char === ',') {
      const next = skipWhitespace(i + 1)
      if (input[next] === '}' || input[next] === ']') {
        i += 1
        continue
      }
      out.push(char)
      i += 1
      continue
    }

    // `//` and `/* */` comments are dropped; a bare `/` starts a regex, but
    // only where a value is expected.
    if (char === '/') {
      if (input[i + 1] === '/') {
        while (i < input.length && input[i] !== '\n') i += 1
        continue
      }
      if (input[i + 1] === '*') {
        const end = input.indexOf('*/', i + 2)
        i = end === -1 ? input.length : end + 2
        continue
      }
      const previous = lastMeaningful()
      if (previous === ':' || previous === '[' || previous === ',' || previous === '') {
        out.push(readRegex())
        continue
      }
      error('unexpected /')
    }

    if (IDENTIFIER_START.test(char)) {
      const start = i
      while (i < input.length && IDENTIFIER_PART.test(input[i])) i += 1
      const word = input.slice(start, i)

      if (word === 'new') continue // `new Date(...)`: the keyword adds nothing
      if (LITERALS.has(word)) {
        out.push(word)
        continue
      }
      if (word === 'Infinity' || word === 'NaN') {
        out.push(JSON.stringify({ $numberDouble: word }))
        continue
      }
      if (CONSTRUCTORS.has(word)) {
        out.push(expand(word, readArguments()))
        continue
      }
      // Anything else is a bare key: `{status: 1}` -> `{"status": 1}`.
      const next = skipWhitespace(i)
      if (input[next] === ':') {
        out.push(JSON.stringify(word))
        continue
      }
      error(`unexpected token ${word}`)
    }

    out.push(char)
    i += 1
  }

  return out.join('')
}

/** Parse relaxed/shell JSON into strict Extended JSON values. */
export function parseRelaxed<T = unknown>(input: string, fallback?: T): T {
  const text = (input ?? '').trim()
  if (!text) {
    if (fallback !== undefined) return fallback
    throw new EjsonParseError('nothing to parse', 0)
  }
  const normalised = normaliseRelaxed(text)
  try {
    return JSON.parse(normalised) as T
  } catch (cause) {
    throw new EjsonParseError((cause as Error).message.replace(/^JSON\.parse: /, ''), 0)
  }
}

/** A filter must be an object; anything else is a mistake worth naming. */
export function parseFilter(input: string): Record<string, unknown> {
  const value = parseRelaxed<unknown>(input, {})
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new EjsonParseError('a filter must be an object, for example {status: "active"}', 0)
  }
  return value as Record<string, unknown>
}

export function parsePipeline(input: string): unknown[] {
  const value = parseRelaxed<unknown>(input, [])
  if (!Array.isArray(value)) {
    throw new EjsonParseError('a pipeline must be an array of stages, for example [{$match: {}}]', 0)
  }
  return value
}

// ---------------------------------------------------------------------------
// value inspection
// ---------------------------------------------------------------------------
export type EjsonKind =
  | 'null'
  | 'boolean'
  | 'number'
  | 'string'
  | 'array'
  | 'object'
  | 'objectId'
  | 'date'
  | 'binary'
  | 'regex'
  | 'decimal'
  | 'timestamp'
  | 'code'
  | 'key'

const WRAPPER_KINDS: Record<string, EjsonKind> = {
  $oid: 'objectId',
  $date: 'date',
  $binary: 'binary',
  $uuid: 'binary',
  $regularExpression: 'regex',
  $numberDecimal: 'decimal',
  $numberLong: 'number',
  $numberInt: 'number',
  $numberDouble: 'number',
  $timestamp: 'timestamp',
  $code: 'code',
  $minKey: 'key',
  $maxKey: 'key',
}

/** The single `$`-key of a wrapper object, or null for a plain object. */
export function wrapperKey(value: unknown): string | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null
  const keys = Object.keys(value as object)
  const first = keys[0]
  if (!first || !(first in WRAPPER_KINDS)) return null
  // $code may be paired with $scope, $ref with $id/$db; nothing else pairs up.
  if (keys.length === 1) return first
  if (first === '$code' && keys.length === 2 && keys[1] === '$scope') return first
  return null
}

export function kindOf(value: unknown): EjsonKind {
  if (value === null || value === undefined) return 'null'
  if (typeof value === 'boolean') return 'boolean'
  if (typeof value === 'number') return 'number'
  if (typeof value === 'string') return 'string'
  if (Array.isArray(value)) return 'array'
  const wrapper = wrapperKey(value)
  return wrapper ? WRAPPER_KINDS[wrapper] : 'object'
}

/** A short, single-line rendering for a table cell. */
export function preview(value: unknown, maxLength = 80): string {
  const text = previewFull(value)
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text
}

function previewFull(value: unknown): string {
  if (value === null || value === undefined) return 'null'
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return `[ ${value.length} ]`

  const wrapper = wrapperKey(value)
  const record = value as Record<string, any>
  switch (wrapper) {
    case '$oid':
      return String(record.$oid)
    case '$date':
      return formatDate(record.$date)
    case '$numberLong':
    case '$numberInt':
    case '$numberDouble':
    case '$numberDecimal':
      return String(record[wrapper])
    case '$binary':
      return `Binary(${String(record.$binary?.base64 ?? '').slice(0, 12)}…)`
    case '$regularExpression':
      return `/${record.$regularExpression?.pattern ?? ''}/${record.$regularExpression?.options ?? ''}`
    case '$timestamp':
      return `Timestamp(${record.$timestamp?.t ?? 0}, ${record.$timestamp?.i ?? 0})`
    case '$minKey':
      return 'MinKey'
    case '$maxKey':
      return 'MaxKey'
    case '$code':
      return String(record.$code)
    default:
      return `{ ${Object.keys(record).length} }`
  }
}

function formatDate(raw: unknown): string {
  const text = typeof raw === 'object' && raw && '$numberLong' in (raw as object)
    ? new Date(Number((raw as any).$numberLong)).toISOString()
    : String(raw)
  return text.replace('T', ' ').replace(/\.\d+Z$/, 'Z')
}

// ---------------------------------------------------------------------------
// rendering back to shell syntax
// ---------------------------------------------------------------------------
/**
 * Render a value the way mongosh would, so the editor round-trips:
 * whatever `toShell` prints, `parseRelaxed` accepts.
 */
export function toShell(value: unknown, indent = 2, level = 0): string {
  const pad = ' '.repeat(indent * (level + 1))
  const closePad = ' '.repeat(indent * level)

  if (value === null || value === undefined) return 'null'
  if (typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]'
    const items = value.map((item) => `${pad}${toShell(item, indent, level + 1)}`)
    return `[\n${items.join(',\n')}\n${closePad}]`
  }

  const record = value as Record<string, any>
  const wrapper = wrapperKey(value)
  switch (wrapper) {
    case '$oid':
      return `ObjectId("${record.$oid}")`
    case '$date':
      return `ISODate("${typeof record.$date === 'string' ? record.$date : new Date(Number(record.$date?.$numberLong ?? 0)).toISOString()}")`
    case '$numberLong':
      return `NumberLong("${record.$numberLong}")`
    case '$numberInt':
      return `NumberInt(${record.$numberInt})`
    case '$numberDecimal':
      return `NumberDecimal("${record.$numberDecimal}")`
    case '$numberDouble':
      return Number.isFinite(Number(record.$numberDouble)) ? String(record.$numberDouble) : `${record.$numberDouble}`
    case '$regularExpression':
      return `/${record.$regularExpression?.pattern ?? ''}/${record.$regularExpression?.options ?? ''}`
    case '$timestamp':
      return `Timestamp(${record.$timestamp?.t ?? 0}, ${record.$timestamp?.i ?? 0})`
    case '$minKey':
      return 'MinKey()'
    case '$maxKey':
      return 'MaxKey()'
    default:
      break
  }

  const keys = Object.keys(record)
  if (keys.length === 0) return '{}'
  const entries = keys.map((key) => `${pad}${formatKey(key)}: ${toShell(record[key], indent, level + 1)}`)
  return `{\n${entries.join(',\n')}\n${closePad}}`
}

/** Quote a key only when it is not a plain identifier. */
function formatKey(key: string): string {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(key) ? key : JSON.stringify(key)
}

// ---------------------------------------------------------------------------
// documents
// ---------------------------------------------------------------------------
/** A filter that selects exactly this document, for an edit or a delete. */
export function idFilter(document: Record<string, unknown>): Record<string, unknown> | null {
  if (!document || !('_id' in document)) return null
  return { _id: document._id }
}

/** The `_id` as a stable string, usable as a React key. */
export function documentKey(document: Record<string, unknown>, fallbackIndex: number): string {
  const id = document?._id
  if (id === undefined) return `row-${fallbackIndex}`
  const wrapper = wrapperKey(id)
  if (wrapper === '$oid') return String((id as any).$oid)
  if (typeof id === 'string' || typeof id === 'number') return String(id)
  return JSON.stringify(id)
}

/** Drop `_id` from a replacement: MongoDB refuses to have it changed. */
export function withoutId(document: Record<string, unknown>): Record<string, unknown> {
  const copy = { ...document }
  delete copy._id
  return copy
}

/** Read a possibly dotted path out of a document, for table columns. */
export function valueAtPath(document: Record<string, unknown>, path: string): unknown {
  if (path in document) return document[path]
  let current: unknown = document
  for (const segment of path.split('.')) {
    if (current === null || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[segment]
  }
  return current
}
