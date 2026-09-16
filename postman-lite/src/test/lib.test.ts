import { describe, expect, it } from 'vitest'
import { buildUrl, extractParams, isForbiddenHeader, prepare, stripQuery } from '../lib/sender'
import { buildCurl, curlToSpec, parseCurl, shellSplit } from '../lib/curl'
import { generateCode } from '../lib/codegen'
import { envTable, findUnresolvedInSpec, resolve, resolveSpec } from '../lib/env'
import { readPath, runExtracts } from '../lib/extract'
import { importAny, importOpenApi, importPostmanCollection } from '../lib/importers'
import { buildTree, collectionPaths } from '../lib/tree'
import { diffLines } from '../lib/diff'
import { runTestsInline } from '../lib/testRunner'
import { base64ToBytes, bytesToBase64, decodeBytes, fuzzy, kv } from '../lib/util'
import { blankRequest, isDescendant } from '../store'
import type { Collection, RequestSpec, ResponseData } from '../types'

const spec = (overrides: Partial<RequestSpec> = {}): RequestSpec => ({ ...blankRequest(), ...overrides })

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
describe('URL and params', () => {
  it('replaces a same-named value already in the URL instead of duplicating it', () => {
    expect(buildUrl('https://a.dev/x?page=1&keep=yes', { page: '2' })).toBe('https://a.dev/x?keep=yes&page=2')
  })

  it('keeps the fragment after the query', () => {
    expect(buildUrl('https://a.dev/x#top', { a: '1' })).toBe('https://a.dev/x?a=1#top')
  })

  it('leaves {{VAR}} readable rather than percent-encoded', () => {
    // URLSearchParams escapes braces; a URL bar full of %7B%7B is unusable.
    expect(buildUrl('https://a.dev/x', { id: '{{USER_ID}}' })).toBe('https://a.dev/x?id={{USER_ID}}')
  })

  it('extractParams and stripQuery invert buildUrl', () => {
    const url = 'https://a.dev/x?a=1&b=two%20words'
    expect(extractParams(url)).toEqual({ a: '1', b: 'two words' })
    expect(stripQuery(url)).toBe('https://a.dev/x')
  })

  it('leaves a URL with no params exactly as typed', () => {
    // Reported: typing "https://u" came back mangled. The URL bar is a pure
    // passthrough and nothing here may rewrite it, so these pin the round trip
    // for the half-typed states a user passes through on the way to a real URL.
    for (const url of ['h', 'https:', 'https:/', 'https://', 'https://u', 'https://u/', '//u', 'u']) {
      expect(buildUrl(url, {}), url).toBe(url)
      expect(stripQuery(url), url).toBe(url)
      expect(extractParams(url), url).toEqual({})
    }
  })

  it('keeps the double slash when params are added to a bare authority', () => {
    expect(buildUrl('https://u', { a: '1' })).toBe('https://u?a=1')
  })

  it('knows which headers the browser refuses to send', () => {
    for (const name of ['Cookie', 'referer', 'Content-Length', 'Sec-Fetch-Mode', 'proxy-authorization']) {
      expect(isForbiddenHeader(name), name).toBe(true)
    }
    for (const name of ['Authorization', 'X-Api-Key', 'Content-Type']) {
      expect(isForbiddenHeader(name), name).toBe(false)
    }
  })
})

describe('prepare', () => {
  it('folds auth, cookies and params into one outgoing request', async () => {
    const prepared = await prepare(
      spec({
        method: 'POST',
        url: 'https://a.dev/login?v=1',
        params: [kv('debug', 'true')],
        cookies: [kv('session', 's1'), kv('lang', 'vi')],
        auth: { type: 'bearer', token: 'tok' },
        bodyMode: 'json',
        body: '{"a":1}',
      }),
    )

    expect(prepared.url).toBe('https://a.dev/login?v=1&debug=true')
    expect(prepared.headers.Authorization).toBe('Bearer tok')
    expect(prepared.headers.Cookie).toBe('session=s1; lang=vi')
    expect(prepared.headers['Content-Type']).toBe('application/json')
    expect(new TextDecoder().decode(prepared.body.bytes!)).toBe('{"a":1}')
  })

  it('encodes non-ASCII basic credentials', async () => {
    const prepared = await prepare(spec({ auth: { type: 'basic', username: 'tí', password: 'mật' } }))
    const decoded = new TextDecoder().decode(base64ToBytes(prepared.headers.Authorization.slice(6)))
    expect(decoded).toBe('tí:mật')
  })

  it('puts an API key in the query when asked', async () => {
    const prepared = await prepare(
      spec({ url: 'https://a.dev/x', auth: { type: 'apikey', keyName: 'k', keyValue: 'v', location: 'query' } }),
    )
    expect(prepared.url).toBe('https://a.dev/x?k=v')
    expect(prepared.headers.k).toBeUndefined()
  })

  it('sends no body for GET even when one is typed', async () => {
    const prepared = await prepare(spec({ method: 'GET', bodyMode: 'json', body: '{"a":1}' }))
    expect(prepared.body.bytes).toBeNull()
  })

  it('builds multipart bytes so uploads survive the proxy', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'a.bin', { type: 'application/octet-stream' })
    const prepared = await prepare(
      spec({ method: 'POST', bodyMode: 'multipart', formFields: [kv('name', 'foo')] }),
      [file],
    )

    expect(prepared.headers['Content-Type']).toMatch(/^multipart\/form-data; boundary=/)
    const text = new TextDecoder().decode(prepared.body.bytes!)
    expect(text).toContain('name="name"')
    expect(text).toContain('filename="a.bin"')
  })

  it('skips disabled rows', async () => {
    const prepared = await prepare(
      spec({ headers: [{ ...kv('X-On', '1') }, { ...kv('X-Off', '2'), enabled: false }] }),
    )
    expect(prepared.headers['X-On']).toBe('1')
    expect(prepared.headers['X-Off']).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
describe('cURL', () => {
  it('parses a multi-line command with backslash continuations', () => {
    const parsed = parseCurl(`curl -X POST 'https://api.example.com/items?limit=10' \\
  -H 'Authorization: Bearer tok' \\
  -H 'Content-Type: application/json' \\
  -d '{"name":"foo"}'`)

    expect(parsed.method).toBe('POST')
    expect(parsed.url).toBe('https://api.example.com/items?limit=10')
    expect(parsed.params).toEqual({ limit: '10' })
    expect(parsed.headers.Authorization).toBe('Bearer tok')
    expect(parsed.data).toBe('{"name":"foo"}')
  })

  it('does not let a boolean flag swallow the URL', () => {
    const parsed = parseCurl("curl --compressed -k -L 'https://api.example.com/x'")
    expect(parsed.url).toBe('https://api.example.com/x')
    expect(parsed.followRedirects).toBe(true)
  })

  it('accepts attached and --flag=value forms', () => {
    const parsed = parseCurl("curl -XPUT --url=https://a.dev/a -H'X-Trace: 1'")
    expect(parsed.method).toBe('PUT')
    expect(parsed.url).toBe('https://a.dev/a')
    expect(parsed.headers['X-Trace']).toBe('1')
  })

  it("handles $'...' quoting from Copy as cURL", () => {
    expect(shellSplit("a $'x\\ny'")).toEqual(['a', 'x\ny'])
  })

  it('refuses a command with no URL rather than sending something odd', () => {
    expect(() => parseCurl('curl -X GET')).toThrow(/Không tìm thấy URL/)
  })

  it('round-trips: what we print is what we can re-import', () => {
    const original = spec({
      method: 'POST',
      url: 'https://api.example.com/items',
      params: [kv('limit', '10')],
      headers: [kv('X-Trace', 'abc')],
      cookies: [kv('session', 's1')],
      auth: { type: 'bearer', token: 'tok' },
      bodyMode: 'json',
      body: '{"name":"foo"}',
    })

    const command = buildCurl(original)
    // Every joined line must end in a backslash, or the shell reads it as
    // several commands and curl reports "no URL specified".
    command.split('\n').slice(0, -1).forEach((line) => expect(line.endsWith('\\')).toBe(true))

    const back = curlToSpec(parseCurl(command))
    expect(back.method).toBe('POST')
    expect(back.url).toBe('https://api.example.com/items')
    expect(back.params.map((p) => [p.key, p.value])).toEqual([['limit', '10']])
    expect(back.auth).toMatchObject({ type: 'bearer', token: 'tok' })
    expect(back.cookies.map((c) => [c.key, c.value])).toEqual([['session', 's1']])
    expect(back.body).toBe('{"name":"foo"}')
  })

  it('escapes single quotes in the body for the shell', () => {
    const command = buildCurl(spec({ method: 'POST', bodyMode: 'json', url: 'https://a.dev', body: `{"q":"it's"}` }))
    expect(command).toContain(`'{"q":"it'\\''s"}'`)
    expect(parseCurl(command).data).toBe(`{"q":"it's"}`)
  })

  it('turns Basic auth in a parsed command back into the auth tab', () => {
    const back = curlToSpec(parseCurl("curl -u 'tí:pass' https://a.dev/"))
    expect(back.auth).toMatchObject({ type: 'basic', username: 'tí', password: 'pass' })
  })
})

// ---------------------------------------------------------------------------
describe('code generation', () => {
  const sample = spec({
    method: 'POST',
    url: 'https://a.dev/items',
    headers: [kv('X-Trace', 'abc')],
    auth: { type: 'bearer', token: 'tok' },
    bodyMode: 'json',
    body: '{"a":1}',
  })

  it('fetch snippet carries url, method, headers and body', () => {
    const code = generateCode(sample, 'fetch')
    expect(code).toContain('"https://a.dev/items"')
    expect(code).toContain('"POST"')
    expect(code).toContain('"Authorization": "Bearer tok"')
    expect(code).toContain('body: "{\\"a\\":1}"')
  })

  it('python snippet is syntactically plausible and complete', () => {
    const code = generateCode(sample, 'python')
    expect(code).toContain('import requests')
    expect(code).toContain('requests.request("POST"')
    expect(code).toContain('headers=headers')
  })

  it('every language produces something non-empty', () => {
    for (const language of ['curl', 'fetch', 'axios', 'python', 'java'] as const) {
      expect(generateCode(sample, language).length, language).toBeGreaterThan(20)
    }
  })

  it('includes auth that lives in the query string', () => {
    const code = generateCode(
      spec({ url: 'https://a.dev/x', auth: { type: 'apikey', keyName: 'k', keyValue: 'v', location: 'query' } }),
      'fetch',
    )
    expect(code).toContain('https://a.dev/x?k=v')
  })
})

// ---------------------------------------------------------------------------
describe('environments', () => {
  const env = { id: 'e1', name: 'Local', vars: [kv('BASE', 'http://localhost:8000'), kv('T', 'abc')] }

  it('substitutes known variables and leaves unknown ones visible', () => {
    const vars = envTable(env)
    expect(resolve('{{BASE}}/users', vars)).toBe('http://localhost:8000/users')
    // Never silently send the literal text "undefined".
    expect(resolve('{{BASE}}/{{MISSING}}', vars)).toBe('http://localhost:8000/{{MISSING}}')
  })

  it('finds every unresolved variable across the whole request', () => {
    const missing = findUnresolvedInSpec(
      spec({
        url: '{{BASE}}/{{X}}',
        headers: [kv('X-{{H}}', '{{T}}')],
        cookies: [kv('s', '{{C}}')],
        bodyMode: 'json',
        body: '{"v":"{{B}}"}',
        auth: { type: 'bearer', token: '{{TOKEN}}' },
      }),
      envTable(env),
    )
    expect(missing.sort()).toEqual(['B', 'C', 'H', 'TOKEN', 'X'])
  })

  it('does not mutate the template when resolving', () => {
    const original = spec({ url: '{{BASE}}/x' })
    const resolved = resolveSpec(original, envTable(env))
    expect(resolved.url).toBe('http://localhost:8000/x')
    expect(original.url).toBe('{{BASE}}/x') // the editor keeps its template
  })

  it('ignores disabled variables', () => {
    const table = envTable({ id: 'e', name: 'e', vars: [{ ...kv('A', '1'), enabled: false }] })
    expect(resolve('{{A}}', table)).toBe('{{A}}')
  })
})

// ---------------------------------------------------------------------------
describe('extract rules', () => {
  it('reads dotted and indexed paths', () => {
    const body = { data: { token: 'abc' }, items: [{ id: 7 }] }
    expect(readPath(body, 'data.token')).toBe('abc')
    expect(readPath(body, 'items.0.id')).toBe(7)
    expect(readPath(body, 'items[0].id')).toBe(7)
    expect(readPath(body, 'nope.deep')).toBeUndefined()
  })

  it('pulls a token out of the body into a variable', () => {
    const outcomes = runExtracts(
      [{ id: '1', enabled: true, source: 'body', path: 'data.token', target: 'ACCESS_TOKEN' }],
      response({ bytes: new TextEncoder().encode('{"data":{"token":"abc"}}') }),
    )
    expect(outcomes).toEqual([{ target: 'ACCESS_TOKEN', value: 'abc' }])
  })

  it('reads headers and status too', () => {
    const outcomes = runExtracts(
      [
        { id: '1', enabled: true, source: 'header', path: 'Content-Type', target: 'CT' },
        { id: '2', enabled: true, source: 'status', path: '', target: 'CODE' },
      ],
      response(),
    )
    expect(outcomes).toEqual([
      { target: 'CT', value: 'application/json' },
      { target: 'CODE', value: '200' },
    ])
  })

  it('reports a missing path instead of storing undefined', () => {
    const [outcome] = runExtracts(
      [{ id: '1', enabled: true, source: 'body', path: 'a.b', target: 'X' }],
      response({ bytes: new TextEncoder().encode('{}') }),
    )
    expect(outcome.value).toBeNull()
    expect(outcome.error).toMatch(/Không tìm thấy/)
  })

  it('skips disabled rules', () => {
    expect(runExtracts([{ id: '1', enabled: false, source: 'status', path: '', target: 'X' }], response())).toEqual([])
  })

  it('serialises a non-string value as JSON', () => {
    const [outcome] = runExtracts(
      [{ id: '1', enabled: true, source: 'body', path: 'ids', target: 'IDS' }],
      response({ bytes: new TextEncoder().encode('{"ids":[1,2]}') }),
    )
    expect(outcome.value).toBe('[1,2]')
  })
})

// ---------------------------------------------------------------------------
describe('test runner sandbox', () => {
  const ctx = {
    status: 200,
    statusText: 'OK',
    timeMs: 12,
    sizeBytes: 20,
    headers: [['content-type', 'application/json']] as [string, string][],
    bodyText: '{"id":7,"name":"foo","tags":["a"]}',
    env: { BASE: 'x' },
  }

  it('reports passes and failures separately', () => {
    const outcome = runTestsInline(
      `pm.test("ok", () => pm.response.to.have.status(200))
       pm.test("bad", () => pm.response.to.have.status(404))`,
      ctx,
    )
    expect(outcome.results[0]).toMatchObject({ name: 'ok', passed: true })
    expect(outcome.results[1].passed).toBe(false)
    expect(outcome.results[1].error).toContain('404')
  })

  it('supports the expect chain', () => {
    const outcome = runTestsInline(
      `const body = pm.response.json()
       pm.test("property", () => pm.expect(body).to.have.property("id", 7))
       pm.test("include", () => pm.expect(body.tags).to.include("a"))
       pm.test("above", () => pm.expect(body.id).to.be.above(3))
       pm.test("negation", () => pm.expect(body.name).to.not.equal("bar"))
       pm.test("eql", () => pm.expect(body.tags).to.eql(["a"]))`,
      ctx,
    )
    expect(outcome.results.every((r) => r.passed)).toBe(true)
  })

  it('collects variables the script sets', () => {
    const outcome = runTestsInline('pm.environment.set("TOKEN", pm.response.json().id)', ctx)
    expect(outcome.envSets).toEqual({ TOKEN: '7' })
  })

  it('reports a syntax error rather than throwing into the app', () => {
    const outcome = runTestsInline('this is not javascript', ctx)
    expect(outcome.error).toBeTruthy()
    expect(outcome.results).toEqual([])
  })

  it('a failing assertion inside one test does not stop the next', () => {
    const outcome = runTestsInline(
      `pm.test("a", () => { throw new Error("boom") })
       pm.test("b", () => pm.expect(1).to.equal(1))`,
      ctx,
    )
    expect(outcome.results.map((r) => r.passed)).toEqual([false, true])
  })

  it('cannot reach the page it runs on', () => {
    // The worker has no DOM; the inline fallback must not offer one either.
    const outcome = runTestsInline('pm.test("dom", () => pm.expect(typeof document).to.equal("undefined"))', {
      ...ctx,
    })
    // jsdom does define `document` globally, so this only asserts the script is
    // not *handed* any app state - it gets exactly pm, console and the body.
    expect(outcome.results).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
describe('importers', () => {
  const postmanDoc = {
    info: { name: 'Demo', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
    item: [
      {
        name: 'Auth',
        item: [
          {
            name: 'Login',
            request: {
              method: 'POST',
              header: [{ key: 'Content-Type', value: 'application/json' }],
              url: { raw: 'https://a.dev/login?v=1', query: [{ key: 'v', value: '1' }] },
              body: { mode: 'raw', raw: '{"u":"x"}', options: { raw: { language: 'json' } } },
              auth: { type: 'bearer', bearer: [{ key: 'token', value: 'tok' }] },
            },
            event: [{ listen: 'test', script: { exec: ['pm.test("ok", () => {})'] } }],
          },
        ],
      },
    ],
    variable: [{ key: 'BASE', value: 'https://a.dev' }],
  }

  it('imports a Postman v2.1 collection with folders, auth, body and tests', () => {
    const result = importPostmanCollection(postmanDoc)
    expect(result.collections.map((c) => c.name)).toEqual(['Demo', 'Auth'])

    const [request] = result.requests
    expect(request.method).toBe('POST')
    expect(request.url).toBe('https://a.dev/login')
    expect(request.params.map((p) => p.key)).toEqual(['v'])
    expect(request.bodyMode).toBe('json')
    expect(request.auth).toMatchObject({ type: 'bearer', token: 'tok' })
    expect(request.tests).toContain('pm.test')
    expect(result.environments[0].vars[0].key).toBe('BASE')
  })

  it('nests folders under the right parent', () => {
    const result = importPostmanCollection(postmanDoc)
    const root = result.collections[0]
    const folder = result.collections[1]
    expect(folder.parentId).toBe(root.id)
    expect(result.requests[0].collectionId).toBe(folder.id)
  })

  it('rejects something that is not a collection', () => {
    expect(() => importPostmanCollection({ hello: 'world' })).toThrow(/Postman Collection/)
  })

  it('imports OpenAPI 3, turning path params and the server into variables', () => {
    const result = importOpenApi({
      openapi: '3.0.0',
      info: { title: 'Demo API' },
      servers: [{ url: 'https://api.demo.dev/v1' }],
      paths: {
        '/users/{userId}': {
          get: {
            summary: 'Get user',
            tags: ['Users'],
            parameters: [
              { name: 'userId', in: 'path', required: true, schema: { type: 'string' } },
              { name: 'expand', in: 'query', schema: { type: 'string' } },
            ],
          },
          post: {
            summary: 'Update user',
            tags: ['Users'],
            requestBody: {
              content: { 'application/json': { schema: { type: 'object', properties: { name: { type: 'string' } } } } },
            },
          },
        },
      },
    })

    expect(result.requests).toHaveLength(2)
    const get = result.requests.find((r) => r.method === 'GET')!
    expect(get.url).toBe('{{BASE_URL}}/users/{{userId}}')
    expect(get.params.map((p) => p.key)).toEqual(['expand'])
    expect(result.environments[0].vars[0].value).toBe('https://api.demo.dev/v1')

    const post = result.requests.find((r) => r.method === 'POST')!
    expect(post.bodyMode).toBe('json')
    expect(JSON.parse(post.body)).toEqual({ name: 'string' })
  })

  it('groups OpenAPI endpoints into one collection per tag', () => {
    const result = importOpenApi({
      openapi: '3.0.0',
      info: { title: 'T' },
      paths: {
        '/a': { get: { tags: ['Alpha'] } },
        '/b': { get: { tags: ['Beta'] } },
      },
    })
    expect(result.collections.map((c) => c.name)).toEqual(['T', 'Alpha', 'Beta'])
  })

  it('survives a $ref cycle instead of blowing the stack', () => {
    const result = importOpenApi({
      openapi: '3.0.0',
      info: { title: 'T' },
      components: { schemas: { Node: { type: 'object', properties: { next: { $ref: '#/components/schemas/Node' } } } } },
      paths: {
        '/n': {
          post: { requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/Node' } } } } },
        },
      },
    })
    expect(result.requests).toHaveLength(1)
  })

  it('sniffs the format so the user does not have to say which it is', () => {
    expect(importAny(JSON.stringify(postmanDoc)).requests).toHaveLength(1)
    expect(importAny(JSON.stringify({ openapi: '3.0.0', info: { title: 'x' }, paths: {} })).collections).toHaveLength(1)
    expect(() => importAny('{"unknown":1}')).toThrow(/Không nhận diện/)
    expect(() => importAny('not json')).toThrow(/JSON không hợp lệ/)
  })
})

// ---------------------------------------------------------------------------
describe('tree', () => {
  const collections: Collection[] = [
    { id: 'a', name: 'Alpha', parentId: null },
    { id: 'b', name: 'Beta', parentId: 'a' },
    { id: 'orphan', name: 'Orphan', parentId: 'deleted' },
  ]
  const requests = [
    spec({ id: 'r1', name: 'Login', url: 'https://a.dev/login', collectionId: 'b' }),
    spec({ id: 'r2', name: 'Loose', url: 'https://a.dev/x', collectionId: null }),
  ]

  it('nests collections and requests', () => {
    const tree = buildTree(collections, requests, '')
    expect(tree.map((n) => n.data.name)).toEqual(['Alpha', 'Orphan', 'Loose'])
    const alpha = tree[0] as Extract<(typeof tree)[number], { kind: 'collection' }>
    expect(alpha.children[0].data.name).toBe('Beta')
  })

  it('surfaces a collection whose parent was deleted instead of hiding it', () => {
    expect(buildTree(collections, [], '').some((n) => n.data.name === 'Orphan')).toBe(true)
  })

  it('a collection matching by name keeps its whole subtree', () => {
    const tree = buildTree(collections, requests, 'alpha')
    const alpha = tree[0] as Extract<(typeof tree)[number], { kind: 'collection' }>
    // Hiding the children would hide exactly what the user searched for.
    expect(alpha.children).toHaveLength(1)
  })

  it('matches requests by URL as well as name', () => {
    const tree = buildTree(collections, requests, 'login')
    expect(tree).toHaveLength(1)
  })

  it('labels nested collections with their full path', () => {
    expect(collectionPaths(collections).find((p) => p.id === 'b')?.path).toBe('Alpha / Beta')
  })

  it('refuses the drag that would detach a subtree', () => {
    expect(isDescendant(collections, 'a', 'b')).toBe(true) // dropping a into b
    expect(isDescendant(collections, 'b', 'a')).toBe(false) // dropping b into a is fine
  })
})

// ---------------------------------------------------------------------------
describe('diff', () => {
  it('marks added, removed and unchanged lines', () => {
    const rows = diffLines('a\nb\nc', 'a\nx\nc')
    expect(rows.filter((r) => r.leftClass === 'diff-removed').map((r) => r.left)).toEqual(['b'])
    expect(rows.filter((r) => r.rightClass === 'diff-added').map((r) => r.right)).toEqual(['x'])
    expect(rows.filter((r) => !r.leftClass && !r.rightClass)).toHaveLength(2)
  })

  it('reports no differences for identical input', () => {
    expect(diffLines('same\ntext', 'same\ntext').every((r) => !r.leftClass && !r.rightClass)).toBe(true)
  })

  it('caps the work so a huge body cannot lock the UI', () => {
    const big = Array.from({ length: 9000 }, (_, i) => String(i)).join('\n')
    expect(diffLines(big, big, 100)).toHaveLength(100)
  })
})

// ---------------------------------------------------------------------------
describe('binary-safe helpers', () => {
  it('round-trips bytes through base64 without corrupting them', () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff, 0xfe])
    expect([...base64ToBytes(bytesToBase64(bytes))]).toEqual([...bytes])
  })

  it('decodes using the charset the response declared', () => {
    const bytes = new TextEncoder().encode('xin chào')
    expect(decodeBytes(bytes, 'text/plain; charset=utf-8')).toBe('xin chào')
    // An unknown charset must fall back rather than throw.
    expect(decodeBytes(bytes, 'text/plain; charset=nonsense-9')).toBe('xin chào')
  })

  it('fuzzy matches a subsequence', () => {
    expect(fuzzy('open request', 'opnrq')).toBe(true)
    expect(fuzzy('open request', 'zzz')).toBe(false)
  })
})
