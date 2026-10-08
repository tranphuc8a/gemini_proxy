/**
 * The platform's AI gateway, `${base}/ai/...`, as every app on it calls it.
 *
 * One contract for all of them (the course pages' `ai-khach.js` is the
 * reference), so a person who unlocked AI in one place is recognised in another:
 *
 *   - Identity travels in headers read from localStorage, under keys that name
 *     the absolute API root. A token stored for one API is never sent to another.
 *       `qlkh.phien@<root>.token` -> X-Admin-Session (a course administrator)
 *       `ai.phien@<root>`         -> X-AI-Session    (a token for the access code)
 *   - Successes are bare JSON. Errors use the common envelope
 *     `{status_code, message, data: {code, retryAfter?}}` and become an AiError.
 *   - `canOffer()` decides whether AI is shown at all: in admin-only mode a guest
 *     sees nothing; in code mode they get a field for the access code.
 */

import { ensureApiBase } from './api'

export type AiAccess = 'admin' | 'code' | 'public'

export interface AiStatus {
  enabled: boolean
  access: AiAccess
  allowed: boolean
  /** What would let this caller in, when `allowed` is false. */
  needs: null | 'code' | 'admin'
  admin: boolean
  model: string
  limits: { perMinute: number; perDay: number }
}

export class AiError extends Error {
  /** The server's `data.code` (`ai_rate_limited`, …), `network`, or ''. */
  readonly code: string
  /** HTTP status; 0 when the server was never reached. */
  readonly status: number
  /** Seconds to wait, when the server said so (429). */
  readonly retryAfter?: number

  constructor(message: string, code = '', status = 0, retryAfter?: number) {
    super(message)
    this.name = 'AiError'
    this.code = code
    this.status = status
    this.retryAfter = retryAfter
  }
}

export const AI_NETWORK_MESSAGE = 'Không kết nối được máy chủ'

/** Show AI at all? On, and this person may use it or only lacks the access code. */
export function canOffer(status: AiStatus | null | undefined): boolean {
  return Boolean(status && status.enabled && (status.allowed || status.needs === 'code'))
}

// ---------------------------------------------------------------- identity
function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key)
    return raw == null ? null : JSON.parse(raw)
  } catch {
    return null
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    if (value == null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* private mode or full storage: the token is simply not remembered */
  }
}

/** The absolute API root tokens are stored under, e.g. "https://host/api/v1". */
export function aiRoot(base: string): string {
  try {
    return new URL(base || '/', location.href).href.replace(/\/+$/, '')
  } catch {
    return ''
  }
}

export const adminSessionKey = (root: string) => `qlkh.phien@${root}.token`
export const aiSessionKey = (root: string) => `ai.phien@${root}`

/**
 * Who is asking, as headers. An expired AI token is dropped from storage here
 * rather than sent: the server would only refuse it.
 */
export function aiIdentityHeaders(base: string): Record<string, string> {
  const root = aiRoot(base)
  const headers: Record<string, string> = {}

  const admin = readJson(adminSessionKey(root))
  if (typeof admin === 'string' && admin) headers['X-Admin-Session'] = admin

  const key = aiSessionKey(root)
  const session = readJson(key) as { token?: unknown; het?: unknown } | null
  if (session && typeof session === 'object' && typeof session.token === 'string' && session.token) {
    const het = Number(session.het) || 0
    // `het` is seconds from the server, but milliseconds are accepted too.
    if (!het || (het > 1e12 ? het : het * 1000) > Date.now()) headers['X-AI-Session'] = session.token
    else writeJson(key, null)
  }
  // The Gemini model picked on another page of this server (course tutor, course admin…), shared by key.
  const model = readJson(`ai.model@${root}`)
  if (typeof model === 'string' && /^[a-z0-9][a-z0-9.-]{1,62}$/.test(model)) headers['X-AI-Model'] = model
  return headers
}

// ------------------------------------------------------------------ calls
function errorFrom(res: Response, body: any): AiError {
  const message =
    (typeof body?.message === 'string' && body.message) ||
    (typeof body?.detail === 'string' && body.detail) ||
    `HTTP ${res.status}`
  const data = body && typeof body.data === 'object' && body.data !== null ? body.data : {}
  const retryAfter = Number(data.retryAfter) || Number(res.headers?.get?.('Retry-After')) || undefined
  return new AiError(message, typeof data.code === 'string' ? data.code : '', res.status, retryAfter)
}

export interface AiClient {
  /** GET /ai/status, asked once; `refresh` asks again (after unlocking, say). */
  status(refresh?: boolean): Promise<AiStatus>
  /** POST /ai/<path> with a JSON body; resolves to the bare JSON answer. */
  post<T>(path: string, body: unknown): Promise<T>
  /** POST /ai/session {code}: keep the token it returns, then refresh the status. */
  unlock(code: string): Promise<AiStatus>
}

/** A client bound to one way of finding the API base (tests pass a fixed one). */
export function createAiClient(resolveBase: () => Promise<string> | string): AiClient {
  let statusPromise: Promise<AiStatus> | null = null

  async function call<T>(path: string, body?: unknown): Promise<T> {
    const base = await resolveBase()
    const init: RequestInit = { credentials: 'same-origin', headers: aiIdentityHeaders(base) }
    if (body !== undefined) {
      init.method = 'POST'
      init.headers = { 'Content-Type': 'application/json', ...(init.headers as Record<string, string>) }
      init.body = JSON.stringify(body)
    }

    let res: Response
    try {
      res = await fetch(`${base}/ai/${path}`, init)
    } catch {
      throw new AiError(AI_NETWORK_MESSAGE, 'network', 0)
    }

    let data: unknown
    try {
      data = await res.json()
    } catch {
      data = undefined
    }
    if (!res.ok) throw errorFrom(res, data)
    if (data === undefined) {
      throw new AiError(`Máy chủ trả về dữ liệu không hợp lệ (HTTP ${res.status})`, 'invalid_response', res.status)
    }
    return data as T
  }

  const client: AiClient = {
    status(refresh = false) {
      if (!statusPromise || refresh) {
        const pending = call<AiStatus>('status')
        statusPromise = pending
        // A failure is not remembered: the next caller asks again.
        pending.catch(() => {
          if (statusPromise === pending) statusPromise = null
        })
      }
      return statusPromise
    },

    post<T>(path: string, body: unknown) {
      return call<T>(path, body ?? {})
    },

    async unlock(code: string) {
      const base = await resolveBase()
      const issued = await call<{ ok?: boolean; session?: unknown; expiresAt?: unknown }>('session', { code })
      if (typeof issued?.session !== 'string' || !issued.session) {
        throw new AiError('Máy chủ không cấp phiên AI', 'invalid_response', 200)
      }
      writeJson(aiSessionKey(aiRoot(base)), { token: issued.session, het: Number(issued.expiresAt) || 0 })
      return client.status(true)
    },
  }
  return client
}

// The app's client: the same API base every other call of this app resolved.
let appClient = createAiClient(ensureApiBase)

export const getStatus = (refresh = false): Promise<AiStatus> => appClient.status(refresh)
export const aiPost = <T>(path: string, body: unknown): Promise<T> => appClient.post<T>(path, body)
export const unlockWithCode = (code: string): Promise<AiStatus> => appClient.unlock(code)

/** Forget the cached status (tests). */
export function resetAiForTests(): void {
  appClient = createAiClient(ensureApiBase)
}
