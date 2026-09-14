/** Domain types shared by the store, the libs and the components. */

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'

export const HTTP_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']

/** One row of a key/value table. `enabled` is what the disable checkbox toggles. */
export interface KeyValue {
  id: string
  key: string
  value: string
  enabled: boolean
  description?: string
}

export type AuthType = 'none' | 'basic' | 'bearer' | 'apikey'

export interface AuthConfig {
  type: AuthType
  username?: string
  password?: string
  token?: string
  keyName?: string
  keyValue?: string
  location?: 'header' | 'query'
}

export type BodyMode = 'none' | 'json' | 'text' | 'xml' | 'form' | 'multipart'

/**
 * Pull a value out of a response and store it in an environment variable, so a
 * login request can feed the token to everything that follows.
 */
export interface ExtractRule {
  id: string
  enabled: boolean
  source: 'body' | 'header' | 'status'
  /** Dotted path for `body` (`data.token`, `items.0.id`), header name for `header`. */
  path: string
  /** Environment variable to write. */
  target: string
}

export interface RequestSpec {
  id: string
  name: string
  collectionId: string | null
  method: HttpMethod
  url: string
  params: KeyValue[]
  headers: KeyValue[]
  cookies: KeyValue[]
  auth: AuthConfig
  bodyMode: BodyMode
  /** Raw text for json/text/xml, and the source of truth for form/multipart keys. */
  body: string
  formFields: KeyValue[]
  /** JavaScript run against the response, Postman-style `pm.test(...)`. */
  tests: string
  extracts: ExtractRule[]
  createdAt?: string
  updatedAt?: string
}

export interface Collection {
  id: string
  name: string
  description?: string
  parentId: string | null
  createdAt?: string
  updatedAt?: string
}

export interface Environment {
  id: string
  name: string
  vars: KeyValue[]
}

export type SendMode = 'auto' | 'direct' | 'proxy'

export interface ResponseData {
  status: number
  statusText: string
  headers: [string, string][]
  bytes: Uint8Array
  contentType: string
  sizeBytes: number
  timeMs: number
  via: 'direct' | 'proxy'
  finalUrl: string
  redirected: boolean
  truncated: boolean
  /** False when the browser hid all but the CORS-safelisted response headers. */
  headersComplete: boolean
  fellBackFrom?: 'direct'
  fallbackReason?: string
  receivedAt: string
}

export interface RequestFailure {
  message: string
  kind: 'aborted' | 'timeout' | 'network' | 'proxy' | 'unknown'
  hint?: string
}

export interface TestResult {
  name: string
  passed: boolean
  error?: string
}

export interface RunnerRow {
  requestId: string
  name: string
  status: 'pending' | 'running' | 'done' | 'failed'
  httpStatus?: number
  timeMs?: number
  tests: TestResult[]
  error?: string
}

export interface Tab {
  id: string
  /** The saved request this tab edits, or null for a scratch tab. */
  requestId: string | null
  draft: RequestSpec
  response?: ResponseData
  failure?: RequestFailure
  testResults?: TestResult[]
  sending: boolean
  dirty: boolean
}

/** Where the server keeps a workspace. Each one is a separate store. */
export type StorageBackend = 'json' | 'mysql' | 'mongo'

export interface StorageBackendInfo {
  id: StorageBackend
  available: boolean
  reason?: string | null
}

export interface WorkspaceLink {
  id: string
  name: string
  accessKey: string
  revision: number
  shareToken?: string | null
  lastSyncedAt?: string
  /**
   * The backend this workspace lives in, fixed when it was created or connected.
   * Absent on links saved before the choice existed, which the server reads as
   * "whatever POSTMAN_STORAGE_BACKEND says" -- the behaviour those links had.
   */
  storageBackend?: StorageBackend
}

export interface ToastMessage {
  id: string
  kind: 'success' | 'info' | 'warn' | 'error'
  text: string
}

/** The backend's uniform response envelope. */
export interface ApiEnvelope<T> {
  status_code: number
  message: string
  data: T
}
