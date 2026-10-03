import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AiError, __testing, aiPost, aiRoot, canOffer, getStatus, identityHeaders, unlock, type AiStatus } from '../lib/ai'

const STATUS: AiStatus = {
  enabled: true,
  access: 'code',
  allowed: true,
  needs: null,
  admin: false,
  model: 'gemini-2.5-flash',
  limits: { perMinute: 6, perDay: 100 },
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

/** The backend's error envelope. */
function failure(status: number, message: string, data: unknown = null) {
  return json({ status_code: status, message, data }, status)
}

const inject = (config: unknown) => {
  ;(window as unknown as { __WEBAPP_CONFIG__?: unknown }).__WEBAPP_CONFIG__ = config
}

/** With nothing injected the API is same-origin with no prefix. */
const origin = () => window.location.origin
const adminKey = () => `qlkh.phien@${origin()}.token`
const aiKey = () => `ai.phien@${origin()}`
const nowSeconds = () => Math.floor(Date.now() / 1000)

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  window.localStorage.clear()
  __testing.resetStatus()
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  delete (window as unknown as { __WEBAPP_CONFIG__?: unknown }).__WEBAPP_CONFIG__
})

function lastCall() {
  const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit]
  return { url, init, headers: (init?.headers ?? {}) as Record<string, string> }
}

describe('aiRoot', () => {
  it('is the page origin when the API is same-origin', () => {
    expect(aiRoot()).toBe(origin())
  })

  it('resolves an injected prefix to an absolute URL without trailing slashes', () => {
    inject({ apiBase: '/api/v1/' })
    expect(aiRoot()).toBe(`${origin()}/api/v1`)
  })

  it('keeps an API on another origin as it is', () => {
    inject({ apiBase: 'https://api.example.com/api/v1' })
    expect(aiRoot()).toBe('https://api.example.com/api/v1')
  })
})

describe('identityHeaders', () => {
  it('is empty when no page left a token', () => {
    expect(identityHeaders()).toEqual({})
  })

  it('sends the course administrator session kept for this API root', () => {
    window.localStorage.setItem(adminKey(), JSON.stringify('admin-tok'))
    expect(identityHeaders()).toEqual({ 'X-Admin-Session': 'admin-tok' })
  })

  it('ignores an administrator entry that is not a JSON string', () => {
    window.localStorage.setItem(adminKey(), JSON.stringify({ token: 'x' }))
    expect(identityHeaders()).toEqual({})
    window.localStorage.setItem(adminKey(), 'not json')
    expect(identityHeaders()).toEqual({})
  })

  it('never sends a token issued for another API root', () => {
    window.localStorage.setItem('qlkh.phien@https://elsewhere.example.token', JSON.stringify('admin-tok'))
    window.localStorage.setItem('ai.phien@https://elsewhere.example', JSON.stringify({ token: 'ai-tok', het: 0 }))
    expect(identityHeaders()).toEqual({})
  })

  it('looks the keys up under the injected API root', () => {
    inject({ apiBase: '/api/v1' })
    window.localStorage.setItem(`qlkh.phien@${origin()}/api/v1.token`, JSON.stringify('admin-tok'))
    expect(identityHeaders()).toEqual({ 'X-Admin-Session': 'admin-tok' })
  })

  it('sends an AI token whose expiry, in seconds, is still ahead', () => {
    window.localStorage.setItem(aiKey(), JSON.stringify({ token: 'ai-tok', het: nowSeconds() + 3600 }))
    expect(identityHeaders()).toEqual({ 'X-AI-Session': 'ai-tok' })
  })

  it('reads an expiry past 1e12 as milliseconds', () => {
    window.localStorage.setItem(aiKey(), JSON.stringify({ token: 'ai-tok', het: Date.now() + 60_000 }))
    expect(identityHeaders()).toEqual({ 'X-AI-Session': 'ai-tok' })
  })

  it('sends an AI token with no expiry', () => {
    window.localStorage.setItem(aiKey(), JSON.stringify({ token: 'ai-tok', het: 0 }))
    expect(identityHeaders()['X-AI-Session']).toBe('ai-tok')
    window.localStorage.setItem(aiKey(), JSON.stringify({ token: 'ai-tok' }))
    expect(identityHeaders()['X-AI-Session']).toBe('ai-tok')
  })

  it('drops an expired AI token instead of sending it', () => {
    window.localStorage.setItem(aiKey(), JSON.stringify({ token: 'ai-tok', het: nowSeconds() - 1 }))
    expect(identityHeaders()).toEqual({})
    expect(window.localStorage.getItem(aiKey())).toBeNull()

    window.localStorage.setItem(aiKey(), JSON.stringify({ token: 'ai-tok', het: Date.now() - 1000 }))
    expect(identityHeaders()).toEqual({})
    expect(window.localStorage.getItem(aiKey())).toBeNull()
  })

  it('sends both tokens together', () => {
    window.localStorage.setItem(adminKey(), JSON.stringify('admin-tok'))
    window.localStorage.setItem(aiKey(), JSON.stringify({ token: 'ai-tok', het: 0 }))
    expect(identityHeaders()).toEqual({ 'X-Admin-Session': 'admin-tok', 'X-AI-Session': 'ai-tok' })
  })

  it('survives storage that throws (private windows, blocked site data)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    expect(identityHeaders()).toEqual({})
  })
})

describe('getStatus', () => {
  it('GETs /ai/status with the identity headers and same-origin credentials', async () => {
    window.localStorage.setItem(adminKey(), JSON.stringify('admin-tok'))
    fetchMock.mockResolvedValue(json(STATUS))

    await expect(getStatus()).resolves.toEqual(STATUS)

    const { url, init, headers } = lastCall()
    expect(url).toBe('/ai/status')
    expect(init.method).toBe('GET')
    expect(init.credentials).toBe('same-origin')
    expect(init.body).toBeUndefined()
    expect(headers['X-Admin-Session']).toBe('admin-tok')
  })

  it('goes through the injected API prefix', async () => {
    inject({ apiBase: '/api/v1' })
    fetchMock.mockResolvedValue(json(STATUS))
    await getStatus()
    expect(lastCall().url).toBe('/api/v1/ai/status')
  })

  it('asks once, and again only on refresh', async () => {
    fetchMock.mockImplementation(() => json(STATUS))
    await getStatus()
    await getStatus()
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await getStatus(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not remember a failed check', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await expect(getStatus()).rejects.toMatchObject({ code: 'network' })

    fetchMock.mockResolvedValueOnce(json(STATUS))
    await expect(getStatus()).resolves.toEqual(STATUS)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

describe('canOffer', () => {
  it('offers AI to someone allowed to use it', () => {
    expect(canOffer(STATUS)).toBe(true)
  })

  it('offers it to someone one access code away', () => {
    expect(canOffer({ ...STATUS, allowed: false, needs: 'code' })).toBe(true)
  })

  it('hides it from guests in admin-only mode', () => {
    expect(canOffer({ ...STATUS, access: 'admin', allowed: false, needs: 'admin' })).toBe(false)
  })

  it('hides it when switched off, or before the status is known', () => {
    expect(canOffer({ ...STATUS, enabled: false })).toBe(false)
    expect(canOffer(null)).toBe(false)
    expect(canOffer(undefined)).toBe(false)
  })
})

describe('aiPost', () => {
  it('posts JSON with the identity headers, extra headers and same-origin credentials', async () => {
    window.localStorage.setItem(aiKey(), JSON.stringify({ token: 'ai-tok', het: 0 }))
    fetchMock.mockResolvedValue(json({ ok: true }))

    await aiPost('mongo', { question: 'q' }, { headers: { 'X-Session-Token': 'mongo-tok' } })

    const { url, init, headers } = lastCall()
    expect(url).toBe('/ai/mongo')
    expect(init.method).toBe('POST')
    expect(init.credentials).toBe('same-origin')
    expect(JSON.parse(init.body as string)).toEqual({ question: 'q' })
    expect(headers).toEqual({
      'Content-Type': 'application/json',
      'X-AI-Session': 'ai-tok',
      'X-Session-Token': 'mongo-tok',
    })
  })

  it('returns the bare JSON answer as it is, without unwrapping an envelope', async () => {
    const body = { mode: 'find', data: 'kept', message: 'kept too' }
    fetchMock.mockResolvedValue(json(body))
    await expect(aiPost('mongo', {})).resolves.toEqual(body)
  })

  it('turns an error envelope into an AiError with the code, status and wait', async () => {
    fetchMock.mockResolvedValue(
      failure(429, 'Bạn hỏi AI nhanh quá — thử lại sau 12 giây', { code: 'ai_rate_limited', retryAfter: 12 }),
    )
    const error = (await aiPost('mongo', {}).catch((caught) => caught)) as AiError

    expect(error).toBeInstanceOf(AiError)
    expect(error.message).toBe('Bạn hỏi AI nhanh quá — thử lại sau 12 giây')
    expect(error.code).toBe('ai_rate_limited')
    expect(error.status).toBe(429)
    expect(error.retryAfter).toBe(12)
  })

  it('leaves the code empty when the envelope carries none', async () => {
    fetchMock.mockResolvedValue(failure(401, 'Session expired or not found; please connect again'))
    await expect(aiPost('mongo', {})).rejects.toMatchObject({
      message: 'Session expired or not found; please connect again',
      code: '',
      status: 401,
    })
  })

  it('reads FastAPI’s own string detail, and falls back to the status otherwise', async () => {
    fetchMock.mockResolvedValueOnce(json({ detail: 'Not Found' }, 404))
    await expect(aiPost('mongo', {})).rejects.toMatchObject({ message: 'Not Found', status: 404 })

    fetchMock.mockResolvedValueOnce(json({ detail: [{ loc: ['body', 'question'] }] }, 422))
    await expect(aiPost('mongo', {})).rejects.toMatchObject({ message: 'Máy chủ báo lỗi (HTTP 422)', code: '' })

    fetchMock.mockResolvedValueOnce(new Response('<html>Bad gateway</html>', { status: 502 }))
    await expect(aiPost('mongo', {})).rejects.toMatchObject({ message: 'Máy chủ báo lỗi (HTTP 502)', status: 502 })
  })

  it('reports a network failure', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    const error = (await aiPost('mongo', {}).catch((caught) => caught)) as AiError
    expect(error).toBeInstanceOf(AiError)
    expect(error.message).toBe('Không kết nối được máy chủ')
    expect(error.code).toBe('network')
    expect(error.status).toBe(0)
  })

  it('tells a cancelled request apart from a network failure', async () => {
    const controller = new AbortController()
    fetchMock.mockImplementation(() => {
      controller.abort()
      return Promise.reject(new DOMException('The operation was aborted.', 'AbortError'))
    })
    await expect(aiPost('mongo', {}, { signal: controller.signal })).rejects.toMatchObject({ code: 'aborted' })
    expect(lastCall().init.signal).toBe(controller.signal)
  })

  it('refuses a success that is not JSON', async () => {
    fetchMock.mockResolvedValue(new Response('<html></html>', { status: 200 }))
    await expect(aiPost('mongo', {})).rejects.toMatchObject({ code: 'bad_response', status: 200 })
  })
})

describe('unlock', () => {
  it('trades the code for a token, keeps it for this API root and refreshes the status', async () => {
    const expiresAt = nowSeconds() + 86400
    fetchMock
      .mockResolvedValueOnce(json({ ...STATUS, allowed: false, needs: 'code' }))
      .mockResolvedValueOnce(json({ ok: true, session: 'ai-tok', expiresAt }))
      .mockResolvedValueOnce(json(STATUS))

    expect((await getStatus()).allowed).toBe(false)
    const status = await unlock('sesame')

    const [, sessionCall, statusCall] = fetchMock.mock.calls as [string, RequestInit][]
    expect(sessionCall[0]).toBe('/ai/session')
    expect(JSON.parse(sessionCall[1].body as string)).toEqual({ code: 'sesame' })
    expect(JSON.parse(window.localStorage.getItem(aiKey()) as string)).toEqual({ token: 'ai-tok', het: expiresAt })
    // The refreshed status is asked with the new token, and replaces the cached one.
    expect((statusCall[1].headers as Record<string, string>)['X-AI-Session']).toBe('ai-tok')
    expect(status.allowed).toBe(true)
    await expect(getStatus()).resolves.toEqual(STATUS)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('stores nothing for a wrong code', async () => {
    fetchMock.mockResolvedValue(failure(403, 'Mã truy cập AI không đúng', { code: 'ai_code_invalid' }))
    await expect(unlock('nope')).rejects.toMatchObject({ code: 'ai_code_invalid', status: 403 })
    expect(window.localStorage.getItem(aiKey())).toBeNull()
  })
})
