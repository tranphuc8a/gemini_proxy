/**
 * The only server-side dependency of this app: a RESTful bridge to MongoDB.
 *
 * Every response uses the backend's envelope ({status_code, message, data}),
 * so `request` unwraps `data` and turns a non-2xx envelope into an ApiError
 * carrying the server's message.
 *
 * Reads that take a filter or a pipeline are POSTs: those are JSON documents,
 * and a query string is the wrong shape for them.
 */

import { resolveApiBase } from './runtimeConfig'

import type {
  ApiEnvelope,
  CollectionInfo,
  CommandResult,
  ConnectRequest,
  CreateIndexRequest,
  DatabaseInfo,
  DocumentPage,
  EjsonDocument,
  FindRequest,
  IndexInfo,
  MutationResult,
  OperationInfo,
  ServerOverview,
  SessionInfo,
  StatsResult,
} from '../types'

// Resolved per call rather than once at module load: the injected config is
// on the page before this bundle runs, and reading it lazily also keeps the
// value correct for tests that stub window.__WEBAPP_CONFIG__.
const apiBase = () => resolveApiBase(import.meta.env?.VITE_API_BASE)

export class ApiError extends Error {
  readonly status: number
  readonly payload: unknown

  constructor(message: string, status: number, payload?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.payload = payload
  }

  /** True when the session is gone and the UI should return to the login screen. */
  get isAuthError(): boolean {
    return this.status === 401
  }
}

let tokenProvider: () => string | null = () => null
let onUnauthorized: (() => void) | null = null

export function configureApi(options: {
  getToken?: () => string | null
  onUnauthorized?: () => void
}): void {
  if (options.getToken) tokenProvider = options.getToken
  if (options.onUnauthorized) onUnauthorized = options.onUnauthorized
}

function buildUrl(path: string, query?: Record<string, unknown>): string {
  const url = `${apiBase()}${path}`
  if (!query) return url
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue
    params.set(key, String(value))
  }
  const qs = params.toString()
  return qs ? `${url}?${qs}` : url
}

function authHeaders(): Record<string, string> {
  const token = tokenProvider()
  return token ? { 'X-Session-Token': token } : {}
}

async function readEnvelope(response: Response): Promise<ApiEnvelope<unknown> | null> {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text) as ApiEnvelope<unknown>
  } catch {
    return { status_code: response.status, message: text, data: null }
  }
}

async function request<T>(
  path: string,
  init: RequestInit & { query?: Record<string, unknown> } = {},
): Promise<T> {
  const { query, headers, ...rest } = init
  let response: Response
  try {
    response = await fetch(buildUrl(path, query), {
      ...rest,
      headers: {
        ...(rest.body ? { 'Content-Type': 'application/json' } : {}),
        ...authHeaders(),
        ...(headers as Record<string, string> | undefined),
      },
    })
  } catch (cause) {
    // fetch only rejects for network/CORS failures, never for HTTP errors.
    throw new ApiError('Cannot reach the API bridge. Is the FastAPI backend running?', 0, cause)
  }

  const envelope = await readEnvelope(response)
  if (!response.ok) {
    if (response.status === 401) onUnauthorized?.()
    throw new ApiError(envelope?.message || response.statusText || 'Request failed', response.status, envelope?.data)
  }
  return (envelope ? (envelope.data as T) : (null as T))
}

const root = '/mongoadmin'
const dbPath = (database: string) => `${root}/databases/${encodeURIComponent(database)}`
const collPath = (database: string, collection: string) =>
  `${dbPath(database)}/collections/${encodeURIComponent(collection)}`
const docPath = (database: string, collection: string) => `${collPath(database, collection)}/documents`

export const api = {
  // --- session ---
  connect: (payload: ConnectRequest) =>
    request<SessionInfo>(`${root}/sessions`, { method: 'POST', body: JSON.stringify(payload) }),

  currentSession: () => request<SessionInfo>(`${root}/sessions/current`),

  disconnect: () => request<{ disconnected: boolean }>(`${root}/sessions/current`, { method: 'DELETE' }),

  // --- databases ---
  listDatabases: () => request<DatabaseInfo[]>(`${root}/databases`),

  createDatabase: (name: string, collection = 'documents') =>
    request<MutationResult>(`${root}/databases`, {
      method: 'POST',
      body: JSON.stringify({ name, collection }),
    }),

  dropDatabase: (database: string) => request<MutationResult>(dbPath(database), { method: 'DELETE' }),

  databaseStats: (database: string) => request<StatsResult>(`${dbPath(database)}/stats`),

  // --- collections ---
  listCollections: (database: string, withStats = false) =>
    request<CollectionInfo[]>(`${dbPath(database)}/collections`, {
      query: withStats ? { with_stats: true } : undefined,
    }),

  createCollection: (
    database: string,
    payload: { name: string; capped?: boolean; size?: number | null; max_documents?: number | null },
  ) =>
    request<MutationResult>(`${dbPath(database)}/collections`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  dropCollection: (database: string, collection: string) =>
    request<MutationResult>(collPath(database, collection), { method: 'DELETE' }),

  renameCollection: (database: string, collection: string, name: string, dropTarget = false) =>
    request<MutationResult>(`${collPath(database, collection)}/rename`, {
      method: 'POST',
      body: JSON.stringify({ name, drop_target: dropTarget }),
    }),

  truncateCollection: (database: string, collection: string) =>
    request<MutationResult>(`${collPath(database, collection)}/truncate`, { method: 'POST' }),

  collectionStats: (database: string, collection: string) =>
    request<StatsResult>(`${collPath(database, collection)}/stats`),

  // --- documents ---
  findDocuments: (database: string, collection: string, payload: FindRequest) =>
    request<DocumentPage>(`${docPath(database, collection)}/find`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  countDocuments: (database: string, collection: string, filter: unknown) =>
    request<{ count: number }>(`${docPath(database, collection)}/count`, {
      method: 'POST',
      body: JSON.stringify({ filter }),
    }),

  insertDocuments: (database: string, collection: string, documents: unknown) =>
    request<MutationResult>(docPath(database, collection), {
      method: 'POST',
      body: JSON.stringify({ documents }),
    }),

  updateDocuments: (
    database: string,
    collection: string,
    payload: { filter: unknown; update: unknown; many?: boolean; upsert?: boolean },
  ) =>
    request<MutationResult>(docPath(database, collection), {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  deleteDocuments: (database: string, collection: string, filter: unknown, many = false) =>
    request<MutationResult>(`${docPath(database, collection)}/delete`, {
      method: 'POST',
      body: JSON.stringify({ filter, many }),
    }),

  // --- indexes ---
  listIndexes: (database: string, collection: string) =>
    request<IndexInfo[]>(`${collPath(database, collection)}/indexes`),

  createIndex: (database: string, collection: string, payload: CreateIndexRequest) =>
    request<MutationResult>(`${collPath(database, collection)}/indexes`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  dropIndex: (database: string, collection: string, name: string) =>
    request<MutationResult>(`${collPath(database, collection)}/indexes/${encodeURIComponent(name)}`, {
      method: 'DELETE',
    }),

  // --- console and server ---
  aggregate: (database: string, collection: string, pipeline: unknown, maxRows = 200) =>
    request<CommandResult>(`${collPath(database, collection)}/aggregate`, {
      method: 'POST',
      body: JSON.stringify({ pipeline, max_rows: maxRows }),
    }),

  runCommand: (command: unknown, database?: string | null) =>
    request<CommandResult>(`${root}/command`, {
      method: 'POST',
      body: JSON.stringify({ command, database: database || null }),
    }),

  serverOverview: () => request<ServerOverview>(`${root}/server/overview`),

  currentOperations: () => request<OperationInfo[]>(`${root}/server/operations`),

  /** Exports stream as a file body rather than an envelope, so fetch is used directly. */
  exportCollection: async (
    database: string,
    collection: string,
    format: 'json' | 'jsonl' | 'csv',
    limit = 200,
    filter?: string,
  ) => {
    const url = buildUrl(`${collPath(database, collection)}/export`, { format, limit, filter })
    const response = await fetch(url, { headers: authHeaders() })
    if (!response.ok) {
      const envelope = await readEnvelope(response)
      throw new ApiError(envelope?.message || 'Export failed', response.status)
    }
    return { blob: await response.blob(), filename: `${database}.${collection}.${format}` }
  },
}

export type { EjsonDocument }
export const __testing = { buildUrl, readEnvelope, request }
