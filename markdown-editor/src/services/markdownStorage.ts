import type { FileNode, StorageBackend } from '../types'
import { normalizeTree } from '../lib/tree'
import { resolveApiBase } from './runtimeConfig'
import { startResponsiveTimeout } from '../lib/responsiveTimeout'

/**
 * Endpoint of the shared document store.
 *
 * Built from the runtime API base rather than a whole URL frozen at build time:
 * this bundle is served from the FastAPI collection, where the prefix is decided
 * when the server starts. VITE_MARKDOWN_API_URL still wins when it names a full
 * URL, for a deployment that keeps the API on another origin.
 */
function filesUrl(): string {
  const configured = import.meta.env.VITE_MARKDOWN_API_URL
  if (configured) return configured
  return `${resolveApiBase()}/markdown/files`
}

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
  if (response.status === 401 || response.status === 403) return false
  throw new Error(await describeFailure(response))
}

/** What the backend said about a session token: it holds, it is spent, or nobody answered. */
export type SessionCheck = 'valid' | 'rejected' | 'unreachable'

async function checkSession(token: string): Promise<SessionCheck> {
  try {
    const response = await request(`${resolveApiBase()}/markdown/admin/session`, {
      method: 'POST',
      headers: { 'X-Admin-Session': token }
    })
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

/** Turns a fetch failure into a message worth showing in a toast. */
async function describeFailure(response: Response): Promise<string> {
  const detail = await response.text().catch(() => '')
  const trimmed = detail.slice(0, 200).trim()
  if (response.status === 401 || response.status === 403) return 'Backend rejected the admin key'
  if (response.status === 404) return 'Backend endpoint not found - is the API running?'
  return trimmed ? `Backend error ${response.status}: ${trimmed}` : `Backend error ${response.status}`
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

export async function loadMarkdownFiles(storageType: StorageBackend): Promise<FileNode[]> {
  const response = await request(`${filesUrl()}?backend=${storageType}`)
  if (!response.ok) throw new Error(await describeFailure(response))

  const data = (await response.json()) as { files?: unknown }
  if (!Array.isArray(data.files)) throw new Error('Backend returned an unexpected payload')
  return normalizeTree(data.files as FileNode[])
}

export async function saveMarkdownFiles(files: FileNode[], storageType: StorageBackend): Promise<void> {
  if (!hasAdminCredential()) throw new Error('Unlock editing with the admin key before saving')

  const response = await request(`${filesUrl()}?backend=${storageType}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...adminHeaders()
    },
    body: JSON.stringify({ files })
  })
  if (!response.ok) throw new Error(await describeFailure(response))
}
