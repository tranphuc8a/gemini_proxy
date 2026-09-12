/**
 * Read a curl command, and write one back.
 *
 * Both directions live here so they stay each other's inverse: the command the
 * app prints is a command the app can re-import.
 */

import type { AuthConfig, BodyMode, HttpMethod, RequestSpec } from '../types'
import { CONTENT_TYPE_BY_MODE, applyAuth, buildUrl, extractParams, stripQuery } from './sender'
import { kv, kvToObject, objectToKv, uid } from './util'

/** Flags that take no argument; treating one as "a value follows" ate the URL. */
const BOOLEAN_FLAGS = new Set([
  '-L', '--location', '-k', '--insecure', '-s', '--silent', '-S', '--show-error',
  '-v', '--verbose', '-i', '--include', '-g', '--globoff', '-f', '--fail',
  '--compressed', '--no-buffer', '-N', '--no-keepalive', '-4', '--ipv4', '-6',
  '--ipv6', '-j', '--junk-session-cookies', '--progress-bar',
])

export interface ParsedCurl {
  method: HttpMethod
  url: string
  params: Record<string, string>
  headers: Record<string, string>
  cookies: Record<string, string>
  data: string | null
  formFields: Record<string, string>
  isMultipart: boolean
  contentType: string | null
  followRedirects: boolean
  files: string[]
  unsupported: string[]
}

/**
 * Split a shell command into tokens.
 *
 * Handles the backslash-newline continuation every browser's "Copy as cURL"
 * emits, plus `$'...'` quoting and the `^` continuation of Windows cmd.
 */
export function shellSplit(input: string): string[] {
  const out: string[] = []
  let i = 0
  let cur = ''
  let started = false
  let quote: "'" | '"' | "$'" | null = null

  const push = () => {
    if (started || cur.length) out.push(cur)
    cur = ''
    started = false
  }

  while (i < input.length) {
    const ch = input[i]

    if (quote === "$'") {
      if (ch === "'") { quote = null; i++; continue }
      if (ch === '\\' && i + 1 < input.length) {
        const escapes: Record<string, string> = { n: '\n', t: '\t', r: '\r', '\\': '\\', "'": "'", '"': '"', '0': '\0' }
        const next = input[i + 1]
        cur += escapes[next] ?? next
        i += 2
        continue
      }
      cur += ch
      i++
      continue
    }

    if (quote) {
      if (ch === quote) { quote = null; i++; continue }
      if (quote === '"' && ch === '\\' && i + 1 < input.length) {
        const next = input[i + 1]
        if (next === '\n') { i += 2; continue }
        cur += '"$`\\'.includes(next) ? next : '\\' + next
        i += 2
        continue
      }
      cur += ch
      i++
      continue
    }

    if (ch === '$' && input[i + 1] === "'") { quote = "$'"; started = true; i += 2; continue }
    if (ch === "'" || ch === '"') { quote = ch; started = true; i++; continue }

    if (ch === '\\' && i + 1 < input.length) {
      if (input[i + 1] === '\n') { i += 2; continue }
      if (input[i + 1] === '\r' && input[i + 2] === '\n') { i += 3; continue }
      cur += input[i + 1]
      started = true
      i += 2
      continue
    }

    if (ch === '^' && (input[i + 1] === '\n' || (input[i + 1] === '\r' && input[i + 2] === '\n'))) {
      i += input[i + 1] === '\r' ? 3 : 2
      continue
    }

    if (/\s/.test(ch)) {
      push()
      while (i < input.length && /\s/.test(input[i])) i++
      continue
    }

    cur += ch
    started = true
    i++
  }

  push()
  return out
}

export function parseCookieString(input: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const part of (input || '').split(';')) {
    const idx = part.indexOf('=')
    if (idx === -1) continue
    const key = part.slice(0, idx).trim()
    if (key) out[key] = part.slice(idx + 1).trim()
  }
  return out
}

function utf8Base64(text: string): string {
  let binary = ''
  new TextEncoder().encode(text).forEach((byte) => { binary += String.fromCharCode(byte) })
  return btoa(binary)
}

export function parseCurl(command: string): ParsedCurl {
  const tokens = shellSplit(command)
  if (!tokens.length) throw new Error('Lệnh rỗng')
  if (tokens[0].toLowerCase() !== 'curl') throw new Error("Lệnh phải bắt đầu bằng 'curl'")

  let method: HttpMethod | null = null
  let url: string | null = null
  let data: string | null = null
  let contentType: string | null = null
  let isMultipart = false
  let followRedirects = false
  const headers: Record<string, string> = {}
  const formFields: Record<string, string> = {}
  const files: string[] = []
  const unsupported: string[] = []
  let cookies: Record<string, string> = {}

  for (let i = 1; i < tokens.length; i++) {
    let token = tokens[i]
    let inline: string | null = null

    // `--header=value` and `-XPOST` both appear in the wild.
    if (token.startsWith('--') && token.includes('=')) {
      const eq = token.indexOf('=')
      inline = token.slice(eq + 1)
      token = token.slice(0, eq)
    } else if (/^-[XHdbuFAe]./.test(token)) {
      inline = token.slice(2)
      token = token.slice(0, 2)
    }

    const takeValue = (): string => {
      if (inline !== null) return inline
      const next = i + 1 < tokens.length ? tokens[i + 1] : ''
      i++
      return next
    }

    if (BOOLEAN_FLAGS.has(token)) {
      if (token === '-L' || token === '--location') followRedirects = true
      continue
    }

    switch (token) {
      case '-X': case '--request':
        method = (takeValue() || 'GET').toUpperCase() as HttpMethod
        continue
      case '-I': case '--head':
        method = 'HEAD'
        continue
      case '-H': case '--header': {
        const raw = takeValue()
        const idx = raw.indexOf(':')
        if (idx > -1) {
          const key = raw.slice(0, idx).trim()
          const value = raw.slice(idx + 1).trim()
          if (key) {
            headers[key] = value
            if (/^content-type$/i.test(key)) contentType = value
          }
        }
        continue
      }
      case '-d': case '--data': case '--data-raw': case '--data-binary':
      case '--data-ascii': case '--data-urlencode': {
        const value = takeValue()
        if (value.startsWith('@')) unsupported.push(`${token} ${value} (đọc file không khả dụng trong trình duyệt)`)
        else data = data === null ? value : `${data}&${value}`
        if (!method) method = 'POST'
        continue
      }
      case '-F': case '--form': case '--form-string': {
        const value = takeValue()
        isMultipart = true
        const eq = value.indexOf('=')
        if (eq > -1) {
          const key = value.slice(0, eq)
          const raw = value.slice(eq + 1)
          if (raw.startsWith('@') || raw.startsWith('<')) files.push(raw.slice(1))
          else formFields[key] = raw
        }
        if (!method) method = 'POST'
        continue
      }
      case '-b': case '--cookie': {
        const value = takeValue()
        if (value.includes('=')) cookies = { ...cookies, ...parseCookieString(value) }
        else unsupported.push(`${token} ${value} (cookie jar dạng file)`)
        continue
      }
      case '-u': case '--user':
        headers.Authorization = 'Basic ' + utf8Base64(takeValue())
        continue
      case '-A': case '--user-agent':
        headers['User-Agent'] = takeValue()
        continue
      case '-e': case '--referer':
        headers.Referer = takeValue()
        continue
      case '--url':
        url = takeValue()
        continue
      default:
        if (token.startsWith('-')) {
          // An unknown flag may or may not take a value; skipping only the flag
          // is the safer guess than eating the next token, which is often the URL.
          unsupported.push(token)
          continue
        }
        if (!url) url = token
        continue
    }
  }

  if (!url) throw new Error('Không tìm thấy URL trong lệnh curl')

  if (!contentType) {
    if (isMultipart) contentType = 'multipart/form-data'
    else if (data !== null) {
      const trimmed = data.trim()
      contentType = trimmed.startsWith('{') || trimmed.startsWith('[')
        ? 'application/json'
        : 'application/x-www-form-urlencoded'
    }
  }

  return {
    method: method ?? 'GET',
    url,
    params: extractParams(url),
    headers,
    cookies,
    data,
    formFields,
    isMultipart,
    contentType,
    followRedirects,
    files,
    unsupported,
  }
}

function bodyModeFor(contentType: string | null, isMultipart: boolean, data: string | null): BodyMode {
  if (isMultipart) return 'multipart'
  const ct = (contentType ?? '').toLowerCase()
  if (ct.includes('x-www-form-urlencoded')) return 'form'
  if (ct.includes('json')) return 'json'
  if (ct.includes('xml')) return 'xml'
  if (data !== null) return 'text'
  return 'none'
}

/** Turn a parsed command into an editable request. */
export function curlToSpec(parsed: ParsedCurl, name = 'Imported from cURL'): RequestSpec {
  const headers = { ...parsed.headers }
  const auth: AuthConfig = { type: 'none' }

  const authKey = Object.keys(headers).find((key) => key.toLowerCase() === 'authorization')
  if (authKey) {
    const value = headers[authKey]
    if (/^Basic\s+/i.test(value)) {
      try {
        const decoded = atob(value.replace(/^Basic\s+/i, '').trim())
        const utf8 = new TextDecoder().decode(Uint8Array.from(decoded, (c) => c.charCodeAt(0)))
        const idx = utf8.indexOf(':')
        auth.type = 'basic'
        auth.username = idx >= 0 ? utf8.slice(0, idx) : utf8
        auth.password = idx >= 0 ? utf8.slice(idx + 1) : ''
        delete headers[authKey]
      } catch {
        /* leave it as a plain header */
      }
    } else if (/^Bearer\s+/i.test(value)) {
      auth.type = 'bearer'
      auth.token = value.replace(/^Bearer\s+/i, '').trim()
      delete headers[authKey]
    }
  }

  const apiKeyHeader = Object.keys(headers).find((key) => /^(x-api-key|api-key|apikey)$/i.test(key))
  if (apiKeyHeader && auth.type === 'none') {
    auth.type = 'apikey'
    auth.keyName = apiKeyHeader
    auth.keyValue = headers[apiKeyHeader]
    auth.location = 'header'
    delete headers[apiKeyHeader]
  }

  let cookies = { ...parsed.cookies }
  for (const key of Object.keys(headers).filter((k) => k.toLowerCase() === 'cookie')) {
    cookies = { ...cookies, ...parseCookieString(headers[key]) }
    delete headers[key]
  }

  const bodyMode = bodyModeFor(parsed.contentType, parsed.isMultipart, parsed.data)

  // The Content-Type header is implied by the body mode; keeping both lets them
  // drift apart, and the header is what would silently win.
  if (bodyMode !== 'none' && CONTENT_TYPE_BY_MODE[bodyMode] === parsed.contentType) {
    for (const key of Object.keys(headers).filter((k) => k.toLowerCase() === 'content-type')) delete headers[key]
  }

  let formFields = objectToKv(parsed.formFields)
  if (bodyMode === 'form' && parsed.data) {
    const parsedForm: Record<string, string> = {}
    new URLSearchParams(parsed.data).forEach((value, key) => { parsedForm[key] = value })
    formFields = objectToKv(parsedForm)
  }

  return {
    id: uid('req_'),
    name,
    collectionId: null,
    method: parsed.method,
    url: stripQuery(parsed.url),
    params: objectToKv(parsed.params),
    headers: objectToKv(headers),
    cookies: objectToKv(cookies),
    auth,
    bodyMode,
    body: bodyMode === 'form' || bodyMode === 'multipart' ? '' : (parsed.data ?? ''),
    formFields,
    tests: '',
    extracts: [],
  }
}

/** Wrap a value in single quotes, escaping any single quote inside it. */
export function shQuote(value: unknown): string {
  return "'" + String(value ?? '').replace(/'/g, "'\\''") + "'"
}

export interface BuildCurlOptions {
  followRedirects?: boolean
  /** Multi-line with backslash continuations (default) or one long line. */
  multiline?: boolean
}

/**
 * Render a spec as a runnable curl command.
 *
 * Note the trailing backslashes: joining the lines with a bare newline produces
 * something a shell reads as several separate commands, and every one of them
 * fails with "curl: no URL specified".
 */
export function buildCurl(spec: RequestSpec, options: BuildCurlOptions = {}): string {
  const headers = kvToObject(spec.headers)
  const params = { ...extractParams(spec.url), ...kvToObject(spec.params) }
  applyAuth(spec, headers, params)

  const url = buildUrl(stripQuery(spec.url), params)
  const parts: string[] = [`curl -X ${spec.method} ${shQuote(url)}`]
  if (options.followRedirects) parts.push('--location')

  const isMultipart = spec.bodyMode === 'multipart'
  for (const [key, value] of Object.entries(headers)) {
    // curl derives the multipart Content-Type (with its boundary) from -F.
    if (isMultipart && /^content-type$/i.test(key)) continue
    parts.push(`-H ${shQuote(`${key}: ${value}`)}`)
  }
  if (!isMultipart && spec.bodyMode !== 'none' && !Object.keys(headers).some((k) => /^content-type$/i.test(k))) {
    const contentType = CONTENT_TYPE_BY_MODE[spec.bodyMode]
    if (contentType) parts.push(`-H ${shQuote(`Content-Type: ${contentType}`)}`)
  }

  const cookies = kvToObject(spec.cookies)
  if (Object.keys(cookies).length) {
    parts.push(`-b ${shQuote(Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; '))}`)
  }

  if (spec.method !== 'GET' && spec.method !== 'HEAD') {
    if (isMultipart) {
      for (const [key, value] of Object.entries(kvToObject(spec.formFields))) {
        parts.push(`-F ${shQuote(`${key}=${value}`)}`)
      }
    } else if (spec.bodyMode === 'form') {
      parts.push(`-d ${shQuote(new URLSearchParams(kvToObject(spec.formFields)).toString())}`)
    } else if (spec.bodyMode !== 'none' && spec.body.trim()) {
      parts.push(`-d ${shQuote(spec.body)}`)
    }
  }

  return options.multiline === false ? parts.join(' ') : parts.join(' \\\n  ')
}

export { kv }
