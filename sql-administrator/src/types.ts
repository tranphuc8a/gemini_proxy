/** Mirrors the value objects in backend/fastapi/src/domain/vo/sqladmin_vo.py. */

export interface ConnectRequest {
  host: string
  port: number
  username: string
  password: string
  database?: string | null
  label?: string | null
}

export interface SessionInfo {
  token: string
  host: string
  port: number
  username: string
  database: string | null
  label: string | null
  server_version: string | null
  server_flavor: string | null
  connected_at: string
  last_used_at: string
}

export interface DatabaseInfo {
  name: string
  charset: string | null
  collation: string | null
}

export interface TableInfo {
  name: string
  type: string
  engine: string | null
  rows: number | null
  data_length: number | null
  collation: string | null
  comment: string | null
}

export interface ColumnInfo {
  name: string
  data_type: string
  column_type: string
  nullable: boolean
  key: string | null
  default: unknown
  extra: string | null
  comment: string | null
  position: number
}

export interface IndexInfo {
  name: string
  unique: boolean
  columns: string[]
  index_type: string | null
}

export interface ForeignKeyInfo {
  name: string
  column: string
  referenced_table: string
  referenced_column: string
  referenced_schema: string | null
}

export interface TableStructure {
  database: string
  table: string
  columns: ColumnInfo[]
  indexes: IndexInfo[]
  foreign_keys: ForeignKeyInfo[]
  primary_key: string[]
  ddl: string | null
}

export type CellValue = string | number | boolean | null | { __binary__: string; size: number }

export interface QueryResult {
  statement: string
  kind: 'read' | 'write'
  columns: string[]
  column_types: string[]
  rows: CellValue[][]
  row_count: number
  affected_rows: number
  last_insert_id: number | null
  duration_ms: number
  truncated: boolean
  error: string | null
}

export interface BrowsePage {
  database: string
  table: string
  columns: ColumnInfo[]
  primary_key: string[]
  rows: Record<string, CellValue>[]
  total: number
  limit: number
  offset: number
  duration_ms: number
}

export interface MutationResult {
  affected_rows: number
  last_insert_id: number | null
  statement: string | null
  duration_ms: number
}

export interface ServerOverview {
  version: string | null
  flavor: string | null
  uptime_seconds: number | null
  current_user: string | null
  charset: string | null
  status: Record<string, string>
  variables: Record<string, string>
}

export interface ProcessInfo {
  id: number
  user: string | null
  host: string | null
  db: string | null
  command: string | null
  time: number | null
  state: string | null
  info: string | null
}

/** Unified envelope returned by every controller in the FastAPI backend. */
export interface ApiEnvelope<T> {
  status_code: number
  message: string
  data: T
}

export type BrowseSort = { column: string; direction: 'asc' | 'desc' } | null

export interface QueryHistoryEntry {
  id: string
  sql: string
  database: string | null
  ranAt: string
  ok: boolean
  durationMs: number
}

export type ViewName = 'browse' | 'structure' | 'objects' | 'backup' | 'console' | 'server'

// ---------------------------------------------------------------------------
// Schema editing
//
// Mirrors the backend's request models. Types are free-form strings on purpose:
// MySQL has too many to enumerate and the list grows, so the server validates
// the *shape* of a type rather than checking it against a list.
// ---------------------------------------------------------------------------
export interface ColumnDefinition {
  name: string
  data_type: string
  nullable: boolean
  default?: string | null
  extra?: string | null
  comment?: string | null
  /** Place after this column; '' means FIRST, undefined means "leave it". */
  after?: string | null
}

export interface CreateTablePayload {
  name: string
  columns: ColumnDefinition[]
  primary_key: string[]
  engine?: string | null
  charset?: string | null
  comment?: string | null
}

export interface ForeignKeyPayload {
  name: string
  columns: string[]
  referenced_table: string
  referenced_columns: string[]
  referenced_schema?: string | null
  on_delete?: string | null
  on_update?: string | null
}

export interface ViewInfo {
  name: string
  updatable: boolean
  definer?: string | null
  security?: string | null
  definition?: string | null
}

export interface RoutineInfo {
  name: string
  kind: 'FUNCTION' | 'PROCEDURE'
  returns?: string | null
  parameters?: string | null
  language?: string | null
  deterministic: boolean
  security?: string | null
  comment?: string | null
  created?: string | null
  modified?: string | null
  definition?: string | null
}

export interface TriggerInfo {
  name: string
  table: string
  timing: string
  event: string
  statement?: string | null
}

export interface BackupOptions {
  include_schema: boolean
  include_data: boolean
  include_routines: boolean
  include_views: boolean
  drop_if_exists: boolean
  max_rows_per_table: number
  tables: string[]
}

export interface BackupResult {
  database: string
  filename: string
  media_type: string
  content: string
  tables: number
  rows: number
  routines: number
  views: number
  bytes: number
  generated_at: string
  /** Tables whose rows were cut short by `max_rows_per_table`. */
  truncated_tables: string[]
}

export interface RestoreResult {
  database: string
  statements: number
  executed: number
  failed: number
  affected_rows: number
  duration_ms: number
  errors: string[]
}
