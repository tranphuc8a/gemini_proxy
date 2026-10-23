import { parseShareHash, type ShareAddress } from './lib/share'
import { resolveApiBase } from './services/runtimeConfig'

/**
 * Start-up fork (md-share V11): a read-only link (`#share=<token>&backend=<store>`) opens the shared page, anything
 * else the editor. Decided before React renders anything, so a visitor holding a link never runs the editor: no
 * service worker (5 MB of offline cache just to read one page), no local workspace, no admin session.
 *
 * The shared page is hardened first: `noindex`, no referrer, and a Content-Security-Policy meta. The server injects
 * `window.__WEBAPP_CONFIG__` with an inline script; it has already run when this module runs, and a CSP meta only
 * governs what comes after it is inserted.
 */

export interface BootDeps {
  renderApp: () => void
  renderShare: (address: ShareAddress) => void | Promise<void>
  initPwa: () => void
}

/** The origin of the API when it is not the page's own (an absolute `apiBase`), for `connect-src`. */
export function apiOriginOf(apiBase: string, pageOrigin: string): string | null {
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(apiBase)) return null
  try {
    const origin = new URL(apiBase).origin
    return origin && origin !== 'null' && origin !== pageOrigin ? origin : null
  } catch {
    return null
  }
}

/**
 * The shared page's policy. `script-src 'self'`: only the app's own bundles (no inline script, no eval -- KaTeX and
 * Mermaid need neither). `style-src 'unsafe-inline'`: React style attributes, KaTeX and Mermaid's SVG styles.
 * `font-src 'self' data:`: KaTeX fonts. `img-src https: data: blob:`: pictures in the document (no plain http).
 * `connect-src`: this origin (and the API's when it lives elsewhere) -- diagrams are drawn offline, never via a server.
 */
export function contentSecurityPolicy(apiOrigin: string | null): string {
  return [
    "default-src 'none'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "media-src 'self' https:",
    "font-src 'self' data:",
    `connect-src 'self'${apiOrigin ? ` ${apiOrigin}` : ''}`,
    "manifest-src 'self'",
    "base-uri 'none'",
    "form-action 'none'",
    "object-src 'none'",
    "frame-src 'none'"
  ].join('; ')
}

function meta(doc: Document, attributes: Record<string, string>): HTMLMetaElement {
  const element = doc.createElement('meta')
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value)
  return element
}

/** Robots, referrer and CSP metas, first in <head>. Idempotent. */
export function hardenSharePage(doc: Document = document, apiBase: string = resolveApiBase(), pageOrigin: string = location.origin): void {
  if (doc.head.querySelector('meta[data-share-hardening]')) return
  const metas = [
    meta(doc, { name: 'robots', content: 'noindex, nofollow, noarchive', 'data-share-hardening': '' }),
    meta(doc, { name: 'referrer', content: 'no-referrer', 'data-share-hardening': '' }),
    meta(doc, { 'http-equiv': 'Content-Security-Policy', content: contentSecurityPolicy(apiOriginOf(apiBase, pageOrigin)), 'data-share-hardening': '' })
  ]
  const first = doc.head.firstChild
  for (const element of metas) doc.head.insertBefore(element, first)
}

/** Did the address switch between the editor and a link (or between two links)? Then the page must start over. */
export function needsRestart(started: ShareAddress | null, hash: string): boolean {
  const next = parseShareHash(hash)
  if (!started || !next) return Boolean(started) !== Boolean(next)
  return started.token !== next.token || started.backend !== next.backend
}

/** Renders the editor or the shared page; returns which. */
export function startApp(deps: BootDeps, win: Window = window): 'app' | 'share' {
  const address = parseShareHash(win.location.hash)
  if (address) {
    hardenSharePage(win.document, resolveApiBase(), win.location.origin)
    void deps.renderShare(address)
  } else {
    deps.initPwa()
    deps.renderApp()
  }
  // Pasting a link into a tab that already shows the editor only changes the hash: start over, or the visitor sees
  // the editor's state under a share address (and the editor would never have been hardened).
  win.addEventListener('hashchange', () => {
    if (needsRestart(address, win.location.hash)) win.location.reload()
  })
  return address ? 'share' : 'app'
}
