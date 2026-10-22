import { describe, expect, it, vi } from 'vitest'
import { startResponsiveTimeout, type TimerHost } from '../responsiveTimeout'

/**
 * A hand-cranked clock: `advance` moves time and runs due timers in order, and `block` moves time
 * without running anything -- the main thread busy with a long render -- as a real tab would.
 */
function fakeHost() {
  let now = 0
  let seq = 0
  const timers = new Map<number, { at: number; callback: () => void }>()
  const host: TimerHost = {
    now: () => now,
    setTimeout: (callback, ms) => {
      seq += 1
      timers.set(seq, { at: now + ms, callback })
      return seq
    },
    clearTimeout: (handle) => {
      timers.delete(handle as number)
    }
  }
  const runDue = () => {
    for (;;) {
      const due = [...timers.entries()].filter(([, timer]) => timer.at <= now).sort((a, b) => a[1].at - b[1].at)[0]
      if (!due) return
      timers.delete(due[0])
      due[1].callback()
    }
  }
  return {
    host,
    pending: () => timers.size,
    advance(ms: number) {
      const end = now + ms
      for (;;) {
        const next = Math.min(...[...timers.values()].map((timer) => timer.at), Infinity)
        if (next > end) break
        now = Math.max(now, next)
        runDue()
      }
      now = end
    },
    /** Time passes while the page runs one long task; overdue timers fire only afterwards. */
    block(ms: number) {
      now += ms
      runDue()
    }
  }
}

describe('startResponsiveTimeout', () => {
  it('expires after the full budget when the page stays responsive', () => {
    const clock = fakeHost()
    const expire = vi.fn()
    startResponsiveTimeout(10_000, expire, { host: clock.host })
    clock.advance(9_900)
    expect(expire).not.toHaveBeenCalled()
    clock.advance(100)
    expect(expire).toHaveBeenCalledTimes(1)
    clock.advance(20_000)
    expect(expire).toHaveBeenCalledTimes(1)
  })

  it('does not count a long main-thread block against the budget', () => {
    // The M0 failure: opening a huge document kept the page busy for over ten seconds. A wall-clock timer
    // was overdue by then and cancelled the session check whose reply was already waiting.
    const clock = fakeHost()
    const expire = vi.fn()
    startResponsiveTimeout(10_000, expire, { host: clock.host })
    clock.advance(200)
    clock.block(25_000)
    expect(expire).not.toHaveBeenCalled()
    // Only one bounded slice of the block counted; the rest of the budget is still there.
    clock.advance(7_000)
    expect(expire).not.toHaveBeenCalled()
    clock.advance(3_000)
    expect(expire).toHaveBeenCalledTimes(1)
  })

  it('still counts timers throttled to about a second in a background tab', () => {
    const clock = fakeHost()
    const expire = vi.fn()
    startResponsiveTimeout(10_000, expire, { host: clock.host, sliceMs: 500 })
    // Each 500 ms slice actually fires a second later: every one counts in full.
    for (let tick = 0; tick < 10; tick += 1) clock.block(1_000)
    expect(expire).toHaveBeenCalledTimes(1)
  })

  it('stops cleanly when cancelled', () => {
    const clock = fakeHost()
    const expire = vi.fn()
    const stop = startResponsiveTimeout(1_000, expire, { host: clock.host })
    clock.advance(400)
    stop()
    expect(clock.pending()).toBe(0)
    clock.advance(5_000)
    expect(expire).not.toHaveBeenCalled()
  })

  it('works on the real timers too', async () => {
    vi.useFakeTimers()
    try {
      const expire = vi.fn()
      startResponsiveTimeout(2_000, expire)
      await vi.advanceTimersByTimeAsync(1_900)
      expect(expire).not.toHaveBeenCalled()
      await vi.advanceTimersByTimeAsync(200)
      expect(expire).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })
})
