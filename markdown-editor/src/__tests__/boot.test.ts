import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiOriginOf, contentSecurityPolicy, hardenSharePage, needsRestart, startApp } from '../boot'

/** md-share V11: the start-up fork between the editor and a read-only link's page. */
const TOKEN = 'AbCdEfGhIjKlMnOpQrStUv'

function fakeWindow(hash: string) {
  const listeners: Record<string, (() => void)[]> = {}
  const reload = vi.fn()
  const win = {
    location: { hash, origin: 'http://127.0.0.1:8000', reload },
    document,
    addEventListener: (type: string, listener: () => void) => {
      ;(listeners[type] ??= []).push(listener)
    }
  }
  const fire = (type: string) => listeners[type]?.forEach((listener) => listener())
  return { win: win as unknown as Window, reload, fire, location: win.location }
}

function clearHardening() {
  document.head.querySelectorAll('meta[data-share-hardening]').forEach((node) => node.remove())
}

beforeEach(clearHardening)
afterEach(() => {
  clearHardening()
  delete window.__WEBAPP_CONFIG__
})

describe('startApp', () => {
  it('a #share= address renders the shared page, hardened, and never registers the service worker', () => {
    const { win } = fakeWindow(`#share=${TOKEN}&backend=json`)
    const deps = { initPwa: vi.fn(), renderApp: vi.fn(), renderShare: vi.fn() }
    expect(startApp(deps, win)).toBe('share')
    expect(deps.initPwa).not.toHaveBeenCalled()
    expect(deps.renderApp).not.toHaveBeenCalled()
    expect(deps.renderShare).toHaveBeenCalledWith({ token: TOKEN, backend: 'json' })
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toMatch(/noindex/)
    expect(document.head.querySelector('meta[name="referrer"]')?.getAttribute('content')).toBe('no-referrer')
    const csp = document.head.querySelector('meta[http-equiv="Content-Security-Policy"]')?.getAttribute('content') ?? ''
    expect(csp).toContain("script-src 'self'")
    expect(csp).toContain("font-src 'self' data:")
    expect(csp).not.toContain('unsafe-eval')
    expect(document.head.firstElementChild?.hasAttribute('data-share-hardening')).toBe(true)
  })

  it('any other address renders the editor and registers the service worker, with no share metas', () => {
    const { win } = fakeWindow('')
    const deps = { initPwa: vi.fn(), renderApp: vi.fn(), renderShare: vi.fn() }
    expect(startApp(deps, win)).toBe('app')
    expect(deps.initPwa).toHaveBeenCalledTimes(1)
    expect(deps.renderApp).toHaveBeenCalledTimes(1)
    expect(deps.renderShare).not.toHaveBeenCalled()
    expect(document.head.querySelector('meta[data-share-hardening]')).toBeNull()
  })

  it('an in-page anchor named "share" (a heading "Share", or [x](#share)) is the editor, never an empty share link', () => {
    for (const hash of ['#share', '#share=', '#share=&backend=json']) {
      const { win, reload, fire, location } = fakeWindow(hash)
      const deps = { initPwa: vi.fn(), renderApp: vi.fn(), renderShare: vi.fn() }
      expect(startApp(deps, win)).toBe('app')
      expect(deps.renderShare).not.toHaveBeenCalled()
      expect(document.head.querySelector('meta[data-share-hardening]')).toBeNull()
      // Clicking such an anchor inside the editor only changes the hash: it must not reload into "Link not available".
      location.hash = '#share'
      fire('hashchange')
      location.hash = '#share='
      fire('hashchange')
      expect(reload, hash).not.toHaveBeenCalled()
      expect(needsRestart(null, hash)).toBe(false)
    }
  })

  it('pasting a link into the editor tab (hash change only) starts over; an ordinary anchor does not', () => {
    const { win, reload, fire, location } = fakeWindow('')
    startApp({ initPwa: vi.fn(), renderApp: vi.fn(), renderShare: vi.fn() }, win)
    location.hash = '#section-2'
    fire('hashchange')
    expect(reload).not.toHaveBeenCalled()
    location.hash = `#share=${TOKEN}&backend=json`
    fire('hashchange')
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('leaving a link, or switching to another link, starts over too', () => {
    expect(needsRestart({ token: TOKEN, backend: 'json' }, '')).toBe(true)
    expect(needsRestart({ token: TOKEN, backend: 'json' }, `#share=${TOKEN}&backend=json`)).toBe(false)
    expect(needsRestart({ token: TOKEN, backend: 'json' }, `#share=${TOKEN}&backend=mysql`)).toBe(true)
    expect(needsRestart({ token: TOKEN, backend: 'json' }, '#share=BbCdEfGhIjKlMnOpQrStUv&backend=json')).toBe(true)
    expect(needsRestart(null, '#x')).toBe(false)
  })
})

describe('hardening details', () => {
  it('adds the API origin to connect-src only when the API lives elsewhere', () => {
    expect(apiOriginOf('/api/v1', 'http://a')).toBeNull()
    expect(apiOriginOf('', 'http://a')).toBeNull()
    expect(apiOriginOf('http://a/api/v1', 'http://a')).toBeNull()
    expect(apiOriginOf('https://api.example.com/api/v1', 'http://a')).toBe('https://api.example.com')
    expect(contentSecurityPolicy(null)).toContain("connect-src 'self';")
    expect(contentSecurityPolicy('https://api.example.com')).toContain("connect-src 'self' https://api.example.com;")
    expect(contentSecurityPolicy(null)).toContain("default-src 'none'")
    expect(contentSecurityPolicy(null)).toContain("object-src 'none'")
  })

  it('is idempotent', () => {
    hardenSharePage(document, '/api/v1', 'http://a')
    hardenSharePage(document, '/api/v1', 'http://a')
    expect(document.head.querySelectorAll('meta[data-share-hardening]')).toHaveLength(3)
  })
})
