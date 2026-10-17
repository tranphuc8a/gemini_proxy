import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { initPwa, installState, offlineStatus, promptInstall, subscribeInstall } from './pwa'

/**
 * The page's half of "use it offline": what to offer, and how far the worker got.
 * The worker itself (pwa/sw.js) is exercised in a real browser, not here.
 */

const SCOPE = new URL('./', document.baseURI).href
const CACHE = `mdpro:${SCOPE}:abc123`

function stubCaches(entries: Record<string, Record<string, unknown>>) {
  vi.stubGlobal('caches', {
    keys: async () => Object.keys(entries),
    open: async (name: string) => ({
      match: async (url: string) => {
        const body = entries[name]?.[url]
        return body === undefined ? undefined : new Response(JSON.stringify(body))
      }
    })
  })
}

/** A browser that can run a service worker on a secure address. jsdom has neither. */
function stubServiceWorker() {
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: {} })
  vi.stubGlobal('isSecureContext', true)
}

function stubUserAgent(value: string) {
  Object.defineProperty(navigator, 'userAgent', { configurable: true, get: () => value })
}

function fireInstallOffer() {
  const offer = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
    prompt: vi.fn(async () => {}),
    userChoice: Promise.resolve({ outcome: 'accepted' as const })
  })
  window.dispatchEvent(offer)
  return offer
}

beforeAll(() => {
  initPwa()
})

afterEach(() => {
  vi.unstubAllGlobals()
  // Own properties the stubs added; the real ones live on Navigator.prototype and stay untouched.
  delete (navigator as unknown as Record<string, unknown>).serviceWorker
  delete (navigator as unknown as Record<string, unknown>).userAgent
  window.dispatchEvent(new Event('appinstalled')) // drops any offer a test left behind
})

describe('installState', () => {
  it('says to use the browser menu when nothing better is known', () => {
    stubServiceWorker()
    expect(installState()).toBe('menu')
  })

  it('cannot install without service-worker support (plain http, file://)', () => {
    expect(installState()).toBe('insecure')
  })

  it('points iPhone and iPad at Share -> Add to Home Screen', () => {
    stubServiceWorker()
    stubUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')
    expect(installState()).toBe('ios')
  })

  it('knows when it already runs as the installed app', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === '(display-mode: standalone)', media: query }))
    expect(installState()).toBe('installed')
  })

  it('offers the install dialog once the browser allows it', () => {
    stubServiceWorker()
    const offer = fireInstallOffer()
    expect(offer.defaultPrevented).toBe(true) // we show our own button, not the mini-infobar
    expect(installState()).toBe('ready')
  })
})

describe('promptInstall', () => {
  it('opens the browser dialog, reports the answer, and spends the offer', async () => {
    stubServiceWorker()
    const offer = fireInstallOffer()
    const seen = vi.fn()
    const stop = subscribeInstall(seen)

    expect(await promptInstall()).toBe(true)

    expect(offer.prompt).toHaveBeenCalledTimes(1)
    expect(seen).toHaveBeenCalled()
    expect(installState()).toBe('menu') // the offer works once
    expect(await promptInstall()).toBe(false)
    stop()
  })

  it('does nothing when there is no offer', async () => {
    expect(await promptInstall()).toBe(false)
  })

  it('forgets the offer after the app is installed', () => {
    stubServiceWorker()
    fireInstallOffer()
    window.dispatchEvent(new Event('appinstalled'))
    expect(installState()).not.toBe('ready')
  })
})

describe('offlineStatus', () => {
  it('is unsupported without service workers and the Cache API', async () => {
    expect((await offlineStatus()).phase).toBe('unsupported')
  })

  it('is still preparing before the worker has written its marker', async () => {
    stubServiceWorker()
    stubCaches({ [CACHE]: { [`${SCOPE}index-only`]: {} } })
    expect(await offlineStatus()).toEqual({ phase: 'preparing', files: 0, failed: 0 })
  })

  it('is ready when every file was saved', async () => {
    stubServiceWorker()
    stubCaches({ [CACHE]: { [`${SCOPE}__offline-ready.json`]: { build: 'abc123', files: 412, failed: 0 } } })
    expect(await offlineStatus()).toEqual({ phase: 'ready', files: 412, failed: 0 })
  })

  it('is partial when some files could not be fetched', async () => {
    stubServiceWorker()
    stubCaches({ [CACHE]: { [`${SCOPE}__offline-ready.json`]: { build: 'abc123', files: 412, failed: 3 } } })
    expect(await offlineStatus()).toEqual({ phase: 'partial', files: 412, failed: 3 })
  })

  it('ignores the caches of other apps and of other folders', async () => {
    stubServiceWorker()
    stubCaches({
      'qlct:http://localhost/webapp/other/:3': { [`${SCOPE}__offline-ready.json`]: { files: 9, failed: 0 } },
      [`mdpro:http://elsewhere/app/:abc`]: { [`${SCOPE}__offline-ready.json`]: { files: 9, failed: 0 } }
    })
    expect((await offlineStatus()).phase).toBe('preparing')
  })

  it('reads a damaged marker as "preparing" rather than throwing', async () => {
    stubServiceWorker()
    vi.stubGlobal('caches', {
      keys: async () => [CACHE],
      open: async () => ({ match: async () => new Response('not json') })
    })
    expect((await offlineStatus()).phase).toBe('preparing')
  })
})
