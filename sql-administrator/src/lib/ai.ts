/**
 * Client for the platform's AI gateway, `${apiBase()}/ai/...`.
 *
 * The contract is shared with the platform's other apps and with the course
 * pages (courses/engine/ai-khach.js), which is why it reads keys this app never
 * writes itself:
 *
 * * The caller is identified by headers built from localStorage, keyed by the
 *   absolute API root so a token is never sent to another server:
 *   `qlkh.phien@<root>.token` (the course administrator's session, a JSON
 *   string) becomes `X-Admin-Session`, and `ai.phien@<root>` (`{token, het}`,
 *   bought with the AI access code) becomes `X-AI-Session` until it expires.
 * * Answers are bare JSON, NOT the app's `{status_code, message, data}`
 *   envelope, so `request` in api.ts must not be used for them. Errors do use
 *   the envelope; its `data.code` becomes `AiError.code`, which is how the UI
 *   tells "type the access code" from "slow down" or "AI is off".
 */

import { apiBase } from './api'

export interface AiStatus {
  enabled: boolean
  access: 'admin' | 'code' | 'public'
  allowed: boolean
  /** What would let this caller in when it is not allowed yet. */
  needs: null | 'code' | 'admin'
  admin: boolean
  model: string
  limits: { perMinute: number; perDay: number }
}

export class AiError extends Error {
  /** The server's `data.code` (e.g. 'ai_code_required'), 'network', 'aborted', 'bad_response' or ''. */
  readonly code: string
  /** HTTP status; 0 when the server was never reached. */
  readonly status: number
  /** Seconds to wait, when the server said so (rate limit, daily budget). */
  readonly retryAfter: number | null

  constructor(message: string, code = '', status = 0, retryAfter: number | null = null) {
    super(message)
    this.name = 'AiError'
    this.code = code
    this.status = status
    this.retryAfter = retryAfter
  }
}

export interface AiRequestOptions {
  /** Extra headers, e.g. the app's own X-Session-Token. */
  headers?: Record<string, string>
  signal?: AbortSignal
}

function withoutTrailingSlashes(value: string): string {
  let end = value.length
  while (end > 0 && value[end - 1] === '/') end -= 1
  return value.slice(0, end)
}

/** The absolute API root, e.g. "https://host/api/v1": what the identity keys are scoped to. */
export function aiRoot(): string {
  try {
    return withoutTrailingSlashes(new URL(apiBase() || '/', window.location.href).href)
  } catch {
    return ''
  }
}

const adminSessionKey = (root: string) => `qlkh.phien@${root}.token`
const aiSessionKey = (root: string) => `ai.phien@${root}`

// Storage throws in private windows and when site data is blocked; AI then
// works without the remembered identities rather than not at all.
function readJson(key: string): unknown {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    if (value === null) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage unavailable: nothing to remember the token in */
  }
}

/** X-Admin-Session and X-AI-Session for this API root. An expired AI token is dropped. */
export function aiIdentityHeaders(): Record<string, string> {
  const root = aiRoot()
  const headers: Record<string, string> = {}

  const admin = readJson(adminSessionKey(root))
  if (typeof admin === 'string' && admin) headers['X-Admin-Session'] = admin

  const saved = readJson(aiSessionKey(root)) as { token?: unknown; het?: unknown } | null
  if (saved && typeof saved === 'object' && typeof saved.token === 'string' && saved.token) {
    // The server issues `het` in seconds; milliseconds are accepted too. 0 or missing: no expiry.
    const het = Number(saved.het) || 0
    if (!het || (het > 1e12 ? het : het * 1000) > Date.now()) headers['X-AI-Session'] = saved.token
    else writeJson(aiSessionKey(root), null)
  }
  return headers
}

function fallbackMessage(status: number): string {
  if (status === 504) return 'Máy chủ AI trả lời quá lâu — hãy thử lại'
  if (status === 502 || status === 503) return 'Máy chủ AI tạm thời không trả lời được — hãy thử lại'
  return `Yêu cầu AI thất bại (HTTP ${status})`
}

/** GET /ai/<path>, or POST when there is a body. `path` has no leading slash. */
async function send<T>(path: string, body: unknown, options: AiRequestOptions): Promise<T> {
  const { signal } = options
  const headers: Record<string, string> = { ...aiIdentityHeaders(), ...options.headers }
  const init: RequestInit = { headers, credentials: 'same-origin', signal }
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    init.method = 'POST'
    init.body = JSON.stringify(body)
  }

  let response: Response
  let text: string
  try {
    response = await fetch(`${apiBase()}/ai/${path}`, init)
    text = await response.text()
  } catch {
    // fetch rejects only when the server was not reached, or when the caller cancelled.
    if (signal?.aborted) throw new AiError('Đã huỷ yêu cầu', 'aborted', 0)
    throw new AiError('Không kết nối được máy chủ', 'network', 0)
  }

  let data: unknown = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = null
    }
  }

  if (!response.ok) {
    const envelope = (data && typeof data === 'object' ? data : {}) as {
      message?: unknown
      detail?: unknown
      data?: unknown
    }
    const extra = (envelope.data && typeof envelope.data === 'object' ? envelope.data : {}) as {
      code?: unknown
      retryAfter?: unknown
    }
    const message =
      (typeof envelope.message === 'string' && envelope.message) ||
      (typeof envelope.detail === 'string' && envelope.detail) ||
      fallbackMessage(response.status)
    throw new AiError(
      message,
      typeof extra.code === 'string' ? extra.code : '',
      response.status,
      typeof extra.retryAfter === 'number' ? extra.retryAfter : null,
    )
  }

  if (!data || typeof data !== 'object') {
    throw new AiError('Máy chủ AI trả lời không đúng định dạng', 'bad_response', response.status)
  }
  return data as T
}

let statusRequest: Promise<AiStatus> | null = null

/** GET /ai/status, asked once per page; `refresh` asks again (after unlocking, for instance). */
export function getStatus(refresh = false): Promise<AiStatus> {
  if (!statusRequest || refresh) {
    const request = send<AiStatus>('status', undefined, {})
    statusRequest = request
    // A failure is not remembered: the next caller asks again.
    request.catch(() => {
      if (statusRequest === request) statusRequest = null
    })
  }
  return statusRequest
}

/**
 * Whether to offer AI at all: it is on, and this caller may use it now or after
 * typing the access code. In admin-only mode a guest sees no AI button.
 */
export function canOffer(status: AiStatus | null | undefined): boolean {
  return Boolean(status?.enabled && (status.allowed || status.needs === 'code'))
}

/** POST /ai/session: trade the access code for a token, keep it for this API root, re-read the status. */
export async function unlockWithCode(code: string): Promise<AiStatus> {
  const issued = await send<{ ok?: boolean; session?: unknown; expiresAt?: unknown }>('session', { code }, {})
  if (typeof issued.session !== 'string' || !issued.session) {
    throw new AiError('Máy chủ không cấp phiên AI', 'bad_response', 200)
  }
  writeJson(aiSessionKey(aiRoot()), { token: issued.session, het: issued.expiresAt })
  return getStatus(true)
}

/** POST /ai/<path> as this caller; resolves to the bare JSON answer, rejects with AiError. */
export function aiPost<T>(path: string, body: unknown, options: AiRequestOptions = {}): Promise<T> {
  return send<T>(path, body, options)
}

export const __testing = {
  /** Forget the cached status, as a page reload would. */
  reset: () => {
    statusRequest = null
  },
}
