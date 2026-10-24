import type { StorageBackend } from '../types'
import { resolveApiBase } from './runtimeConfig'
import { startResponsiveTimeout } from '../lib/responsiveTimeout'

const TIMEOUT_MS = 10_000

/** Where the session token lives between reloads. */
export const SESSION_KEY = 'markdown-editor:admin-session'

/**
 * The admin credential for this browser session.
 *
 * The *key* is still never stored: it is typed once, exchanged for a signed
 * token at `/markdown/admin/verify`, and then forgotten. What survives a reload
 * is the token, which carries nothing but an expiry and a signature and is
 * useless against anything other than this app. That exchange is the whole point
 * -- before it, every reload dropped the user back to view-only.
 */
let adminSession: string | null = null

/** localStorage throws in private mode and when the quota is exhausted. */
function readStoredSession(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY)
  } catch {
    return null
  }
}

function writeStoredSession(token: string | null): void {
  try {
    if (token) localStorage.setItem(SESSION_KEY, token)
    else localStorage.removeItem(SESSION_KEY)
  } catch {
    /* an unlockable session is a lesser failure than a broken editor */
  }
}

export function setAdminSession(token: string | null): void {
  adminSession = token
  writeStoredSession(token)
}

/** The header that proves this browser may write. */
function adminHeaders(): Record<string, string> {
  return adminSession ? { 'X-Admin-Session': adminSession } : {}
}

/** The admin header for another client of the markdown API (the share links: services/shareClient.ts). */
export function adminSessionHeaders(): Record<string, string> {
  return adminHeaders()
}

/**
 * A refusal from the markdown API, with the machine-readable `data.code` of its error envelope
 * (`{message, data: {code, retryAfter}}`) so the UI can react to the case rather than to a sentence.
 */
export class StorageError extends Error {
  readonly status: number
  readonly code: string | null
  readonly retryAfter: number | null

  constructor(message: string, status: number, code: string | null = null, retryAfter: number | null = null) {
    super(message)
    this.name = 'StorageError'
    this.status = status
    this.code = code
    this.retryAfter = retryAfter
  }
}

export function hasAdminCredential(): boolean {
  return Boolean(adminSession)
}

interface SessionResponse {
  session?: unknown
  expiresAt?: unknown
}

async function readSession(response: Response): Promise<string> {
  const body = (await response.json()) as SessionResponse
  if (typeof body.session !== 'string' || !body.session) {
    throw new Error('Backend did not return a session token')
  }
  return body.session
}

/**
 * Exchange the admin key for a session token.
 *
 * Returns false for a rejected key and throws for anything else, so the caller
 * can tell "wrong key" from "backend is down" -- they need different messages.
 */
export async function verifyAdminKey(key: string): Promise<boolean> {
  const response = await request(`${resolveApiBase()}/markdown/admin/verify`, {
    method: 'POST',
    headers: { 'X-Admin-Key': key }
  })
  if (response.ok) {
    setAdminSession(await readSession(response))
    return true
  }
  const failure = await storageError(response)
  // A refused DEFAULT key or a locked-out address is not "wrong key": say what is going on.
  if ((response.status === 401 || response.status === 403) && failure.code !== 'markdown_default_key_refused') return false
  throw failure
}

/** What the backend said about a session token: it holds, it is spent, or nobody answered. */
export type SessionCheck = 'valid' | 'rejected' | 'unreachable'

async function checkSession(token: string): Promise<SessionCheck> {
  try {
    const response = await request(`${resolveApiBase()}/markdown/admin/session`, {
      method: 'POST',
      headers: { 'X-Admin-Session': token }
    })
    // Locked out for a while (too many wrong keys from this network, maybe not ours): says nothing about the token.
    if (response.status === 429) return 'unreachable'
    // Expired, or the admin key was rotated. Either way this token is spent.
    if (!response.ok) return 'rejected'
    // The server hands back a fresh token, so an active user is not signed out
    // mid-session just because the original was near its expiry.
    setAdminSession(await readSession(response))
    return 'valid'
  } catch {
    return 'unreachable'
  }
}

/** The browser itself says there is no network -- as opposed to a server that is merely down. */
function deviceIsOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

/**
 * Re-establish admin mode from the token kept in localStorage.
 *
 * Called once on startup. A missing, tampered or expired token simply means
 * "view-only" -- never an error the user has to dismiss, because arriving at the
 * page without a session is the normal case.
 *
 * Unreachable backend, two cases. A server that is down while the device is online says nothing
 * about the token: keep it in storage and stay view-only until a later attempt can settle the
 * question. A device with no network at all is the installed-app case: the owner must be able to
 * keep editing the copy in this browser, so the stored token is trusted for now. That grants no
 * more than the UI -- every write to the server still carries the token and is checked there --
 * and `recheckAdminSession` settles it the moment the connection returns.
 */
export async function restoreAdminSession(): Promise<boolean> {
  const stored = readStoredSession()
  if (!stored) return false

  const result = await checkSession(stored)
  if (result === 'valid') return true
  if (result === 'rejected') {
    setAdminSession(null)
    return false
  }
  if (deviceIsOffline()) {
    adminSession = stored
    return true
  }
  adminSession = null
  return false
}

/**
 * Back online after trusting a token offline (or any time admin mode should be re-proved).
 *
 * Only an explicit rejection takes the session away; a flaky connection right after reconnecting
 * must not sign the owner out, so 'unreachable' leaves everything as it was.
 */
export async function recheckAdminSession(): Promise<SessionCheck> {
  const token = adminSession ?? readStoredSession()
  if (!token) return 'rejected'
  const result = await checkSession(token)
  if (result === 'rejected') setAdminSession(null)
  return result
}

export function clearAdminCredentials(): void {
  setAdminSession(null)
}

/** Storage backends this deployment can actually serve. */
export interface BackendInfo {
  id: StorageBackend
  available: boolean
  reason?: string | null
}

export async function listBackends(): Promise<BackendInfo[]> {
  const response = await request(`${resolveApiBase()}/markdown/backends`)
  if (!response.ok) throw new Error(await describeFailure(response))
  const data = (await response.json()) as unknown
  if (!Array.isArray(data)) throw new Error('Backend returned an unexpected payload')
  return data.filter((item): item is BackendInfo => typeof item === 'object' && item !== null && 'id' in item)
}

interface ErrorEnvelope {
  message?: unknown
  detail?: unknown
  data?: { code?: unknown; retryAfter?: unknown } | null
}

/** What the UI says for the API's error codes (the server's own sentences are Vietnamese; the app is English). */
function messageForCode(code: string | null, retryAfter: number | null): string | null {
  switch (code) {
    case 'markdown_private':
      return "This server's documents are private. Unlock admin mode to load them."
    case 'markdown_admin_locked':
      return `Too many wrong admin keys from this network. Try again in ${retryAfter ?? 600} s.`
    case 'markdown_default_key_refused':
      return 'The server still uses the default admin key, which is public, so it refuses admin access from other devices. Set MARKDOWN_ADMIN_KEY on the server.'
    case 'markdown_session_expired':
      return 'Your admin session expired. Unlock admin mode again.'
    case 'markdown_admin_disabled':
      return 'Admin access is switched off on this server.'
    default:
      return null
  }
}

/** Turns a refused response into a `StorageError` whose message is worth showing in a toast. */
async function storageError(response: Response): Promise<StorageError> {
  const raw = await response.text().catch(() => '')
  let envelope: ErrorEnvelope | null = null
  try {
    envelope = raw ? (JSON.parse(raw) as ErrorEnvelope) : null
  } catch {
    envelope = null
  }
  const code = typeof envelope?.data?.code === 'string' ? envelope.data.code : null
  const header = Number(response.headers.get('Retry-After'))
  const retryAfter =
    typeof envelope?.data?.retryAfter === 'number' ? envelope.data.retryAfter : Number.isFinite(header) && header > 0 ? header : null
  const known = messageForCode(code, retryAfter)
  if (known) return new StorageError(known, response.status, code, retryAfter)
  const trimmed = raw.slice(0, 200).trim()
  let message: string
  if (response.status === 401 || response.status === 403) message = 'Backend rejected the admin key'
  else if (response.status === 404) message = 'Backend endpoint not found - is the API running?'
  else if (response.status === 429) message = `Too many requests. Try again in ${retryAfter ?? 60} s.`
  else message = trimmed ? `Backend error ${response.status}: ${trimmed}` : `Backend error ${response.status}`
  return new StorageError(message, response.status, code, retryAfter)
}

async function describeFailure(response: Response): Promise<string> {
  return (await storageError(response)).message
}

async function request(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController()
  // Counts only time the page could have handled the reply: a long render on startup must not cancel the
  // session check whose answer is already waiting (see lib/responsiveTimeout).
  const stop = startResponsiveTimeout(TIMEOUT_MS, () => controller.abort())
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(`Backend did not respond within ${TIMEOUT_MS / 1000}s`)
    }
    throw new Error('Cannot reach the backend - check that the API is running')
  } finally {
    stop()
  }
}
