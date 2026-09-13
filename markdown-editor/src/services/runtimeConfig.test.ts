import { afterEach, describe, expect, it } from 'vitest'
import { resolveApiBase, runtimeConfig } from './runtimeConfig'

/**
 * The bridge between a frozen bundle and a live deployment.
 *
 * `import.meta.env.VITE_*` is compiled in when the app is built; the FastAPI
 * webapp controller injects the real values when it serves the page. These tests
 * pin down which one wins.
 */

const inject = (config: unknown) => {
  ;(window as unknown as { __WEBAPP_CONFIG__?: unknown }).__WEBAPP_CONFIG__ = config
}

afterEach(() => {
  delete (window as unknown as { __WEBAPP_CONFIG__?: unknown }).__WEBAPP_CONFIG__
})

describe('runtimeConfig', () => {
  it('is empty when the server injected nothing', () => {
    expect(runtimeConfig()).toEqual({})
  })

  it('returns what the server injected', () => {
    inject({ apiBase: '/api/v1', webappBase: '/webapp' })
    expect(runtimeConfig()).toEqual({ apiBase: '/api/v1', webappBase: '/webapp' })
  })
})

describe('resolveApiBase', () => {
  it('falls back to same origin when nothing is configured anywhere', () => {
    expect(resolveApiBase()).toBe('')
    expect(resolveApiBase('')).toBe('')
  })

  it('uses the build-time value when the server injected nothing', () => {
    expect(resolveApiBase('http://localhost:6789')).toBe('http://localhost:6789')
  })

  it('prefers the injected value over the build-time one', () => {
    // The whole point: a bundle built against localhost, served from production.
    inject({ apiBase: '/api/v1' })
    expect(resolveApiBase('http://localhost:6789')).toBe('/api/v1')
  })

  it('treats an injected empty string as a real answer, not a missing one', () => {
    // The backend ships API_PREFIX empty, meaning "same origin, no prefix".
    // Reading that as "unset" would send every call to the build machine's URL.
    inject({ apiBase: '' })
    expect(resolveApiBase('http://localhost:6789')).toBe('')
  })

  it('drops trailing slashes so paths do not double up', () => {
    inject({ apiBase: '/api/v1///' })
    expect(resolveApiBase()).toBe('/api/v1')
  })

  it('drops trailing slashes from the build-time value too', () => {
    expect(resolveApiBase('https://api.example.com/')).toBe('https://api.example.com')
  })

  it('ignores an injected value that is not a string', () => {
    inject({ apiBase: 42 })
    expect(resolveApiBase('http://localhost:6789')).toBe('http://localhost:6789')
  })
})
