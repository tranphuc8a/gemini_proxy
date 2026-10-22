/**
 * A timeout that counts only the time this page was free to notice a reply.
 *
 * A plain `setTimeout(abort, 10_000)` measures wall time. Opening a very long
 * document keeps the main thread busy for more than ten seconds, and when it
 * frees up the overdue timer can run before the reply -- which arrived long
 * ago -- is handled: the request is cancelled and the admin session check
 * reports "unreachable", dropping the owner to view-only (seen in M0's
 * benchmark, tasks/2610/261023/cai-tien-webapp/dot/M0.md, item 6).
 *
 * Here the budget is spent in short slices. A slice that took far longer than
 * asked means the page itself was blocked, and only a bounded part of it is
 * counted; a slow server still times out after `totalMs` of responsive time.
 */
export interface TimerHost {
  now: () => number
  setTimeout: (callback: () => void, ms: number) => unknown
  clearTimeout: (handle: unknown) => void
}

const browserHost: TimerHost = {
  now: () => Date.now(),
  setTimeout: (callback, ms) => setTimeout(callback, ms),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>)
}

export interface ResponsiveTimeoutOptions {
  /** Length of one slice. */
  sliceMs?: number
  /**
   * The most one slice may count, however long it really took. Above the
   * slice itself so that timers throttled in a background tab (about 1 s)
   * still count in full.
   */
  maxSliceMs?: number
  host?: TimerHost
}

/** Calls `onExpire` once `totalMs` of responsive time has passed; returns a function that cancels it. */
export function startResponsiveTimeout(totalMs: number, onExpire: () => void, options: ResponsiveTimeoutOptions = {}): () => void {
  const host = options.host ?? browserHost
  const sliceMs = Math.max(1, options.sliceMs ?? 500)
  const maxSliceMs = Math.max(sliceMs, options.maxSliceMs ?? sliceMs + 1000)
  let spent = 0
  let last = host.now()
  let handle: unknown = null
  let done = false

  const tick = () => {
    if (done) return
    const now = host.now()
    spent += Math.min(Math.max(0, now - last), maxSliceMs)
    last = now
    if (spent >= totalMs) {
      done = true
      onExpire()
      return
    }
    handle = host.setTimeout(tick, Math.min(sliceMs, totalMs - spent))
  }

  handle = host.setTimeout(tick, Math.min(sliceMs, totalMs))
  return () => {
    done = true
    if (handle !== null) host.clearTimeout(handle)
  }
}
