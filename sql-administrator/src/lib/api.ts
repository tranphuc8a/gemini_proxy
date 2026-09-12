/**
 * The only server-side dependency of this app: a RESTful bridge to MySQL.
 *
 * Every response uses the backend's envelope ({status_code, message, data}),
 * so `request` unwraps `data` and turns a non-2xx envelope into an ApiError
 * carrying the server's message.
 */

import type {
  ApiEnvelope,
  BrowsePage,
  ConnectRequest,
  DatabaseInfo,
  MutationResult,
  ProcessInfo,
  QueryResult,
  ServerOverview,
  SessionInfo,
  TableInfo,
  TableStructure,
} from '../types'

const API_BASE = (import.meta.env?.VITE_API_BASE ?? '').replace(/\/+$/, '')

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
  const url = `${API_BASE}${path}`
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

const root = '/sqladmin'
const tablePath = (database: string, table: string) =>
  `${root}/databases/${encodeURIComponent(database)}/tables/${encodeURIComponent(table)}`

export const api = {
  // --- session ---
  connect: (payload: ConnectRequest) =>
    request<SessionInfo>(`${root}/sessions`, { method: 'POST', body: JSON.stringify(payload) }),

  currentSession: () => request<SessionInfo>(`${root}/sessions/current`),

  disconnect: () => request<{ disconnected: boolean }>(`${root}/sessions/current`, { method: 'DELETE' }),

  // --- databases ---
  listDatabases: () => request<DatabaseInfo[]>(`${root}/databases`),

  createDatabase: (name: string, charset = 'utf8mb4', collation?: string) =>
    request<MutationResult>(`${root}/databases`, {
      method: 'POST',
      body: JSON.stringify({ name, charset, collation: collation || null }),
    }),

  dropDatabase: (database: string) =>
    request<MutationResult>(`${root}/databases/${encodeURIComponent(database)}`, { method: 'DELETE' }),

  // --- tables ---
  listTables: (database: string) =>
    request<TableInfo[]>(`${root}/databases/${encodeURIComponent(database)}/tables`),

  tableStructure: (database: string, table: string) =>
    request<TableStructure>(`${tablePath(database, table)}/structure`),

  dropTable: (database: string, table: string) =>
    request<MutationResult>(tablePath(database, table), { method: 'DELETE' }),

  truncateTable: (database: string, table: string) =>
    request<MutationResult>(`${tablePath(database, table)}/truncate`, { method: 'POST' }),

  // --- rows ---
  browseRows: (
    database: string,
    table: string,
    options: { limit?: number; offset?: number; orderBy?: string; direction?: string; search?: string } = {},
  ) =>
    request<BrowsePage>(`${tablePath(database, table)}/rows`, {
      query: {
        limit: options.limit,
        offset: options.offset,
        order_by: options.orderBy,
        direction: options.direction,
        search: options.search,
      },
    }),

  insertRow: (database: string, table: string, values: Record<string, unknown>) =>
    request<MutationResult>(`${tablePath(database, table)}/rows`, {
      method: 'POST',
      body: JSON.stringify({ values }),
    }),

  updateRow: (database: string, table: string, values: Record<string, unknown>, key: Record<string, unknown>) =>
    request<MutationResult>(`${tablePath(database, table)}/rows`, {
      method: 'PATCH',
      body: JSON.stringify({ values, key }),
    }),

  deleteRows: (database: string, table: string, keys: Record<string, unknown>[]) =>
    request<MutationResult>(`${tablePath(database, table)}/rows/delete`, {
      method: 'POST',
      body: JSON.stringify({ keys }),
    }),

  // --- console and server ---
  runSql: (sql: string, database?: string | null, maxRows = 500) =>
    request<QueryResult[]>(`${root}/query`, {
      method: 'POST',
      body: JSON.stringify({ sql, database: database || null, max_rows: maxRows }),
    }),

  serverOverview: () => request<ServerOverview>(`${root}/server/overview`),

  processList: () => request<ProcessInfo[]>(`${root}/server/processes`),

  /** Exports stream as a file body rather than an envelope, so fetch is used directly. */
  exportTable: async (database: string, table: string, format: 'csv' | 'json' | 'sql', limit = 1000) => {
    const url = buildUrl(`${tablePath(database, table)}/export`, { format, limit })
    const response = await fetch(url, { headers: authHeaders() })
    if (!response.ok) {
      const envelope = await readEnvelope(response)
      throw new ApiError(envelope?.message || 'Export failed', response.status)
    }
    return { blob: await response.blob(), filename: `${database}.${table}.${format}` }
  },
}

export const __testing = { buildUrl, readEnvelope, request }
