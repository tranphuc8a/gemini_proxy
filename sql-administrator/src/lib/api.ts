/**
 * The only server-side dependency of this app: a RESTful bridge to MySQL.
 *
 * Every response uses the backend's envelope ({status_code, message, data}),
 * so `request` unwraps `data` and turns a non-2xx envelope into an ApiError
 * carrying the server's message.
 */

import { resolveApiBase } from './runtimeConfig'

import type {
  ApiEnvelope,
  BackupOptions,
  BackupResult,
  BrowsePage,
  ColumnDefinition,
  ConnectRequest,
  CreateTablePayload,
  DatabaseInfo,
  ForeignKeyPayload,
  MutationResult,
  ProcessInfo,
  QueryResult,
  RestoreResult,
  RoutineInfo,
  ServerOverview,
  SessionInfo,
  TableInfo,
  TableStructure,
  TriggerInfo,
  ViewInfo,
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


  // --- schema editing ---
  // One method per operation, matching the backend. The console (`runSql`) is
  // where free-form SQL belongs; these build their statement from validated
  // parts server-side, so a table name cannot become a second statement.
  createTable: (database: string, payload: CreateTablePayload) =>
    request<MutationResult>(`${root}/databases/${encodeURIComponent(database)}/tables`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  renameTable: (database: string, table: string, newName: string) =>
    request<MutationResult>(`${tablePath(database, table)}/rename`, {
      method: 'PATCH',
      body: JSON.stringify({ new_name: newName }),
    }),

  addColumn: (database: string, table: string, column: ColumnDefinition) =>
    request<MutationResult>(`${tablePath(database, table)}/columns`, {
      method: 'POST',
      body: JSON.stringify({ column }),
    }),

  modifyColumn: (database: string, table: string, name: string, column: ColumnDefinition) =>
    request<MutationResult>(`${tablePath(database, table)}/columns`, {
      method: 'PATCH',
      body: JSON.stringify({ name, column }),
    }),

  dropColumn: (database: string, table: string, name: string) =>
    request<MutationResult>(`${tablePath(database, table)}/columns/delete`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  // --- keys and indexes ---
  setPrimaryKey: (database: string, table: string, columns: string[]) =>
    request<MutationResult>(`${tablePath(database, table)}/primary-key`, {
      method: 'PUT',
      body: JSON.stringify({ columns }),
    }),

  createIndex: (database: string, table: string, payload: { name: string; columns: string[]; unique: boolean }) =>
    request<MutationResult>(`${tablePath(database, table)}/indexes`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  dropIndex: (database: string, table: string, name: string) =>
    request<MutationResult>(`${tablePath(database, table)}/indexes/${encodeURIComponent(name)}`, {
      method: 'DELETE',
    }),

  createForeignKey: (database: string, table: string, payload: ForeignKeyPayload) =>
    request<MutationResult>(`${tablePath(database, table)}/foreign-keys`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  dropForeignKey: (database: string, table: string, name: string) =>
    request<MutationResult>(`${tablePath(database, table)}/foreign-keys/${encodeURIComponent(name)}`, {
      method: 'DELETE',
    }),

  // --- views ---
  listViews: (database: string) =>
    request<ViewInfo[]>(`${root}/databases/${encodeURIComponent(database)}/views`),

  getView: (database: string, view: string) =>
    request<ViewInfo>(`${root}/databases/${encodeURIComponent(database)}/views/${encodeURIComponent(view)}`),

  saveView: (database: string, payload: { name: string; select: string; replace?: boolean }) =>
    request<MutationResult>(`${root}/databases/${encodeURIComponent(database)}/views`, {
      method: 'PUT',
      body: JSON.stringify({ replace: true, ...payload }),
    }),

  dropView: (database: string, view: string) =>
    request<MutationResult>(`${root}/databases/${encodeURIComponent(database)}/views/${encodeURIComponent(view)}`, {
      method: 'DELETE',
    }),

  // --- routines ---
  listRoutines: (database: string) =>
    request<RoutineInfo[]>(`${root}/databases/${encodeURIComponent(database)}/routines`),

  getRoutine: (database: string, kind: string, name: string) =>
    request<RoutineInfo>(
      `${root}/databases/${encodeURIComponent(database)}/routines/${encodeURIComponent(kind)}/${encodeURIComponent(name)}`,
    ),

  saveRoutine: (database: string, statement: string, replace = true) =>
    request<MutationResult>(`${root}/databases/${encodeURIComponent(database)}/routines`, {
      method: 'PUT',
      body: JSON.stringify({ statement, replace }),
    }),

  dropRoutine: (database: string, kind: string, name: string) =>
    request<MutationResult>(
      `${root}/databases/${encodeURIComponent(database)}/routines/${encodeURIComponent(kind)}/${encodeURIComponent(name)}`,
      { method: 'DELETE' },
    ),

  callRoutine: (database: string, name: string, args: unknown[] = []) =>
    request<QueryResult>(`${root}/databases/${encodeURIComponent(database)}/routines/call`, {
      method: 'POST',
      body: JSON.stringify({ name, arguments: args }),
    }),

  listTriggers: (database: string) =>
    request<TriggerInfo[]>(`${root}/databases/${encodeURIComponent(database)}/triggers`),

  // --- backup and restore ---
  backupDatabase: (database: string, options: Partial<BackupOptions> = {}) =>
    request<BackupResult>(`${root}/databases/${encodeURIComponent(database)}/backup`, {
      method: 'POST',
      body: JSON.stringify({
        include_schema: true,
        include_data: true,
        include_routines: true,
        include_views: true,
        drop_if_exists: true,
        max_rows_per_table: 100000,
        tables: [],
        ...options,
      }),
    }),

  restoreDatabase: (database: string, content: string, options: { stopOnError?: boolean } = {}) =>
    request<RestoreResult>(`${root}/databases/${encodeURIComponent(database)}/restore`, {
      method: 'POST',
      body: JSON.stringify({
        content,
        stop_on_error: options.stopOnError ?? true,
        // Always sent: the server refuses a restore whose confirmation does not
        // name the target, which is the guard against restoring into the wrong
        // database and destroying it.
        confirm_database: database,
      }),
    }),

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
