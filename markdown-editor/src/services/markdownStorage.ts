import type { FileNode, StorageBackend } from '../types'
import { normalizeTree } from '../lib/tree'

const API_URL = import.meta.env.VITE_MARKDOWN_API_URL || 'http://localhost:6789/api/v1/markdown/files'
const ADMIN_KEY = import.meta.env.VITE_MARKDOWN_ADMIN_KEY || 'markdown-editor-admin-2024'
const TIMEOUT_MS = 10_000

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
  const response = await request(`${API_URL}?backend=${storageType}`)
  if (!response.ok) throw new Error(await describeFailure(response))

  const data = (await response.json()) as { files?: unknown }
  if (!Array.isArray(data.files)) throw new Error('Backend returned an unexpected payload')
  return normalizeTree(data.files as FileNode[])
}

export async function saveMarkdownFiles(files: FileNode[], storageType: StorageBackend): Promise<void> {
  const response = await request(`${API_URL}?backend=${storageType}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Key': ADMIN_KEY
    },
    body: JSON.stringify({ files })
  })
  if (!response.ok) throw new Error(await describeFailure(response))
}
