/**
 * The wire contract with the FastAPI bridge.
 *
 * Field names are snake_case because they come straight from the backend's
 * pydantic models; renaming them in the client would only add a mapping layer
 * that has to be kept in step with the server.
 */

export interface ApiEnvelope<T> {
  status_code: number
  message: string
  data: T
}

/** Any value that has been through the server's Extended JSON encoder. */
export type Ejson = unknown
export type EjsonDocument = Record<string, Ejson>

export interface ConnectRequest {
  uri?: string | null
  host?: string
  port?: number
  username?: string | null
  password?: string
  database?: string | null
  auth_source?: string | null
  auth_mechanism?: string | null
  replica_set?: string | null
  tls?: boolean
  srv?: boolean
  direct_connection?: boolean
  label?: string | null
}

export interface SessionInfo {
  token: string
  host: string
  port: number | null
  username: string | null
  database: string | null
  auth_source: string | null
  tls: boolean
  srv: boolean
  label: string | null
  server_version: string | null
  server_flavor: string | null
  topology: string | null
  connected_at: string
  last_used_at: string
}

export interface DatabaseInfo {
  name: string
  size_on_disk: number | null
  empty: boolean
  collections: number | null
}

export interface CollectionInfo {
  name: string
  type: string
  count: number | null
  size: number | null
  storage_size: number | null
  avg_obj_size: number | null
  index_count: number | null
  capped: boolean
  view_on: string | null
}

export interface IndexInfo {
  name: string
  keys: [string, Ejson][]
  unique: boolean
  sparse: boolean
  ttl_seconds: number | null
  partial_filter: EjsonDocument | null
  size: number | null
}

export interface DocumentPage {
  database: string
  collection: string
  documents: EjsonDocument[]
  fields: string[]
  total: number
  skip: number
  limit: number
  duration_ms: number
  truncated: boolean
}

export interface FindRequest {
  filter?: unknown
  projection?: unknown
  sort?: unknown
  skip?: number
  limit?: number
  with_count?: boolean
}

export interface MutationResult {
  acknowledged: boolean
  matched: number
  modified: number
  inserted: number
  deleted: number
  upserted_id: Ejson
  inserted_ids: Ejson[]
  duration_ms: number
  detail: string | null
}

export interface CommandResult {
  kind: 'command' | 'aggregate'
  database: string | null
  result: Ejson
  documents: EjsonDocument[]
  row_count: number
  duration_ms: number
  truncated: boolean
}

export interface StatsResult {
  database: string
  collection: string | null
  stats: Record<string, Ejson>
}

export interface ServerOverview {
  version: string | null
  flavor: string | null
  topology: string | null
  host: string | null
  uptime_seconds: number | null
  current_user: string | null
  connections: Record<string, Ejson>
  opcounters: Record<string, Ejson>
  memory: Record<string, Ejson>
  storage_engine: string | null
  build: Record<string, Ejson>
}

export interface OperationInfo {
  opid: Ejson
  op: string | null
  ns: string | null
  secs_running: number | null
  client: string | null
  description: string | null
  active: boolean
  command: Ejson
}

export interface CreateIndexRequest {
  keys: unknown
  name?: string | null
  unique?: boolean
  sparse?: boolean
  ttl_seconds?: number | null
  partial_filter?: unknown
}

// --- client-side only -------------------------------------------------------
export type Tab = 'documents' | 'indexes' | 'aggregate' | 'stats' | 'server'
export type ViewMode = 'table' | 'json'
export type Theme = 'light' | 'dark'

export interface Toast {
  id: number
  kind: 'info' | 'success' | 'error'
  message: string
}

export interface QueryHistoryEntry {
  id: string
  /** The filter or pipeline as the user typed it. */
  text: string
  kind: 'find' | 'aggregate'
  namespace: string
  at: string
}
