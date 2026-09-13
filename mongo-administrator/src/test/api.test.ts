import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError, __testing, api, configureApi } from '../lib/api'

const { buildUrl, readEnvelope } = __testing

function envelope(data: unknown, status = 200, message = 'OK') {
  return new Response(JSON.stringify({ status_code: status, message, data }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  configureApi({ getToken: () => 'tok-123', onUnauthorized: () => {} })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function lastCall() {
  const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit]
  return { url, init, headers: (init?.headers ?? {}) as Record<string, string> }
}

describe('buildUrl', () => {
  it('leaves a path alone without a query', () => {
    expect(buildUrl('/mongoadmin/databases')).toBe('/mongoadmin/databases')
  })

  it('appends only the parameters that have a value', () => {
    const url = buildUrl('/x', { a: 1, b: undefined, c: null, d: '', e: false })
    expect(url).toBe('/x?a=1&e=false')
  })

  it('encodes parameter values', () => {
    expect(buildUrl('/x', { filter: '{"a": 1}' })).toContain('filter=%7B%22a%22%3A+1%7D')
  })
})

describe('readEnvelope', () => {
  it('parses a JSON envelope', async () => {
    expect(await readEnvelope(envelope({ n: 1 }))).toEqual({ status_code: 200, message: 'OK', data: { n: 1 } })
  })

  it('wraps a non-JSON body as the message', async () => {
    const result = await readEnvelope(new Response('gateway down', { status: 502 }))
    expect(result?.message).toBe('gateway down')
  })

  it('returns null for an empty body', async () => {
    expect(await readEnvelope(new Response(null, { status: 204 }))).toBeNull()
  })
})

describe('request plumbing', () => {
  it('sends the session token', async () => {
    fetchMock.mockResolvedValue(envelope([]))
    await api.listDatabases()
    expect(lastCall().headers['X-Session-Token']).toBe('tok-123')
  })

  it('omits the token header when there is none', async () => {
    configureApi({ getToken: () => null })
    fetchMock.mockResolvedValue(envelope([]))
    await api.listDatabases()
    expect(lastCall().headers['X-Session-Token']).toBeUndefined()
  })

  it('sets a JSON content type only when there is a body', async () => {
    fetchMock.mockResolvedValue(envelope(null))
    await api.listDatabases()
    expect(lastCall().headers['Content-Type']).toBeUndefined()

    fetchMock.mockResolvedValue(envelope(null, 201))
    await api.createDatabase('shop')
    expect(lastCall().headers['Content-Type']).toBe('application/json')
  })

  it('unwraps data from the envelope', async () => {
    fetchMock.mockResolvedValue(envelope([{ name: 'shop' }]))
    await expect(api.listDatabases()).resolves.toEqual([{ name: 'shop' }])
  })

  it('turns a non-2xx envelope into an ApiError carrying the message', async () => {
    fetchMock.mockResolvedValue(envelope(null, 400, 'a filter must be an object'))
    await expect(api.listDatabases()).rejects.toMatchObject({
      name: 'ApiError',
      status: 400,
      message: 'a filter must be an object',
    })
  })

  it('reports a network failure as a reachability problem', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    const error = (await api.listDatabases().catch((caught) => caught)) as ApiError
    expect(error.status).toBe(0)
    expect(error.message).toMatch(/Cannot reach the API bridge/)
  })

  it('calls onUnauthorized for a 401 and flags the error', async () => {
    const onUnauthorized = vi.fn()
    configureApi({ getToken: () => 'tok-123', onUnauthorized })
    fetchMock.mockResolvedValue(envelope(null, 401, 'Session expired'))

    const error = (await api.currentSession().catch((caught) => caught)) as ApiError
    expect(onUnauthorized).toHaveBeenCalledOnce()
    expect(error.isAuthError).toBe(true)
  })

  it('does not flag other statuses as auth errors', async () => {
    fetchMock.mockResolvedValue(envelope(null, 404, 'nope'))
    const error = (await api.listDatabases().catch((caught) => caught)) as ApiError
    expect(error.isAuthError).toBe(false)
  })
})

describe('endpoints', () => {
  // A Response body can only be read once, so build a fresh one per call.
  beforeEach(() => fetchMock.mockImplementation(() => envelope(null)))

  it('connect posts the payload', async () => {
    await api.connect({ host: 'db.local', port: 27017 })
    const { url, init } = lastCall()
    expect(url).toBe('/mongoadmin/sessions')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({ host: 'db.local', port: 27017 })
  })

  it('disconnect uses DELETE on the current session', async () => {
    await api.disconnect()
    expect(lastCall().url).toBe('/mongoadmin/sessions/current')
    expect(lastCall().init.method).toBe('DELETE')
  })

  it('encodes database and collection names', async () => {
    await api.listIndexes('my db', 'orders/2026')
    expect(lastCall().url).toBe('/mongoadmin/databases/my%20db/collections/orders%2F2026/indexes')
  })

  it('find posts the whole request', async () => {
    await api.findDocuments('shop', 'orders', { filter: { a: 1 }, limit: 10, skip: 20 })
    const { url, init } = lastCall()
    expect(url).toBe('/mongoadmin/databases/shop/collections/orders/documents/find')
    expect(JSON.parse(init.body as string)).toEqual({ filter: { a: 1 }, limit: 10, skip: 20 })
  })

  it('insert posts to the documents root', async () => {
    await api.insertDocuments('shop', 'orders', { a: 1 })
    expect(lastCall().url).toBe('/mongoadmin/databases/shop/collections/orders/documents')
    expect(lastCall().init.method).toBe('POST')
  })

  it('update uses PATCH', async () => {
    await api.updateDocuments('shop', 'orders', { filter: { _id: 1 }, update: { $set: { a: 2 } } })
    expect(lastCall().init.method).toBe('PATCH')
  })

  it('delete posts a filter to a sub-path, never DELETE with a body', async () => {
    await api.deleteDocuments('shop', 'orders', { _id: 1 }, true)
    expect(lastCall().url).toBe('/mongoadmin/databases/shop/collections/orders/documents/delete')
    expect(JSON.parse(lastCall().init.body as string)).toEqual({ filter: { _id: 1 }, many: true })
  })

  it('with_stats is only sent when asked for', async () => {
    await api.listCollections('shop')
    expect(lastCall().url).toBe('/mongoadmin/databases/shop/collections')
    await api.listCollections('shop', true)
    expect(lastCall().url).toBe('/mongoadmin/databases/shop/collections?with_stats=true')
  })

  it('aggregate posts the pipeline and a row cap', async () => {
    await api.aggregate('shop', 'orders', [{ $match: {} }], 50)
    expect(JSON.parse(lastCall().init.body as string)).toEqual({
      pipeline: [{ $match: {} }],
      max_rows: 50,
    })
  })

  it('runCommand defaults the database to null', async () => {
    await api.runCommand({ ping: 1 })
    expect(JSON.parse(lastCall().init.body as string)).toEqual({ command: { ping: 1 }, database: null })
  })

  it('dropIndex encodes the index name', async () => {
    await api.dropIndex('shop', 'orders', 'a_1 b_-1')
    expect(lastCall().url).toContain('/indexes/a_1%20b_-1')
  })
})

describe('export', () => {
  it('returns a blob and a filename', async () => {
    fetchMock.mockResolvedValue(new Response('[]', { status: 200 }))
    const result = await api.exportCollection('shop', 'orders', 'json', 10, '{"a":1}')
    expect(lastCall().url).toContain('format=json')
    expect(lastCall().url).toContain('limit=10')
    expect(result.filename).toBe('shop.orders.json')
    expect(await result.blob.text()).toBe('[]')
  })

  it('raises the server message when the export fails', async () => {
    fetchMock.mockResolvedValue(envelope(null, 400, 'format must be one of json, jsonl or csv'))
    await expect(api.exportCollection('shop', 'orders', 'json')).rejects.toThrow(
      'format must be one of json, jsonl or csv',
    )
  })
})
