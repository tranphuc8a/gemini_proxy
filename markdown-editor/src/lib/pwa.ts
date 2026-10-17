/**
 * Installing the editor as an app, and knowing whether it will open with no network.
 *
 * The service worker (pwa/sw.js, finished by scripts/make-sw.mjs) does the saving. This module is
 * the page's half: register it, keep the browser's install offer, and read back how far the worker got.
 *
 * Nothing here runs in the dev server or the tests -- `initPwa` registers only in a production build,
 * because a worker in development would keep serving yesterday's modules.
 */

/**
 * installed  running as the installed app (own window / home screen)
 * ready      the browser allows installing now; `promptInstall` opens its dialog
 * ios        iPhone/iPad have no install dialog: Share -> Add to Home Screen
 * insecure   not HTTPS (or localhost), or no service-worker support: nothing can be installed
 * menu       everything else: install from the browser's own menu
 */
export type InstallState = 'installed' | 'ready' | 'ios' | 'insecure' | 'menu'

/**
 * preparing    the worker has not finished saving the app yet (first visit, or still downloading)
 * ready        every file is saved: the app opens with no network
 * partial      saved, but some files could not be fetched; reconnect and reload to finish
 * unsupported  this browser or address cannot keep an offline copy
 */
export interface OfflineStatus {
  phase: 'preparing' | 'ready' | 'partial' | 'unsupported'
  files: number
  failed: number
}

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/** Cache name prefix and marker file; both are written by pwa/sw.js and must stay in step with it. */
const CACHE_PREFIX = 'mdpro:'
const READY_FILE = '__offline-ready.json'

let offer: InstallPromptEvent | null = null
const listeners = new Set<() => void>()

function notify(): void {
  listeners.forEach((listener) => {
    try {
      listener()
    } catch {
      /* one broken listener must not silence the others */
    }
  })
}

/** Called when the install offer, or whether the app is installed, changes. Returns the unsubscribe. */
export function subscribeInstall(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function runsStandalone(): boolean {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
  return iosStandalone || window.matchMedia?.('(display-mode: standalone)').matches === true
}

function onIos(): boolean {
  const ua = navigator.userAgent || ''
  // iPadOS reports itself as a Mac, so the touch points are what give it away.
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
}

export function installState(): InstallState {
  if (runsStandalone()) return 'installed'
  if (offer) return 'ready'
  if (!window.isSecureContext || !/^https?:$/.test(location.protocol) || !('serviceWorker' in navigator)) return 'insecure'
  return onIos() ? 'ios' : 'menu'
}

/** Opens the browser's install dialog. True when the person accepted. The offer is single-use. */
export async function promptInstall(): Promise<boolean> {
  if (!offer) return false
  const pending = offer
  offer = null
  try {
    await pending.prompt()
    const choice = await pending.userChoice
    return choice.outcome === 'accepted'
  } catch {
    return false
  } finally {
    notify()
  }
}

/** The folder the app is served from, with the trailing slash the worker's scope has. */
function appScope(): string {
  return new URL('./', document.baseURI).href
}

/** How far the worker got saving this app. Never throws: any failure reads as "not ready yet". */
export async function offlineStatus(): Promise<OfflineStatus> {
  const unsupported: OfflineStatus = { phase: 'unsupported', files: 0, failed: 0 }
  if (!('serviceWorker' in navigator) || !('caches' in window) || !window.isSecureContext) return unsupported
  try {
    const scope = appScope()
    for (const name of await caches.keys()) {
      if (!name.startsWith(`${CACHE_PREFIX}${scope}:`)) continue
      const marker = await (await caches.open(name)).match(scope + READY_FILE)
      if (!marker) continue
      const body = (await marker.json()) as { files?: unknown; failed?: unknown }
      const files = typeof body.files === 'number' ? body.files : 0
      const failed = typeof body.failed === 'number' ? body.failed : 0
      return { phase: failed > 0 ? 'partial' : 'ready', files, failed }
    }
  } catch {
    /* fall through to "preparing" */
  }
  return { phase: 'preparing', files: 0, failed: 0 }
}

/**
 * Wire up install prompts and register the worker. Called once from main.tsx.
 *
 * The listeners attach in every build (so the unit tests of the UI can drive them); registration is
 * production-only and needs http(s) -- file:// has no service workers.
 */
export function initPwa(): void {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    offer = event as InstallPromptEvent
    notify()
  })
  window.addEventListener('appinstalled', () => {
    offer = null
    notify()
  })

  if (!import.meta.env.PROD || !('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return
  const register = () => {
    navigator.serviceWorker.register('./sw.js').catch((error: unknown) => {
      console.warn('Could not register the service worker:', error instanceof Error ? error.message : error)
    })
  }
  // After load, so saving a few megabytes does not compete with the first paint.
  if (document.readyState === 'complete') register()
  else window.addEventListener('load', register, { once: true })
}
