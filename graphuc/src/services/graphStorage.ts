/**
 * Where drawings live.
 *
 * Local first: everything is written to localStorage as it is edited, so the
 * editor works with no backend at all and nothing is lost to a closed tab. The
 * server is an opt-in second home — for sharing a drawing, or keeping it past a
 * cleared cache.
 *
 * Saving to the server needs the admin key. The key itself is never stored:
 * it is exchanged once for a signed session token, and the token is what
 * survives a reload. See the backend's `application/utils/admin_session.py`.
 */

import type { BackendInfo, GraphDocument, GraphSummary, StorageBackend } from '../types'
import { parseDocument } from '../lib/graph'
import { resolveApiBase } from './runtimeConfig'

const TIMEOUT_MS = 12_000

export const LOCAL_INDEX_KEY = 'graphuc:index'
export const LOCAL_PREFIX = 'graphuc:doc:'
export const SESSION_KEY = 'graphuc:admin-session'
export const SETTINGS_KEY = 'graphuc:settings'

function apiRoot(): string {
  return `${resolveApiBase(import.meta.env?.VITE_API_BASE as string | undefined)}/graphs`
}

// ------------------------------------------------------------------- local

/** localStorage throws in private mode and when the quota is exhausted. */
function readRaw<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function writeRaw(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export interface LocalEntry {
  id: string
  title: string
  kind: string
  nodes: number
  edges: number
  updatedAt: string
}

export function listLocal(): LocalEntry[] {
  const index = readRaw<LocalEntry[]>(LOCAL_INDEX_KEY, [])
  return Array.isArray(index) ? [...index].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) : []
}

export function loadLocal(id: string): GraphDocument | null {
  return parseDocument(readRaw<unknown>(LOCAL_PREFIX + id, null))
}

/**
 * Write the document and keep the index in step.
 *
 * The index is a separate key so opening the picker does not have to parse
 * every drawing the browser holds — with a dozen saved graphs that is the
 * difference between instant and noticeable.
 */
export function saveLocal(graph: GraphDocument): boolean {
  const stored = writeRaw(LOCAL_PREFIX + graph.id, graph)
  if (!stored) return false

  const index = listLocal().filter((entry) => entry.id !== graph.id)
  index.unshift({
    id: graph.id,
    title: graph.title,
    kind: graph.kind,
    nodes: graph.nodes.length,
    edges: graph.edges.length,
    updatedAt: graph.updatedAt
  })
  return writeRaw(LOCAL_INDEX_KEY, index)
}

export function deleteLocal(id: string): void {
  try {
    localStorage.removeItem(LOCAL_PREFIX + id)
  } catch {
    /* nothing to remove */
  }
  writeRaw(LOCAL_INDEX_KEY, listLocal().filter((entry) => entry.id !== id))
}

export function readSettings<T>(fallback: T): T {
  return readRaw<T>(SETTINGS_KEY, fallback)
}

export function writeSettings(settings: unknown): void {
  writeRaw(SETTINGS_KEY, settings)
}

// -------------------------------------------------------------------- auth

let adminSession: string | null = null

function storedSession(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY)
  } catch {
    return null
  }
}

function keepSession(token: string | null): void {
  adminSession = token
  try {
    if (token) localStorage.setItem(SESSION_KEY, token)
    else localStorage.removeItem(SESSION_KEY)
  } catch {
    /* an unlockable session is a lesser failure than a broken editor */
  }
}

export function isUnlocked(): boolean {
  return Boolean(adminSession)
}

export function lock(): void {
  keepSession(null)
}

function adminHeaders(): Record<string, string> {
  return adminSession ? { 'X-Admin-Session': adminSession } : {}
}

async function readSessionToken(response: Response): Promise<string> {
  const body = (await response.json()) as { session?: unknown }
  if (typeof body.session !== 'string' || !body.session) throw new Error('Máy chủ không trả về session token')
  return body.session
}

/**
 * Exchange the admin key for a session token.
 *
 * `false` means the key was rejected; anything else throws, so the caller can
 * tell "sai khoá" from "máy chủ không phản hồi" — they need different messages.
 */
export async function unlock(key: string): Promise<boolean> {
  const response = await request(`${apiRoot()}/_admin/verify`, { method: 'POST', headers: { 'X-Admin-Key': key } })
  if (response.ok) {
    keepSession(await readSessionToken(response))
    return true
  }
  if (response.status === 401 || response.status === 403) return false
  throw new Error(await describeFailure(response))
}

/**
 * Re-establish admin mode from the stored token, once on startup.
 *
 * Failure is silent: arriving without a valid session is the normal case, not
 * something to interrupt anybody about.
 */
export async function restoreSession(): Promise<boolean> {
  const stored = storedSession()
  if (!stored) return false
  try {
    const response = await request(`${apiRoot()}/_admin/session`, {
      method: 'POST',
      headers: { 'X-Admin-Session': stored }
    })
    if (!response.ok) {
      keepSession(null) // expired, or the admin key was rotated
      return false
    }
    keepSession(await readSessionToken(response))
    return true
  } catch {
    // An unreachable backend says nothing about the token: keep it in storage
    // and stay locked until a later attempt can settle the question.
    adminSession = null
    return false
  }
}

// ----------------------------------------------------------------- backend

async function describeFailure(response: Response): Promise<string> {
  const detail = await response.text().catch(() => '')
  if (response.status === 401 || response.status === 403) return 'Máy chủ từ chối khoá admin'
  if (response.status === 404) return 'Không tìm thấy endpoint — API có đang chạy không?'
  if (response.status === 503) return 'Backend lưu trữ này chưa được cấu hình trên máy chủ'
  const trimmed = detail.slice(0, 200).trim()
  return trimmed ? `Lỗi ${response.status}: ${trimmed}` : `Lỗi ${response.status}`
}

async function request(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(`Máy chủ không phản hồi trong ${TIMEOUT_MS / 1000}s`)
    }
    throw new Error('Không kết nối được tới máy chủ')
  } finally {
    clearTimeout(timer)
  }
}

async function json<T>(response: Response): Promise<T> {
  if (!response.ok) throw new Error(await describeFailure(response))
  return (await response.json()) as T
}

export async function listBackends(): Promise<BackendInfo[]> {
  const data = await json<unknown>(await request(`${apiRoot()}/_backends`))
  return Array.isArray(data) ? (data as BackendInfo[]) : []
}

export async function listRemote(backend: StorageBackend): Promise<GraphSummary[]> {
  return json<GraphSummary[]>(await request(`${apiRoot()}?backend=${backend}`))
}

export async function loadRemote(id: string, backend: StorageBackend): Promise<GraphDocument> {
  const body = await json<{ document: unknown; title: string }>(
    await request(`${apiRoot()}/${encodeURIComponent(id)}?backend=${backend}`)
  )
  const parsed = parseDocument(body.document)
  if (!parsed) throw new Error('Máy chủ trả về tài liệu không đọc được')
  // The envelope's title is the authoritative one: it is what the picker showed
  // and what a rename on the server changed.
  return { ...parsed, id, title: body.title || parsed.title }
}

export async function saveRemote(graph: GraphDocument, backend: StorageBackend): Promise<GraphSummary> {
  if (!adminSession) throw new Error('Cần mở khoá bằng admin token trước khi lưu lên máy chủ')
  const response = await request(`${apiRoot()}/${encodeURIComponent(graph.id)}?backend=${backend}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...adminHeaders() },
    body: JSON.stringify({ title: graph.title, kind: graph.kind, document: graph })
  })
  return json<GraphSummary>(response)
}

export async function deleteRemote(id: string, backend: StorageBackend): Promise<boolean> {
  if (!adminSession) throw new Error('Cần mở khoá bằng admin token trước khi xoá trên máy chủ')
  const body = await json<{ deleted: boolean }>(
    await request(`${apiRoot()}/${encodeURIComponent(id)}?backend=${backend}`, {
      method: 'DELETE',
      headers: adminHeaders()
    })
  )
  return body.deleted
}
