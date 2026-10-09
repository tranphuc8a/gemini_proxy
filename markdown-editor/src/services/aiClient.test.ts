import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AiError,
  __testing,
  aiRoot,
  canOffer,
  chooseModel,
  chosenModel,
  formatMarkdown,
  getStatus,
  identityHeaders,
  listModels,
  unlockWithCode,
  type AiStatus
} from './aiClient'

const ROOT = aiRoot()
const STATUS: AiStatus = { enabled: true, access: 'code', allowed: true, needs: null, admin: false, model: 'gemini-3.5-flash' }

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const mockFetch = (impl: (url: string, init?: RequestInit) => Promise<Response>) => {
  const spy = vi.fn<typeof fetch>((input, init) => impl(String(input), init))
  vi.stubGlobal('fetch', spy)
  return spy
}
const headersOf = (spy: ReturnType<typeof mockFetch>, call = 0) => (spy.mock.calls[call][1]?.headers ?? {}) as Record<string, string>
const store = (key: string, value: unknown) => localStorage.setItem(key, JSON.stringify(value))

beforeEach(() => {
  localStorage.clear()
  __testing.reset()
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('identity headers', () => {
  it('sends what other pages of this server left for this API root', () => {
    store(`qlkh.phien@${ROOT}.token`, 'adm-1')
    store(`ai.phien@${ROOT}`, { token: 'ai-1', het: Math.floor(Date.now() / 1000) + 3600 })
    store(`ai.model@${ROOT}`, 'gemini-3.8-flash')
    expect(identityHeaders()).toEqual({ 'X-Admin-Session': 'adm-1', 'X-AI-Session': 'ai-1', 'X-AI-Model': 'gemini-3.8-flash' })
  })

  it('never sends a token filed under another server', () => {
    store('qlkh.phien@https://elsewhere.example/api/v1.token', 'adm-x')
    expect(identityHeaders()).toEqual({})
  })

  it('drops an expired AI token and ignores a malformed model', () => {
    store(`ai.phien@${ROOT}`, { token: 'old', het: Math.floor(Date.now() / 1000) - 5 })
    store(`ai.model@${ROOT}`, 'Not A Model!')
    expect(identityHeaders()).toEqual({})
    expect(localStorage.getItem(`ai.phien@${ROOT}`)).toBeNull()
  })

  it('does not use the markdown editor\'s own admin session', () => {
    localStorage.setItem('markdown-editor:admin-session', 'md-token')
    expect(identityHeaders()).toEqual({})
  })

  it('treats unreadable storage as no identity', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(identityHeaders()).toEqual({})
  })
})

describe('model choice', () => {
  it('is remembered for every page of the server, and forgotten on ""', () => {
    expect(chosenModel()).toBe('')
    chooseModel('gemini-3.8-flash')
    expect(JSON.parse(localStorage.getItem(`ai.model@${ROOT}`) ?? 'null')).toBe('gemini-3.8-flash')
    chooseModel('')
    expect(localStorage.getItem(`ai.model@${ROOT}`)).toBeNull()
  })
})

describe('status and models', () => {
  it('asks the status once, and again on refresh', async () => {
    const spy = mockFetch(async () => json(STATUS))
    await Promise.all([getStatus(), getStatus()])
    expect(spy).toHaveBeenCalledTimes(1)
    await getStatus(true)
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('does not remember a failure', async () => {
    mockFetch(async () => {
      throw new TypeError('offline')
    })
    await expect(getStatus()).rejects.toMatchObject({ code: 'network' })
    const spy = mockFetch(async () => json(STATUS))
    await expect(getStatus()).resolves.toEqual(STATUS)
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('lists models and refuses an answer without a list', async () => {
    mockFetch(async () => json({ default: 'x' }))
    await expect(listModels()).rejects.toMatchObject({ code: 'bad_response' })
    const models = { default: 'gemini-3.5-flash', source: 'api', admin: false, models: [] }
    mockFetch(async () => json(models))
    await expect(listModels()).resolves.toEqual(models)
  })

  it('offers AI only when it is on and this caller may use it or only lacks the code', () => {
    expect(canOffer(null)).toBe(false)
    expect(canOffer({ ...STATUS, enabled: false })).toBe(false)
    expect(canOffer({ ...STATUS, allowed: false, needs: 'admin' })).toBe(false)
    expect(canOffer({ ...STATUS, allowed: false, needs: 'code' })).toBe(true)
    expect(canOffer(STATUS)).toBe(true)
  })
})

describe('unlock', () => {
  it('exchanges the code for a session kept for this root, then re-reads the status', async () => {
    const spy = mockFetch(async (url) => (url.endsWith('/ai/session') ? json({ ok: true, session: 'tok', expiresAt: 4_102_444_800 }) : json(STATUS)))
    await expect(unlockWithCode('open-sesame')).resolves.toEqual(STATUS)
    expect(JSON.parse(String(spy.mock.calls[0][1]?.body))).toEqual({ code: 'open-sesame' })
    expect(JSON.parse(localStorage.getItem(`ai.phien@${ROOT}`) ?? 'null')).toEqual({ token: 'tok', het: 4_102_444_800 })
  })

  it('keeps nothing when the code is refused', async () => {
    mockFetch(async () => json({ message: 'Mã truy cập AI không đúng', data: { code: 'ai_code_invalid' } }, 403))
    await expect(unlockWithCode('nope')).rejects.toMatchObject({ code: 'ai_code_invalid', status: 403 })
    expect(localStorage.getItem(`ai.phien@${ROOT}`)).toBeNull()
  })
})

describe('formatMarkdown', () => {
  const answer = { markdown: '## A', changes: ['Thêm tiêu đề'], words: 1, sourceWords: 2, shrunk: false, truncated: false, mode: 'smart' }

  it('posts the text, mode and note, and returns the result', async () => {
    const spy = mockFetch(async () => json(answer))
    await expect(formatMarkdown('a b', 'tidy', 'a log', undefined)).resolves.toMatchObject({ markdown: '## A', changes: ['Thêm tiêu đề'], shrunk: false })
    expect(String(spy.mock.calls[0][0])).toMatch(/\/ai\/markdown$/)
    expect(JSON.parse(String(spy.mock.calls[0][1]?.body))).toEqual({ text: 'a b', mode: 'tidy', hint: 'a log' })
    expect(headersOf(spy)['Content-Type']).toBe('application/json')
  })

  it('turns the error envelope into an AiError with the code and wait time', async () => {
    mockFetch(async () =>
      json({ message: 'Bạn hỏi AI nhanh quá — thử lại sau 12 giây', data: { code: 'ai_rate_limited', retryAfter: 12 } }, 429)
    )
    const error = await formatMarkdown('x', 'smart', '').catch((cause: unknown) => cause)
    expect(error).toBeInstanceOf(AiError)
    expect(error).toMatchObject({ code: 'ai_rate_limited', status: 429, retryAfter: 12 })
  })

  it('refuses an answer with no markdown', async () => {
    mockFetch(async () => json({ ...answer, markdown: '' }))
    await expect(formatMarkdown('x', 'smart', '')).rejects.toMatchObject({ code: 'bad_response' })
  })

  it('forgets a model the server no longer has and asks once more with the default', async () => {
    chooseModel('gemini-2.0-flash')
    const spy = mockFetch(async (_url, init) =>
      (init?.headers as Record<string, string>)['X-AI-Model']
        ? json({ message: 'Máy chủ không có model', data: { code: 'ai_model_unknown' } }, 400)
        : json(answer)
    )
    await expect(formatMarkdown('x', 'smart', '')).resolves.toMatchObject({ markdown: '## A' })
    expect(spy).toHaveBeenCalledTimes(2)
    expect(chosenModel()).toBe('')
  })

  it('reports an unreachable server, and a cancelled request, differently', async () => {
    mockFetch(async () => {
      throw new TypeError('offline')
    })
    await expect(formatMarkdown('x', 'smart', '')).rejects.toMatchObject({ code: 'network' })
    const controller = new AbortController()
    controller.abort()
    mockFetch(async () => {
      throw new DOMException('aborted', 'AbortError')
    })
    await expect(formatMarkdown('x', 'smart', '', controller.signal)).rejects.toMatchObject({ code: 'aborted' })
  })
})
