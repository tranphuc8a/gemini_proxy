/**
 * Sharing, two ways:
 *
 *   - a whole workspace through the server's read-only link,
 *     `?share=<token>&backend=<store>`: the backend is part of the link because
 *     every store is separate, and a token minted in mysql means nothing to json;
 *   - one request with no server at all, packed into the fragment,
 *     `#req=<base64url of UTF-8 JSON>`. Browsers never send the fragment, so the
 *     link is the only copy - which is also why anything credential-looking is
 *     stripped by default.
 *
 * Pure string-in, value-out: reading and rewriting the address bar is App's job.
 */

import type {
  AuthConfig,
  AuthType,
  BodyMode,
  Collection,
  ExtractRule,
  HttpMethod,
  KeyValue,
  RequestSpec,
  StorageBackend,
} from '../types'
import { HTTP_METHODS } from '../types'
import type { ImportResult } from './importers'
import { buildUrl, extractParams, stripQuery } from './sender'
import { base64ToBytes, bytesToBase64, isSecretName, kv, uid } from './util'

const STORAGE_BACKENDS: StorageBackend[] = ['json', 'mysql', 'mongo']
const AUTH_TYPES: AuthType[] = ['none', 'basic', 'bearer', 'apikey']
const BODY_MODES: BodyMode[] = ['none', 'json', 'text', 'xml', 'form', 'multipart']
const AUTH_FIELDS = ['username', 'password', 'token', 'keyName', 'keyValue'] as const

const isObject = (value: unknown): value is Record<string, any> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const text = (value: unknown, fallback = ''): string => (typeof value === 'string' ? value : fallback)

// ---------------------------------------------------------------------------
// Workspace link
// ---------------------------------------------------------------------------
export interface WorkspaceShareLink {
  token: string
  /** Absent on links made before the store was part of them: the server default. */
  backend?: StorageBackend
}

/** `pageUrl` is origin + path of this app, without query or fragment. */
export function workspaceShareUrl(pageUrl: string, token: string, backend?: StorageBackend): string {
  const params = new URLSearchParams({ share: token })
  if (backend) params.set('backend', backend)
  return `${pageUrl}?${params.toString()}`
}

/** `?share=…&backend=…` from a query string, or null when there is none. */
export function readWorkspaceShare(search: string): WorkspaceShareLink | null {
  const params = new URLSearchParams(search)
  const token = (params.get('share') ?? '').trim()
  if (!token) return null
  const backend = (params.get('backend') ?? '').trim().toLowerCase() as StorageBackend
  return STORAGE_BACKENDS.includes(backend) ? { token, backend } : { token }
}

/** The address with share/backend taken out and everything else kept, for history.replaceState. */
export function withoutShareParams(href: string): string {
  const url = new URL(href)
  url.searchParams.delete('share')
  url.searchParams.delete('backend')
  return `${url.pathname}${url.search}${url.hash}`
}

export interface SharedWorkspaceDto {
  id?: string
  name?: string
  revision?: number
  updated_at?: string
  collections?: unknown
  requests?: unknown
}

function looseRows(value: unknown): KeyValue[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((row) => isObject(row) && typeof row.key === 'string')
    .map((row) => {
      const out = kv(row.key, text(row.value), row.enabled !== false)
      if (typeof row.description === 'string') out.description = row.description
      return out
    })
}

function looseAuth(value: unknown): AuthConfig {
  if (!isObject(value) || !AUTH_TYPES.includes(value.type)) return { type: 'none' }
  const out: AuthConfig = { type: value.type }
  for (const field of AUTH_FIELDS) if (typeof value[field] === 'string') out[field] = value[field]
  if (value.location === 'header' || value.location === 'query') out.location = value.location
  return out
}

function looseExtracts(value: unknown): ExtractRule[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((rule) => isObject(rule) && ['body', 'header', 'status'].includes(rule.source))
    .map((rule) => ({
      id: uid('ex_'),
      enabled: rule.enabled !== false,
      source: rule.source,
      path: text(rule.path),
      target: text(rule.target),
    }))
}

function looseMethod(value: unknown): HttpMethod {
  const upper = text(value).toUpperCase() as HttpMethod
  return HTTP_METHODS.includes(upper) ? upper : 'GET'
}

/**
 * A shared workspace as an import bundle for the local store.
 *
 * Everything gets fresh ids - importing the same link twice, or a link to your
 * own workspace, must not produce two objects with one id - and lands in a new
 * collection named after the workspace, so the import is visible as one unit and
 * nothing already here is touched. The server never shares environments.
 */
export function sharedWorkspaceToBundle(dto: SharedWorkspaceDto): ImportResult & { root: Collection } {
  const now = new Date().toISOString()
  const root: Collection = {
    id: uid('col_'),
    name: text(dto.name).trim() || 'Workspace được chia sẻ',
    parentId: null,
    createdAt: now,
  }

  const sourceCollections = (Array.isArray(dto.collections) ? dto.collections : []).filter(isObject)
  const ids = new Map<string, string>()
  for (const collection of sourceCollections) {
    if (typeof collection.id === 'string' && !ids.has(collection.id)) ids.set(collection.id, uid('col_'))
  }
  const newId = (id: unknown) => (typeof id === 'string' ? ids.get(id) : undefined)

  const collections: Collection[] = sourceCollections.map((collection) => {
    const out: Collection = {
      id: newId(collection.id) ?? uid('col_'),
      name: text(collection.name).trim() || 'Collection',
      parentId: newId(collection.parentId) ?? root.id,
      createdAt: now,
    }
    if (typeof collection.description === 'string') out.description = collection.description
    return out
  })

  const requests: RequestSpec[] = (Array.isArray(dto.requests) ? dto.requests : [])
    .filter(isObject)
    .map((request) => ({
      id: uid('req_'),
      name: text(request.name).trim() || 'Request',
      collectionId: newId(request.collectionId) ?? root.id,
      method: looseMethod(request.method),
      url: text(request.url),
      params: looseRows(request.params),
      headers: looseRows(request.headers),
      cookies: looseRows(request.cookies),
      auth: looseAuth(request.auth),
      bodyMode: BODY_MODES.includes(request.bodyMode) ? request.bodyMode : 'none',
      body: text(request.body),
      formFields: looseRows(request.formFields),
      tests: text(request.tests),
      extracts: looseExtracts(request.extracts),
      createdAt: now,
    }))

  return { root, collections: [root, ...collections], requests, environments: [], warnings: [] }
}

// ---------------------------------------------------------------------------
// One request in the fragment
// ---------------------------------------------------------------------------
export const SHARE_REQUEST_PREFIX = '#req='
/** Past this many characters some chat apps, mail clients and servers cut a link. */
export const SHARE_LINK_WARN_CHARS = 8000

/** `[name, value]`, or `[name, value, false]` for a row that is switched off. */
export type SharedPair = [string, string] | [string, string, boolean]

export interface SharedRequest {
  v: 1
  name: string
  method: HttpMethod
  url: string
  headers: SharedPair[]
  params: SharedPair[]
  /** For form and multipart, `text` is the fields URL-encoded. */
  body: { mode: BodyMode; text: string }
  auth?: AuthConfig
  tests?: string
}

export function toBase64Url(value: string): string {
  return bytesToBase64(new TextEncoder().encode(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Throws on anything that is not base64url of valid UTF-8. */
export function fromBase64Url(encoded: string): string {
  if (!/^[A-Za-z0-9_-]*$/.test(encoded)) throw new Error('ký tự lạ trong link')
  const padded = encoded.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (encoded.length % 4)) % 4)
  return new TextDecoder('utf-8', { fatal: true }).decode(base64ToBytes(padded))
}

/**
 * The request as it goes into a link, plus what was left out.
 *
 * `stripSecrets` drops the auth tab and every header, query parameter and form
 * field whose name looks like a credential (Authorization, Cookie, X-API-Key,
 * access_token…). Cookies, extract rules and files are never shared.
 */
export function toSharedRequest(
  spec: RequestSpec,
  { stripSecrets }: { stripSecrets: boolean },
): { shared: SharedRequest; removed: string[] } {
  const removed: string[] = []
  const drop = (label: string) => {
    if (!removed.includes(label)) removed.push(label)
  }
  const keep = (row: KeyValue, kind: string) => {
    if (!row.key.trim()) return false
    if (stripSecrets && isSecretName(row.key)) {
      drop(`${kind} ${row.key}`)
      return false
    }
    return true
  }
  const pairs = (rows: KeyValue[], kind: string): SharedPair[] =>
    rows
      .filter((row) => keep(row, kind))
      .map((row): SharedPair => (row.enabled ? [row.key, row.value] : [row.key, row.value, false]))

  // The URL bar carries the enabled params too, so a secret one leaves both.
  let url = spec.url
  if (stripSecrets) {
    const query = extractParams(spec.url)
    const secret = Object.keys(query).filter(isSecretName)
    if (secret.length) {
      for (const name of secret) {
        delete query[name]
        drop(`param ${name}`)
      }
      url = buildUrl(stripQuery(spec.url), query)
    }
  }

  const formLike = spec.bodyMode === 'form' || spec.bodyMode === 'multipart'
  const bodyText = formLike
    ? new URLSearchParams(
        spec.formFields.filter((row) => row.enabled && keep(row, 'trường form')).map((row) => [row.key, row.value]),
      ).toString()
    : spec.bodyMode === 'none'
      ? ''
      : spec.body

  const shared: SharedRequest = {
    v: 1,
    name: spec.name,
    method: spec.method,
    url,
    headers: pairs(spec.headers, 'header'),
    params: pairs(spec.params, 'param'),
    body: { mode: spec.bodyMode, text: bodyText },
  }

  if (spec.auth && spec.auth.type !== 'none') {
    if (stripSecrets) drop(`Auth (${spec.auth.type})`)
    else shared.auth = looseAuth(spec.auth)
  }
  if (spec.tests.trim()) shared.tests = spec.tests
  return { shared, removed }
}

export function encodeSharedRequest(shared: SharedRequest): string {
  return toBase64Url(JSON.stringify(shared))
}

/** `pageUrl` is origin + path of this app. */
export function sharedRequestUrl(pageUrl: string, shared: SharedRequest): string {
  return `${pageUrl}${SHARE_REQUEST_PREFIX}${encodeSharedRequest(shared)}`
}

function invalid(reason: string): never {
  throw new Error(`Link request không hợp lệ: ${reason}`)
}

function strictPairs(value: unknown, field: string): SharedPair[] {
  if (value === undefined) return []
  if (!Array.isArray(value)) invalid(`"${field}" phải là danh sách`)
  return value.map((pair) => {
    const ok =
      Array.isArray(pair) &&
      (pair.length === 2 || pair.length === 3) &&
      typeof pair[0] === 'string' &&
      typeof pair[1] === 'string' &&
      (pair.length === 2 || typeof pair[2] === 'boolean')
    if (!ok) invalid(`một dòng trong "${field}" sai định dạng`)
    return pair as SharedPair
  })
}

function strictAuth(value: unknown): AuthConfig | undefined {
  if (value === undefined) return undefined
  if (!isObject(value) || !AUTH_TYPES.includes(value.type)) invalid('auth không hợp lệ')
  const out: AuthConfig = { type: value.type }
  for (const field of AUTH_FIELDS) {
    if (value[field] === undefined) continue
    if (typeof value[field] !== 'string') invalid(`auth.${field} không hợp lệ`)
    out[field] = value[field]
  }
  if (value.location !== undefined) {
    if (value.location !== 'header' && value.location !== 'query') invalid('auth.location không hợp lệ')
    out.location = value.location
  }
  return out
}

/** Check a decoded link field by field; anything malformed is refused, not repaired. */
export function validateSharedRequest(data: unknown): SharedRequest {
  if (!isObject(data)) invalid('không phải một request')
  if (data.v !== 1) invalid('phiên bản không được hỗ trợ')
  const method = text(data.method).toUpperCase() as HttpMethod
  if (!HTTP_METHODS.includes(method)) invalid('method không hợp lệ')
  if (typeof data.url !== 'string') invalid('thiếu URL')
  if (data.name !== undefined && typeof data.name !== 'string') invalid('tên không hợp lệ')

  let body: SharedRequest['body'] = { mode: 'none', text: '' }
  if (data.body !== undefined) {
    if (!isObject(data.body) || !BODY_MODES.includes(data.body.mode) || typeof data.body.text !== 'string') {
      invalid('body không hợp lệ')
    }
    body = { mode: data.body.mode, text: data.body.text }
  }
  if (data.tests !== undefined && typeof data.tests !== 'string') invalid('test script không hợp lệ')

  const shared: SharedRequest = {
    v: 1,
    name: text(data.name),
    method,
    url: data.url,
    headers: strictPairs(data.headers, 'headers'),
    params: strictPairs(data.params, 'params'),
    body,
  }
  const auth = strictAuth(data.auth)
  if (auth) shared.auth = auth
  if (typeof data.tests === 'string') shared.tests = data.tests
  return shared
}

/** The part after `#req=`, decoded and validated. Throws a message fit for a toast. */
export function decodeSharedRequest(encoded: string): SharedRequest {
  if (!encoded) invalid('link trống')
  let data: unknown
  try {
    data = JSON.parse(fromBase64Url(encoded))
  } catch {
    invalid('không giải mã được nội dung (link bị cắt hoặc sửa?)')
  }
  return validateSharedRequest(data)
}

/** A decoded link as a fresh, unsaved request. */
export function sharedRequestToSpec(shared: SharedRequest): RequestSpec {
  const rows = (pairs: SharedPair[]) => pairs.map(([key, value, enabled]) => kv(key, value, enabled !== false))
  const formLike = shared.body.mode === 'form' || shared.body.mode === 'multipart'
  return {
    id: uid('req_'),
    name: shared.name.trim() || 'Request được chia sẻ',
    collectionId: null,
    method: shared.method,
    url: shared.url,
    params: rows(shared.params),
    headers: rows(shared.headers),
    cookies: [],
    auth: shared.auth ?? { type: 'none' },
    bodyMode: shared.body.mode,
    body: formLike ? '' : shared.body.text,
    formFields: formLike ? [...new URLSearchParams(shared.body.text)].map(([key, value]) => kv(key, value)) : [],
    tests: shared.tests ?? '',
    extracts: [],
  }
}
