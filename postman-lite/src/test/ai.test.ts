import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AiError,
  type AiStatus,
  adminSessionKey,
  aiIdentityHeaders,
  aiRoot,
  aiSessionKey,
  canOffer,
  createAiClient,
} from '../lib/ai'
import {
  MASKED,
  REQUEST_BODY_CHARS,
  RESPONSE_BODY_CHARS,
  appendScript,
  buildHttpAiPayload,
  maskHeaders,
} from '../lib/aiHttp'
import { cutText, kv } from '../lib/util'
import { blankRequest } from '../store'
import type { ResponseData } from '../types'

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } })

const STATUS: AiStatus = {
  enabled: true,
  access: 'code',
  allowed: false,
  needs: 'code',
  admin: false,
  model: 'gemini-2.5-flash',
  limits: { perMinute: 5, perDay: 100 },
}

const response = (overrides: Partial<ResponseData> = {}): ResponseData => ({
  status: 200,
  statusText: 'OK',
  headers: [['content-type', 'application/json']],
  bytes: new TextEncoder().encode('{}'),
  contentType: 'application/json',
  sizeBytes: 2,
  timeMs: 5,
  via: 'direct',
  finalUrl: 'https://a.dev',
  redirected: false,
  truncated: false,
  headersComplete: true,
  receivedAt: new Date().toISOString(),
  ...overrides,
})

// ---------------------------------------------------------------------------
describe('AI client: who is asking', () => {
  const root = `${location.origin}/api/v1`

  beforeEach(() => localStorage.clear())

  it('stores tokens under the absolute API root, without trailing slashes', () => {
    expect(aiRoot('')).toBe(location.origin)
    expect(aiRoot('/api/v1')).toBe(root)
    expect(aiRoot('https://api.example.com/api/v1/')).toBe('https://api.example.com/api/v1')
  })

  it("sends the administrator session stored for this API, and only this API's", () => {
    localStorage.setItem(adminSessionKey(root), JSON.stringify('adm-123'))
    expect(aiIdentityHeaders('/api/v1')).toEqual({ 'X-Admin-Session': 'adm-123' })
    // Same origin, another mount: a different API, so nothing is sent.
    expect(aiIdentityHeaders('')).toEqual({})
  })

  it('ignores an administrator entry that is not a non-empty JSON string', () => {
    for (const raw of [JSON.stringify(''), 'not json', JSON.stringify({ token: 'x' }), JSON.stringify(42)]) {
      localStorage.setItem(adminSessionKey(root), raw)
      expect(aiIdentityHeaders('/api/v1'), raw).toEqual({})
    }
  })

  it('sends a live AI token, whether the expiry is in seconds, milliseconds or absent', () => {
    const key = aiSessionKey(root)
    const inAnHour = Date.now() + 3_600_000
    for (const het of [Math.floor(inAnHour / 1000), inAnHour, 0, undefined]) {
      localStorage.setItem(key, JSON.stringify({ token: 'ai-tok', het }))
      expect(aiIdentityHeaders('/api/v1'), String(het)).toEqual({ 'X-AI-Session': 'ai-tok' })
    }
  })

  it('sends the model picked on another page of this server, and ignores a malformed one', () => {
    localStorage.setItem(`ai.model@${root}`, JSON.stringify('gemini-3.8-flash'))
    expect(aiIdentityHeaders('/api/v1')).toEqual({ 'X-AI-Model': 'gemini-3.8-flash' })
    localStorage.setItem(`ai.model@${root}`, JSON.stringify('Not A Model!'))
    expect(aiIdentityHeaders('/api/v1')).toEqual({})
  })

  it('removes an expired AI token instead of sending it', () => {
    const key = aiSessionKey(root)
    localStorage.setItem(adminSessionKey(root), JSON.stringify('adm'))
    localStorage.setItem(key, JSON.stringify({ token: 'old', het: Math.floor(Date.now() / 1000) - 60 }))

    expect(aiIdentityHeaders('/api/v1')).toEqual({ 'X-Admin-Session': 'adm' })
    expect(localStorage.getItem(key)).toBeNull()

    // Milliseconds expire the same way.
    localStorage.setItem(key, JSON.stringify({ token: 'old', het: Date.now() - 1000 }))
    expect(aiIdentityHeaders('/api/v1')['X-AI-Session']).toBeUndefined()
    expect(localStorage.getItem(key)).toBeNull()
  })

  it('offers AI only when it is on and this person may use it or only lacks the code', () => {
    expect(canOffer(null)).toBe(false)
    expect(canOffer({ ...STATUS, enabled: false })).toBe(false)
    expect(canOffer(STATUS)).toBe(true) // code mode: show the code field
    expect(canOffer({ ...STATUS, access: 'admin', needs: 'admin' })).toBe(false) // guests see nothing
    expect(canOffer({ ...STATUS, access: 'public', allowed: true, needs: null })).toBe(true)
  })
})

// ---------------------------------------------------------------------------
describe('AI client: calls', () => {
  const base = 'https://api.example.com/api/v1'
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    localStorage.clear()
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('POSTs JSON with the identity headers and returns the bare JSON answer', async () => {
    localStorage.setItem(aiSessionKey(base), JSON.stringify({ token: 'ai-tok', het: 0 }))
    fetchMock.mockResolvedValue(json(200, { summary: 'Ổn', details: [], problems: [], next: [], cached: false }))

    const answer = await createAiClient(() => base).post('http', { action: 'explain' })

    expect(answer).toEqual({ summary: 'Ổn', details: [], problems: [], next: [], cached: false })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(`${base}/ai/http`)
    expect(init).toMatchObject({ method: 'POST', credentials: 'same-origin' })
    expect(init.headers).toEqual({ 'Content-Type': 'application/json', 'X-AI-Session': 'ai-tok' })
    expect(JSON.parse(init.body)).toEqual({ action: 'explain' })
  })

  it('turns the error envelope into an AiError carrying the server code', async () => {
    fetchMock.mockResolvedValue(
      json(429, {
        status_code: 429,
        message: 'Bạn hỏi AI nhanh quá — thử lại sau 12 giây',
        data: { code: 'ai_rate_limited', retryAfter: 12 },
      }),
    )
    const err = await createAiClient(() => base)
      .post('http', {})
      .catch((e: unknown) => e)

    expect(err).toBeInstanceOf(AiError)
    expect(err).toMatchObject({
      message: 'Bạn hỏi AI nhanh quá — thử lại sau 12 giây',
      code: 'ai_rate_limited',
      status: 429,
      retryAfter: 12,
    })
  })

  it('keeps the message of an envelope without a code (a 502 from the model)', async () => {
    fetchMock.mockResolvedValue(json(502, { status_code: 502, message: 'AI trả lời sai định dạng — thử lại', data: null }))
    const err = await createAiClient(() => base)
      .post('http', {})
      .catch((e: unknown) => e)
    expect(err).toMatchObject({ name: 'AiError', message: 'AI trả lời sai định dạng — thử lại', code: '', status: 502 })
  })

  it('reports an unreachable server as code "network", status 0', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    const err = await createAiClient(() => base)
      .post('http', {})
      .catch((e: unknown) => e)
    expect(err).toBeInstanceOf(AiError)
    expect(err).toMatchObject({ message: 'Không kết nối được máy chủ', code: 'network', status: 0 })
  })

  it('asks for the status once, again on refresh, and does not remember a failure', async () => {
    const client = createAiClient(() => base)
    fetchMock.mockRejectedValueOnce(new TypeError('offline'))
    await expect(client.status()).rejects.toMatchObject({ code: 'network' })

    fetchMock.mockImplementation(async () => json(200, STATUS))
    await expect(client.status()).resolves.toEqual(STATUS)
    await client.status()
    expect(fetchMock).toHaveBeenCalledTimes(2)

    await client.status(true)
    expect(fetchMock).toHaveBeenCalledTimes(3)
    const [url, init] = fetchMock.mock.calls[2]
    expect(url).toBe(`${base}/ai/status`)
    expect(init.method).toBeUndefined() // a GET
  })

  it('unlocks with the access code: keeps the token, then asks for the status with it', async () => {
    const expiresAt = Math.floor(Date.now() / 1000) + 86_400
    fetchMock
      .mockResolvedValueOnce(json(200, { ok: true, session: 'S1', expiresAt }))
      .mockResolvedValueOnce(json(200, { ...STATUS, allowed: true, needs: null }))

    const status = await createAiClient(() => base).unlock('mã bí mật')

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ code: 'mã bí mật' })
    expect(JSON.parse(localStorage.getItem(aiSessionKey(base))!)).toEqual({ token: 'S1', het: expiresAt })
    expect(fetchMock.mock.calls[1][0]).toBe(`${base}/ai/status`)
    expect(fetchMock.mock.calls[1][1].headers['X-AI-Session']).toBe('S1')
    expect(status.allowed).toBe(true)
  })

  it('reports a wrong access code with the server message', async () => {
    fetchMock.mockResolvedValue(
      json(403, { status_code: 403, message: 'Mã truy cập AI không đúng', data: { code: 'ai_code_invalid' } }),
    )
    await expect(createAiClient(() => base).unlock('sai')).rejects.toMatchObject({
      message: 'Mã truy cập AI không đúng',
      code: 'ai_code_invalid',
      status: 403,
    })
    expect(localStorage.getItem(aiSessionKey(base))).toBeNull()
  })
})

// ---------------------------------------------------------------------------
describe('AI for one HTTP exchange', () => {
  it('masks credential-looking headers by name and keeps the rest', () => {
    const secret = [
      'Authorization',
      'Proxy-Authorization',
      'Cookie',
      'Set-Cookie',
      'X-API-Key',
      'x-api_key',
      'X-Auth-Token',
      'X-Session-Id',
      'X-Signature',
      'X-Client-Secret',
      'X-Password',
      'X-Credential',
    ]
    const masked = maskHeaders([...secret.map((name): [string, string] => [name, 'S3CRET']), ['Content-Type', 'text/html'], ['X-Request-Id', 'r1']])
    expect(masked).toEqual([
      ...secret.map((name) => [name, MASKED]),
      ['Content-Type', 'text/html'],
      ['X-Request-Id', 'r1'],
    ])
  })

  it('builds the request as it was sent, with auth and cookies masked', async () => {
    const spec = blankRequest({
      method: 'POST',
      url: 'https://a.dev/login',
      params: [kv('lang', 'vi')],
      headers: [kv('X-Trace', 'abc')],
      cookies: [kv('sid', 'COOKIE-SECRET')],
      auth: { type: 'bearer', token: 'BEARER-SECRET' },
      bodyMode: 'json',
      body: '{"user":"an"}',
    })
    const { payload, notes } = await buildHttpAiPayload(
      'explain',
      spec,
      response({ headers: [['content-type', 'application/json'], ['set-cookie', 'sid=NEW-SECRET']] }),
    )

    expect(payload.action).toBe('explain')
    expect(payload.request).toMatchObject({ method: 'POST', url: 'https://a.dev/login?lang=vi', body: '{"user":"an"}' })
    expect(payload.request.headers).toEqual(
      expect.arrayContaining([['X-Trace', 'abc'], ['Authorization', MASKED], ['Cookie', MASKED]]),
    )
    expect(payload.response).toMatchObject({ status: 200, statusText: 'OK', contentType: 'application/json', body: '{}' })
    expect(payload.response.headers).toContainEqual(['set-cookie', MASKED])
    expect(JSON.stringify(payload)).not.toMatch(/SECRET/)
    expect(notes).toEqual([])
  })

  it('sends at most 100 000 characters of the response body and 20 000 of the request body', async () => {
    const { payload, notes } = await buildHttpAiPayload(
      'tests',
      blankRequest({ method: 'POST', url: 'https://a.dev', bodyMode: 'text', body: 'b'.repeat(REQUEST_BODY_CHARS + 10) }),
      response({ contentType: 'text/plain', bytes: new TextEncoder().encode('a'.repeat(RESPONSE_BODY_CHARS + 50)) }),
    )
    expect(payload.response.body).toHaveLength(RESPONSE_BODY_CHARS)
    expect(payload.request.body).toHaveLength(REQUEST_BODY_CHARS)
    expect(notes).toHaveLength(2)
  })

  it('sends no body for a binary response, and says so', async () => {
    const { payload, notes } = await buildHttpAiPayload(
      'explain',
      blankRequest({ url: 'https://a.dev/logo.png' }),
      response({ contentType: 'image/png', bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47]) }),
    )
    expect(payload.response.body).toBe('')
    expect(notes[0]).toMatch(/nhị phân/)
  })

  it('never cuts an emoji in half', () => {
    expect(cutText('ab😀', 3)).toBe('ab')
    expect(cutText('ab😀', 4)).toBe('ab😀')
  })

  it('appends generated tests after one blank line', () => {
    expect(appendScript('pm.test("cũ", () => {})\n\n\n', 'pm.test("mới", () => {})\n')).toBe(
      'pm.test("cũ", () => {})\n\npm.test("mới", () => {})',
    )
    expect(appendScript('  \n', 'pm.test("a", () => {})')).toBe('pm.test("a", () => {})')
  })
})
