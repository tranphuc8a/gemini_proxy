/**
 * Client for the platform's AI gateway, `${apiBase}/ai/...`.
 *
 * Same contract as the other apps on this server and the course pages
 * (courses/engine/ai-khach.js), so a person who unlocked AI or signed in as
 * course administrator on one page is recognised here:
 *
 * * Who is asking comes from localStorage, filed under the absolute API root so a
 *   token never goes to another server: `qlkh.phien@<root>.token` (the course
 *   administrator's session) → `X-Admin-Session`, `ai.phien@<root>` (`{token, het}`,
 *   bought with the AI access code) → `X-AI-Session`, `ai.model@<root>` (the Gemini
 *   model picked on any page) → `X-AI-Model`.
 * * Answers are bare JSON; errors use the envelope `{message, data: {code, retryAfter?}}`,
 *   and `data.code` becomes `AiError.code` — how the UI tells "type the access code"
 *   from "slow down" or "AI is off".
 *
 * This is NOT the app's own admin session (`markdown-editor:admin-session`): that
 * token is signed for the markdown store only.
 */

import { resolveApiBase } from './runtimeConfig'

export interface AiStatus {
  enabled: boolean
  access: 'admin' | 'code' | 'public'
  allowed: boolean
  /** What would let this caller in when it is not allowed yet. */
  needs: null | 'code' | 'admin'
  admin: boolean
  model: string
}

export interface AiModel {
  id: string
  label: string
  tier: string
  preview: boolean
  alias: boolean
  adminOnly: boolean
  default: boolean
  /** Whether THIS caller may pick it (Pro models are for administrators). */
  allowed: boolean
}

export interface AiModels {
  default: string
  /** "api" (Gemini's own list), "config" (AI_MODELS) or "fallback". */
  source: string
  admin: boolean
  models: AiModel[]
}

export type FormatMode = 'smart' | 'tidy' | 'summary'

export interface FormatResult {
  markdown: string
  /** Short notes on what changed (Vietnamese, from the server). */
  changes: string[]
  words: number
  sourceWords: number
  /** The answer has far fewer words than the source: something may have been dropped. */
  shrunk: boolean
  /** The model ran out of room: the markdown may end early. */
  truncated: boolean
  mode: FormatMode
}

export class AiError extends Error {
  /** The server's `data.code` (e.g. 'ai_code_required'), 'network', 'aborted', 'bad_response' or ''. */
  readonly code: string
  readonly status: number
  /** Seconds to wait, when the server said so. */
  readonly retryAfter: number | null

  constructor(message: string, code = '', status = 0, retryAfter: number | null = null) {
    super(message)
    this.name = 'AiError'
    this.code = code
    this.status = status
    this.retryAfter = retryAfter
  }
}

/** Longest text POST /ai/markdown accepts — keep equal to TEXT_CHARS in ai_markdown_usecase.py. */
export const FORMAT_MAX_CHARS = 20_000
const MODEL_ID = /^[a-z0-9][a-z0-9.-]{1,62}$/

/** The absolute API root the identity keys are filed under, e.g. "https://host/api/v1". */
export function aiRoot(): string {
  try {
    return new URL(resolveApiBase() || '/', window.location.href).href.replace(/\/+$/, '')
  } catch {
    return ''
  }
}

const adminKey = (root: string) => `qlkh.phien@${root}.token`
const sessionKey = (root: string) => `ai.phien@${root}`
const modelKey = (root: string) => `ai.model@${root}`

// Storage throws in private windows and when site data is blocked; AI then works
// without the remembered identities rather than not at all.
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
    /* nothing to remember the value in */
  }
}

/** The model this browser picked for the server ('' = the server's default). */
export function chosenModel(): string {
  const stored = readJson(modelKey(aiRoot()))
  return typeof stored === 'string' && MODEL_ID.test(stored) ? stored : ''
}

export function chooseModel(id: string): void {
  writeJson(modelKey(aiRoot()), id && MODEL_ID.test(id) ? id : null)
}

/** X-Admin-Session, X-AI-Session and X-AI-Model for this API root. An expired AI token is dropped. */
export function identityHeaders(): Record<string, string> {
  const root = aiRoot()
  const headers: Record<string, string> = {}

  const admin = readJson(adminKey(root))
  if (typeof admin === 'string' && admin) headers['X-Admin-Session'] = admin

  const saved = readJson(sessionKey(root)) as { token?: unknown; het?: unknown } | null
  if (saved && typeof saved === 'object' && typeof saved.token === 'string' && saved.token) {
    // The server issues `het` in seconds; milliseconds are accepted too. 0 or missing: no expiry.
    const het = Number(saved.het) || 0
    if (!het || (het > 1e12 ? het : het * 1000) > Date.now()) headers['X-AI-Session'] = saved.token
    else writeJson(sessionKey(root), null)
  }

  const model = chosenModel()
  if (model) headers['X-AI-Model'] = model
  return headers
}

function fallbackMessage(status: number): string {
  if (status === 504) return 'The AI server took too long — try again.'
  if (status === 502 || status === 503) return 'The AI server is not answering right now — try again.'
  if (status === 422) return 'The server rejected the request (the text may be too long).'
  return `The AI request failed (HTTP ${status}).`
}

async function send<T>(path: string, body: unknown, signal?: AbortSignal, retried = false): Promise<T> {
  const headers: Record<string, string> = identityHeaders()
  const init: RequestInit = { headers, credentials: 'same-origin', signal }
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    init.method = 'POST'
    init.body = JSON.stringify(body)
  }

  let response: Response
  let text: string
  try {
    response = await fetch(`${resolveApiBase()}/ai/${path}`, init)
    text = await response.text()
  } catch {
    if (signal?.aborted) throw new AiError('Cancelled', 'aborted', 0)
    throw new AiError('Could not reach the server.', 'network', 0)
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
    const envelope = (data && typeof data === 'object' ? data : {}) as { message?: unknown; detail?: unknown; data?: unknown }
    const extra = (envelope.data && typeof envelope.data === 'object' ? envelope.data : {}) as { code?: unknown; retryAfter?: unknown }
    const code = typeof extra.code === 'string' ? extra.code : ''
    // The model picked on another page is gone or not allowed: forget it and ask once with the default.
    if (!retried && /^ai_model_(unknown|admin_only|invalid)$/.test(code) && chosenModel()) {
      chooseModel('')
      return send<T>(path, body, signal, true)
    }
    const message =
      (typeof envelope.message === 'string' && envelope.message) ||
      (typeof envelope.detail === 'string' && envelope.detail) ||
      fallbackMessage(response.status)
    throw new AiError(message, code, response.status, typeof extra.retryAfter === 'number' ? extra.retryAfter : null)
  }

  if (!data || typeof data !== 'object') throw new AiError('The AI server answered in an unexpected format.', 'bad_response', response.status)
  return data as T
}

let statusRequest: Promise<AiStatus> | null = null
let modelsRequest: Promise<AiModels> | null = null

/** GET /ai/status, asked once per page; `refresh` asks again (after unlocking). A failure is not remembered. */
export function getStatus(refresh = false): Promise<AiStatus> {
  if (!statusRequest || refresh) {
    const request = send<AiStatus>('status', undefined)
    statusRequest = request
    request.catch(() => {
      if (statusRequest === request) statusRequest = null
    })
  }
  return statusRequest
}

/** GET /ai/models: the models this caller may pick, newest first. */
export function listModels(refresh = false): Promise<AiModels> {
  if (!modelsRequest || refresh) {
    const request = send<AiModels>('models', undefined).then((answer) => {
      if (!Array.isArray(answer.models)) throw new AiError('The AI server answered in an unexpected format.', 'bad_response', 200)
      return answer
    })
    modelsRequest = request
    request.catch(() => {
      if (modelsRequest === request) modelsRequest = null
    })
  }
  return modelsRequest
}

/** Whether to offer AI at all: it is on, and this caller may use it now or after typing the access code. */
export function canOffer(status: AiStatus | null | undefined): boolean {
  return Boolean(status?.enabled && (status.allowed || status.needs === 'code'))
}

/** POST /ai/session: trade the access code for a token kept for this API root, then re-read the status. */
export async function unlockWithCode(code: string): Promise<AiStatus> {
  const issued = await send<{ session?: unknown; expiresAt?: unknown }>('session', { code })
  if (typeof issued.session !== 'string' || !issued.session) {
    throw new AiError('The server did not issue an AI session.', 'bad_response', 200)
  }
  writeJson(sessionKey(aiRoot()), { token: issued.session, het: issued.expiresAt })
  return getStatus(true)
}

/** POST /ai/markdown: raw text → readable markdown. Nothing is stored server-side. */
export function formatMarkdown(text: string, mode: FormatMode, hint: string, signal?: AbortSignal): Promise<FormatResult> {
  return send<FormatResult>('markdown', { text, mode, hint }, signal).then((answer) => {
    if (typeof answer.markdown !== 'string' || !answer.markdown) {
      throw new AiError('The AI returned no markdown.', 'bad_response', 200)
    }
    return {
      markdown: answer.markdown,
      changes: Array.isArray(answer.changes) ? answer.changes.map(String) : [],
      words: Number(answer.words) || 0,
      sourceWords: Number(answer.sourceWords) || 0,
      shrunk: Boolean(answer.shrunk),
      truncated: Boolean(answer.truncated),
      mode: answer.mode ?? mode
    }
  })
}

export const __testing = {
  /** Forget cached answers, as a page reload would. */
  reset: () => {
    statusRequest = null
    modelsRequest = null
  }
}
