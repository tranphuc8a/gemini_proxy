import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ShareError, createShare, listShares, readShared, revokeShare } from './shareClient'
import { setAdminSession } from './markdownStorage'

type Call = { url: string; init: RequestInit }

function respond(status: number, body: unknown, headers: Record<string, string> = {}) {
  const calls: Call[] = []
  const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init })
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } })
  })
  vi.stubGlobal('fetch', fetchMock)
  return calls
}

const SUMMARY = {
  token: 'AbCdEfGhIjKlMnOpQrStUv',
  docId: 'file-1',
  title: 'Notes',
  mode: 'snapshot',
  sharedAt: 1,
  updatedAt: 1,
  expiresAt: null,
  bytes: 3,
  contentHash: 'h'
}

beforeEach(() => {
  window.__WEBAPP_CONFIG__ = { apiBase: '/api/v1' }
  setAdminSession('admin.session.token')
})

afterEach(() => {
  vi.unstubAllGlobals()
  delete window.__WEBAPP_CONFIG__
  setAdminSession(null)
})

describe('owner calls', () => {
  it('createShare posts the snapshot with the admin session and the store', async () => {
    const calls = respond(201, SUMMARY)
    const out = await createShare({ docId: 'file-1', title: 'Notes', content: 'abc', expiresInDays: 7 }, 'mysql')
    expect(out).toEqual({ created: true, share: SUMMARY })
    expect(calls[0].url).toBe('/api/v1/markdown/shares?backend=mysql')
    expect(calls[0].init.method).toBe('POST')
    expect((calls[0].init.headers as Record<string, string>)['X-Admin-Session']).toBe('admin.session.token')
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ docId: 'file-1', title: 'Notes', content: 'abc', expiresInDays: 7, mode: 'snapshot' })
  })

  it('a refresh answers 200: created is false', async () => {
    respond(200, SUMMARY)
    expect((await createShare({ docId: 'file-1', title: 'Notes', content: 'abc', expiresInDays: null }, 'json')).created).toBe(false)
  })

  it('listShares and revokeShare carry the admin session; the doc id is URL-encoded', async () => {
    let calls = respond(200, { shares: [SUMMARY], limits: { maxShares: 50, maxBytes: 2_000_000 }, persistent: true })
    expect((await listShares('json')).shares).toHaveLength(1)
    expect(calls[0].url).toBe('/api/v1/markdown/shares?backend=json')
    expect((calls[0].init.headers as Record<string, string>)['X-Admin-Session']).toBe('admin.session.token')
    calls = respond(200, { revoked: true })
    await revokeShare('file:a.b', 'json')
    expect(calls[0].url).toBe('/api/v1/markdown/shares?backend=json&docId=file%3Aa.b')
    expect(calls[0].init.method).toBe('DELETE')
  })

  it('turns the error envelope into a ShareError with its code', async () => {
    respond(400, { status_code: 400, message: 'Tài liệu quá lớn', data: { code: 'markdown_share_too_large', limit: 10, bytes: 11 } })
    const error = await createShare({ docId: 'd', title: 't', content: 'x', expiresInDays: null }, 'json').catch((e) => e)
    expect(error).toBeInstanceOf(ShareError)
    expect(error.code).toBe('markdown_share_too_large')
    expect(error.status).toBe(400)
  })

  it('409 markdown_share_conflict (ids that differ only in case) explains itself', async () => {
    respond(409, { message: 'Một tài liệu khác…', data: { code: 'markdown_share_conflict' } })
    const error = await createShare({ docId: 'Doc-A', title: 't', content: 'x', expiresInDays: null }, 'mysql').catch((e) => e)
    expect(error.code).toBe('markdown_share_conflict')
    expect(error.status).toBe(409)
    expect(error.message).toMatch(/differs only in letter case/)
  })

  it('falls back to the server message for an unknown code', async () => {
    respond(400, { message: 'Lỗi lạ', data: { code: 'something_new' } })
    const error = await listShares('json').catch((e) => e)
    expect(error.message).toBe('Lỗi lạ')
  })
})

describe('the public read', () => {
  it('sends the token in X-Share-Token, no admin header, no cookies, nothing cached', async () => {
    const calls = respond(200, { title: 'T', content: '# x', mode: 'snapshot', sharedAt: 1, updatedAt: 2, expiresAt: null })
    const doc = await readShared('AbCdEfGhIjKlMnOpQrStUv', 'json')
    expect(doc.title).toBe('T')
    const { url, init } = calls[0]
    expect(url).toBe('/api/v1/markdown/shared?backend=json')
    expect(url).not.toContain('AbCdEfGhIjKlMnOpQrStUv')
    const headers = init.headers as Record<string, string>
    expect(headers['X-Share-Token']).toBe('AbCdEfGhIjKlMnOpQrStUv')
    expect(headers['X-Admin-Session']).toBeUndefined()
    expect(headers['X-Admin-Key']).toBeUndefined()
    expect(init.credentials).toBe('omit')
    expect(init.cache).toBe('no-store')
  })

  it('omits ?backend= when the link names no store', async () => {
    const calls = respond(200, { title: 'T', content: '', mode: 'snapshot', sharedAt: 1, updatedAt: 1, expiresAt: null })
    await readShared('AbCdEfGhIjKlMnOpQrStUv', null)
    expect(calls[0].url).toBe('/api/v1/markdown/shared')
  })

  it('404 → not found, 429 → retryAfter from the body or the header', async () => {
    respond(404, { message: 'x', data: { code: 'markdown_share_not_found' } })
    const missing = await readShared('AbCdEfGhIjKlMnOpQrStUv', 'json').catch((e) => e)
    expect(missing.code).toBe('markdown_share_not_found')
    expect(missing.message).toMatch(/doesn't exist, has expired, or was revoked/)
    respond(429, { message: 'x', data: { code: 'markdown_rate_limited' } }, { 'Retry-After': '42' })
    const limited = await readShared('AbCdEfGhIjKlMnOpQrStUv', 'json').catch((e) => e)
    expect(limited.retryAfter).toBe(42)
  })

  it('a store failure (503 markdown_share_unavailable) is a retryable message, not the server text', async () => {
    respond(503, { message: 'Chưa mở được liên kết', data: { code: 'markdown_share_unavailable' } })
    const error = await readShared('AbCdEfGhIjKlMnOpQrStUv', 'json').catch((e) => e)
    expect(error.status).toBe(503)
    expect(error.message).toMatch(/could not open this link right now.*Try again/s)
  })

  it('no network → an offline ShareError', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))))
    const error = await readShared('AbCdEfGhIjKlMnOpQrStUv', 'json').catch((e) => e)
    expect(error).toBeInstanceOf(ShareError)
    expect(error.offline).toBe(true)
  })

  it('gives up after 10 s', async () => {
    vi.useFakeTimers()
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))))
      )
    )
    const pending = readShared('AbCdEfGhIjKlMnOpQrStUv', 'json').catch((e) => e)
    await vi.advanceTimersByTimeAsync(11_000)
    const error = await pending
    vi.useRealTimers()
    expect(error.offline).toBe(true)
    expect(error.message).toMatch(/within 10 s/)
  })
})
