/**
 * Configuration that only the running server can know.
 *
 * Vite freezes `import.meta.env.VITE_*` into the bundle at build time. That is
 * fine for an app deployed from its own build, but this build also gets copied
 * into the FastAPI web-app collection and served from whatever host that backend
 * runs on. Any URL baked in here is therefore a URL from the *build* machine --
 * usually localhost -- while `API_PREFIX` is chosen when the server starts.
 *
 * The webapp controller injects the live values into the page instead, ahead of
 * this bundle. Precedence, highest first:
 *
 *   1. `window.__WEBAPP_CONFIG__`  - injected by the FastAPI webapp controller
 *   2. `import.meta.env.VITE_*`    - a standalone deployment, or the dev server
 *   3. same origin, no prefix      - which is also what the Vite dev proxy serves
 */

export interface WebappRuntimeConfig {
  /** Where the API routers are mounted: '' or something like '/api/v1'. */
  apiBase?: string
  /** Root of the app collection, e.g. '/webapp'. */
  webappBase?: string
  [key: string]: unknown
}

declare global {
  interface Window {
    __WEBAPP_CONFIG__?: WebappRuntimeConfig
  }
}

/** Whatever the server injected, or an empty object outside a browser. */
export function runtimeConfig(): WebappRuntimeConfig {
  if (typeof window === 'undefined') return {}
  return window.__WEBAPP_CONFIG__ ?? {}
}

function withoutTrailingSlash(value: string): string {
  let end = value.length
  while (end > 0 && value[end - 1] === '/') end -= 1
  return value.slice(0, end)
}

/**
 * Root that every API path is appended to.
 *
 * `buildTimeValue` is this app's own VITE_* setting, consulted only when the
 * server injected nothing. An injected empty string is a real answer -- it means
 * "same origin, no prefix" -- so it has to win over the build-time value instead
 * of being mistaken for a missing one.
 */
export function resolveApiBase(buildTimeValue?: string): string {
  const injected = runtimeConfig().apiBase
  if (typeof injected === 'string') return withoutTrailingSlash(injected)
  if (typeof buildTimeValue === 'string' && buildTimeValue !== '') {
    return withoutTrailingSlash(buildTimeValue)
  }
  return ''
}
