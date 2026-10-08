import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  __testing,
  AiError,
  type AiStatus,
  aiIdentityHeaders,
  aiPost,
  aiRoot,
  canOffer,
  getStatus,
  unlockWithCode,
} from '../lib/ai'

const fetchMock = vi.fn()

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function envelope(status: number, message: string, data: unknown = null) {
  return json({ status_code: status, message, data }, status)
}

function lastCall() {
  const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit]
  return { url, init, headers: (init?.headers ?? {}) as Record<string, string> }
}

const status: AiStatus = {
  enabled: true,
  access: 'code',
  allowed: true,
  needs: null,
  admin: false,
  model: 'gemini-2.5-flash',
  limits: { perMinute: 6, perDay: 200 },
}

// With the API at the page's root, identities are kept under the bare origin.
const adminKey = () => `qlkh.phien@${window.location.origin}.token`
const aiKey = () => `ai.phien@${window.location.origin}`
const nowSeconds = () => Math.floor(Date.now() / 1000)

beforeEach(() => {
  __testing.reset()
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  window.localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  delete window.__WEBAPP_CONFIG__
})

describe('aiRoot', () => {
  it('is the page origin when the API is mounted at the root', () => {
    expect(aiRoot()).toBe(window.location.origin)
  })

  it('includes the injected API prefix, without trailing slashes', () => {
    window.__WEBAPP_CONFIG__ = { apiBase: '/api/v1/' }
    expect(aiRoot()).toBe(`${window.location.origin}/api/v1`)
  })

  it('keeps an API on another origin as it is', () => {
    window.__WEBAPP_CONFIG__ = { apiBase: 'https://api.example.com/v1' }
    expect(aiRoot()).toBe('https://api.example.com/v1')
  })
})

describe('identity headers', () => {
  it('sends nothing when nothing is saved', () => {
    expect(aiIdentityHeaders()).toEqual({})
  })

  it('sends the course administrator session saved for this API root', () => {
    window.localStorage.setItem(adminKey(), JSON.stringify('adm-1'))
    expect(aiIdentityHeaders()).toEqual({ 'X-Admin-Session': 'adm-1' })
  })

  it('ignores an admin value that is empty, not a string or not JSON', () => {
    for (const raw of [JSON.stringify(''), JSON.stringify({ token: 'x' }), 'adm-not-json']) {
      window.localStorage.setItem(adminKey(), raw)
      expect(aiIdentityHeaders()).toEqual({})
    }
  })

  it('never sends a token saved for another API root', () => {
    window.localStorage.setItem('qlkh.phien@https://other.example.com.token', JSON.stringify('adm-1'))
    window.localStorage.setItem('ai.phien@https://other.example.com', JSON.stringify({ token: 'ai-1', het: 0 }))
    expect(aiIdentityHeaders()).toEqual({})
  })

  it('follows the injected API base to find the keys', () => {
    window.__WEBAPP_CONFIG__ = { apiBase: '/api/v1' }
    window.localStorage.setItem(`qlkh.phien@${window.location.origin}/api/v1.token`, JSON.stringify('adm-2'))
    expect(aiIdentityHeaders()).toEqual({ 'X-Admin-Session': 'adm-2' })
  })

  it('sends an AI token whose expiry, in seconds, is still ahead', () => {
    window.localStorage.setItem(aiKey(), JSON.stringify({ token: 'ai-1', het: nowSeconds() + 3600 }))
    expect(aiIdentityHeaders()).toEqual({ 'X-AI-Session': 'ai-1' })
  })

  it('also reads an expiry given in milliseconds', () => {
    window.localStorage.setItem(aiKey(), JSON.stringify({ token: 'ai-1', het: Date.now() + 60_000 }))
    expect(aiIdentityHeaders()).toEqual({ 'X-AI-Session': 'ai-1' })
  })

  it('treats a zero or missing expiry as none', () => {
    window.localStorage.setItem(aiKey(), JSON.stringify({ token: 'ai-1', het: 0 }))
    expect(aiIdentityHeaders()['X-AI-Session']).toBe('ai-1')

    window.localStorage.setItem(aiKey(), JSON.stringify({ token: 'ai-2' }))
    expect(aiIdentityHeaders()['X-AI-Session']).toBe('ai-2')
  })

  it('drops an expired AI token and removes it from storage', () => {
    window.localStorage.setItem(aiKey(), JSON.stringify({ token: 'ai-1', het: nowSeconds() - 10 }))
    expect(aiIdentityHeaders()).toEqual({})
    expect(window.localStorage.getItem(aiKey())).toBeNull()
  })

  it('sends the model picked on another page of this server, and ignores a malformed one', () => {
    window.localStorage.setItem(`ai.model@${window.location.origin}/api/v1`, JSON.stringify('gemini-3.8-flash'))
    window.__WEBAPP_CONFIG__ = { apiBase: '/api/v1' }
    expect(aiIdentityHeaders()).toEqual({ 'X-AI-Model': 'gemini-3.8-flash' })
    window.localStorage.setItem(`ai.model@${window.location.origin}/api/v1`, JSON.stringify('Not A Model!'))
    expect(aiIdentityHeaders()).toEqual({})
  })

  it('sends both identities together', () => {
    window.localStorage.setItem(adminKey(), JSON.stringify('adm-1'))
    window.localStorage.setItem(aiKey(), JSON.stringify({ token: 'ai-1', het: nowSeconds() + 60 }))
    expect(aiIdentityHeaders()).toEqual({ 'X-Admin-Session': 'adm-1', 'X-AI-Session': 'ai-1' })
  })

  it('carries on without identities when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(aiIdentityHeaders()).toEqual({})
  })
})

describe('getStatus', () => {
  beforeEach(() => fetchMock.mockImplementation(async () => json(status)))

  it('asks GET /ai/status once and then answers from the cache', async () => {
    await expect(getStatus()).resolves.toEqual(status)
    await getStatus()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const { url, init, headers } = lastCall()
    expect(url).toBe('/ai/status')
    expect(init.method).toBeUndefined()
    expect(init.credentials).toBe('same-origin')
    expect(headers['Content-Type']).toBeUndefined()
  })

  it('asks again on refresh', async () => {
    await getStatus()
    await getStatus(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('sends the saved identities', async () => {
    window.localStorage.setItem(adminKey(), JSON.stringify('adm-1'))
    await getStatus()
    expect(lastCall().headers['X-Admin-Session']).toBe('adm-1')
  })

  it('does not cache a failure', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await expect(getStatus()).rejects.toMatchObject({ code: 'network' })

    await expect(getStatus()).resolves.toEqual(status)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('uses the API base the server injected', async () => {
    window.__WEBAPP_CONFIG__ = { apiBase: '/api/v1' }
    await getStatus()
    expect(lastCall().url).toBe('/api/v1/ai/status')
  })
})

describe('canOffer', () => {
  it('offers AI to a caller who may use it', () => {
    expect(canOffer(status)).toBe(true)
  })

  it('offers it to a caller who only lacks the access code', () => {
    expect(canOffer({ ...status, allowed: false, needs: 'code' })).toBe(true)
  })

  it('hides it in admin-only mode', () => {
    expect(canOffer({ ...status, access: 'admin', allowed: false, needs: 'admin' })).toBe(false)
  })

  it('hides it when AI is off, or the status is unknown', () => {
    expect(canOffer({ ...status, enabled: false })).toBe(false)
    expect(canOffer(null)).toBe(false)
  })
})

describe('unlockWithCode', () => {
  it('trades the code for a token, keeps it for this API root and re-reads the status with it', async () => {
    const het = nowSeconds() + 86400
    fetchMock
      .mockResolvedValueOnce(json({ ok: true, session: 'ai-tok', expiresAt: het }))
      .mockResolvedValueOnce(json({ ...status, allowed: true }))

    const next = await unlockWithCode('1234')

    const [sessionUrl, sessionInit] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(sessionUrl).toBe('/ai/session')
    expect(sessionInit.method).toBe('POST')
    expect(JSON.parse(String(sessionInit.body))).toEqual({ code: '1234' })
    expect(JSON.parse(window.localStorage.getItem(aiKey()) ?? 'null')).toEqual({ token: 'ai-tok', het })

    expect(lastCall().url).toBe('/ai/status')
    expect(lastCall().headers['X-AI-Session']).toBe('ai-tok')
    expect(next.allowed).toBe(true)
  })

  it('surfaces a wrong code and stores nothing', async () => {
    fetchMock.mockResolvedValueOnce(envelope(403, 'Mã truy cập AI không đúng', { code: 'ai_code_invalid' }))

    const error = await unlockWithCode('nope').catch((caught) => caught)
    expect(error).toBeInstanceOf(AiError)
    expect(error).toMatchObject({ message: 'Mã truy cập AI không đúng', code: 'ai_code_invalid', status: 403 })
    expect(window.localStorage.getItem(aiKey())).toBeNull()
  })
})

describe('aiPost', () => {
  it('returns the bare JSON answer without unwrapping anything', async () => {
    fetchMock.mockResolvedValue(json({ data: 'not an envelope', sql: 'SELECT 1' }))
    await expect(aiPost('sql', {})).resolves.toEqual({ data: 'not an envelope', sql: 'SELECT 1' })
  })

  it('posts JSON as this caller, with any extra headers, on the same origin', async () => {
    window.localStorage.setItem(adminKey(), JSON.stringify('adm-1'))
    fetchMock.mockResolvedValue(json({ ok: true }))

    await aiPost('sql', { question: 'q' }, { headers: { 'X-Session-Token': 'tok-1' } })

    const { url, init, headers } = lastCall()
    expect(url).toBe('/ai/sql')
    expect(init.method).toBe('POST')
    expect(init.credentials).toBe('same-origin')
    expect(JSON.parse(String(init.body))).toEqual({ question: 'q' })
    expect(headers).toEqual({
      'Content-Type': 'application/json',
      'X-Admin-Session': 'adm-1',
      'X-Session-Token': 'tok-1',
    })
  })

  it('turns an error envelope into an AiError with its code, status and wait', async () => {
    fetchMock.mockResolvedValue(
      envelope(429, 'Bạn hỏi AI nhanh quá — thử lại sau 12 giây', { code: 'ai_rate_limited', retryAfter: 12 }),
    )

    const error = await aiPost('sql', {}).catch((caught) => caught)
    expect(error).toBeInstanceOf(AiError)
    expect(error).toMatchObject({
      message: 'Bạn hỏi AI nhanh quá — thử lại sau 12 giây',
      code: 'ai_rate_limited',
      status: 429,
      retryAfter: 12,
    })
  })

  it('leaves the code empty when the envelope carries none', async () => {
    fetchMock.mockResolvedValue(envelope(400, 'CSDL `shop` chưa có bảng nào'))
    await expect(aiPost('sql', {})).rejects.toMatchObject({ code: '', status: 400, message: 'CSDL `shop` chưa có bảng nào' })
  })

  it('gives a readable message for a gateway error that is not JSON', async () => {
    fetchMock.mockResolvedValue(new Response('<html>504 Gateway Time-out</html>', { status: 504 }))
    await expect(aiPost('sql', {})).rejects.toMatchObject({
      message: 'Máy chủ AI trả lời quá lâu — hãy thử lại',
      code: '',
      status: 504,
    })
  })

  it('reports a network failure', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    const error = await aiPost('sql', {}).catch((caught) => caught)
    expect(error).toBeInstanceOf(AiError)
    expect(error).toMatchObject({ message: 'Không kết nối được máy chủ', code: 'network', status: 0 })
  })

  it('reports a cancelled request as aborted, not as a network failure', async () => {
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) =>
          init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))),
        ),
    )
    const controller = new AbortController()
    const pending = aiPost('sql', {}, { signal: controller.signal })
    controller.abort()

    await expect(pending).rejects.toMatchObject({ code: 'aborted', status: 0 })
  })

  it('rejects a success body that is not JSON', async () => {
    fetchMock.mockResolvedValue(new Response('<!doctype html><html></html>', { status: 200 }))
    await expect(aiPost('sql', {})).rejects.toMatchObject({ code: 'bad_response' })
  })
})
