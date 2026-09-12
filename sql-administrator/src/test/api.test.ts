import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError, api, configureApi } from '../lib/api'

function jsonResponse(data: unknown, status = 200, message = 'OK') {
  return new Response(JSON.stringify({ status_code: status, message, data }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  configureApi({ getToken: () => 'tok-123', onUnauthorized: () => {} })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function lastCall() {
  const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit]
  return { url, init, headers: (init?.headers ?? {}) as Record<string, string> }
}

describe('envelope handling', () => {
  it('unwraps the data field', async () => {
    fetchMock.mockResolvedValue(jsonResponse([{ name: 'shop', charset: 'utf8mb4', collation: null }]))
    await expect(api.listDatabases()).resolves.toEqual([{ name: 'shop', charset: 'utf8mb4', collation: null }])
  })

  it('raises ApiError carrying the server message', async () => {
    fetchMock.mockResolvedValue(jsonResponse(null, 400, 'You have an error in your SQL syntax'))
    await expect(api.runSql('BOOM')).rejects.toThrow('You have an error in your SQL syntax')
  })

  it('marks a 401 as an auth error and notifies the listener', async () => {
    const onUnauthorized = vi.fn()
    configureApi({ getToken: () => 'tok-123', onUnauthorized })
    fetchMock.mockResolvedValue(jsonResponse(null, 401, 'Session expired'))

    await expect(api.currentSession()).rejects.toMatchObject({ status: 401 })
    expect(onUnauthorized).toHaveBeenCalledOnce()
  })

  it('turns a network failure into a readable error', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    const error = await api.listDatabases().catch((caught) => caught)
    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(0)
    expect(error.message).toMatch(/Cannot reach the API bridge/)
  })

  it('tolerates a non-JSON error body', async () => {
    fetchMock.mockResolvedValue(new Response('<html>502</html>', { status: 502 }))
    await expect(api.listDatabases()).rejects.toThrow('<html>502</html>')
  })

  it('handles an empty 200 body', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 200 }))
    await expect(api.listDatabases()).resolves.toBeNull()
  })
})

describe('request shape', () => {
  // A Response body can only be read once, so each call needs a fresh one.
  beforeEach(() => fetchMock.mockImplementation(async () => jsonResponse(null)))

  it('sends the session token header', async () => {
    await api.listDatabases()
    expect(lastCall().headers['X-Session-Token']).toBe('tok-123')
  })

  it('omits the token header when there is no session', async () => {
    configureApi({ getToken: () => null })
    await api.listDatabases()
    expect(lastCall().headers['X-Session-Token']).toBeUndefined()
  })

  it('sets a JSON content type only when there is a body', async () => {
    await api.listDatabases()
    expect(lastCall().headers['Content-Type']).toBeUndefined()

    await api.createDatabase('shop')
    expect(lastCall().headers['Content-Type']).toBe('application/json')
  })

  it('encodes database and table names in the path', async () => {
    await api.tableStructure('my db', 'odd/table')
    expect(lastCall().url).toBe('/sqladmin/databases/my%20db/tables/odd%2Ftable/structure')
  })

  it('builds browse query parameters and drops the empty ones', async () => {
    await api.browseRows('shop', 'users', { limit: 25, offset: 50, orderBy: 'name', direction: 'desc' })
    const { url } = lastCall()
    expect(url).toContain('limit=25')
    expect(url).toContain('offset=50')
    expect(url).toContain('order_by=name')
    expect(url).toContain('direction=desc')
    expect(url).not.toContain('search=')
  })

  it('sends an offset of zero rather than dropping it', async () => {
    await api.browseRows('shop', 'users', { limit: 10, offset: 0 })
    expect(lastCall().url).toContain('offset=0')
  })

  it('posts insert values under a values key', async () => {
    await api.insertRow('shop', 'users', { name: 'ann' })
    const { init } = lastCall()
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body))).toEqual({ values: { name: 'ann' } })
  })

  it('patches an update with both values and key', async () => {
    await api.updateRow('shop', 'users', { name: 'bo' }, { id: 1 })
    const { init } = lastCall()
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(String(init.body))).toEqual({ values: { name: 'bo' }, key: { id: 1 } })
  })

  it('posts deletes to a sub-path so the keys can travel in the body', async () => {
    await api.deleteRows('shop', 'users', [{ id: 1 }])
    const { url, init } = lastCall()
    expect(url).toBe('/sqladmin/databases/shop/tables/users/rows/delete')
    expect(JSON.parse(String(init.body))).toEqual({ keys: [{ id: 1 }] })
  })

  it('sends the console payload with its row cap', async () => {
    await api.runSql('SELECT 1', 'shop', 100)
    expect(JSON.parse(String(lastCall().init.body))).toEqual({ sql: 'SELECT 1', database: 'shop', max_rows: 100 })
  })

  it('normalises a missing database to null', async () => {
    await api.runSql('SELECT 1')
    expect(JSON.parse(String(lastCall().init.body)).database).toBeNull()
  })
})

describe('export', () => {
  it('returns a blob and a filename', async () => {
    fetchMock.mockResolvedValue(new Response('id\n1\n', { status: 200, headers: { 'Content-Type': 'text/csv' } }))
    const result = await api.exportTable('shop', 'users', 'csv')
    expect(result.filename).toBe('shop.users.csv')
    expect(await result.blob.text()).toBe('id\n1\n')
  })

  it('raises with the server message when the export fails', async () => {
    fetchMock.mockResolvedValue(jsonResponse(null, 400, 'Export format must be one of: csv, json, sql'))
    await expect(api.exportTable('shop', 'users', 'csv')).rejects.toThrow(/Export format/)
  })
})
