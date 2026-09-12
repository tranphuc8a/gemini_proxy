import { describe, expect, it, vi } from 'vitest'
import { createSyncLock, emitJump, emitScrollSync, lineForOffset, offsetForLine, onJump, onScrollSync } from '../paneSync'

const anchors = [
  { line: 1, top: 0 },
  { line: 10, top: 100 },
  { line: 20, top: 400 }
]

describe('offsetForLine', () => {
  it('returns the anchor position on an exact hit', () => {
    expect(offsetForLine(anchors, 10)).toBe(100)
  })

  it('interpolates between anchors', () => {
    expect(offsetForLine(anchors, 15)).toBe(250)
  })

  it('clamps outside the anchor range', () => {
    expect(offsetForLine(anchors, -4)).toBe(0)
    expect(offsetForLine(anchors, 999)).toBe(400)
  })

  it('is safe with no anchors', () => {
    expect(offsetForLine([], 5)).toBe(0)
  })

  it('survives duplicate anchor lines', () => {
    expect(offsetForLine([{ line: 3, top: 9 }, { line: 3, top: 40 }], 3)).toBe(9)
  })
})

describe('lineForOffset', () => {
  it('inverts offsetForLine at the anchors', () => {
    expect(lineForOffset(anchors, 100)).toBe(10)
    expect(lineForOffset(anchors, 400)).toBe(20)
  })

  it('interpolates between anchors', () => {
    expect(lineForOffset(anchors, 250)).toBe(15)
  })

  it('clamps outside the range', () => {
    expect(lineForOffset(anchors, -20)).toBe(1)
    expect(lineForOffset(anchors, 9000)).toBe(20)
    expect(lineForOffset([], 10)).toBe(1)
  })

  it('round-trips through offsetForLine', () => {
    for (const line of [1, 5, 10, 14, 20]) {
      expect(lineForOffset(anchors, offsetForLine(anchors, line))).toBe(line)
    }
  })
})

describe('sync lock', () => {
  it('is engaged only inside its window', () => {
    vi.useFakeTimers()
    const lock = createSyncLock(100)
    expect(lock.locked).toBe(false)
    lock.engage()
    expect(lock.locked).toBe(true)
    vi.advanceTimersByTime(150)
    expect(lock.locked).toBe(false)
    vi.useRealTimers()
  })
})

describe('event bus', () => {
  it('delivers scroll events and unsubscribes cleanly', () => {
    const seen: number[] = []
    const off = onScrollSync((event) => seen.push(event.line))
    emitScrollSync({ line: 7, source: 'editor' })
    off()
    emitScrollSync({ line: 9, source: 'editor' })
    expect(seen).toEqual([7])
  })

  it('delivers jump events', () => {
    const listener = vi.fn()
    const off = onJump(listener)
    emitJump({ line: 3, source: 'preview' })
    expect(listener).toHaveBeenCalledWith({ line: 3, source: 'preview' })
    off()
  })
})
