import type { StorageBackend } from '../types'
import { resolveApiBase } from './runtimeConfig'
import { adminSessionHeaders } from './markdownStorage'
import { startResponsiveTimeout } from '../lib/responsiveTimeout'

/**
 * Client of the read-only share links (`/markdown/shares`, `/markdown/shared`; backend `markdown_share_controller`).
 *
 * Owner calls carry the admin session. The public read carries nothing of the viewer's: no admin header, no cookie
 * (`credentials: 'omit'`), nothing cached (`no-store`), and the token goes in `X-Share-Token`, never in the URL.
 */

const TIMEOUT_MS = 10_000

export interface ShareSummary {
  token: string
  docId: string
  title: string
  mode: string
  sharedAt: number
  updatedAt: number
  expiresAt: number | null
  bytes: number
  contentHash: string
  /** Only in listings. */
  expired?: boolean
}

export interface ShareListing {
  shares: ShareSummary[]
  limits: { maxShares: number; maxBytes: number }
  /** False when this server keeps links in a temporary file (a serverless JSON store). */
  persistent: boolean
}

export interface SharedDocument {
  title: string
  content: string
  mode: string
  sharedAt: number
  updatedAt: number
  expiresAt: number | null
}

export interface CreateShareInput {
  docId: string
  title: string
  content: string
  expiresInDays: 1 | 7 | 30 | null
}

/** A refusal (or no answer) from the share API. `code` is the envelope's `data.code`; `offline` = no network/answer. */
export class ShareError extends Error {
  readonly code: string | null
  readonly status: number
  readonly retryAfter: number | null
  readonly offline: boolean

  constructor(message: string, { code = null, status = 0, retryAfter = null, offline = false }: Partial<Pick<ShareError, 'code' | 'status' | 'retryAfter' | 'offline'>> = {}) {
    super(message)
    this.name = 'ShareError'
    this.code = code
    this.status = status
    this.retryAfter = retryAfter
    this.offline = offline
  }
}

function sharesUrl(path: string, backend: StorageBackend | null, extra: Record<string, string> = {}): string {
  const query = new URLSearchParams()
  if (backend) query.set('backend', backend)
  for (const [key, value] of Object.entries(extra)) query.set(key, value)
  const text = query.toString()
  return `${resolveApiBase()}/markdown/${path}${text ? `?${text}` : ''}`
}

/** English text for the codes the UI knows; the server's (Vietnamese) message otherwise. */
function messageFor(code: string | null, status: number, serverMessage: string, retryAfter: number | null): string {
  switch (code) {
    case 'markdown_share_not_found':
      return "This link doesn't exist, has expired, or was revoked by its owner."
    case 'markdown_rate_limited':
    case 'markdown_admin_locked':
      return `Too many requests. Try again in ${retryAfter ?? 60} s.`
    case 'markdown_share_too_large':
      return 'This document is too large to share.'
    case 'markdown_too_many_shares':
      return 'This server already holds the maximum number of links. Revoke an old one first.'
    case 'markdown_admin_required':
    case 'markdown_admin_invalid':
    case 'markdown_session_invalid':
    case 'markdown_session_expired':
      return 'Admin access is needed. Unlock admin mode again.'
    case 'markdown_default_key_refused':
      return 'The server still uses the default admin key, which is public. Set MARKDOWN_ADMIN_KEY on the server.'
    case 'markdown_share_unavailable':
      return 'The server could not open this link right now. Try again in a moment.'
    case 'markdown_share_conflict':
      return 'Another document of this editor, whose id differs only in letter case, already has a link. Revoke that link or rename one of the two documents.'
    case 'markdown_backend_unavailable':
      return 'This storage is not configured on the server. Choose another one under Sync → Storage.'
    default:
      return serverMessage || `The server answered ${status}.`
  }
}

interface ErrorEnvelope {
  message?: unknown
  data?: { code?: unknown; retryAfter?: unknown } | null
}

async function failure(response: Response): Promise<ShareError> {
  let body: ErrorEnvelope | null
  try {
    body = (await response.json()) as ErrorEnvelope
  } catch {
    body = null
  }
  const code = typeof body?.data?.code === 'string' ? body.data.code : null
  const header = Number(response.headers.get('Retry-After'))
  const retryAfter =
    typeof body?.data?.retryAfter === 'number' ? body.data.retryAfter : Number.isFinite(header) && header > 0 ? header : null
  const serverMessage = typeof body?.message === 'string' ? body.message : ''
  return new ShareError(messageFor(code, response.status, serverMessage, retryAfter), { code, status: response.status, retryAfter })
}

async function send(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const stop = startResponsiveTimeout(TIMEOUT_MS, () => controller.abort())
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ShareError(`The server did not answer within ${TIMEOUT_MS / 1000} s.`, { offline: true })
    }
    throw new ShareError(navigator.onLine === false ? "You're offline." : 'Cannot reach the server.', { offline: true })
  } finally {
    stop()
  }
}

async function json<T>(response: Response): Promise<T> {
  if (!response.ok) throw await failure(response)
  return (await response.json()) as T
}

/** Make the link of a document, or refresh its snapshot (same token). `created` is false for a refresh. */
export async function createShare(input: CreateShareInput, backend: StorageBackend | null): Promise<{ created: boolean; share: ShareSummary }> {
  const response = await send(sharesUrl('shares', backend), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...adminSessionHeaders() },
    body: JSON.stringify({ ...input, mode: 'snapshot' }),
    cache: 'no-store'
  })
  const share = await json<ShareSummary>(response)
  return { created: response.status === 201, share }
}

export async function listShares(backend: StorageBackend | null): Promise<ShareListing> {
  const response = await send(sharesUrl('shares', backend), { headers: { ...adminSessionHeaders() }, cache: 'no-store' })
  return json<ShareListing>(response)
}

export async function revokeShare(docId: string, backend: StorageBackend | null): Promise<void> {
  const response = await send(sharesUrl('shares', backend, { docId }), {
    method: 'DELETE',
    headers: { ...adminSessionHeaders() },
    cache: 'no-store'
  })
  await json<{ revoked: boolean }>(response)
}

/** The public read. Sends nothing that identifies the viewer. */
export async function readShared(token: string, backend: StorageBackend | null): Promise<SharedDocument> {
  const response = await send(sharesUrl('shared', backend), {
    headers: { 'X-Share-Token': token },
    credentials: 'omit',
    cache: 'no-store',
    referrerPolicy: 'no-referrer'
  })
  const body = await json<SharedDocument>(response)
  if (typeof body?.content !== 'string' || typeof body.title !== 'string') throw new ShareError('The server returned an unexpected answer.')
  return body
}
