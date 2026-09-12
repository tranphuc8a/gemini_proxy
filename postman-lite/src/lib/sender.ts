/**
 * Turning a RequestSpec into an actual HTTP call.
 *
 * Two transports, because the browser alone is not enough:
 *
 *   direct - window.fetch(). Bound by the same-origin policy: an API that sends
 *            no Access-Control-Allow-Origin is unreachable, `Cookie`/`Referer`/
 *            `User-Agent` are dropped, and a cross-origin response only exposes
 *            six of its headers.
 *   proxy  - POST to the FastAPI backend, which makes the call server-side.
 *            No CORS, no forbidden headers, every response header visible.
 *
 * `auto` picks direct when it can be faithful and proxy when it cannot, which is
 * why a request that works in the real Postman also works here.
 */

import type { RequestSpec, ResponseData, SendMode } from '../types'
import { apiBase, ensureApiBase } from './api'
import { base64ToBytes, bytesToBase64, kvToObject } from './util'

/** Header names window.fetch() refuses to set. */
const FORBIDDEN_HEADERS = new Set([
  'accept-charset', 'accept-encoding', 'access-control-request-headers',
  'access-control-request-method', 'connection', 'content-length', 'cookie',
  'cookie2', 'date', 'dnt', 'expect', 'host', 'keep-alive', 'origin',
  'referer', 'te', 'trailer', 'transfer-encoding', 'upgrade', 'via',
])

const FORBIDDEN_PREFIXES = ['proxy-', 'sec-']

const METHODS_WITHOUT_BODY = new Set(['GET', 'HEAD'])

export function isForbiddenHeader(name: string): boolean {
  const lower = name.toLowerCase()
  return FORBIDDEN_HEADERS.has(lower) || FORBIDDEN_PREFIXES.some((prefix) => lower.startsWith(prefix))
}

export const CONTENT_TYPE_BY_MODE: Record<string, string> = {
  json: 'application/json',
  text: 'text/plain',
  xml: 'application/xml',
  form: 'application/x-www-form-urlencoded',
  multipart: 'multipart/form-data',
}

// ---------------------------------------------------------------- URL helpers
/**
 * Merge `params` into `url`'s query string, replacing same-named values rather
 * than appending a second copy the server may or may not honour.
 */
export function buildUrl(rawUrl: string, params: Record<string, string>): string {
  const url = (rawUrl || '').trim()
  const entries = Object.entries(params).filter(([key]) => key)
  if (!entries.length) return url

  const hashIndex = url.indexOf('#')
  const hash = hashIndex > -1 ? url.slice(hashIndex) : ''
  const withoutHash = hashIndex > -1 ? url.slice(0, hashIndex) : url
  const queryIndex = withoutHash.indexOf('?')
  const base = queryIndex > -1 ? withoutHash.slice(0, queryIndex) : withoutHash

  const search = new URLSearchParams(queryIndex > -1 ? withoutHash.slice(queryIndex + 1) : '')
  entries.forEach(([key]) => search.delete(key))
  entries.forEach(([key, value]) => search.append(key, value ?? ''))

  const query = search.toString()
  // URLSearchParams percent-encodes braces; keep {{VAR}} readable in the URL bar.
  const readable = query.replace(/%7B%7B/gi, '{{').replace(/%7D%7D/gi, '}}')
  return base + (readable ? '?' + readable : '') + hash
}

export function extractParams(rawUrl: string): Record<string, string> {
  const queryIndex = (rawUrl || '').indexOf('?')
  if (queryIndex === -1) return {}
  const hashIndex = rawUrl.indexOf('#')
  const query = hashIndex > queryIndex ? rawUrl.slice(queryIndex + 1, hashIndex) : rawUrl.slice(queryIndex + 1)
  const out: Record<string, string> = {}
  new URLSearchParams(query).forEach((value, key) => {
    out[key] = value
  })
  return out
}

export function stripQuery(rawUrl: string): string {
  const queryIndex = (rawUrl || '').indexOf('?')
  if (queryIndex === -1) return rawUrl
  const hashIndex = rawUrl.indexOf('#')
  return rawUrl.slice(0, queryIndex) + (hashIndex > queryIndex ? rawUrl.slice(hashIndex) : '')
}

// ---------------------------------------------------------------------- auth
/** Fold auth into headers/params, mirroring what curl's own flags do. */
export function applyAuth(
  spec: RequestSpec,
  headers: Record<string, string>,
  params: Record<string, string>,
): void {
  const auth = spec.auth
  if (!auth || auth.type === 'none') return

  if (auth.type === 'basic') {
    if (!auth.username) return
    // btoa() is Latin-1 only; encode UTF-8 first so accented logins survive.
    headers.Authorization = 'Basic ' + bytesToBase64(new TextEncoder().encode(`${auth.username}:${auth.password ?? ''}`))
  } else if (auth.type === 'bearer') {
    const token = (auth.token ?? '').trim()
    if (token) headers.Authorization = 'Bearer ' + token
  } else if (auth.type === 'apikey') {
    const name = (auth.keyName ?? '').trim()
    const value = (auth.keyValue ?? '').trim()
    if (!name || !value) return
    if (auth.location === 'query') params[name] = value
    else headers[name] = value
  }
}

// ---------------------------------------------------------------------- body
export interface PreparedBody {
  direct: BodyInit | undefined
  bytes: Uint8Array | null
  contentType: string | null
}

async function readFileBytes(file: File): Promise<Uint8Array> {
  return new Uint8Array(await file.arrayBuffer())
}

function concat(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.length
  }
  return out
}

/**
 * Build a multipart body twice over.
 *
 * The direct transport hands back a FormData and lets the browser choose the
 * boundary; the proxy needs real bytes, so the envelope is assembled by hand
 * with an explicit boundary. Without the second form, file uploads break the
 * moment the request has to go through the proxy.
 */
async function buildMultipart(spec: RequestSpec, files: File[]): Promise<PreparedBody> {
  const fields = (spec.formFields ?? []).filter((row) => row.enabled && row.key.trim())

  const form = new FormData()
  fields.forEach((row) => form.append(row.key, row.value))
  files.forEach((file) => form.append(file.name, file, file.name))

  const boundary = '----PostmanLitePro' + Math.random().toString(36).slice(2) + Date.now().toString(36)
  const encoder = new TextEncoder()
  const chunks: Uint8Array[] = []

  for (const row of fields) {
    chunks.push(encoder.encode(`--${boundary}\r\nContent-Disposition: form-data; name="${row.key}"\r\n\r\n${row.value}\r\n`))
  }
  for (const file of files) {
    chunks.push(
      encoder.encode(
        `--${boundary}\r\nContent-Disposition: form-data; name="${file.name}"; filename="${file.name}"\r\n` +
          `Content-Type: ${file.type || 'application/octet-stream'}\r\n\r\n`,
      ),
    )
    chunks.push(await readFileBytes(file))
    chunks.push(encoder.encode('\r\n'))
  }
  chunks.push(encoder.encode(`--${boundary}--\r\n`))

  return { direct: form, bytes: concat(chunks), contentType: `multipart/form-data; boundary=${boundary}` }
}

export async function buildBody(spec: RequestSpec, files: File[] = []): Promise<PreparedBody> {
  if (METHODS_WITHOUT_BODY.has(spec.method) || spec.bodyMode === 'none') {
    return { direct: undefined, bytes: null, contentType: null }
  }

  if (spec.bodyMode === 'multipart') return buildMultipart(spec, files)

  if (spec.bodyMode === 'form') {
    const encoded = new URLSearchParams(kvToObject(spec.formFields)).toString()
    return { direct: encoded, bytes: new TextEncoder().encode(encoded), contentType: CONTENT_TYPE_BY_MODE.form }
  }

  const text = spec.body ?? ''
  const contentType = CONTENT_TYPE_BY_MODE[spec.bodyMode] ?? 'text/plain'
  if (!text) return { direct: undefined, bytes: null, contentType }
  return { direct: text, bytes: new TextEncoder().encode(text), contentType }
}

// ------------------------------------------------------------------- prepare
export interface PreparedRequest {
  method: string
  url: string
  headers: Record<string, string>
  body: PreparedBody
}

/**
 * Normalise a spec into everything both transports need.
 *
 * Pure: it touches no DOM and performs no I/O, which is why the code generators
 * build on it too - the snippet you copy always matches what actually goes out.
 */
export async function prepare(spec: RequestSpec, files: File[] = []): Promise<PreparedRequest> {
  const headers = kvToObject(spec.headers)
  const params = { ...extractParams(spec.url), ...kvToObject(spec.params) }

  applyAuth(spec, headers, params)

  const cookies = kvToObject(spec.cookies)
  const cookiePairs = Object.entries(cookies)
  if (cookiePairs.length) {
    headers.Cookie = cookiePairs.map(([key, value]) => `${key}=${value}`).join('; ')
  }

  const url = buildUrl(stripQuery(spec.url), params)
  const body = await buildBody(spec, files)

  if (body.contentType) {
    const explicit = Object.keys(headers).find((name) => name.toLowerCase() === 'content-type')
    // Never let a stale Content-Type contradict the body we just built, and for
    // multipart the browser must supply its own boundary.
    if (!explicit || body.contentType.startsWith('multipart/form-data')) {
      if (explicit) delete headers[explicit]
      headers['Content-Type'] = body.contentType
    }
  }

  return { method: spec.method, url, headers, body }
}

// ---------------------------------------------------------------- transports
export interface SendOptions {
  mode: SendMode
  signal?: AbortSignal
  timeoutSeconds?: number
  followRedirects?: boolean
  withCredentials?: boolean
  files?: File[]
  onTransport?: (via: 'direct' | 'proxy', message: string) => void
}

async function sendDirect(prepared: PreparedRequest, options: SendOptions): Promise<ResponseData> {
  const headers: Record<string, string> = {}
  for (const [name, value] of Object.entries(prepared.headers)) {
    // The browser drops these anyway; some engines throw instead of ignoring.
    if (!isForbiddenHeader(name)) headers[name] = value
  }

  const init: RequestInit = {
    method: prepared.method,
    headers,
    mode: 'cors',
    credentials: options.withCredentials ? 'include' : 'omit',
    redirect: options.followRedirects === false ? 'manual' : 'follow',
    signal: options.signal,
  }

  const body = prepared.body.direct
  if (body instanceof FormData) delete headers['Content-Type']
  if (body !== undefined && body !== '') init.body = body

  const started = performance.now()
  const res = await fetch(prepared.url, init)
  const buffer = await res.arrayBuffer()

  return {
    via: 'direct',
    status: res.status,
    statusText: res.statusText,
    headers: [...res.headers.entries()],
    bytes: new Uint8Array(buffer),
    contentType: res.headers.get('content-type') ?? '',
    sizeBytes: buffer.byteLength,
    timeMs: Math.round(performance.now() - started),
    finalUrl: res.url || prepared.url,
    redirected: res.redirected,
    truncated: false,
    // A cross-origin response hides everything but the safelisted headers.
    headersComplete: res.type === 'basic',
    receivedAt: new Date().toISOString(),
  }
}

export class ProxyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProxyError'
  }
}

async function sendProxy(prepared: PreparedRequest, options: SendOptions): Promise<ResponseData> {
  const base = await ensureApiBase()

  const payload: Record<string, unknown> = {
    method: prepared.method,
    url: prepared.url,
    headers: prepared.headers,
    follow_redirects: options.followRedirects !== false,
  }
  if (options.timeoutSeconds) payload.timeout_seconds = options.timeoutSeconds
  if (prepared.body.bytes?.length) {
    payload.body = bytesToBase64(prepared.body.bytes)
    payload.body_encoding = 'base64'
  }

  const started = performance.now()
  const res = await fetch(`${base}/proxy/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: options.signal,
  })

  let envelope: any
  try {
    envelope = await res.json()
  } catch {
    throw new ProxyError(`Proxy trả về dữ liệu không phải JSON (HTTP ${res.status})`)
  }
  if (!res.ok) throw new ProxyError(`Proxy từ chối: ${envelope?.message ?? `HTTP ${res.status}`}`)

  const data = envelope.data ?? {}
  const bytes: Uint8Array =
    data.body_encoding === 'base64' ? base64ToBytes(data.body) : new TextEncoder().encode(data.body ?? '')

  return {
    via: 'proxy',
    status: data.status,
    statusText: data.status_text ?? '',
    headers: (data.raw_headers ?? []).map((pair: string[]) => [pair[0], pair[1]] as [string, string]),
    bytes,
    contentType: data.content_type ?? '',
    sizeBytes: data.size_bytes ?? bytes.length,
    timeMs: data.elapsed_ms ?? Math.round(performance.now() - started),
    finalUrl: data.final_url ?? prepared.url,
    redirected: Boolean(data.redirected),
    truncated: Boolean(data.truncated),
    headersComplete: true,
    receivedAt: new Date().toISOString(),
  }
}

export async function send(spec: RequestSpec, options: SendOptions): Promise<ResponseData> {
  const prepared = await prepare(spec, options.files ?? [])
  const notify = options.onTransport ?? (() => {})
  const blocked = Object.keys(prepared.headers).filter(isForbiddenHeader)

  if (options.mode === 'proxy') {
    notify('proxy', 'Gửi qua proxy backend')
    return sendProxy(prepared, options)
  }

  if (options.mode === 'direct') {
    if (blocked.length) notify('direct', `Trình duyệt sẽ bỏ qua header: ${blocked.join(', ')}`)
    return sendDirect(prepared, options)
  }

  // auto: skip a direct attempt we already know cannot be faithful.
  if (blocked.length) {
    notify('proxy', `Dùng proxy vì trình duyệt cấm header: ${blocked.join(', ')}`)
    return sendProxy(prepared, options)
  }

  try {
    notify('direct', 'Thử gửi trực tiếp từ trình duyệt')
    return await sendDirect(prepared, options)
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    // fetch() reports CORS rejections, DNS failures and refused connections all
    // as the same opaque TypeError - the browser deliberately hides which.
    // Retrying through the proxy is the only way to tell them apart, and it is
    // also the fix for the common case.
    if (!(err instanceof TypeError)) throw err

    notify('proxy', 'Trực tiếp thất bại (CORS/mạng) — thử lại qua proxy')
    const result = await sendProxy(prepared, options)
    result.fellBackFrom = 'direct'
    result.fallbackReason = err.message || 'Failed to fetch'
    return result
  }
}

export { apiBase }
