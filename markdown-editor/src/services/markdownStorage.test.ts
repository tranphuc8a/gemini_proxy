import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  SESSION_KEY,
  adminSessionHeaders,
  clearAdminCredentials,
  hasAdminCredential,
  recheckAdminSession,
  restoreAdminSession,
  setAdminSession,
  verifyAdminKey
} from './markdownStorage'
import { SyncError, createHttpSyncApi } from './markdownSync'

/**
 * Admin mode across reloads, and across a lost connection.
 *
 * The installed app has to stay editable with no network, but the server remains the authority:
 * a device that is merely "online with a dead server" keeps the old view-only answer, and only an
 * explicit rejection after reconnecting takes the session away.
 */

const TOKEN = 'stored.token'

function answer(status: number, body: unknown = { session: 'fresh.token', expiresAt: 1 }) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status }))
}

function setOnline(online: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => online })
}

beforeEach(() => {
  clearAdminCredentials()
  localStorage.setItem(SESSION_KEY, TOKEN)
  setOnline(true)
})

afterEach(() => {
  vi.unstubAllGlobals()
  clearAdminCredentials()
  setOnline(true)
})

describe('restoreAdminSession', () => {
  it('is view-only when no session was ever stored', async () => {
    localStorage.removeItem(SESSION_KEY)
    vi.stubGlobal('fetch', answer(200))
    expect(await restoreAdminSession()).toBe(false)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('unlocks and swaps in the fresh token the server hands back', async () => {
    vi.stubGlobal('fetch', answer(200))
    expect(await restoreAdminSession()).toBe(true)
    expect(hasAdminCredential()).toBe(true)
    expect(localStorage.getItem(SESSION_KEY)).toBe('fresh.token')
  })

  it('forgets a token the server rejects', async () => {
    vi.stubGlobal('fetch', answer(401, { message: 'expired' }))
    expect(await restoreAdminSession()).toBe(false)
    expect(hasAdminCredential()).toBe(false)
    expect(localStorage.getItem(SESSION_KEY)).toBeNull()
  })

  it('stays view-only, but keeps the token, when the server is down and the device is online', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))))
    expect(await restoreAdminSession()).toBe(false)
    expect(hasAdminCredential()).toBe(false)
    expect(localStorage.getItem(SESSION_KEY)).toBe(TOKEN)
  })

  it('trusts the stored token while the device has no network at all', async () => {
    // The installed-app case: the owner opens the editor on a plane and keeps working.
    setOnline(false)
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))))
    expect(await restoreAdminSession()).toBe(true)
    expect(hasAdminCredential()).toBe(true)
    expect(localStorage.getItem(SESSION_KEY)).toBe(TOKEN)
  })

  it('does not unlock offline without a stored token', async () => {
    localStorage.removeItem(SESSION_KEY)
    setOnline(false)
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))))
    expect(await restoreAdminSession()).toBe(false)
    expect(hasAdminCredential()).toBe(false)
  })
})

describe('recheckAdminSession', () => {
  async function trustedOffline() {
    setOnline(false)
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))))
    await restoreAdminSession()
    setOnline(true)
  }

  it('settles a token trusted offline: the server still accepts it', async () => {
    await trustedOffline()
    vi.stubGlobal('fetch', answer(200))
    expect(await recheckAdminSession()).toBe('valid')
    expect(hasAdminCredential()).toBe(true)
    expect(localStorage.getItem(SESSION_KEY)).toBe('fresh.token')
  })

  it('takes the session away when the server now rejects it', async () => {
    await trustedOffline()
    vi.stubGlobal('fetch', answer(403, { message: 'key rotated' }))
    expect(await recheckAdminSession()).toBe('rejected')
    expect(hasAdminCredential()).toBe(false)
    expect(localStorage.getItem(SESSION_KEY)).toBeNull()
  })

  it('does not sign anyone out because the connection is still flaky', async () => {
    await trustedOffline()
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))))
    expect(await recheckAdminSession()).toBe('unreachable')
    expect(hasAdminCredential()).toBe(true)
    expect(localStorage.getItem(SESSION_KEY)).toBe(TOKEN)
  })

  it('reports a rejection when there is nothing to check', async () => {
    localStorage.removeItem(SESSION_KEY)
    vi.stubGlobal('fetch', answer(200))
    expect(await recheckAdminSession()).toBe('rejected')
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('the private store and the hardened admin key (M3: Q1, B0)', () => {
  it('a locked-out address (429) keeps the stored session instead of signing the owner out', async () => {
    vi.stubGlobal('fetch', answer(429, { message: 'x', data: { code: 'markdown_admin_locked', retryAfter: 60 } }))
    expect(await restoreAdminSession()).toBe(false)
    expect(localStorage.getItem(SESSION_KEY)).toBe(TOKEN)
  })

  it('the sync client sends the admin session (the store is private by default)', async () => {
    setAdminSession('admin.token')
    const fetchMock = vi.fn(
      async (_url: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({ items: [], cursor: 0, more: false, horizon: 0, reset: false }), { status: 200 })
    )
    await createHttpSyncApi({ backend: 'json', headers: adminSessionHeaders, fetchImpl: fetchMock as unknown as typeof fetch }).changes({ since: 0, device: 'md-test' })
    expect((fetchMock.mock.calls[0][1]?.headers as Record<string, string>)['X-Admin-Session']).toBe('admin.token')
    expect(adminSessionHeaders()).toEqual({ 'X-Admin-Session': 'admin.token' })
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/markdown\/sync\/changes\?backend=json&since=0&device=md-test$/)
  })

  it('a guest refused by a private store gets a SyncError with the code and a clear message', async () => {
    const refused = answer(403, { message: 'riêng tư', data: { code: 'markdown_private' } })
    const error = await createHttpSyncApi({ backend: 'json', headers: () => ({}), fetchImpl: refused as unknown as typeof fetch })
      .changes({ since: 0, device: 'md-test' })
      .catch((e) => e)
    expect(error).toBeInstanceOf(SyncError)
    expect(error.code).toBe('markdown_private')
    expect(error.message).toMatch(/private\. Unlock admin mode/)
  })

  it('verifyAdminKey: a wrong key is false; the refused default key and a lock-out explain themselves', async () => {
    vi.stubGlobal('fetch', answer(403, { message: 'sai', data: { code: 'markdown_admin_invalid' } }))
    expect(await verifyAdminKey('nope')).toBe(false)
    vi.stubGlobal('fetch', answer(403, { message: 'mặc định', data: { code: 'markdown_default_key_refused' } }))
    await expect(verifyAdminKey('markdown-editor-admin-2024')).rejects.toThrow(/default admin key/)
    vi.stubGlobal('fetch', answer(429, { message: 'khoá', data: { code: 'markdown_admin_locked', retryAfter: 120 } }))
    await expect(verifyAdminKey('x')).rejects.toThrow(/Try again in 120 s/)
  })
})
