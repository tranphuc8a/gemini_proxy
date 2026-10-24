import { afterEach, describe, expect, it, vi } from 'vitest'
import { SyncError, createHttpSyncApi } from './markdownSync'

type Call = [string, RequestInit]

function api(respond: (url: string, init: RequestInit) => Response | Promise<Response>, headers: () => Record<string, string> = () => ({ 'X-Admin-Session': 'tok' })) {
  const calls: Call[] = []
  const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push([String(input), init ?? {}])
    return respond(String(input), init ?? {})
  }) as unknown as typeof fetch
  return { client: createHttpSyncApi({ backend: 'mysql', headers, fetchImpl }), calls }
}

const json = (body: unknown, status = 200, extra: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers: extra })

afterEach(() => vi.useRealTimers())

describe('the delta-sync client', () => {
  it('pulls with the backend, cursor, device and limit in the query, and the admin header handed in', async () => {
    const { client, calls } = api(() => json({ items: [], cursor: 5, more: false, horizon: 0, reset: false }))
    const page = await client.changes({ since: 41, limit: 200, device: 'md-abc' })
    expect(page.cursor).toBe(5)
    expect(calls[0][0]).toBe('/markdown/sync/changes?backend=mysql&since=41&device=md-abc&limit=200')
    expect(calls[0][1].method).toBe('GET')
    expect(calls[0][1].headers).toMatchObject({ 'X-Admin-Session': 'tok' })
    expect(calls[0][1].credentials).toBe('omit')
    expect(calls[0][1].cache).toBe('no-store')
  })

  it('reads the header again on every request (the session may change under a running engine)', async () => {
    let token = 'one'
    const { client, calls } = api(() => json({ items: [], cursor: 0, more: false, horizon: 0, reset: false }), () => ({ 'X-Admin-Session': token }))
    await client.changes({ since: 0, device: 'd' })
    token = 'two'
    await client.changes({ since: 0, device: 'd' })
    expect((calls[0][1].headers as Record<string, string>)['X-Admin-Session']).toBe('one')
    expect((calls[1][1].headers as Record<string, string>)['X-Admin-Session']).toBe('two')
  })

  it('pushes the ops as JSON to /sync/push and returns the results', async () => {
    const op = { id: 'a', kind: 'file' as const, baseRev: 0, content: 'x', hash: 'h'.repeat(64), updatedAt: 1 }
    const { client, calls } = api(() => json({ results: [{ id: 'a', status: 'ok', rev: 1, contentRev: 1, metaRev: 1, hash: 'h', serverUpdatedAt: 3 }], serverTime: 9 }))
    const response = await client.push({ device: 'md-abc', ops: [op] })
    expect(response.results[0].status).toBe('ok')
    expect(calls[0][0]).toBe('/markdown/sync/push?backend=mysql')
    expect(calls[0][1].method).toBe('POST')
    expect(JSON.parse(String(calls[0][1].body))).toEqual({ device: 'md-abc', ops: [op] })
    expect((calls[0][1].headers as Record<string, string>)['Content-Type']).toBe('application/json')
  })

  it('fetches one document by an encoded id', async () => {
    const { client, calls } = api(() => json({ id: 'a b', kind: 'file', content: 'x' }))
    await client.getDoc('a b')
    expect(calls[0][0]).toBe('/markdown/docs/a%20b?backend=mysql')
  })

  it('turns an error envelope into a SyncError with its code, status and Retry-After', async () => {
    const { client } = api(() => json({ message: 'bận', data: { code: 'md_busy' } }, 503, { 'Retry-After': '7' }))
    const error = await client.push({ device: 'd', ops: [] }).catch((e) => e)
    expect(error).toBeInstanceOf(SyncError)
    expect(error).toMatchObject({ status: 503, code: 'md_busy', retryAfter: 7, offline: false })
    expect(error.message).toMatch(/storage is busy/)
  })

  it('explains a private server and a locked-out address in English', async () => {
    const priv = await api(() => json({ message: 'riêng', data: { code: 'markdown_private' } }, 403)).client.changes({ since: 0, device: 'd' }).catch((e) => e)
    expect(priv.message).toMatch(/private\. Unlock admin mode/)
    const locked = await api(() => json({ message: 'khoá', data: { code: 'markdown_admin_locked', retryAfter: 120 } }, 429)).client.changes({ since: 0, device: 'd' }).catch((e) => e)
    expect(locked.message).toMatch(/Try again in 120 s/)
    expect(locked.retryAfter).toBe(120)
  })

  it('keeps the server\'s own sentence for a code it does not know, and a plain one with no body', async () => {
    const odd = await api(() => json({ message: 'Lỗi lạ', data: { code: 'md_unheard_of' } }, 500)).client.changes({ since: 0, device: 'd' }).catch((e) => e)
    expect(odd.message).toBe('Lỗi lạ')
    const bare = await api(() => new Response('<html>', { status: 502 })).client.changes({ since: 0, device: 'd' }).catch((e) => e)
    expect(bare.message).toBe('The server answered 502.')
  })

  it('says offline when nobody answers', async () => {
    const client = createHttpSyncApi({ backend: 'json', headers: () => ({}), fetchImpl: (async () => { throw new TypeError('network') }) as unknown as typeof fetch })
    const error = await client.changes({ since: 0, device: 'd' }).catch((e) => e)
    expect(error).toBeInstanceOf(SyncError)
    expect(error.offline).toBe(true)
    expect(error.status).toBe(0)
  })

  it('gives up on a server that never answers', async () => {
    vi.useFakeTimers()
    const hang = ((_: RequestInfo | URL, init?: RequestInit) => new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))))) as unknown as typeof fetch
    const client = createHttpSyncApi({ backend: 'json', headers: () => ({}), fetchImpl: hang })
    const pending = client.changes({ since: 0, device: 'd' }).catch((e) => e)
    await vi.advanceTimersByTimeAsync(40_000)
    const error = await pending
    expect(error).toBeInstanceOf(SyncError)
    expect(error.offline).toBe(true)
    expect(error.message).toMatch(/did not answer/)
  })

  it('refuses a 200 that is not JSON', async () => {
    const { client } = api(() => new Response('nope', { status: 200 }))
    const error = await client.changes({ since: 0, device: 'd' }).catch((e) => e)
    expect(error).toBeInstanceOf(SyncError)
    expect(error.message).toMatch(/not JSON/)
  })
})
