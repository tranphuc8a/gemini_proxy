/**
 * The backend bridge: workspace sync, server history, sharing - and the base
 * URL discovery both this file and the proxy sender depend on.
 *
 * Discovery exists because `API_PREFIX` is a deployment choice. This repo's own
 * .env leaves it empty, so the routers sit at `/postman/...` while the
 * documented default is `/api/v1/postman/...`. Guessing wrong 404s every call,
 * so we probe the plausible mounts once and remember the answer.
 */

import type { ApiEnvelope } from '../types'
import { resolveApiBase } from './runtimeConfig'

// The server-injected base when there is one, else this app's VITE_API_BASE.
// Probing below still covers the case where neither is set.
const CONFIGURED_BASE = resolveApiBase(import.meta.env?.VITE_API_BASE as string | undefined)
const STORAGE_KEY = 'postman_pro_api_base'

let resolvedBase: string | null = null
let probing: Promise<string> | null = null

export class ApiError extends Error {
  readonly status: number
  readonly payload: unknown

  constructor(message: string, status: number, payload?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.payload = payload
  }

  /** A save refused because somebody else saved first. */
  get isConflict(): boolean {
    return this.status === 409
  }

  get isAuthError(): boolean {
    return this.status === 401
  }
}

function candidates(): string[] {
  const list: string[] = []
  const push = (value: string | null | undefined) => {
    if (value == null) return
    const clean = value.replace(/\/+$/, '')
    if (!list.includes(clean)) list.push(clean)
  }

  push(CONFIGURED_BASE)
  try {
    push(localStorage.getItem(STORAGE_KEY))
  } catch {
    /* private mode */
  }
  // '' means "same origin, no prefix", which is what the dev proxy serves too.
  push('')
  push('/api/v1')
  push('/api')
  return list
}

async function probe(base: string): Promise<boolean> {
  try {
    const res = await fetch(`${base}/proxy/status`)
    if (!res.ok) return false
    const envelope = await res.json()
    // A 200 from an unrelated page is not the API; insist on our envelope.
    return typeof envelope?.data?.enabled === 'boolean'
  } catch {
    return false
  }
}

/** Resolve (and cache) the API mount point. Safe to call concurrently. */
export function ensureApiBase(): Promise<string> {
  if (resolvedBase !== null) return Promise.resolve(resolvedBase)
  if (probing) return probing

  probing = (async () => {
    for (const base of candidates()) {
      if (await probe(base)) {
        resolvedBase = base
        try {
          localStorage.setItem(STORAGE_KEY, base)
        } catch {
          /* private mode */
        }
        return base
      }
    }
    // Nothing answered. Fall back to same-origin so calls fail with a real HTTP
    // error the user can read, rather than hanging on discovery forever.
    resolvedBase = CONFIGURED_BASE ?? ''
    return resolvedBase
  })()

  return probing
}

export function apiBase(): string {
  return resolvedBase ?? CONFIGURED_BASE ?? ''
}

export function resetApiBaseForTests(): void {
  resolvedBase = null
  probing = null
}

// ---------------------------------------------------------------------------
async function request<T>(
  path: string,
  init: RequestInit & { accessKey?: string; query?: Record<string, unknown> } = {},
): Promise<T> {
  const base = await ensureApiBase()
  let url = `${base}${path}`

  if (init.query) {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(init.query)) {
      if (value === undefined || value === null || value === '') continue
      params.set(key, String(value))
    }
    const query = params.toString()
    if (query) url += `?${query}`
  }

  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) }
  if (init.body) headers['Content-Type'] = 'application/json'
  if (init.accessKey) headers['X-Workspace-Key'] = init.accessKey

  const res = await fetch(url, { ...init, headers })

  let envelope: ApiEnvelope<T> | undefined
  try {
    envelope = (await res.json()) as ApiEnvelope<T>
  } catch {
    throw new ApiError(`Máy chủ trả về dữ liệu không hợp lệ (HTTP ${res.status})`, res.status)
  }

  if (!res.ok) throw new ApiError(envelope?.message ?? `HTTP ${res.status}`, res.status, envelope?.data)
  return envelope!.data
}

// ---------------------------------------------------------------- workspaces
export interface WorkspaceDto {
  id: string
  name: string
  revision: number
  created_at: string
  updated_at: string
  collections: any[]
  requests: any[]
  environments: any[]
  share_token: string | null
}

export interface WorkspaceCreatedDto {
  id: string
  name: string
  access_key: string
  revision: number
  created_at: string
}

export const api = {
  createWorkspace: (name: string) =>
    request<WorkspaceCreatedDto>('/postman/workspaces', { method: 'POST', body: JSON.stringify({ name }) }),

  getWorkspace: (id: string, accessKey: string) =>
    request<WorkspaceDto>(`/postman/workspaces/${encodeURIComponent(id)}`, { accessKey }),

  saveWorkspace: (
    id: string,
    accessKey: string,
    payload: { revision: number; name?: string; collections: any[]; requests: any[]; environments: any[] },
  ) =>
    request<WorkspaceDto>(`/postman/workspaces/${encodeURIComponent(id)}`, {
      method: 'PUT',
      accessKey,
      body: JSON.stringify(payload),
    }),

  deleteWorkspace: (id: string, accessKey: string) =>
    request<{ deleted: boolean }>(`/postman/workspaces/${encodeURIComponent(id)}`, { method: 'DELETE', accessKey }),

  setShare: (id: string, accessKey: string, enabled: boolean) =>
    request<{ share_token: string | null; enabled: boolean }>(
      `/postman/workspaces/${encodeURIComponent(id)}/share`,
      { method: 'POST', accessKey, query: { enabled } },
    ),

  getShared: (token: string) => request<Omit<WorkspaceDto, 'environments' | 'share_token' | 'created_at'>>(
    `/postman/shared/${encodeURIComponent(token)}`,
  ),

  listHistory: (id: string, accessKey: string, limit = 50, offset = 0) =>
    request<{ items: any[]; total: number }>(`/postman/workspaces/${encodeURIComponent(id)}/history`, {
      accessKey,
      query: { limit, offset },
    }),

  addHistory: (id: string, accessKey: string, entry: Record<string, unknown>) =>
    request<any>(`/postman/workspaces/${encodeURIComponent(id)}/history`, {
      method: 'POST',
      accessKey,
      body: JSON.stringify(entry),
    }),

  clearHistory: (id: string, accessKey: string) =>
    request<{ removed: number }>(`/postman/workspaces/${encodeURIComponent(id)}/history`, {
      method: 'DELETE',
      accessKey,
    }),

  proxyStatus: () =>
    request<{ enabled: boolean; allowed_hosts: string; max_bytes: number; timeout_seconds: number }>('/proxy/status'),
}
