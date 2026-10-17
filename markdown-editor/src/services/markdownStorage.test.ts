import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  SESSION_KEY,
  clearAdminCredentials,
  hasAdminCredential,
  recheckAdminSession,
  restoreAdminSession
} from './markdownStorage'

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
