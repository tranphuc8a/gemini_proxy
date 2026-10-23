import type { StorageBackend } from '../types'
import type { LinePatch } from '../sync/lineDiff'
import type { ServerRecord } from '../sync/records'
import { resolveApiBase } from './runtimeConfig'
import { startResponsiveTimeout } from '../lib/responsiveTimeout'

/**
 * Client of the delta sync (`/markdown/sync/*`, `/markdown/docs/*`; backend `markdown_docs_controller`, contract in
 * docs/markdown-sync-api.md). The administrator's header is handed in, not imported from `markdownStorage`: that module is
 * mocked by seven test files, and this one must stay usable (and testable) without it.
 *
 * Nothing here is cached by the browser (`no-store`), and the service worker never touches these routes (they sit under
 * the API prefix; it only serves GET requests of its own scope).
 */

const TIMEOUT_MS = 30_000

export interface PushOp {
  id: string
  kind: 'file' | 'folder'
  baseRev: number
  set?: { name?: string; parentId?: string | null }
  content?: string
  patch?: LinePatch
  baseHash?: string
  hash?: string
  deleted?: boolean
  updatedAt: number
}

export type PushResult =
  | { id: string; status: 'ok'; rev: number; contentRev: number; metaRev: number; hash: string; serverUpdatedAt: number }
  | { id: string; status: 'conflict'; parts: ('content' | 'meta' | 'deleted')[]; record: ServerRecord; contentOmitted?: boolean }
  | { id: string; status: 'rejected'; code: string; message: string }

export interface PushResponse {
  results: PushResult[]
  serverTime: number
}

export interface ChangesPage {
  items: ServerRecord[]
  cursor: number
  more: boolean
  horizon: number
  /** The cursor is older than the oldest tombstone the server still keeps: reconcile from scratch. */
  reset: boolean
}

/** What the sync engine needs from a server: implemented over HTTP here and in memory by the test server. */
export interface SyncApi {
  changes(args: { since: number; limit?: number; device: string }): Promise<ChangesPage>
  push(args: { device: string; ops: PushOp[] }): Promise<PushResponse>
  getDoc(id: string): Promise<ServerRecord>
}

/** A refusal (or no answer) from the sync API. `offline` = nobody answered; `status` 0 then. */
export class SyncError extends Error {
  readonly status: number
  readonly code: string | null
  readonly retryAfter: number | null
  readonly offline: boolean

  constructor(message: string, { status = 0, code = null, retryAfter = null, offline = false }: { status?: number; code?: string | null; retryAfter?: number | null; offline?: boolean } = {}) {
    super(message)
    this.name = 'SyncError'
    this.status = status
    this.code = code
    this.retryAfter = retryAfter
    this.offline = offline
  }
}

/** English text for the codes the UI knows; the server's (Vietnamese) message otherwise. */
function messageFor(code: string | null, status: number, serverMessage: string, retryAfter: number | null): string {
  switch (code) {
    case 'markdown_private':
      return "This server's documents are private. Unlock admin mode to sync."
    case 'markdown_admin_locked':
      return `Too many wrong admin keys from this network. Try again in ${retryAfter ?? 600} s.`
    case 'markdown_admin_required':
    case 'markdown_admin_invalid':
    case 'markdown_session_invalid':
    case 'markdown_session_expired':
      return 'Admin access is needed. Unlock admin mode again.'
    case 'markdown_default_key_refused':
      return 'The server still uses the default admin key, which is public. Set MARKDOWN_ADMIN_KEY on the server.'
    case 'markdown_backend_unavailable':
      return 'This storage is not configured on the server. Choose another one under Sync → Storage.'
    case 'md_migrating':
      return 'The server is still copying the old documents. Retrying…'
    case 'md_busy':
    case 'md_store_unavailable':
      return "The server's storage is busy. Retrying…"
    case 'md_push_too_large':
      return 'The changes were too large for one request.'
    case 'md_history_broken':
      return "The server could not rebuild that version."
    default:
      return serverMessage || `The server answered ${status}.`
  }
}

interface ErrorEnvelope {
  message?: unknown
  data?: { code?: unknown; retryAfter?: unknown } | null
}

async function failure(response: Response): Promise<SyncError> {
  let body: ErrorEnvelope | null
  try {
    body = (await response.json()) as ErrorEnvelope
  } catch {
    body = null
  }
  const code = typeof body?.data?.code === 'string' ? body.data.code : null
  const header = Number(response.headers.get('Retry-After'))
  const retryAfter = typeof body?.data?.retryAfter === 'number' ? body.data.retryAfter : Number.isFinite(header) && header > 0 ? header : null
  const serverMessage = typeof body?.message === 'string' ? body.message : ''
  return new SyncError(messageFor(code, response.status, serverMessage, retryAfter), { status: response.status, code, retryAfter })
}

export interface HttpSyncOptions {
  backend: StorageBackend
  /** Called for every request: the admin session may change under a running engine. */
  headers: () => Record<string, string>
  /** Test hook. */
  fetchImpl?: typeof fetch
}

export function createHttpSyncApi({ backend, headers, fetchImpl }: HttpSyncOptions): SyncApi {
  const doFetch = fetchImpl ?? ((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init))

  const url = (path: string, extra: Record<string, string> = {}) => {
    const query = new URLSearchParams({ backend, ...extra })
    return `${resolveApiBase()}/markdown/${path}?${query.toString()}`
  }

  async function send<T>(path: string, init: RequestInit, extra: Record<string, string> = {}): Promise<T> {
    const controller = new AbortController()
    const stop = startResponsiveTimeout(TIMEOUT_MS, () => controller.abort())
    let response: Response
    try {
      response = await doFetch(url(path, extra), {
        ...init,
        headers: { ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...headers() },
        credentials: 'omit',
        cache: 'no-store',
        signal: controller.signal
      })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new SyncError(`The server did not answer within ${TIMEOUT_MS / 1000} s.`, { offline: true })
      }
      throw new SyncError(typeof navigator !== 'undefined' && navigator.onLine === false ? "You're offline." : 'Cannot reach the server.', { offline: true })
    } finally {
      stop()
    }
    if (!response.ok) throw await failure(response)
    try {
      return (await response.json()) as T
    } catch {
      throw new SyncError('The server sent something that is not JSON.', { status: response.status })
    }
  }

  return {
    changes: ({ since, limit, device }) =>
      send<ChangesPage>('sync/changes', { method: 'GET' }, { since: String(since), device, ...(limit ? { limit: String(limit) } : {}) }),
    push: ({ device, ops }) => send<PushResponse>('sync/push', { method: 'POST', body: JSON.stringify({ device, ops }) }),
    getDoc: (id) => send<ServerRecord>(`docs/${encodeURIComponent(id)}`, { method: 'GET' })
  }
}
