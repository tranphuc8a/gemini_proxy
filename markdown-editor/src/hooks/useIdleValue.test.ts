import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useIdleValue } from './useIdleValue'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('useIdleValue', () => {
  it('starts with the real value, never a stale one', () => {
    const { result } = renderHook(() => useIdleValue('first', 400))
    expect(result.current).toBe('first')
  })

  it('collapses a burst of changes into one, after the value stops changing', () => {
    const { result, rerender } = renderHook(({ value }) => useIdleValue(value, 400), { initialProps: { value: 'a' } })
    for (const value of ['ab', 'abc', 'abcd']) {
      rerender({ value })
      act(() => vi.advanceTimersByTime(300))
      expect(result.current).toBe('a')
    }
    act(() => vi.advanceTimersByTime(400))
    expect(result.current).toBe('abcd')
  })

  it('takes a new value at once when the reset key changes (another file was opened)', () => {
    const { result, rerender } = renderHook(({ value, key }) => useIdleValue(value, 400, key), {
      initialProps: { value: 'file a', key: 'a' }
    })
    rerender({ value: 'file a, edited', key: 'a' })
    expect(result.current).toBe('file a')
    rerender({ value: 'file b', key: 'b' })
    expect(result.current).toBe('file b')
    // Nothing from the first file arrives later either.
    act(() => vi.advanceTimersByTime(1000))
    expect(result.current).toBe('file b')
    // And within the new file, edits are held back again.
    rerender({ value: 'file b, edited', key: 'b' })
    expect(result.current).toBe('file b')
    act(() => vi.advanceTimersByTime(400))
    expect(result.current).toBe('file b, edited')
  })

  it('drops a pending update when the value returns to the settled one', () => {
    const { result, rerender } = renderHook(({ value }) => useIdleValue(value, 400), { initialProps: { value: 'x' } })
    rerender({ value: 'y' })
    rerender({ value: 'x' })
    act(() => vi.advanceTimersByTime(1000))
    expect(result.current).toBe('x')
  })
})
