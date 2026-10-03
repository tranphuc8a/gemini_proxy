import { afterEach, describe, expect, it, vi } from 'vitest'
import { api, resetApiBaseForTests } from '../lib/api'
import { looksLikeCurl, specPatchFromCurl } from '../lib/curl'
import {
  SHARE_REQUEST_PREFIX,
  decodeSharedRequest,
  encodeSharedRequest,
  readWorkspaceShare,
  sharedRequestToSpec,
  sharedRequestUrl,
  sharedWorkspaceToBundle,
  toBase64Url,
  toSharedRequest,
  withoutShareParams,
  workspaceShareUrl,
} from '../lib/share'
import { kv } from '../lib/util'
import { blankRequest } from '../store'

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

// ---------------------------------------------------------------------------
describe('sharing one request in the link fragment', () => {
  const spec = blankRequest({
    name: 'Tạo đơn hàng 🚀',
    method: 'POST',
    url: 'https://api.example.vn/đơn-hàng?lang=vi&access_token=SECRET1',
    params: [kv('lang', 'vi'), kv('access_token', 'SECRET1'), { ...kv('debug', '1'), enabled: false }],
    headers: [
      kv('Authorization', 'Bearer SECRET2'),
      kv('X-Api-Key', 'SECRET3'),
      kv('X-Ghi-Chú', 'xin chào 👋'),
      { ...kv('X-Off', 'tắt'), enabled: false },
      kv('', ''),
    ],
    cookies: [kv('sid', 'SECRET4')],
    auth: { type: 'bearer', token: 'SECRET5' },
    bodyMode: 'json',
    body: '{"tên":"Phở bò 🍜","giá":45000}',
    tests: 'pm.test("Tạo được ✅", () => pm.response.to.have.status(201))',
  })

  it('round-trips Vietnamese and emoji through a base64url fragment', () => {
    const { shared } = toSharedRequest(spec, { stripSecrets: false })
    const url = sharedRequestUrl('https://host/app/', shared)
    const encoded = url.slice(`https://host/app/${SHARE_REQUEST_PREFIX}`.length)
    expect(url.startsWith(`https://host/app/${SHARE_REQUEST_PREFIX}`)).toBe(true)
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/)

    const back = sharedRequestToSpec(decodeSharedRequest(encoded))
    expect(back).toMatchObject({
      name: 'Tạo đơn hàng 🚀',
      method: 'POST',
      url: spec.url,
      bodyMode: 'json',
      body: '{"tên":"Phở bò 🍜","giá":45000}',
      tests: spec.tests,
      auth: { type: 'bearer', token: 'SECRET5' },
      collectionId: null,
      cookies: [], // never shared
      extracts: [],
    })
    expect(back.headers.map((h) => [h.key, h.value, h.enabled])).toEqual([
      ['Authorization', 'Bearer SECRET2', true],
      ['X-Api-Key', 'SECRET3', true],
      ['X-Ghi-Chú', 'xin chào 👋', true],
      ['X-Off', 'tắt', false],
    ])
    expect(back.params.map((p) => [p.key, p.enabled])).toEqual([
      ['lang', true],
      ['access_token', true],
      ['debug', false],
    ])
    // A new request, not a copy of the sender's ids.
    expect(back.id).not.toBe(spec.id)
  })

  it('strips auth and credential-looking headers and params by default', () => {
    const { shared, removed } = toSharedRequest(spec, { stripSecrets: true })
    const text = JSON.stringify(shared)
    for (const secret of ['SECRET1', 'SECRET2', 'SECRET3', 'SECRET4', 'SECRET5']) expect(text).not.toContain(secret)

    expect(shared.auth).toBeUndefined()
    expect(shared.headers.map(([name]) => name)).toEqual(['X-Ghi-Chú', 'X-Off'])
    expect(shared.params.map(([name]) => name)).toEqual(['lang', 'debug'])
    expect(shared.url).toBe('https://api.example.vn/đơn-hàng?lang=vi')
    expect(removed).toEqual(
      expect.arrayContaining(['header Authorization', 'header X-Api-Key', 'param access_token', 'Auth (bearer)']),
    )
    // Everything else survives.
    expect(shared.body).toEqual({ mode: 'json', text: spec.body })
    expect(shared.tests).toBe(spec.tests)
  })

  it('carries form fields as URL-encoded text, minus credential-looking ones', () => {
    const form = blankRequest({
      method: 'POST',
      url: 'https://a.dev/login',
      bodyMode: 'form',
      formFields: [kv('tài_khoản', 'an 😀'), kv('password', 'SECRET6'), { ...kv('nhớ', '1'), enabled: false }],
    })
    const { shared } = toSharedRequest(form, { stripSecrets: true })
    expect(JSON.stringify(shared)).not.toContain('SECRET6')

    const back = sharedRequestToSpec(decodeSharedRequest(encodeSharedRequest(shared)))
    expect(back.bodyMode).toBe('form')
    expect(back.body).toBe('')
    expect(back.formFields.map((f) => [f.key, f.value])).toEqual([['tài_khoản', 'an 😀']])
  })

  it('rejects malformed links instead of opening half a request', () => {
    const valid = encodeSharedRequest(toSharedRequest(spec, { stripSecrets: true }).shared)
    const bad = [
      '',
      '%%%',
      valid.slice(0, -9), // cut short by a chat app
      'gA', // a lone 0x80 byte: not UTF-8
      toBase64Url('not json'),
      toBase64Url('[1,2]'),
      toBase64Url(JSON.stringify({ v: 2, method: 'GET', url: 'https://a.dev' })),
      toBase64Url(JSON.stringify({ v: 1, method: 'FETCH', url: 'https://a.dev' })),
      toBase64Url(JSON.stringify({ v: 1, method: 'GET' })),
      toBase64Url(JSON.stringify({ v: 1, method: 'GET', url: 'x', name: 7 })),
      toBase64Url(JSON.stringify({ v: 1, method: 'GET', url: 'x', headers: { a: 'b' } })),
      toBase64Url(JSON.stringify({ v: 1, method: 'GET', url: 'x', headers: [['a']] })),
      toBase64Url(JSON.stringify({ v: 1, method: 'GET', url: 'x', params: [['a', 1]] })),
      toBase64Url(JSON.stringify({ v: 1, method: 'GET', url: 'x', body: { mode: 'yaml', text: '' } })),
      toBase64Url(JSON.stringify({ v: 1, method: 'GET', url: 'x', auth: { type: 'oauth2' } })),
      toBase64Url(JSON.stringify({ v: 1, method: 'GET', url: 'x', auth: { type: 'bearer', token: 5 } })),
      toBase64Url(JSON.stringify({ v: 1, method: 'GET', url: 'x', tests: 42 })),
    ]
    for (const encoded of bad) {
      expect(() => decodeSharedRequest(encoded), encoded).toThrow(/^Link request không hợp lệ/)
    }
    // The untouched link still opens.
    expect(decodeSharedRequest(valid).name).toBe('Tạo đơn hàng 🚀')
  })
})

// ---------------------------------------------------------------------------
describe('sharing a workspace', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('names the store in the link and reads it back', () => {
    const url = workspaceShareUrl('https://host/app/', 'tok_1', 'mysql')
    expect(url).toBe('https://host/app/?share=tok_1&backend=mysql')
    expect(readWorkspaceShare(new URL(url).search)).toEqual({ token: 'tok_1', backend: 'mysql' })
    expect(workspaceShareUrl('https://host/app/', 'tok_1')).toBe('https://host/app/?share=tok_1')
  })

  it('reads old links (no backend) and ignores a store it does not know', () => {
    expect(readWorkspaceShare('?share=abc')).toEqual({ token: 'abc' })
    expect(readWorkspaceShare('?share=abc&backend=MONGO')).toEqual({ token: 'abc', backend: 'mongo' })
    expect(readWorkspaceShare('?share=abc&backend=postgres')).toEqual({ token: 'abc' })
    expect(readWorkspaceShare('?backend=mysql')).toBeNull()
    expect(readWorkspaceShare('')).toBeNull()
  })

  it('takes share and backend out of the address and keeps the rest', () => {
    expect(withoutShareParams('https://h/app/?x=1&share=t&backend=json#k')).toBe('/app/?x=1#k')
    expect(withoutShareParams('https://h/app/?share=t&backend=json')).toBe('/app/')
  })

  it('asks the store named in the link: getShared sends ?backend=', async () => {
    resetApiBaseForTests()
    localStorage.clear()
    const fetchMock = vi.fn(async (input: RequestInfo | URL) =>
      String(input).endsWith('/proxy/status')
        ? json(200, { status_code: 200, message: 'OK', data: { enabled: true } })
        : json(200, {
            status_code: 200,
            message: 'OK',
            data: { id: 'ws', name: 'Demo', revision: 1, updated_at: '', collections: [], requests: [] },
          }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await api.getShared('tok 1', 'mongo')
    expect(String(fetchMock.mock.calls.at(-1)![0])).toBe('/postman/shared/tok%201?backend=mongo')

    // An old link leaves the choice to the server.
    await api.getShared('tok2')
    expect(String(fetchMock.mock.calls.at(-1)![0])).toBe('/postman/shared/tok2')
  })

  it('imports a shared workspace under one new collection, with fresh ids', () => {
    const bundle = sharedWorkspaceToBundle({
      name: 'Demo API',
      collections: [
        { id: 'c1', name: 'Auth', parentId: null },
        { id: 'c2', name: 'Phiên', parentId: 'c1' },
        'junk',
      ],
      requests: [
        {
          id: 'r1',
          name: 'Đăng nhập',
          collectionId: 'c2',
          method: 'post',
          url: 'https://a.dev/login',
          headers: [{ id: 'h1', key: 'X-Trace', value: '1', enabled: true }, { nope: true }],
          auth: { type: 'bearer', token: 't' },
          bodyMode: 'json',
          body: '{}',
          tests: 'pm.test("ok", () => {})',
          extracts: [{ id: 'e1', enabled: true, source: 'body', path: 'token', target: 'TOKEN' }],
        },
        { id: 'r2', name: 'Lạc', collectionId: 'deleted', method: 'BREW', url: 5, bodyMode: 'yaml' },
        null,
      ],
    })

    const [root, auth, session] = bundle.collections
    expect(bundle.collections).toHaveLength(3)
    expect(root).toMatchObject({ name: 'Demo API', parentId: null })
    expect(auth).toMatchObject({ name: 'Auth', parentId: root.id })
    expect(session).toMatchObject({ name: 'Phiên', parentId: auth.id })
    expect(bundle.collections.map((c) => c.id)).not.toContain('c1')

    const [login, loose] = bundle.requests
    expect(bundle.requests).toHaveLength(2)
    expect(login).toMatchObject({
      name: 'Đăng nhập',
      collectionId: session.id,
      method: 'POST',
      bodyMode: 'json',
      auth: { type: 'bearer', token: 't' },
      tests: 'pm.test("ok", () => {})',
    })
    expect(login.id).not.toBe('r1')
    expect(login.headers.map((h) => [h.key, h.value])).toEqual([['X-Trace', '1']])
    expect(login.extracts).toMatchObject([{ source: 'body', path: 'token', target: 'TOKEN' }])
    // Repaired rather than dropped: unknown values fall back to the defaults.
    expect(loose).toMatchObject({ name: 'Lạc', collectionId: root.id, method: 'GET', url: '', bodyMode: 'none' })
    expect(bundle.environments).toEqual([])
  })
})

// ---------------------------------------------------------------------------
describe('a curl command pasted into the URL bar', () => {
  it('is recognised as curl, and nothing else is', () => {
    expect(looksLikeCurl("curl 'https://a.dev'")).toBe(true)
    expect(looksLikeCurl('  CURL -X POST https://a.dev')).toBe(true)
    expect(looksLikeCurl('curl\t-L https://a.dev')).toBe(true)
    expect(looksLikeCurl('https://curl.se/docs')).toBe(false)
    expect(looksLikeCurl('curly')).toBe(false)
  })

  it('fills method, URL, params, headers, auth and body - and leaves the rest of the tab alone', () => {
    const { patch, unsupported } = specPatchFromCurl(`curl -X POST 'https://a.dev/items?limit=10' \\
  -H 'Authorization: Bearer tok' \\
  -H 'X-Trace: 1' \\
  --data-raw '{"name":"Phở"}' --retry 3`)

    expect(patch).toMatchObject({
      method: 'POST',
      // The URL bar shows the query string, the same as typing it would.
      url: 'https://a.dev/items?limit=10',
      auth: { type: 'bearer', token: 'tok' },
      bodyMode: 'json',
      body: '{"name":"Phở"}',
    })
    expect(patch.params?.map((p) => [p.key, p.value])).toEqual([['limit', '10']])
    expect(patch.headers?.map((h) => [h.key, h.value])).toEqual([['X-Trace', '1']])
    for (const kept of ['id', 'name', 'collectionId', 'tests', 'extracts']) expect(patch).not.toHaveProperty(kept)
    expect(unsupported).toContain('--retry')
  })
})
