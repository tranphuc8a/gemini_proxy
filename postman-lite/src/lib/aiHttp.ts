/**
 * AI for one exchange: explain a response, or draft `pm.*` tests for it
 * (POST /ai/http).
 *
 * What leaves the browser is cut to size and has its credential headers masked
 * first. The server masks again - query strings, JSON fields, JWTs - and checks
 * a generated script against the test sandbox, but a header value that is never
 * sent cannot leak from anywhere further down the line.
 */

import type { RequestSpec, ResponseData } from '../types'
import { AiError, aiPost } from './ai'
import { prepare } from './sender'
import { cutText, decodeBytes, isSecretName, isTextualContentType, kvToObject } from './util'

export type HttpAiAction = 'explain' | 'tests'

export const MASKED = '[đã ẩn]'
/** How much of each body the AI is shown. */
export const REQUEST_BODY_CHARS = 20_000
export const RESPONSE_BODY_CHARS = 100_000

// What the endpoint validates (ai_controller.HttpAsk); exceeding it is a 422.
const URL_CHARS = 8000
const HEADER_CHARS = 8000
const HEADERS_MAX = 200
const SHORT_CHARS = 200
// Enough bytes for RESPONSE_BODY_CHARS characters in any encoding, so a 50 MB
// body is not decoded in full only to keep its first page.
const RESPONSE_BYTES = RESPONSE_BODY_CHARS * 4

export interface HttpAiPayload {
  action: HttpAiAction
  request: { method: string; url: string; headers: [string, string][]; body: string }
  response: {
    status: number
    statusText: string
    headers: [string, string][]
    contentType: string
    timeMs: number
    sizeBytes: number
    body: string
  }
}

export interface HttpExplanation {
  summary: string
  details: string[]
  problems: string[]
  next: string[]
  cached: boolean
}

export interface HttpTests {
  script: string
  notes: string
  cached: boolean
}

/** Credential-looking headers keep their name and lose their value. */
export function maskHeaders(headers: [string, string][]): [string, string][] {
  return headers.slice(0, HEADERS_MAX).map(([name, value]) => {
    const key = cutText(String(name), HEADER_CHARS)
    return [key, isSecretName(key) ? MASKED : cutText(String(value ?? ''), HEADER_CHARS)]
  })
}

function requestBody(spec: RequestSpec): string {
  // prepare() sends no body for these either.
  if (spec.method === 'GET' || spec.method === 'HEAD' || spec.bodyMode === 'none') return ''
  const fields = kvToObject(spec.formFields)
  if (spec.bodyMode === 'form') return new URLSearchParams(fields).toString()
  if (spec.bodyMode === 'multipart') {
    return Object.entries(fields)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n')
  }
  return spec.body ?? ''
}

function responseBody(response: ResponseData, notes: string[]): string {
  if (!isTextualContentType(response.contentType)) {
    notes.push('Body là dữ liệu nhị phân nên không được gửi cho AI — AI chỉ thấy status và header.')
    return ''
  }
  const bytes = response.bytes.length > RESPONSE_BYTES ? response.bytes.subarray(0, RESPONSE_BYTES) : response.bytes
  const text = decodeBytes(bytes, response.contentType)
  if (bytes !== response.bytes || text.length > RESPONSE_BODY_CHARS) {
    notes.push(`Body dài: AI chỉ đọc ${RESPONSE_BODY_CHARS.toLocaleString('vi-VN')} ký tự đầu.`)
  }
  return cutText(text, RESPONSE_BODY_CHARS)
}

/**
 * The exchange as the endpoint takes it.
 *
 * `spec` should be the request as sent - environment variables already
 * substituted - so the AI reads the real URL rather than `{{BASE_URL}}`; the
 * headers come from prepare(), so auth and cookies appear (masked) exactly as
 * they went out. `notes` says what the AI was not shown.
 */
export async function buildHttpAiPayload(
  action: HttpAiAction,
  spec: RequestSpec,
  response: ResponseData,
): Promise<{ payload: HttpAiPayload; notes: string[] }> {
  const notes: string[] = []
  const prepared = await prepare(spec)

  let body = requestBody(spec)
  if (body.length > REQUEST_BODY_CHARS) {
    notes.push(`Body của request dài: AI chỉ đọc ${REQUEST_BODY_CHARS.toLocaleString('vi-VN')} ký tự đầu.`)
    body = cutText(body, REQUEST_BODY_CHARS)
  }

  const payload: HttpAiPayload = {
    action,
    request: {
      method: spec.method,
      url: cutText(prepared.url || response.finalUrl || '/', URL_CHARS),
      headers: maskHeaders(Object.entries(prepared.headers)),
      body,
    },
    response: {
      status: Math.min(999, Math.max(0, Math.round(Number(response.status) || 0))),
      statusText: cutText(response.statusText ?? '', SHORT_CHARS),
      headers: maskHeaders(response.headers),
      contentType: cutText(response.contentType ?? '', SHORT_CHARS),
      timeMs: Math.max(0, Number(response.timeMs) || 0),
      sizeBytes: Math.max(0, Math.round(Number(response.sizeBytes) || 0)),
      body: responseBody(response, notes),
    },
  }
  return { payload, notes }
}

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim() !== '') : []

export async function explainHttp(payload: HttpAiPayload): Promise<HttpExplanation> {
  const raw = await aiPost<any>('http', { ...payload, action: 'explain' })
  const summary = typeof raw?.summary === 'string' ? raw.summary.trim() : ''
  if (!summary) throw new AiError('AI trả lời sai định dạng — thử lại', 'invalid_response', 200)
  return {
    summary,
    details: strings(raw.details),
    problems: strings(raw.problems),
    next: strings(raw.next),
    cached: Boolean(raw.cached),
  }
}

export async function testsForHttp(payload: HttpAiPayload): Promise<HttpTests> {
  const raw = await aiPost<any>('http', { ...payload, action: 'tests' })
  const script = typeof raw?.script === 'string' ? raw.script.trim() : ''
  if (!script) throw new AiError('AI không trả về test script — thử lại', 'invalid_response', 200)
  return { script, notes: typeof raw.notes === 'string' ? raw.notes.trim() : '', cached: Boolean(raw.cached) }
}

/** `addition` after what is already there, separated by one blank line. */
export function appendScript(existing: string, addition: string): string {
  const head = existing.replace(/\s+$/, '')
  const tail = addition.trim()
  return head ? `${head}\n\n${tail}` : tail
}
