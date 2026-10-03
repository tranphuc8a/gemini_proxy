/**
 * The platform's AI gateway, spoken the same way by every app on it (and by
 * the course pages' `ai-khach.js`):
 *
 *   GET  ${apiBase()}/ai/status     what this caller may do — cached, refreshed on demand
 *   POST ${apiBase()}/ai/session    an access code → an AI token kept in localStorage
 *   POST ${apiBase()}/ai/<feature>  the features themselves
 *
 * The caller is identified by tokens that other pages of this origin keep in
 * localStorage, under keys named after the API root that issued them, so a
 * token is never sent to a different server:
 *
 *   qlkh.phien@<root>.token   the course administrator's session → X-Admin-Session
 *   ai.phien@<root>           {token, het} from the access code   → X-AI-Session
 *
 * Answers are bare JSON — not the {status_code, message, data} envelope that
 * `request<T>` in api.ts unwraps — while errors do use the envelope, with the
 * reason in `data.code`. Hence a fetch of its own.
 */

import { apiBase } from './api'

export type AiAccess = 'admin' | 'code' | 'public'

export interface AiStatus {
  enabled: boolean
  access: AiAccess
  allowed: boolean
  /** What would let this caller in: the access code, or an admin login. */
  needs: null | 'code' | 'admin'
  admin: boolean
  model: string
  limits: { perMinute: number; perDay: number }
}

export class AiError extends Error {
  /** The server's `data.code` (`ai_code_required`, `ai_rate_limited`…), `network`, `aborted`, or ''. */
  readonly code: string
  /** The HTTP status; 0 when no answer came back. */
  readonly status: number
  /** Seconds to wait, when the server says (429). */
  readonly retryAfter: number | null

  constructor(message: string, code = '', status = 0, retryAfter: number | null = null) {
    super(message)
    this.name = 'AiError'
    this.code = code
    this.status = status
    this.retryAfter = retryAfter
  }
}

/** The API root as an absolute URL without trailing slashes: what the token keys are named after. */
export function aiRoot(): string {
  try {
    return new URL(apiBase() || '/', window.location.href).href.replace(/\/+$/, '')
  } catch {
    return ''
  }
}

const adminKey = () => `qlkh.phien@${aiRoot()}.token`
const aiKey = () => `ai.phien@${aiRoot()}`

// localStorage throws in private windows and when site data is blocked.
function readJson(key: string): unknown {
  try {
    const raw = window.localStorage.getItem(key)
    return raw === null ? null : JSON.parse(raw)
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

/** Who is asking, from the tokens other pages left for this API root. An expired AI token is dropped. */
export function identityHeaders(): Record<string, string> {
  const headers: Record<string, string> = {}
  const admin = readJson(adminKey())
  if (typeof admin === 'string' && admin) headers['X-Admin-Session'] = admin

  const ai = readJson(aiKey()) as { token?: unknown; het?: unknown } | null
  if (ai && typeof ai === 'object' && typeof ai.token === 'string' && ai.token) {
    const het = Number(ai.het) || 0
    // `het` is seconds since the epoch; anything past 1e12 can only be milliseconds.
    if (!het || (het > 1e12 ? het : het * 1000) > Date.now()) headers['X-AI-Session'] = ai.token
    else writeJson(aiKey(), null)
  }
  return headers
}

interface CallOptions {
  body?: unknown
  headers?: Record<string, string>
  signal?: AbortSignal
}

async function call<T>(path: string, { body, headers, signal }: CallOptions = {}): Promise<T> {
  const init: RequestInit = {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...identityHeaders(),
      ...headers,
    },
    credentials: 'same-origin',
    signal,
  }
  if (body !== undefined) init.body = JSON.stringify(body)

  let response: Response
  let text: string
  try {
    response = await fetch(`${apiBase()}/ai/${path}`, init)
    text = await response.text()
  } catch {
    if (signal?.aborted) throw new AiError('Đã huỷ', 'aborted', 0)
    throw new AiError('Không kết nối được máy chủ', 'network', 0)
  }

  let data: any = undefined
  try {
    data = text ? JSON.parse(text) : undefined
  } catch {
    data = undefined
  }

  if (response.ok) {
    if (data === undefined || data === null) {
      throw new AiError('Máy chủ trả lời không đúng định dạng', 'bad_response', response.status)
    }
    return data as T
  }

  const envelope = data && typeof data === 'object' ? data : {}
  const detail = envelope.data && typeof envelope.data === 'object' ? envelope.data : {}
  const message =
    (typeof envelope.message === 'string' && envelope.message) ||
    // FastAPI's own errors (a 422) carry `detail` instead of the envelope.
    (typeof envelope.detail === 'string' && envelope.detail) ||
    `Máy chủ báo lỗi (HTTP ${response.status})`
  throw new AiError(
    message,
    typeof detail.code === 'string' ? detail.code : '',
    response.status,
    typeof detail.retryAfter === 'number' ? detail.retryAfter : null,
  )
}

/** POST a feature request: JSON body, identity headers, a bare JSON answer or an AiError. */
export function aiPost<T>(
  path: string,
  body: unknown,
  options: { headers?: Record<string, string>; signal?: AbortSignal } = {},
): Promise<T> {
  return call<T>(path, { ...options, body })
}

let statusPromise: Promise<AiStatus> | null = null

/** GET /ai/status, asked once and shared; `refresh` asks again (after an access code, say). */
export function getStatus(refresh = false): Promise<AiStatus> {
  if (!statusPromise || refresh) {
    const pending = call<AiStatus>('status')
    statusPromise = pending
    // A failed check is not remembered: the next caller asks again.
    pending.catch(() => {
      if (statusPromise === pending) statusPromise = null
    })
  }
  return statusPromise
}

/**
 * Should the page offer AI at all? Only when it is on, and this person may use
 * it or is one access code away. In admin-only mode a guest sees nothing.
 */
export function canOffer(status: AiStatus | null | undefined): boolean {
  return !!status && !!status.enabled && (!!status.allowed || status.needs === 'code')
}

/** Trade the access code for an AI token, keep it for this API root, and return the new status. */
export async function unlock(code: string): Promise<AiStatus> {
  const issued = await aiPost<{ ok?: boolean; session?: unknown; expiresAt?: unknown }>('session', { code })
  if (typeof issued.session !== 'string' || !issued.session) {
    throw new AiError('Máy chủ trả lời không đúng định dạng', 'bad_response', 200)
  }
  writeJson(aiKey(), { token: issued.session, het: issued.expiresAt })
  return getStatus(true)
}

export const __testing = {
  resetStatus: () => {
    statusPromise = null
  },
}
