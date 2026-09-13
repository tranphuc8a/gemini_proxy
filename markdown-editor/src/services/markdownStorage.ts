import type { FileNode, StorageBackend } from '../types'
import { normalizeTree } from '../lib/tree'
import { resolveApiBase } from './runtimeConfig'

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

/**
 * The admin key for this browser session.
 *
 * Deliberately a module-level variable and nothing more: it is never written to
 * localStorage, and never compiled into the bundle. It used to come from
 * VITE_MARKDOWN_ADMIN_KEY, which put the real key in the JavaScript every
 * visitor downloads.
 */
let adminKey: string | null = null

export function setAdminKey(key: string | null): void {
  adminKey = key
}

/** Ask the backend whether a key is the real one. */
export async function verifyAdminKey(key: string): Promise<boolean> {
  const response = await request(`${resolveApiBase()}/markdown/admin/verify`, {
    method: 'POST',
    headers: { 'X-Admin-Key': key }
  })
  if (response.ok) return true
  if (response.status === 401 || response.status === 403) return false
  throw new Error(await describeFailure(response))
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
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(`Backend did not respond within ${TIMEOUT_MS / 1000}s`)
    }
    throw new Error('Cannot reach the backend - check that the API is running')
  } finally {
    clearTimeout(timer)
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
  if (!adminKey) throw new Error('Unlock editing with the admin key before saving')

  const response = await request(`${filesUrl()}?backend=${storageType}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Key': adminKey
    },
    body: JSON.stringify({ files })
  })
  if (!response.ok) throw new Error(await describeFailure(response))
}
